// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Agent Execution Service
 *
 * Handles the full agent lifecycle:
 * - Load config via ConfigLoaderService
 * - Load prompt template using AGENTS[agentName].promptTemplate
 * - Create git checkpoint
 * - Start audit logging
 * - Invoke Claude SDK via runClaudePrompt
 * - Spending cap check using isSpendingCapBehavior
 * - Handle failure (rollback, audit)
 * - Validate output using AGENTS[agentName].deliverableFilename
 * - Commit on success, log metrics
 *
 * No Temporal dependencies - pure domain logic.
 */

import { fs, path } from 'zx';
import { type ClaudePromptResult, runClaudePrompt, validateAgentOutput } from '../ai/claude-executor.js';
import { getOutputFormat, getQueueFilename } from '../ai/queue-schemas.js';
import type { AuditSession } from '../audit/index.js';
import { AGENTS } from '../session-manager.js';
import type { ActivityLogger } from '../types/activity-logger.js';
import type { AgentName } from '../types/agents.js';
import type { AgentEndResult } from '../types/audit.js';
import { ErrorCode, type PentestErrorType } from '../types/errors.js';
import type { AgentMetrics } from '../types/metrics.js';
import { err, isErr, ok, type Result } from '../types/result.js';
import { isSpendingCapBehavior } from '../utils/billing-detection.js';
import type { BlastRadiusTracker } from './blast-radius.js';
import type { ConfigLoaderService } from './config-loader.js';
import { PentestError } from './error-handling.js';
import { commitGitSuccess, createGitCheckpoint, getGitCommitHash, rollbackGitWorkspace } from './git-manager.js';
import type { ModeDispatcher } from './mode-dispatcher.js';
import { loadPrompt } from './prompt-manager.js';

/**
 * Input for agent execution.
 */
export interface AgentExecutionInput {
  webUrl: string;
  repoPath: string;
  deliverablesPath: string;
  configPath?: string | undefined;
  configData?: import('../types/config.js').DistributedConfig | undefined;
  configYAML?: string | undefined;
  pipelineTestingMode?: boolean | undefined;
  attemptNumber: number;
  apiKey?: string | undefined;
  promptDir?: string | undefined;
  providerConfig?: import('../types/config.js').ProviderConfig | undefined;
  brainHints?: string | undefined;
  previousEngagementMemory?: string | undefined;
}

interface FailAgentOpts {
  attemptNumber: number;
  result: ClaudePromptResult;
  rollbackReason: string;
  errorMessage: string;
  errorCode: ErrorCode;
  category: PentestErrorType;
  retryable: boolean;
  context: Record<string, unknown>;
}

/**
 * Service for executing agents with full lifecycle management.
 *
 * NOTE: AuditSession is passed per-execution, NOT stored on the service.
 * This is critical for parallel agent execution - each agent needs its own
 * AuditSession instance because AuditSession uses instance state (currentAgentName)
 * to track which agent is currently logging.
 */
export class AgentExecutionService {
  private readonly configLoader: ConfigLoaderService;
  private readonly modeDispatcher: ModeDispatcher | undefined;
  private readonly blastRadiusTracker: BlastRadiusTracker | undefined;

  constructor(
    configLoader: ConfigLoaderService,
    modeDispatcher?: ModeDispatcher,
    blastRadiusTracker?: BlastRadiusTracker,
  ) {
    this.configLoader = configLoader;
    this.modeDispatcher = modeDispatcher;
    this.blastRadiusTracker = blastRadiusTracker;
  }

  /**
   * Execute an agent with full lifecycle management.
   *
   * @param agentName - Name of the agent to execute
   * @param input - Execution input parameters
   * @param auditSession - Audit session for this specific agent execution
   * @returns Result containing AgentEndResult on success, PentestError on failure
   */
  async execute(
    agentName: AgentName,
    input: AgentExecutionInput,
    auditSession: AuditSession,
    logger: ActivityLogger,
  ): Promise<Result<AgentEndResult, PentestError>> {
    const {
      webUrl,
      repoPath,
      deliverablesPath,
      configPath,
      configData,
      configYAML,
      pipelineTestingMode = false,
      attemptNumber,
      apiKey,
      promptDir,
      providerConfig,
      brainHints,
      previousEngagementMemory,
    } = input;

    // 0. Mode gate — block agents that require a higher engagement mode
    if (this.modeDispatcher && !pipelineTestingMode) {
      const agentDef = AGENTS[agentName];
      const modeCheck = this.modeDispatcher.assertCanRun(agentName, agentDef.required_mode);
      if (isErr(modeCheck)) {
        logger.warn(`Agent ${agentName} blocked by mode dispatcher`, {
          required: agentDef.required_mode,
          current: this.modeDispatcher.mode,
        });
        return err(modeCheck.error);
      }
    }

    // 1. Load config (pre-parsed configData → raw YAML → file path)
    const configResult = await this.configLoader.loadOptional(configPath, configData, configYAML);
    if (isErr(configResult)) {
      return configResult;
    }
    const distributedConfig = configResult.value;

    // 2. Load prompt
    const promptTemplate = AGENTS[agentName].promptTemplate;
    let prompt: string;
    try {
      prompt = await loadPrompt(
        promptTemplate,
        {
          webUrl,
          repoPath,
          ...(this.blastRadiusTracker && { blastRadiusRemainingMb: this.blastRadiusTracker.contextVar() }),
          ...(brainHints !== undefined && { brainHints }),
          ...(previousEngagementMemory !== undefined && { previousMemory: previousEngagementMemory }),
        },
        distributedConfig,
        pipelineTestingMode,
        logger,
        promptDir,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return err(
        new PentestError(
          `Failed to load prompt for ${agentName}: ${errorMessage}`,
          'prompt',
          false,
          { agentName, promptTemplate, originalError: errorMessage },
          ErrorCode.PROMPT_LOAD_FAILED,
        ),
      );
    }

    // 3. Create git checkpoint before execution
    try {
      await createGitCheckpoint(deliverablesPath, agentName, attemptNumber, logger);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return err(
        new PentestError(
          `Failed to create git checkpoint for ${agentName}: ${errorMessage}`,
          'filesystem',
          false,
          { agentName, deliverablesPath, originalError: errorMessage },
          ErrorCode.GIT_CHECKPOINT_FAILED,
        ),
      );
    }

    // 4. Start audit logging
    await auditSession.startAgent(agentName, prompt, attemptNumber);

    // 5. Execute agent
    const outputFormat = getOutputFormat(agentName);
    const result: ClaudePromptResult = await runClaudePrompt(
      prompt,
      repoPath,
      '', // context
      agentName, // description
      agentName,
      auditSession,
      logger,
      AGENTS[agentName].modelTier,
      outputFormat,
      apiKey,
      path.relative(repoPath, deliverablesPath),
      providerConfig,
    );

    // 6. Spending cap check - defense-in-depth
    if (result.success && (result.turns ?? 0) <= 2 && (result.cost || 0) === 0) {
      const resultText = result.result || '';
      if (isSpendingCapBehavior(result.turns ?? 0, result.cost || 0, resultText)) {
        return this.failAgent(agentName, deliverablesPath, auditSession, logger, {
          attemptNumber,
          result,
          rollbackReason: 'spending cap detected',
          errorMessage: `Spending cap likely reached: ${resultText.slice(0, 100)}`,
          errorCode: ErrorCode.SPENDING_CAP_REACHED,
          category: 'billing',
          retryable: true,
          context: { agentName, turns: result.turns, cost: result.cost },
        });
      }
    }

    // 7. Handle execution failure
    if (!result.success) {
      return this.failAgent(agentName, deliverablesPath, auditSession, logger, {
        attemptNumber,
        result,
        rollbackReason: 'execution failure',
        errorMessage: result.error || 'Agent execution failed',
        errorCode: ErrorCode.AGENT_EXECUTION_FAILED,
        category: 'validation',
        retryable: result.retryable ?? true,
        context: { agentName, originalError: result.error },
      });
    }

    // 8. Write structured output to disk (vuln agents only)
    const queueFilename = getQueueFilename(agentName);
    if (result.structuredOutput !== undefined && queueFilename) {
      await fs.ensureDir(deliverablesPath);
      const queuePath = path.join(deliverablesPath, queueFilename);
      await fs.writeFile(queuePath, JSON.stringify(result.structuredOutput, null, 2), 'utf8');
      logger.info(`Wrote structured output queue to ${queueFilename}`);
    }

    // 9. Validate output
    const validationPassed = await validateAgentOutput(result, agentName, deliverablesPath, logger);
    if (!validationPassed) {
      return this.failAgent(agentName, deliverablesPath, auditSession, logger, {
        attemptNumber,
        result,
        rollbackReason: 'validation failure',
        errorMessage: `Agent ${agentName} failed output validation`,
        errorCode: ErrorCode.OUTPUT_VALIDATION_FAILED,
        category: 'validation',
        retryable: true,
        context: { agentName, deliverableFilename: AGENTS[agentName].deliverableFilename },
      });
    }

    // 9b. Track deliverable against evidence budget
    if (this.blastRadiusTracker) {
      const deliverableFile = path.join(deliverablesPath, AGENTS[agentName].deliverableFilename);
      try {
        const deliverableContent = await fs.readFile(deliverableFile, 'utf8');
        const tracked = this.blastRadiusTracker.trackEvidence(deliverableContent, agentName, logger);
        if (isErr(tracked)) {
          const notice =
            `[EVIDENCE BUDGET EXHAUSTED]\n${tracked.error.message}\n\n---\n` + `${deliverableContent.slice(0, 500)}`;
          await fs.writeFile(deliverableFile, notice, 'utf8');
          logger.warn(`Evidence budget exhausted — deliverable truncated for ${agentName}`);
        } else if (tracked.value !== deliverableContent) {
          await fs.writeFile(deliverableFile, tracked.value, 'utf8');
        }
      } catch {
        logger.warn(`Blast-radius tracking failed for ${agentName} — continuing`);
      }
    }

    // 10. Success - commit deliverables, then capture checkpoint hash
    await commitGitSuccess(deliverablesPath, agentName, logger);
    const commitHash = await getGitCommitHash(deliverablesPath);

    const endResult: AgentEndResult = {
      attemptNumber,
      duration_ms: result.duration,
      cost_usd: result.cost || 0,
      success: true,
      model: result.model,
      ...(commitHash && { checkpoint: commitHash }),
    };
    await auditSession.endAgent(agentName, endResult);

    return ok(endResult);
  }

  private async failAgent(
    agentName: AgentName,
    deliverablesPath: string,
    auditSession: AuditSession,
    logger: ActivityLogger,
    opts: FailAgentOpts,
  ): Promise<Result<AgentEndResult, PentestError>> {
    await rollbackGitWorkspace(deliverablesPath, opts.rollbackReason, logger);

    const endResult: AgentEndResult = {
      attemptNumber: opts.attemptNumber,
      duration_ms: opts.result.duration,
      cost_usd: opts.result.cost || 0,
      success: false,
      model: opts.result.model,
      error: opts.errorMessage,
    };
    await auditSession.endAgent(agentName, endResult);

    return err(new PentestError(opts.errorMessage, opts.category, opts.retryable, opts.context, opts.errorCode));
  }

  /**
   * Execute an agent, throwing PentestError on failure.
   *
   * This is the preferred method for Temporal activities, which need to
   * catch errors and classify them into ApplicationFailure. Avoids requiring
   * activities to import Result utilities, keeping the boundary clean.
   *
   * @param agentName - Name of the agent to execute
   * @param input - Execution input parameters
   * @param auditSession - Audit session for this specific agent execution
   * @returns AgentEndResult on success
   * @throws PentestError on failure
   */
  async executeOrThrow(
    agentName: AgentName,
    input: AgentExecutionInput,
    auditSession: AuditSession,
    logger: ActivityLogger,
  ): Promise<AgentEndResult> {
    const result = await this.execute(agentName, input, auditSession, logger);
    if (isErr(result)) {
      throw result.error;
    }
    return result.value;
  }

  /**
   * Convert AgentEndResult to AgentMetrics for workflow state.
   */
  static toMetrics(endResult: AgentEndResult, result: ClaudePromptResult): AgentMetrics {
    return {
      durationMs: endResult.duration_ms,
      inputTokens: null, // Not currently exposed by SDK wrapper
      outputTokens: null,
      costUsd: endResult.cost_usd,
      numTurns: result.turns ?? null,
      model: result.model,
    };
  }
}

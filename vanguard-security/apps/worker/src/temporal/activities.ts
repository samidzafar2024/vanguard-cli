// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Temporal activities for Vanguard agent execution.
 *
 * Each activity wraps service calls with Temporal-specific concerns:
 * - Heartbeat loop (2s interval) to signal worker liveness
 * - Error classification into ApplicationFailure
 * - Container lifecycle management
 *
 * Business logic is delegated to services in src/services/.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { ApplicationFailure, Context, heartbeat } from '@temporalio/activity';
import { AuditSession } from '../audit/index.js';
import type { ResumeAttempt } from '../audit/metrics-tracker.js';
import type { SessionMetadata } from '../audit/utils.js';
import type { WorkflowSummary } from '../audit/workflow-logger.js';
import type { CheckpointContext } from '../interfaces/checkpoint-provider.js';
import { DEFAULT_DELIVERABLES_SUBDIR, deliverablesDir } from '../paths.js';
import { getContainer, getOrCreateContainer, removeContainer } from '../services/container.js';
import {
  formatMemoryForPrompt,
  loadDomainMemory,
  saveEngagementFindings,
} from '../services/engagement-memory.js';
import { loadEngagement } from '../services/engagement-loader.js';
import { classifyErrorForTemporal, PentestError } from '../services/error-handling.js';
import { ExploitationCheckerService } from '../services/exploitation-checker.js';
import { executeGitCommandWithRetry } from '../services/git-manager.js';
import { runEngagementPreflight, runPreflightChecks } from '../services/preflight.js';
import type { ExploitationDecision, VulnType } from '../services/queue-validation.js';
import { assembleFinalReport, injectModelIntoReport } from '../services/reporting.js';
import { AGENTS } from '../session-manager.js';
import type { AgentName } from '../types/agents.js';
import { ALL_AGENTS } from '../types/agents.js';
import type { ContainerConfig, ProviderConfig } from '../types/config.js';
import { ErrorCode } from '../types/errors.js';
import { isErr } from '../types/result.js';
import { fileExists, readJson } from '../utils/file-io.js';
import { createActivityLogger } from './activity-logger.js';
import type { AgentMetrics, PipelineState, ResumeState } from './shared.js';

// Max lengths to prevent Temporal protobuf buffer overflow
const MAX_ERROR_MESSAGE_LENGTH = 2000;
const MAX_STACK_TRACE_LENGTH = 1000;

// Max retries for output validation errors (agent didn't save deliverables)
const MAX_OUTPUT_VALIDATION_RETRIES = 3;

const HEARTBEAT_INTERVAL_MS = 2000;

/**
 * Input for all agent activities.
 *
 * Config fields are optional with sensible defaults. When provided, they
 * flow through to getOrCreateContainer() for path and credential configuration.
 */
export interface ActivityInput {
  webUrl: string;
  reconUrl?: string; // Separate URL for OSINT/recon phases (default: webUrl)
  repoPath: string;
  configPath?: string;
  outputPath?: string;
  pipelineTestingMode?: boolean;
  workflowId: string;
  sessionId: string;

  // Config fields — serializable, read by getOrCreateContainer()
  configYAML?: string;
  apiKey?: string;
  deliverablesSubdir?: string;
  auditDir?: string;
  promptDir?: string;
  sastSarifPath?: string;
  skipGitCheck?: boolean;
  providerConfig?: ProviderConfig;

  // Engagement config fields — loaded from engagement.yaml when provided
  engagementPath?: string;
  engagementMode?: import('../types/engagement.js').EngagementMode;
  evidenceBudgetMb?: number;

  // WAF bypass hints injected after waf-fingerprint completes
  brainHints?: string;

  // Previous engagement memory injected before brain-planner runs
  previousEngagementMemory?: string;
}

/**
 * Truncate error message to prevent buffer overflow in Temporal serialization.
 */
function truncateErrorMessage(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return message;
  }
  return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 20)}\n[truncated]`;
}

/**
 * Truncate stack trace on an ApplicationFailure to prevent buffer overflow.
 */
function truncateStackTrace(failure: ApplicationFailure): void {
  if (failure.stack && failure.stack.length > MAX_STACK_TRACE_LENGTH) {
    failure.stack = `${failure.stack.slice(0, MAX_STACK_TRACE_LENGTH)}\n[stack truncated]`;
  }
}

/**
 * Build SessionMetadata from ActivityInput.
 */
function buildSessionMetadata(input: ActivityInput): SessionMetadata {
  const { webUrl, repoPath, outputPath, sessionId } = input;
  return {
    id: sessionId,
    webUrl,
    repoPath,
    ...(outputPath && { outputPath }),
  };
}

/**
 * Build ContainerConfig from ActivityInput, falling back to defaults.
 */
function buildContainerConfig(input: ActivityInput): ContainerConfig {
  return {
    deliverablesSubdir: input.deliverablesSubdir ?? DEFAULT_DELIVERABLES_SUBDIR,
    auditDir: input.auditDir ?? './workspaces',
    ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
    ...(input.promptDir !== undefined && { promptDir: input.promptDir }),
    ...(input.providerConfig !== undefined && { providerConfig: input.providerConfig }),
    ...(input.engagementMode !== undefined && { engagementMode: input.engagementMode }),
    ...(input.evidenceBudgetMb !== undefined && { evidenceBudgetMb: input.evidenceBudgetMb }),
  };
}

/**
 * Core activity implementation using services.
 *
 * Executes a single agent with:
 * 1. Heartbeat loop for worker liveness
 * 2. Container creation/reuse
 * 3. Service-based agent execution
 * 4. Error classification for Temporal retry
 */
async function runAgentActivity(agentName: AgentName, input: ActivityInput): Promise<AgentMetrics> {
  const { repoPath, configPath, pipelineTestingMode = false, workflowId, webUrl } = input;

  // Skip guard: the checkpoint provider decides whether to run the agent.
  // The default NoOp provider always returns { skip: false }.
  const skipContainer =
    getContainer(workflowId) ??
    getOrCreateContainer(workflowId, buildSessionMetadata(input), buildContainerConfig(input));
  const decision = await skipContainer.checkpointProvider.shouldSkipAgent(
    agentName,
    repoPath,
    input.deliverablesSubdir ?? DEFAULT_DELIVERABLES_SUBDIR,
  );
  if (decision.skip && decision.metrics) {
    return decision.metrics;
  }

  const startTime = Date.now();
  const attemptNumber = Context.current().info.attempt;

  // Heartbeat loop - signals worker is alive to Temporal server
  const heartbeatInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    heartbeat({ agent: agentName, elapsedSeconds: elapsed, attempt: attemptNumber });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const logger = createActivityLogger();

    // 1. Build session metadata and get/create container
    const sessionMetadata = buildSessionMetadata(input);
    const container = getOrCreateContainer(workflowId, sessionMetadata, buildContainerConfig(input));

    // 2. Create audit session for THIS agent execution
    // NOTE: Each agent needs its own AuditSession because AuditSession uses
    // instance state (currentAgentName) that cannot be shared across parallel agents
    const auditSession = new AuditSession(sessionMetadata);
    await auditSession.initialize(workflowId);

    // 3. Execute agent via service (throws PentestError on failure)
    const deliverablesPath = deliverablesDir(repoPath, container.config.deliverablesSubdir);
    const endResult = await container.agentExecution.executeOrThrow(
      agentName,
      {
        webUrl,
        repoPath,
        deliverablesPath,
        configPath,
        pipelineTestingMode,
        attemptNumber,
        ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
        ...(input.providerConfig !== undefined && { providerConfig: input.providerConfig }),
        ...(input.promptDir !== undefined && {
          promptDir: path.isAbsolute(input.promptDir)
            ? input.promptDir
            : path.resolve(process.env.VANGUARD_WORKER_ROOT ?? process.cwd(), input.promptDir),
        }),
        ...(input.configYAML !== undefined && { configYAML: input.configYAML }),
        ...(input.brainHints !== undefined && { brainHints: input.brainHints }),
        ...(input.previousEngagementMemory !== undefined && {
          previousEngagementMemory: input.previousEngagementMemory,
        }),
      },
      auditSession,
      logger,
    );

    // 4. Return metrics
    return {
      durationMs: Date.now() - startTime,
      inputTokens: null,
      outputTokens: null,
      costUsd: endResult.cost_usd,
      numTurns: null,
      model: endResult.model,
    };
  } catch (error) {
    // If error is already an ApplicationFailure, re-throw directly
    if (error instanceof ApplicationFailure) {
      throw error;
    }

    // Check if output validation retry limit reached (PentestError with code)
    if (
      error instanceof PentestError &&
      error.code === ErrorCode.OUTPUT_VALIDATION_FAILED &&
      attemptNumber >= MAX_OUTPUT_VALIDATION_RETRIES
    ) {
      throw ApplicationFailure.nonRetryable(
        `Agent ${agentName} failed output validation after ${attemptNumber} attempts`,
        'OutputValidationError',
        [{ agentName, attemptNumber, elapsed: Date.now() - startTime }],
      );
    }

    // Classify error for Temporal retry behavior
    const classified = classifyErrorForTemporal(error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = truncateErrorMessage(rawMessage);

    if (classified.retryable) {
      const failure = ApplicationFailure.create({
        message,
        type: classified.type,
        details: [{ agentName, attemptNumber, elapsed: Date.now() - startTime }],
      });
      truncateStackTrace(failure);
      throw failure;
    } else {
      const failure = ApplicationFailure.nonRetryable(message, classified.type, [
        { agentName, attemptNumber, elapsed: Date.now() - startTime },
      ]);
      truncateStackTrace(failure);
      throw failure;
    }
  } finally {
    clearInterval(heartbeatInterval);
  }
}

export async function runOsintReconAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('osint-recon', input);
}

export async function runWafFingerprintAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('waf-fingerprint', input);
}

export async function runSecretsDetectionAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('secrets-detection', input);
}

export async function runHardeningAuditorAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('hardening-auditor', input);
}

export async function runCredIntelAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('cred-intel', input);
}

export async function runBrainPlannerAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('brain-planner', input);
}

export async function runBrainGuardianAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('brain-guardian', input);
}

export async function runBrainCriticAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('brain-critic', input);
}

export async function runBrainChainHunterAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('brain-chain-hunter', input);
}

export async function runProfilingAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('profiling', input);
}

export async function runPreReconAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('pre-recon', input);
}

export async function runSastAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('sast', input);
}

export async function runReconAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('recon', input);
}

export async function runNucleiScanAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('nuclei-scan', input);
}

export async function runSslTlsVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('ssl-tls-vuln', input);
}

export async function runCloudVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('cloud-vuln', input);
}

export async function runContainerVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('container-vuln', input);
}

export async function runGithubLeaksAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('github-leaks', input);
}

export async function runAwsVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('aws-vuln', input);
}

export async function runGcpVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('gcp-vuln', input);
}

export async function runAzureVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('azure-vuln', input);
}

export async function runLlmPromptInjectorAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('llm-prompt-injector', input);
}

export async function runBrowserVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('browser-vuln', input);
}

export async function runBrowserExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('browser-exploit', input);
}

export async function runPostExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('post-exploit', input);
}

export async function runNetworkScanAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('network-scan', input);
}

export async function runMobileReconAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('mobile-recon', input);
}

export async function runActiveDirectoryAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('active-directory', input);
}

export async function runKillChainAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('kill-chain', input);
}

export async function runRemediationAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('remediation', input);
}

export async function runSupplyChainAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('supply-chain', input);
}

export async function runInjectionVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('injection-vuln', input);
}

export async function runXssVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('xss-vuln', input);
}

export async function runAuthVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('auth-vuln', input);
}

export async function runSsrfVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('ssrf-vuln', input);
}

export async function runAuthzVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('authz-vuln', input);
}

export async function runInjectionExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('injection-exploit', input);
}

export async function runXssExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('xss-exploit', input);
}

export async function runAuthExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('auth-exploit', input);
}

export async function runSsrfExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('ssrf-exploit', input);
}

export async function runAuthzExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('authz-exploit', input);
}

export async function runWebsocketVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('websocket-vuln', input);
}

export async function runWebsocketExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('websocket-exploit', input);
}

export async function runIdorVulnAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('idor-vuln', input);
}

export async function runIdorExploitAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('idor-exploit', input);
}

export async function runReportAgent(input: ActivityInput): Promise<AgentMetrics> {
  return runAgentActivity('report', input);
}

export interface ProfilingData {
  tech_stack: string[];
  cloud_provider: 'aws' | 'gcp' | 'azure' | 'vercel' | 'cloudflare' | null;
  llm_endpoints: Array<{
    url: string;
    provider_hint: string;
    confidence: number;
    ui_present: boolean;
  }>;
  framework: string | null;
  framework_version: string | null;
  language: string | null;
  cms: string | null;
  ad_environment?: boolean;
  mobile_apps?: Array<{
    platform: 'ios' | 'android' | 'pwa';
    url: string;
    store_url?: string;
  }>;
}

/**
 * Load structured profiling data from the profiling agent's JSON output.
 *
 * Returns null if profiling.json does not exist (e.g. black-box mode, agent failed).
 * Callers must handle null — Phase 4 routing skips cloud/LLM gates when null.
 */
export async function loadProfilingData(input: ActivityInput): Promise<ProfilingData | null> {
  const brainDir = path.join(input.repoPath, '.vanguard', 'brain');
  const profilingFile = path.join(brainDir, 'profiling.json');
  try {
    const content = await fs.readFile(profilingFile, 'utf8');
    return JSON.parse(content) as ProfilingData;
  } catch {
    return null;
  }
}

/**
 * Load WAF bypass hints from the waf-fingerprint deliverable.
 *
 * Reads the deliverable and extracts the bypass strategy as a compact string
 * that is injected into {{BRAIN_HINTS}} for all subsequent agents.
 */
export async function loadWafHints(input: ActivityInput): Promise<string> {
  const deliverablesDirPath = deliverablesDir(input.repoPath, input.deliverablesSubdir);
  const wafFile = path.join(deliverablesDirPath, 'waf_fingerprint_deliverable.md');
  try {
    const content = await fs.readFile(wafFile, 'utf8');
    // Extract the WAF JSON block between ```json and ``` markers
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1] !== undefined) {
      const wafData = JSON.parse(jsonMatch[1].trim()) as {
        waf_detected?: string;
        confidence?: number;
        bypass_strategy?: {
          rate_limit_rps?: number;
          ua_bundle?: string;
          tamper_scripts?: string[];
        };
      };
      const waf = wafData.waf_detected ?? 'none';
      const confidence = Math.round((wafData.confidence ?? 0) * 100);
      const strategy = wafData.bypass_strategy;
      if (waf === 'none') {
        return 'WAF: none detected — proceed normally.';
      }
      const tamper = strategy?.tamper_scripts?.join('+') ?? '';
      return [
        `WAF: ${waf} (confidence: ${confidence}%)`,
        `Bypass: rate ${strategy?.rate_limit_rps ?? 2} RPS, ua ${strategy?.ua_bundle ?? 'chrome120'}${tamper ? `, tamper ${tamper}` : ''}`,
        'Apply these settings to ALL vanguardFetch calls in this session.',
      ].join('\n');
    }
    return 'WAF fingerprint deliverable found but no bypass JSON extracted.';
  } catch {
    return 'WAF fingerprint not available — proceeding without bypass hints.';
  }
}

/**
 * Load attack priorities from the brain-planner deliverable.
 *
 * Returns a compact hint string injected into {{BRAIN_HINTS}} for all subsequent agents.
 * Returns empty string if planner deliverable is missing (e.g. pipeline-testing mode).
 */
export async function loadPlannerHints(input: ActivityInput): Promise<string> {
  const deliverablesDirPath = deliverablesDir(input.repoPath, input.deliverablesSubdir);
  const plannerFile = path.join(deliverablesDirPath, 'brain_planner_deliverable.md');
  try {
    const content = await fs.readFile(plannerFile, 'utf8');
    // Extract the PLANNER PRIORITIES block if present, else return the whole file truncated
    const match = content.match(/##\s*(?:Attack Priorities|Planner Priorities|Priority Targets)([\s\S]*?)(?:##|$)/i);
    const hints = match ? match[0].trim() : content.slice(0, 1200).trim();
    return hints ? `BRAIN PLANNER PRIORITIES:\n${hints}` : '';
  } catch {
    return '';
  }
}

/**
 * Load OPSEC status from the brain-guardian deliverable.
 *
 * Returns adjusted rate/bypass hints if the guardian detected WAF adaptation.
 * Returns empty string if guardian deliverable is missing.
 */
export async function loadGuardianHints(input: ActivityInput): Promise<string> {
  const deliverablesDirPath = deliverablesDir(input.repoPath, input.deliverablesSubdir);
  const guardianFile = path.join(deliverablesDirPath, 'brain_guardian_status.md');
  try {
    const content = await fs.readFile(guardianFile, 'utf8');
    const statusMatch = content.match(/\*\*OPSEC Status:\*\*\s*(.+)/i);
    const rateMatch = content.match(/\*\*Adjusted Rate:\*\*\s*(.+)/i);
    const status = statusMatch?.[1]?.trim() ?? 'OK';
    if (status.toUpperCase() === 'OK') return '';
    const rate = rateMatch?.[1]?.trim() ?? 'unchanged';
    return `GUARDIAN OPSEC ALERT: Status=${status}. Adjusted rate: ${rate}. Reduce request frequency immediately.`;
  } catch {
    return '';
  }
}

/**
 * Preflight validation activity.
 *
 * Runs cheap checks before any agent execution:
 * 1. Repository path exists with .git
 * 2. Config file validates (if provided)
 * 3. Credential validation (API key, OAuth, Bedrock, or Vertex AI)
 * 4. Target URL reachable from the container
 *
 * NOT using runAgentActivity — preflight doesn't run an agent via the SDK.
 */
export async function runPreflightValidation(input: ActivityInput): Promise<void> {
  const startTime = Date.now();
  const attemptNumber = Context.current().info.attempt;

  const heartbeatInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    heartbeat({ phase: 'preflight', elapsedSeconds: elapsed, attempt: attemptNumber });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const logger = createActivityLogger();
    logger.info('Running preflight validation...', { attempt: attemptNumber });

    const result = await runPreflightChecks(
      input.webUrl,
      input.repoPath,
      input.configPath,
      logger,
      input.skipGitCheck,
      input.apiKey,
      input.providerConfig,
    );

    if (isErr(result)) {
      const classified = classifyErrorForTemporal(result.error);
      const message = truncateErrorMessage(result.error.message);

      if (classified.retryable) {
        const failure = ApplicationFailure.create({
          message,
          type: classified.type,
          details: [{ phase: 'preflight', attemptNumber, elapsed: Date.now() - startTime }],
        });
        truncateStackTrace(failure);
        throw failure;
      } else {
        const failure = ApplicationFailure.nonRetryable(message, classified.type, [
          { phase: 'preflight', attemptNumber, elapsed: Date.now() - startTime },
        ]);
        truncateStackTrace(failure);
        throw failure;
      }
    }

    // Run engagement-specific preflight checks when an engagement.yaml was provided
    if (input.engagementPath) {
      const engagementResult = await loadEngagement(input.engagementPath, { webUrl: input.webUrl }, logger);
      if (isErr(engagementResult)) {
        throw ApplicationFailure.nonRetryable(
          truncateErrorMessage(engagementResult.error.message),
          'EngagementConfigError',
          [{ phase: 'engagement-preflight', attemptNumber, elapsed: Date.now() - startTime }],
        );
      }

      const engagementPreflightResult = await runEngagementPreflight(engagementResult.value, logger);
      if (isErr(engagementPreflightResult)) {
        throw ApplicationFailure.nonRetryable(
          truncateErrorMessage(engagementPreflightResult.error.message),
          'EngagementPreflightError',
          [{ phase: 'engagement-preflight', attemptNumber, elapsed: Date.now() - startTime }],
        );
      }

      const warnings = engagementPreflightResult.value.filter((r) => !r.passed);
      if (warnings.length > 0) {
        logger.warn(`Engagement preflight: ${warnings.length} warning(s)`, {
          warnings: warnings.map((w) => w.message),
        });
      }
    }

    logger.info('Preflight validation passed');
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      throw error;
    }

    const classified = classifyErrorForTemporal(error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = truncateErrorMessage(rawMessage);

    const failure = ApplicationFailure.nonRetryable(message, classified.type, [
      { phase: 'preflight', attemptNumber, elapsed: Date.now() - startTime },
    ]);
    truncateStackTrace(failure);
    throw failure;
  } finally {
    clearInterval(heartbeatInterval);
  }
}

/**
 * Initialize a private git repository inside the workspace deliverables directory.
 * Idempotent — skips if .git already exists (resume case).
 */
export async function initDeliverableGit(input: ActivityInput): Promise<void> {
  const deliverablesPath = deliverablesDir(input.repoPath, input.deliverablesSubdir);
  await fs.mkdir(deliverablesPath, { recursive: true });

  // Check for .git directly inside deliverables, not parent repo's .git
  const dotGitPath = path.join(deliverablesPath, '.git');
  try {
    await fs.stat(dotGitPath);
    return;
  } catch {
    // .git doesn't exist, proceed with init
  }

  await executeGitCommandWithRetry(['git', 'init'], deliverablesPath, 'init deliverables repo');
  await executeGitCommandWithRetry(
    ['git', 'commit', '--allow-empty', '-m', '📍 Initial deliverables checkpoint'],
    deliverablesPath,
    'initial checkpoint',
  );
}

/**
 * Assemble the final report by concatenating exploitation evidence files.
 */
export async function assembleReportActivity(input: ActivityInput): Promise<void> {
  const { repoPath, deliverablesSubdir } = input;
  const logger = createActivityLogger();
  logger.info('Assembling deliverables from specialist agents...');
  try {
    await assembleFinalReport(repoPath, deliverablesSubdir, logger);
  } catch (error) {
    const err = error as Error;
    logger.warn(`Error assembling final report: ${err.message}`);
  }
}

/**
 * Inject model metadata into the final report.
 */
export async function injectReportMetadataActivity(input: ActivityInput): Promise<void> {
  const { repoPath, sessionId, outputPath, deliverablesSubdir } = input;
  const logger = createActivityLogger();
  const effectiveOutputPath = outputPath ? path.join(outputPath, sessionId) : path.join('./workspaces', sessionId);
  try {
    await injectModelIntoReport(repoPath, deliverablesSubdir, effectiveOutputPath, logger);
  } catch (error) {
    const err = error as Error;
    logger.warn(`Error injecting model into report: ${err.message}`);
  }
}

/**
 * Check if exploitation should run for a given vulnerability type.
 *
 * Uses existing container if available (from prior agent runs),
 * otherwise creates service directly (stateless, no dependencies).
 */
export async function checkExploitationQueue(input: ActivityInput, vulnType: VulnType): Promise<ExploitationDecision> {
  const { repoPath, workflowId } = input;
  const logger = createActivityLogger();

  // Reuse container's service if available (from prior vuln agent runs)
  const existingContainer = getContainer(workflowId);
  const checker = existingContainer?.exploitationChecker ?? new ExploitationCheckerService();

  // Pass deliverablesPath (not repoPath) — validators expect the deliverables directory
  const delivPath = deliverablesDir(repoPath, input.deliverablesSubdir);
  return checker.checkQueue(vulnType, delivPath, logger);
}

interface SessionJson {
  session: {
    id: string;
    webUrl: string;
    repoPath?: string;
    originalWorkflowId?: string;
    resumeAttempts?: ResumeAttempt[];
  };
  metrics: {
    agents: Record<
      string,
      {
        status: 'in-progress' | 'success' | 'failed';
        checkpoint?: string;
      }
    >;
  };
}

/**
 * Load resume state from an existing workspace.
 */
export async function loadResumeState(
  workspaceName: string,
  expectedUrl: string,
  expectedRepoPath: string,
  deliverablesSubdir?: string,
): Promise<ResumeState> {
  // 1. Validate workspace exists
  const sessionPath = path.join('./workspaces', workspaceName, 'session.json');

  const exists = await fileExists(sessionPath);
  if (!exists) {
    throw ApplicationFailure.nonRetryable(
      `Workspace not found: ${workspaceName}\nExpected path: ${sessionPath}`,
      'WorkspaceNotFoundError',
    );
  }

  // 2. Parse session.json and validate URL match
  let session: SessionJson;
  try {
    session = await readJson<SessionJson>(sessionPath);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw ApplicationFailure.nonRetryable(
      `Corrupted session.json in workspace ${workspaceName}: ${errorMsg}`,
      'CorruptedSessionError',
    );
  }

  if (session.session.webUrl !== expectedUrl) {
    throw ApplicationFailure.nonRetryable(
      `URL mismatch with workspace\n  Workspace URL: ${session.session.webUrl}\n  Provided URL:  ${expectedUrl}`,
      'URLMismatchError',
    );
  }

  // 3. Cross-check agent status with deliverables on disk
  const completedAgents: string[] = [];
  const agents = session.metrics.agents;

  for (const agentName of ALL_AGENTS) {
    const agentData = agents[agentName];
    if (!agentData || agentData.status !== 'success') {
      continue;
    }

    const deliverableFilename = AGENTS[agentName].deliverableFilename;
    const deliverablePath = path.join(deliverablesDir(expectedRepoPath, deliverablesSubdir), deliverableFilename);
    const deliverableExists = await fileExists(deliverablePath);

    if (!deliverableExists) {
      const logger = createActivityLogger();
      logger.warn(`Agent ${agentName} shows success but deliverable missing, will re-run`);
      continue;
    }

    completedAgents.push(agentName);
  }

  // 4. Collect git checkpoints and validate at least one exists
  const checkpoints = completedAgents
    .map((name) => agents[name]?.checkpoint)
    .filter((hash): hash is string => hash != null);

  if (checkpoints.length === 0) {
    const successAgents = Object.entries(agents)
      .filter(([, data]) => data.status === 'success')
      .map(([name]) => name);

    throw ApplicationFailure.nonRetryable(
      `Cannot resume workspace ${workspaceName}: ` +
        (successAgents.length > 0
          ? `${successAgents.length} agent(s) show success in session.json (${successAgents.join(', ')}) ` +
            `but their deliverable files are missing from disk. ` +
            `Start a fresh run instead.`
          : `No agents completed successfully. Start a fresh run instead.`),
      'NoCheckpointsError',
    );
  }

  // 5. Find the most recent checkpoint commit
  const deliverablesPath = deliverablesDir(expectedRepoPath, deliverablesSubdir);
  const checkpointHash = await findLatestCommit(deliverablesPath, checkpoints);
  const originalWorkflowId = session.session.originalWorkflowId || session.session.id;

  // 6. Log summary and return resume state
  const logger = createActivityLogger();
  logger.info('Resume state loaded', {
    workspace: workspaceName,
    completedAgents: completedAgents.length,
    checkpoint: checkpointHash,
  });

  return {
    workspaceName,
    originalUrl: session.session.webUrl,
    completedAgents,
    checkpointHash,
    originalWorkflowId,
  };
}

async function findLatestCommit(gitDir: string, commitHashes: string[]): Promise<string> {
  if (commitHashes.length === 1) {
    const hash = commitHashes[0];
    if (!hash) {
      throw new PentestError(
        'Empty commit hash in array',
        'filesystem',
        false, // Non-retryable - corrupt workspace state
        { phase: 'resume' },
        ErrorCode.GIT_CHECKPOINT_FAILED,
      );
    }
    return hash;
  }

  const result = await executeGitCommandWithRetry(
    ['git', 'rev-list', '--max-count=1', ...commitHashes],
    gitDir,
    'find latest commit',
  );

  return result.stdout.trim();
}

/**
 * Restore deliverables git to a checkpoint.
 * Operates on the private git inside workspace deliverables, not the user's repo.
 */
export async function restoreGitCheckpoint(
  repoPath: string,
  checkpointHash: string,
  incompleteAgents: AgentName[],
  deliverablesSubdir?: string,
): Promise<void> {
  const deliverablesPath = deliverablesDir(repoPath, deliverablesSubdir);
  const logger = createActivityLogger();
  logger.info(`Restoring deliverables to ${checkpointHash}...`);

  // Validate hash exists in this clone before attempting reset
  try {
    await executeGitCommandWithRetry(
      ['git', 'rev-parse', '--verify', checkpointHash],
      repoPath,
      'verify checkpoint hash exists',
    );
  } catch {
    logger.info(`Checkpoint hash not found in clone, skipping git reset: ${checkpointHash}`);
    return;
  }

  await executeGitCommandWithRetry(
    ['git', 'reset', '--hard', checkpointHash],
    deliverablesPath,
    'reset deliverables to checkpoint',
  );
  await executeGitCommandWithRetry(['git', 'clean', '-fd'], deliverablesPath, 'clean untracked deliverables');

  // Explicitly delete partial deliverables for incomplete agents
  for (const agentName of incompleteAgents) {
    const deliverableFilename = AGENTS[agentName].deliverableFilename;
    const deliverablePath = path.join(deliverablesPath, deliverableFilename);
    try {
      const exists = await fileExists(deliverablePath);
      if (exists) {
        logger.warn(`Cleaning partial deliverable: ${agentName}`);
        await fs.unlink(deliverablePath);
      }
    } catch (error) {
      logger.info(`Note: Failed to delete ${deliverablePath}: ${error}`);
    }
  }

  logger.info('Deliverables restored to clean state');
}

/**
 * Record a resume attempt in session.json and write resume header to workflow.log.
 */
export async function recordResumeAttempt(
  input: ActivityInput,
  terminatedWorkflows: string[],
  checkpointHash: string,
  previousWorkflowId: string,
  completedAgents: string[],
): Promise<void> {
  const sessionMetadata = buildSessionMetadata(input);
  const auditSession = new AuditSession(sessionMetadata);
  await auditSession.initialize();

  // Update session.json with resume attempt
  await auditSession.addResumeAttempt(input.workflowId, terminatedWorkflows, checkpointHash);

  // Write resume header to workflow.log
  await auditSession.logResumeHeader({
    previousWorkflowId,
    newWorkflowId: input.workflowId,
    checkpointHash,
    completedAgents,
  });
}

/**
 * Log phase transition to the unified workflow log.
 */
export async function logPhaseTransition(
  input: ActivityInput,
  phase: string,
  event: 'start' | 'complete',
): Promise<void> {
  const sessionMetadata = buildSessionMetadata(input);
  const auditSession = new AuditSession(sessionMetadata);
  await auditSession.initialize(input.workflowId);

  if (event === 'start') {
    await auditSession.logPhaseStart(phase);
  } else {
    await auditSession.logPhaseComplete(phase);
  }
}

/**
 * Log workflow completion with full summary.
 * Cleans up container when done.
 */
export async function logWorkflowComplete(input: ActivityInput, summary: WorkflowSummary): Promise<void> {
  const { workflowId } = input;
  const sessionMetadata = buildSessionMetadata(input);

  // 1. Initialize audit session and mark final status
  const auditSession = new AuditSession(sessionMetadata);
  await auditSession.initialize(workflowId);
  await auditSession.updateSessionStatus(summary.status);

  // 2. Load cumulative metrics from session.json
  const sessionData = (await auditSession.getMetrics()) as {
    metrics: {
      total_duration_ms: number;
      total_cost_usd: number;
      agents: Record<string, { final_duration_ms: number; total_cost_usd: number }>;
    };
  };

  // 3. Fill in metrics for skipped agents (resumed from previous run)
  const agentMetrics = { ...summary.agentMetrics };
  for (const agentName of summary.completedAgents) {
    if (!agentMetrics[agentName]) {
      const agentData = sessionData.metrics.agents[agentName];
      if (agentData) {
        agentMetrics[agentName] = {
          durationMs: agentData.final_duration_ms,
          costUsd: agentData.total_cost_usd,
        };
      }
    }
  }

  // 4. Build cumulative summary with cross-run totals
  const cumulativeSummary: WorkflowSummary = {
    ...summary,
    totalDurationMs: sessionData.metrics.total_duration_ms,
    totalCostUsd: sessionData.metrics.total_cost_usd,
    agentMetrics,
  };

  // 5. Write completion entry to workflow.log
  await auditSession.logWorkflowComplete(cumulativeSummary);

  // 6. Clean up container
  removeContainer(workflowId);
}

/**
 * Merge external findings into the exploitation queue for a vulnerability type.
 *
 * Delegates to the FindingsProvider registered in the DI container.
 * Default: no-op returning { mergedCount: 0 }.
 * Consumers can override this activity at the worker level with custom findings integration.
 */
export async function mergeFindingsIntoQueue(
  input: ActivityInput,
  vulnType: VulnType,
): Promise<{ mergedCount: number }> {
  const container = getContainer(input.workflowId);
  if (!container?.findingsProvider) return { mergedCount: 0 };
  return container.findingsProvider.mergeFindingsIntoQueue(input.repoPath, vulnType, input);
}

/**
 * Persist pipeline state after an agent completes.
 *
 * Delegates to the CheckpointProvider registered in the DI container.
 * Default: no-op. Consumers can override this activity at the worker level with custom persistence.
 */
export async function saveCheckpoint(
  input: ActivityInput,
  agentName: string,
  phase: string,
  state: PipelineState,
): Promise<void> {
  const container = getContainer(input.workflowId);
  if (!container?.checkpointProvider) return;

  const context: CheckpointContext = {
    repoPath: input.repoPath,
    sessionId: input.sessionId,
    deliverablesSubdir: input.deliverablesSubdir ?? DEFAULT_DELIVERABLES_SUBDIR,
    ...(input.outputPath !== undefined && { outputPath: input.outputPath }),
  };

  return container.checkpointProvider.onAgentComplete(agentName, phase, state, context);
}

/**
 * Generate an optional additional output alongside the assembled markdown report.
 *
 * Delegates to the ReportOutputProvider registered in the DI container.
 * Default: no-op. Consumers can override this activity at the worker level
 * to emit derived outputs from the final report.
 */
export async function generateReportOutputActivity(input: ActivityInput): Promise<void> {
  const container = getContainer(input.workflowId);
  if (!container?.reportOutputProvider) return;

  const logger = createActivityLogger();

  // Resolve promptDir against the worker root so providers are cwd-independent.
  const resolvedInput: ActivityInput = {
    ...input,
    ...(input.promptDir !== undefined && {
      promptDir: path.isAbsolute(input.promptDir)
        ? input.promptDir
        : path.resolve(process.env.VANGUARD_WORKER_ROOT ?? process.cwd(), input.promptDir),
    }),
  };

  const result = await container.reportOutputProvider.generate(resolvedInput, logger);
  if (result.outputPath) {
    logger.info(`Report output written to ${result.outputPath}`);
  }
}

/**
 * Load previous engagement memory for the target domain.
 *
 * Returns a formatted string ready for injection into {{PREVIOUS_MEMORY}} in the
 * brain-planner prompt. Returns an empty string when no prior memory exists.
 */
export async function loadEngagementMemory(input: ActivityInput): Promise<string> {
  const workspacesDir = input.auditDir ?? './workspaces';
  const memory = await loadDomainMemory(input.webUrl, workspacesDir);
  if (!memory || memory.engagements.length === 0) {
    return '';
  }
  return formatMemoryForPrompt(memory);
}

/**
 * Save key findings from the completed engagement to persistent domain memory.
 *
 * Reads brain_chain_hunter_deliverable.md and brain_critic_deliverable.md from the
 * deliverables directory to extract findings and exploit chains, then persists them
 * to the per-domain memory file.
 */
export async function saveEngagementMemory(input: ActivityInput): Promise<void> {
  const logger = createActivityLogger();
  const deliverablesDirPath = deliverablesDir(input.repoPath, input.deliverablesSubdir);

  const findings: string[] = [];
  const criticalChains: string[] = [];
  const techStack: string[] = [];

  // Extract findings from brain-critic deliverable
  const criticFile = path.join(deliverablesDirPath, 'brain_critic_deliverable.md');
  try {
    const criticContent = await fs.readFile(criticFile, 'utf8');
    const criticLines = criticContent.split('\n');
    for (const line of criticLines) {
      const trimmed = line.trim();
      // Capture top-level list items as findings (markdown bullet or numbered list)
      if (/^[-*•]\s+.{10,}/.test(trimmed) || /^\d+\.\s+.{10,}/.test(trimmed)) {
        const text = trimmed.replace(/^[-*•\d.]\s+/, '').trim();
        if (text.length > 0 && findings.length < 10) {
          findings.push(text);
        }
      }
    }
  } catch {
    logger.info('brain_critic_deliverable.md not found — skipping findings extraction');
  }

  // Extract exploit chains from brain-chain-hunter deliverable
  const chainHunterFile = path.join(deliverablesDirPath, 'brain_chain_hunter_deliverable.md');
  try {
    const chainContent = await fs.readFile(chainHunterFile, 'utf8');
    const chainLines = chainContent.split('\n');
    for (const line of chainLines) {
      const trimmed = line.trim();
      if (/^[-*•]\s+.{10,}/.test(trimmed) || /^\d+\.\s+.{10,}/.test(trimmed)) {
        const text = trimmed.replace(/^[-*•\d.]\s+/, '').trim();
        if (text.length > 0 && criticalChains.length < 5) {
          criticalChains.push(text);
        }
      }
    }
  } catch {
    logger.info('brain_chain_hunter_deliverable.md not found — skipping chain extraction');
  }

  // Extract tech stack from profiling deliverable if available
  const profilingFile = path.join(input.repoPath, '.vanguard', 'brain', 'profiling.json');
  try {
    const profilingContent = await fs.readFile(profilingFile, 'utf8');
    const profiling = JSON.parse(profilingContent) as {
      tech_stack?: string[];
      cloud_provider?: string | null;
      framework?: string | null;
    };
    if (Array.isArray(profiling.tech_stack)) {
      techStack.push(...profiling.tech_stack.slice(0, 10));
    }
    if (profiling.cloud_provider) {
      techStack.push(profiling.cloud_provider);
    }
    if (profiling.framework) {
      techStack.push(profiling.framework);
    }
  } catch {
    // Profiling data is optional
  }

  if (findings.length === 0 && criticalChains.length === 0) {
    logger.info('No findings or chains extracted — skipping engagement memory save');
    return;
  }

  const workspacesDir = input.auditDir ?? './workspaces';
  await saveEngagementFindings(input.webUrl, input.sessionId, workspacesDir, {
    findings,
    criticalChains,
    techStack,
  });

  logger.info(`Engagement memory saved for ${input.webUrl}: ${findings.length} finding(s), ${criticalChains.length} chain(s)`);
}

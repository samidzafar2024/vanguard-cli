// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Temporal workflow for Vanguard pentest pipeline.
 *
 * Orchestrates the penetration testing workflow:
 * 1. Pre-Reconnaissance (sequential)
 * 2. Reconnaissance (sequential)
 * 3-4. Vulnerability + Exploitation (5 pipelined pairs in parallel)
 *      Each pair: vuln agent → queue check → conditional exploit
 *      No synchronization barrier - exploits start when their vuln finishes
 * 5. Reporting (sequential)
 *
 * Features:
 * - Queryable state via getProgress
 * - Automatic retry with backoff for transient/billing errors
 * - Non-retryable classification for permanent errors
 * - Audit correlation via workflowId
 * - Graceful failure handling: pipelines continue if one fails
 */

import {
  ApplicationFailure,
  condition,
  isCancellation,
  log,
  proxyActivities,
  setHandler,
  workflowInfo,
} from '@temporalio/workflow';
import type { AgentName, VulnType } from '../types/agents.js';
import { ALL_AGENTS } from '../types/agents.js';
import type * as activities from './activities.js';
import type { ActivityInput } from './activities.js';
import {
  approvalPendingQuery,
  approveKillChainSignal,
  type AgentMetrics,
  getProgress,
  type PipelineInput,
  type PipelineProgress,
  type PipelineState,
  type PipelineSummary,
  type ResumeState,
  type VulnExploitPipelineResult,
} from './shared.js';
import { toWorkflowSummary } from './summary-mapper.js';
import { classifyErrorCode, formatWorkflowError } from './workflow-errors.js';

// Retry configuration for production (long intervals for billing recovery)
const PRODUCTION_RETRY = {
  initialInterval: '5 minutes',
  maximumInterval: '30 minutes',
  backoffCoefficient: 2,
  maximumAttempts: 50,
  nonRetryableErrorTypes: [
    'AuthenticationError',
    'PermissionError',
    'InvalidRequestError',
    'RequestTooLargeError',
    'ConfigurationError',
    'InvalidTargetError',
    'ExecutionLimitError',
  ],
};

// Retry configuration for pipeline testing (fast iteration)
const TESTING_RETRY = {
  initialInterval: '10 seconds',
  maximumInterval: '30 seconds',
  backoffCoefficient: 2,
  maximumAttempts: 5,
  nonRetryableErrorTypes: PRODUCTION_RETRY.nonRetryableErrorTypes,
};

// Activity proxy with production retry configuration (default)
const acts = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 hours',
  heartbeatTimeout: '60 minutes', // Extended for sub-agent execution (SDK blocks event loop during Task tool calls)
  retry: PRODUCTION_RETRY,
});

// Activity proxy with testing retry configuration (fast)
const testActs = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  heartbeatTimeout: '30 minutes', // Extended for sub-agent execution in testing
  retry: TESTING_RETRY,
});

// Retry configuration for subscription plans (5h+ rolling rate limit windows)
const SUBSCRIPTION_RETRY = {
  initialInterval: '5 minutes',
  maximumInterval: '6 hours',
  backoffCoefficient: 2,
  maximumAttempts: 100,
  nonRetryableErrorTypes: PRODUCTION_RETRY.nonRetryableErrorTypes,
};

// Activity proxy for subscription plan recovery (extended timeouts)
const subscriptionActs = proxyActivities<typeof activities>({
  startToCloseTimeout: '8 hours',
  heartbeatTimeout: '2 hours',
  retry: SUBSCRIPTION_RETRY,
});

// Retry configuration for preflight validation (short timeout, few retries)
const PREFLIGHT_RETRY = {
  initialInterval: '10 seconds',
  maximumInterval: '1 minute',
  backoffCoefficient: 2,
  maximumAttempts: 3,
  nonRetryableErrorTypes: PRODUCTION_RETRY.nonRetryableErrorTypes,
};

// Activity proxy for preflight validation (short timeout)
const preflightActs = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  heartbeatTimeout: '2 minutes',
  retry: PREFLIGHT_RETRY,
});

/**
 * Compute aggregated metrics from the current pipeline state.
 * Called on both success and failure to provide partial metrics.
 */
function computeSummary(state: PipelineState): PipelineSummary {
  const metrics = Object.values(state.agentMetrics);
  return {
    totalCostUsd: metrics.reduce((sum, m) => sum + (m.costUsd ?? 0), 0),
    totalDurationMs: Date.now() - state.startTime,
    totalTurns: metrics.reduce((sum, m) => sum + (m.numTurns ?? 0), 0),
    agentCount: state.completedAgents.length,
  };
}

/**
 * Core pipeline orchestration. Coordinates the pentest pipeline stages.
 *
 * IMPORTANT: This function uses Temporal workflow APIs internally (proxyActivities,
 * queries). It can ONLY be called from within a Temporal workflow execution.
 * Do not call from standalone scripts or activity code.
 */
export async function pentestPipeline(input: PipelineInput): Promise<PipelineState> {
  // Validate repoPath: reject traversal attempts and require absolute path
  if (!input.repoPath || input.repoPath.includes('..')) {
    throw ApplicationFailure.nonRetryable(
      `Invalid repoPath: path traversal not allowed (received: ${input.repoPath ?? '<empty>'})`,
      'ConfigurationError',
    );
  }
  if (!input.repoPath.startsWith('/')) {
    throw ApplicationFailure.nonRetryable(
      `Invalid repoPath: absolute path required (received: ${input.repoPath})`,
      'ConfigurationError',
    );
  }

  const { workflowId } = workflowInfo();

  // Select activity proxy based on mode: testing (fast), subscription (extended), or default
  function selectActivityProxy(pipelineInput: PipelineInput) {
    if (pipelineInput.pipelineTestingMode) return testActs;
    if (pipelineInput.pipelineConfig?.retry_preset === 'subscription') return subscriptionActs;
    return acts;
  }

  const a = selectActivityProxy(input);

  const state: PipelineState = {
    status: 'running',
    currentPhase: null,
    currentAgent: null,
    completedAgents: [],
    failedAgent: null,
    error: null,
    startTime: Date.now(),
    agentMetrics: {},
    summary: null,
  };

  setHandler(
    getProgress,
    (): PipelineProgress => ({
      ...state,
      workflowId,
      elapsedMs: Date.now() - state.startTime,
    }),
  );

  let approvalPending = false;
  let killChainApproved = false;

  setHandler(approvalPendingQuery, () => approvalPending);
  setHandler(approveKillChainSignal, () => {
    killChainApproved = true;
  });

  // Build ActivityInput with required workflowId for audit correlation
  // Activities require workflowId (non-optional), PipelineInput has it optional
  // Use spread to conditionally include optional properties (exactOptionalPropertyTypes)
  // sessionId is workspace name for resume, or workflowId for new runs
  const sessionId = input.sessionId || input.resumeFromWorkspace || workflowId;

  const activityInput: ActivityInput = {
    webUrl: input.webUrl,
    repoPath: input.repoPath,
    workflowId,
    sessionId,
    ...(input.configPath !== undefined && { configPath: input.configPath }),
    ...(input.outputPath !== undefined && { outputPath: input.outputPath }),
    ...(input.pipelineTestingMode !== undefined && {
      pipelineTestingMode: input.pipelineTestingMode,
    }),
    // Config fields — flow through to getOrCreateContainer()
    ...(input.configYAML !== undefined && { configYAML: input.configYAML }),
    ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
    ...(input.deliverablesSubdir !== undefined && { deliverablesSubdir: input.deliverablesSubdir }),
    ...(input.auditDir !== undefined && { auditDir: input.auditDir }),
    ...(input.promptDir !== undefined && { promptDir: input.promptDir }),
    ...(input.sastSarifPath !== undefined && { sastSarifPath: input.sastSarifPath }),
    ...(input.skipGitCheck !== undefined && { skipGitCheck: input.skipGitCheck }),
    ...(input.providerConfig !== undefined && { providerConfig: input.providerConfig }),
  };

  // When reconUrl is provided, recon/OSINT agents use the prod domain for intelligence
  // while attack agents use the dev/attack URL. Falls back to webUrl if not set.
  // NOTE: must be a separate object (not activityInput alias) so brainHints can be set independently
  const reconInput: ActivityInput = input.reconUrl
    ? { ...activityInput, webUrl: input.reconUrl }
    : { ...activityInput };

  let resumeState: ResumeState | null = null;

  if (input.resumeFromWorkspace) {
    // 1. Load resume state (validates workspace, cross-checks deliverables)
    resumeState = await a.loadResumeState(
      input.resumeFromWorkspace,
      input.webUrl,
      input.repoPath,
      input.deliverablesSubdir,
    );

    // 2. Restore git workspace and clean up incomplete deliverables
    const incompleteAgents = ALL_AGENTS.filter(
      (agentName) => !resumeState?.completedAgents.includes(agentName),
    ) as AgentName[];

    await a.restoreGitCheckpoint(
      input.repoPath,
      resumeState.checkpointHash,
      incompleteAgents,
      input.deliverablesSubdir,
    );

    // 3. Short-circuit if all agents already completed
    if (resumeState.completedAgents.length === ALL_AGENTS.length) {
      log.info(`All ${ALL_AGENTS.length} agents already completed. Nothing to resume.`);
      state.status = 'completed';
      state.completedAgents = [...resumeState.completedAgents];
      state.summary = computeSummary(state);
      return state;
    }

    // 4. Record this resume attempt in session.json and workflow.log
    await a.recordResumeAttempt(
      activityInput,
      input.terminatedWorkflows || [],
      resumeState.checkpointHash,
      resumeState.originalWorkflowId,
      resumeState.completedAgents,
    );

    log.info('Resume state loaded and workspace restored');
  }

  const shouldSkip = (agentName: string): boolean => {
    return resumeState?.completedAgents.includes(agentName) ?? false;
  };

  // Run a sequential agent phase (pre-recon, recon)
  // inputOverride: pass reconInput for OSINT/recon phases, omit for attack phases
  async function runSequentialPhase(
    phaseName: string,
    agentName: AgentName,
    runAgent: (input: ActivityInput) => Promise<AgentMetrics>,
    inputOverride?: ActivityInput,
  ): Promise<void> {
    const effectiveInput = inputOverride ?? activityInput;
    if (!shouldSkip(agentName)) {
      state.currentPhase = phaseName;
      state.currentAgent = agentName;
      await a.logPhaseTransition(effectiveInput, phaseName, 'start');
      state.agentMetrics[agentName] = await runAgent(effectiveInput);
      state.completedAgents.push(agentName);
      if (input.checkpointsEnabled) {
        await a.saveCheckpoint(effectiveInput, agentName, phaseName, state);
      }
      await a.logPhaseTransition(effectiveInput, phaseName, 'complete');
    } else {
      log.info(`Skipping ${agentName} (already complete)`);
      state.completedAgents.push(agentName);
    }
  }

  // Build pipeline configs for the 5 vuln→exploit pairs
  function buildPipelineConfigs(): Array<{
    vulnType: VulnType;
    vulnAgent: string;
    exploitAgent: string;
    runVuln: () => Promise<AgentMetrics>;
    runExploit: () => Promise<AgentMetrics>;
  }> {
    return [
      {
        vulnType: 'injection',
        vulnAgent: 'injection-vuln',
        exploitAgent: 'injection-exploit',
        runVuln: () => a.runInjectionVulnAgent(activityInput),
        runExploit: () => a.runInjectionExploitAgent(activityInput),
      },
      {
        vulnType: 'xss',
        vulnAgent: 'xss-vuln',
        exploitAgent: 'xss-exploit',
        runVuln: () => a.runXssVulnAgent(activityInput),
        runExploit: () => a.runXssExploitAgent(activityInput),
      },
      {
        vulnType: 'auth',
        vulnAgent: 'auth-vuln',
        exploitAgent: 'auth-exploit',
        runVuln: () => a.runAuthVulnAgent(activityInput),
        runExploit: () => a.runAuthExploitAgent(activityInput),
      },
      {
        vulnType: 'ssrf',
        vulnAgent: 'ssrf-vuln',
        exploitAgent: 'ssrf-exploit',
        runVuln: () => a.runSsrfVulnAgent(activityInput),
        runExploit: () => a.runSsrfExploitAgent(activityInput),
      },
      {
        vulnType: 'authz',
        vulnAgent: 'authz-vuln',
        exploitAgent: 'authz-exploit',
        runVuln: () => a.runAuthzVulnAgent(activityInput),
        runExploit: () => a.runAuthzExploitAgent(activityInput),
      },
      {
        vulnType: 'websocket',
        vulnAgent: 'websocket-vuln',
        exploitAgent: 'websocket-exploit',
        runVuln: () => a.runWebsocketVulnAgent(activityInput),
        runExploit: () => a.runWebsocketExploitAgent(activityInput),
      },
      {
        vulnType: 'idor',
        vulnAgent: 'idor-vuln',
        exploitAgent: 'idor-exploit',
        runVuln: () => a.runIdorVulnAgent(activityInput),
        runExploit: () => a.runIdorExploitAgent(activityInput),
      },
      {
        vulnType: 'browser',
        vulnAgent: 'browser-vuln',
        exploitAgent: 'browser-exploit',
        runVuln: () => a.runBrowserVulnAgent(activityInput),
        runExploit: () => a.runBrowserExploitAgent(activityInput),
      },
    ];
  }

  // Aggregate errors from settled pipeline promises.
  // Metrics and completedAgents are updated incrementally inside runVulnExploitPipeline
  // so that getProgress queries reflect real-time status during execution.
  function aggregatePipelineResults(results: PromiseSettledResult<VulnExploitPipelineResult>[]): void {
    const failedPipelines: string[] = [];

    for (const result of results) {
      if (result.status === 'rejected') {
        const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failedPipelines.push(errorMsg);
      }
    }

    if (failedPipelines.length > 0) {
      log.warn(`${failedPipelines.length} pipeline(s) failed`, {
        failures: failedPipelines,
      });
    }
  }

  // Run thunks with a concurrency limit, returning PromiseSettledResult for each.
  // When limit >= thunks.length (default), all launch concurrently — identical to Promise.allSettled.
  // NOTE: Results are in completion order, not input order. Callers must key on value fields, not index.
  async function runWithConcurrencyLimit(
    thunks: Array<() => Promise<VulnExploitPipelineResult>>,
    limit: number,
  ): Promise<PromiseSettledResult<VulnExploitPipelineResult>[]> {
    const results: PromiseSettledResult<VulnExploitPipelineResult>[] = [];
    const inFlight = new Set<Promise<void>>();

    for (const thunk of thunks) {
      const slot = thunk()
        .then(
          (value) => {
            results.push({ status: 'fulfilled', value });
          },
          (reason: unknown) => {
            results.push({ status: 'rejected', reason });
          },
        )
        .finally(() => {
          inFlight.delete(slot);
        });

      inFlight.add(slot);

      if (inFlight.size >= limit) {
        await Promise.race(inFlight);
      }
    }

    await Promise.allSettled(inFlight);
    return results;
  }

  try {
    // === Preflight Validation ===
    // Quick sanity checks before committing to expensive agent runs.
    // NOT using runSequentialPhase — preflight doesn't produce AgentMetrics.
    state.currentPhase = 'preflight';
    state.currentAgent = null;
    await preflightActs.runPreflightValidation(activityInput);
    log.info('Preflight validation passed');

    // === Initialize Deliverables Git ===
    await a.initDeliverableGit(activityInput);

    // === Wave 0: Passive intelligence — no target HTTP contact (parallel) ===
    // reconInput: uses prod domain for OSINT when --recon-url is set, else falls back to webUrl
    await Promise.allSettled([
      runSequentialPhase('osint-recon', 'osint-recon', a.runOsintReconAgent, reconInput),
      runSequentialPhase('waf-fingerprint', 'waf-fingerprint', a.runWafFingerprintAgent, reconInput),
    ]);

    // Load WAF hints and inject into all subsequent activities
    const wafHints = await a.loadWafHints(reconInput);
    if (wafHints) {
      activityInput.brainHints = wafHints;
      reconInput.brainHints = wafHints;
    }

    // === Wave 1A: Surface mapping (parallel) ===
    await Promise.allSettled([
      runSequentialPhase('profiling', 'profiling', a.runProfilingAgent, reconInput),
      runSequentialPhase('secrets-detection', 'secrets-detection', a.runSecretsDetectionAgent, reconInput),
      runSequentialPhase('hardening-auditor', 'hardening-auditor', a.runHardeningAuditorAgent, reconInput),
      runSequentialPhase('github-leaks', 'github-leaks', a.runGithubLeaksAgent, reconInput),
      runSequentialPhase('network-scan', 'network-scan', a.runNetworkScanAgent, reconInput),
    ]);

    // === Wave 1B: Sequential Wave 1 tail (supply-chain needs github-leaks, cred-intel needs hardening-auditor) ===
    await Promise.allSettled([
      runSequentialPhase('supply-chain', 'supply-chain', a.runSupplyChainAgent, reconInput),
      runSequentialPhase('cred-intel', 'cred-intel', a.runCredIntelAgent, reconInput),
    ]);

    // Load profiling data and append cloud/LLM signals to brain hints
    const profilingData = await a.loadProfilingData(reconInput);
    if (profilingData) {
      const cloudHint = profilingData.cloud_provider
        ? `Cloud: ${profilingData.cloud_provider}`
        : 'Cloud: none detected';
      const llmHint =
        profilingData.llm_endpoints.length > 0
          ? `LLM endpoints: ${profilingData.llm_endpoints.map((e) => e.url).join(', ')}`
          : 'LLM endpoints: none detected';
      const stackHint = profilingData.tech_stack.length > 0 ? `Tech stack: ${profilingData.tech_stack.join(', ')}` : '';
      const adHint = profilingData.ad_environment ? 'AD environment: Windows/Active Directory detected' : '';
      const mobileHint =
        (profilingData.mobile_apps?.length ?? 0) > 0
          ? `Mobile apps: ${(profilingData.mobile_apps ?? []).map((a) => `${a.platform} (${a.url})`).join(', ')}`
          : '';
      const profilingHints = [cloudHint, llmHint, stackHint, adHint, mobileHint].filter(Boolean).join('\n');
      activityInput.brainHints = activityInput.brainHints
        ? `${activityInput.brainHints}\n${profilingHints}`
        : profilingHints;
    }

    // === Cross-Engagement Memory: load prior findings before brain-planner runs ===
    const previousMemory = await a.loadEngagementMemory(activityInput);
    if (previousMemory) {
      activityInput.previousEngagementMemory = previousMemory;
      reconInput.previousEngagementMemory = previousMemory;
    }

    // === Brain Team: Planner synthesizes all Wave 1 intelligence ===
    await runSequentialPhase('brain', 'brain-planner', a.runBrainPlannerAgent, reconInput);
    const plannerHints = await a.loadPlannerHints(reconInput);
    if (plannerHints) {
      activityInput.brainHints = activityInput.brainHints
        ? `${activityInput.brainHints}\n${plannerHints}`
        : plannerHints;
    }

    // === Deep Scanning: Pre-Recon → SAST → Recon ===
    await runSequentialPhase('pre-recon', 'pre-recon', a.runPreReconAgent);
    await runSequentialPhase('sast', 'sast', a.runSastAgent);
    await runSequentialPhase('recon', 'recon', a.runReconAgent);

    // === Automated Scanning (sequential — each feeds the next) ===
    await runSequentialPhase('nuclei-scan', 'nuclei-scan', a.runNucleiScanAgent);
    await runSequentialPhase('ssl-tls-vuln', 'ssl-tls-vuln', a.runSslTlsVulnAgent);
    // cloud-vuln: general cloud hardening. Phase 5 will add provider-specific agents.
    await runSequentialPhase('cloud-vuln', 'cloud-vuln', a.runCloudVulnAgent);
    await runSequentialPhase('container-vuln', 'container-vuln', a.runContainerVulnAgent);

    // === Phase 5: Active Directory (conditional — gated on ad_environment) ===
    if (profilingData?.ad_environment === true) {
      await runSequentialPhase('active-directory', 'active-directory', a.runActiveDirectoryAgent);
    }

    // === Phase 4: Cloud Provider Agent (conditional — gated on cloud_provider) ===
    if (profilingData?.cloud_provider === 'aws') {
      await runSequentialPhase('aws-vuln', 'aws-vuln', a.runAwsVulnAgent);
    } else if (profilingData?.cloud_provider === 'gcp') {
      await runSequentialPhase('gcp-vuln', 'gcp-vuln', a.runGcpVulnAgent);
    } else if (profilingData?.cloud_provider === 'azure') {
      await runSequentialPhase('azure-vuln', 'azure-vuln', a.runAzureVulnAgent);
    }

    // === Phase 4: LLM Attack Surface (conditional — gated on llm_endpoints) ===
    if ((profilingData?.llm_endpoints.length ?? 0) > 0) {
      await runSequentialPhase('llm-attack', 'llm-prompt-injector', a.runLlmPromptInjectorAgent);
    }

    // === Phase 5: Mobile Recon (conditional — gated on mobile_apps) ===
    if ((profilingData?.mobile_apps?.length ?? 0) > 0) {
      await runSequentialPhase('mobile-recon', 'mobile-recon', a.runMobileReconAgent);
    }

    // === Brain Team: Guardian — OPSEC check before vuln phase ===
    await runSequentialPhase('brain', 'brain-guardian', a.runBrainGuardianAgent);
    const guardianHints = await a.loadGuardianHints(activityInput);
    if (guardianHints) {
      activityInput.brainHints = activityInput.brainHints
        ? `${activityInput.brainHints}\n${guardianHints}`
        : guardianHints;
    }

    // === Wave 2-3: Vulnerability Analysis + Exploitation (Pipelined) ===
    // Each vuln type runs as an independent pipeline:
    // vuln agent → queue check → conditional exploit agent
    // Exploits start immediately when their vuln finishes, not waiting for all.
    state.currentPhase = 'vulnerability-exploitation';
    state.currentAgent = 'pipelines';
    await a.logPhaseTransition(activityInput, 'vulnerability-exploitation', 'start');

    // Closure over shouldSkip and activityInput by design (Temporal replay safety)
    async function runVulnExploitPipeline(
      vulnType: VulnType,
      runVulnAgent: () => Promise<AgentMetrics>,
      runExploitAgent: () => Promise<AgentMetrics>,
    ): Promise<VulnExploitPipelineResult> {
      const vulnAgentName = `${vulnType}-vuln`;
      const exploitAgentName = `${vulnType}-exploit`;

      // 1. Run vulnerability analysis (or skip if resumed)
      let vulnMetrics: AgentMetrics | null = null;
      if (!shouldSkip(vulnAgentName)) {
        vulnMetrics = await runVulnAgent();
        state.agentMetrics[vulnAgentName] = vulnMetrics;
        state.completedAgents.push(vulnAgentName);
        if (input.checkpointsEnabled) {
          await a.saveCheckpoint(activityInput, vulnAgentName, 'vulnerability-analysis', state);
        }
      } else {
        log.info(`Skipping ${vulnAgentName} (already complete)`);
        state.completedAgents.push(vulnAgentName);
      }

      // 1.5. Merge external findings from consumer provider into exploitation queue
      await a.mergeFindingsIntoQueue(activityInput, vulnType);

      // 2. Check exploitation queue for actionable findings
      const decision = await a.checkExploitationQueue(activityInput, vulnType);

      // 3. Conditionally run exploitation agent
      let exploitMetrics: AgentMetrics | null = null;
      if (decision.shouldExploit) {
        if (!shouldSkip(exploitAgentName)) {
          exploitMetrics = await runExploitAgent();
          state.agentMetrics[exploitAgentName] = exploitMetrics;
          state.completedAgents.push(exploitAgentName);
          if (input.checkpointsEnabled) {
            await a.saveCheckpoint(activityInput, exploitAgentName, 'exploitation', state);
          }
        } else {
          log.info(`Skipping ${exploitAgentName} (already complete)`);
          state.completedAgents.push(exploitAgentName);
        }
      }

      return {
        vulnType,
        vulnMetrics,
        exploitMetrics,
        exploitDecision: {
          shouldExploit: decision.shouldExploit,
          vulnerabilityCount: decision.vulnerabilityCount,
        },
        error: null,
      };
    }

    const maxConcurrent = input.pipelineConfig?.max_concurrent_pipelines ?? 5;

    const pipelineConfigs = buildPipelineConfigs();
    const pipelineThunks: Array<() => Promise<VulnExploitPipelineResult>> = [];

    for (const config of pipelineConfigs) {
      if (!shouldSkip(config.vulnAgent) || !shouldSkip(config.exploitAgent)) {
        pipelineThunks.push(() => runVulnExploitPipeline(config.vulnType, config.runVuln, config.runExploit));
      } else {
        log.info(`Skipping entire ${config.vulnType} pipeline (both agents complete)`);
        state.completedAgents.push(config.vulnAgent, config.exploitAgent);
      }
    }

    const pipelineResults = await runWithConcurrencyLimit(pipelineThunks, maxConcurrent);
    aggregatePipelineResults(pipelineResults);

    state.currentPhase = 'exploitation';
    state.currentAgent = null;
    await a.logPhaseTransition(activityInput, 'vulnerability-exploitation', 'complete');

    // === Phase 4: Post-Exploitation Simulation (active mode — synthesizes all exploit results) ===
    await runSequentialPhase('post-exploitation', 'post-exploit', a.runPostExploitAgent);

    // === Brain Team: Critic validates findings, Chain Hunter builds exploit chains ===
    await runSequentialPhase('brain', 'brain-critic', a.runBrainCriticAgent);
    await runSequentialPhase('brain', 'brain-chain-hunter', a.runBrainChainHunterAgent);

    // === Phase 5: Kill Chain Simulation ===
    if (!input.pipelineTestingMode) {
      approvalPending = true;
      log.info(`Kill chain paused — waiting for approval. Run: ./vanguard approve ${sessionId}`);
      await condition(() => killChainApproved);
      approvalPending = false;
      log.info('Kill chain approved — continuing');
    }
    await runSequentialPhase('kill-chain', 'kill-chain', a.runKillChainAgent);

    // === Phase 4: Remediation Generator ===
    await runSequentialPhase('remediation', 'remediation', a.runRemediationAgent);

    // === Reporting ===
    if (!shouldSkip('report')) {
      state.currentPhase = 'reporting';
      state.currentAgent = 'report';
      await a.logPhaseTransition(activityInput, 'reporting', 'start');

      // First, assemble the concatenated report from exploitation evidence files
      await a.assembleReportActivity(activityInput);

      // Then run the report agent to add executive summary and clean up
      state.agentMetrics.report = await a.runReportAgent(activityInput);
      state.completedAgents.push('report');
      if (input.checkpointsEnabled) {
        await a.saveCheckpoint(activityInput, 'report', 'reporting', state);
      }

      // Inject model metadata into the final report
      await a.injectReportMetadataActivity(activityInput);

      await a.logPhaseTransition(activityInput, 'reporting', 'complete');
    } else {
      log.info('Skipping report (already complete)');
      state.completedAgents.push('report');
    }

    // Runs after the skip gate so consumer providers still execute on resume.
    await a.generateReportOutputActivity(activityInput);

    if (input.checkpointsEnabled) {
      await a.saveCheckpoint(activityInput, 'report-output', 'reporting', state);
    }

    // === Cross-Engagement Memory: persist findings for future scans on this domain ===
    await a.saveEngagementMemory(activityInput);

    state.status = 'completed';
    state.currentPhase = null;
    state.currentAgent = null;
    state.summary = computeSummary(state);

    // Log workflow completion summary
    await a.logWorkflowComplete(activityInput, toWorkflowSummary(state, 'completed'));

    return state;
  } catch (error) {
    // Cancellation: return structured state instead of throwing
    if (isCancellation(error)) {
      state.status = 'cancelled';
      state.error = `Cancelled during phase: ${state.currentPhase ?? 'unknown'}`;
      state.summary = computeSummary(state);
      await a.logWorkflowComplete(activityInput, toWorkflowSummary(state, 'cancelled'));
      return state;
    }

    state.status = 'failed';
    state.failedAgent = state.currentAgent;
    state.error = formatWorkflowError(error, state.currentPhase, state.currentAgent);
    const errorCode = classifyErrorCode(error);
    if (errorCode) {
      state.errorCode = errorCode;
    }
    state.summary = computeSummary(state);

    // Log workflow failure summary
    await a.logWorkflowComplete(activityInput, toWorkflowSummary(state, 'failed'));

    throw error;
  }
}

/** OSS workflow entry point — thin shell around the extracted pipeline function. */
export async function pentestPipelineWorkflow(input: PipelineInput): Promise<PipelineState> {
  return pentestPipeline(input);
}

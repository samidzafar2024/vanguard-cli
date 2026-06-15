// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Agent type definitions
 */

/**
 * List of all agents in execution order.
 * Used for iteration during resume state checking.
 */
export const ALL_AGENTS = [
  // Wave 0: Passive intelligence — no target HTTP contact
  'osint-recon',
  'waf-fingerprint',
  // Wave 1: Surface mapping (parallel batches)
  'profiling',
  'secrets-detection',
  'hardening-auditor',
  'github-leaks',
  'network-scan',
  'supply-chain',
  'cred-intel',
  // Brain Team: Planner synthesizes Wave 1 intelligence
  'brain-planner',
  // Deep scanning phases
  'pre-recon',
  'sast',
  'recon',
  'nuclei-scan',
  'ssl-tls-vuln',
  'cloud-vuln',
  'container-vuln',
  // Phase 5: Active Directory (conditional — gated on ad_environment)
  'active-directory',
  // Phase 4: Cloud-native agents (conditional — gated on profilingData.cloud_provider)
  'aws-vuln',
  'gcp-vuln',
  'azure-vuln',
  // Phase 4: LLM attack surface (conditional — gated on profilingData.llm_endpoints)
  'llm-prompt-injector',
  // Phase 5: Mobile recon (conditional — gated on mobile_apps)
  'mobile-recon',
  // Brain Team: Guardian OPSEC check before vuln phase
  'brain-guardian',
  // Wave 2-3: Vulnerability analysis + exploitation (parallel)
  'injection-vuln',
  'xss-vuln',
  'auth-vuln',
  'ssrf-vuln',
  'authz-vuln',
  'websocket-vuln',
  'idor-vuln',
  'browser-vuln',
  'injection-exploit',
  'xss-exploit',
  'auth-exploit',
  'ssrf-exploit',
  'authz-exploit',
  'websocket-exploit',
  'idor-exploit',
  'browser-exploit',
  // Phase 4: Post-exploitation simulation (active mode)
  'post-exploit',
  // Brain Team: Critic validates findings, Chain Hunter builds exploit chains
  'brain-critic',
  'brain-chain-hunter',
  // Phase 5: Kill chain simulation
  'kill-chain',
  // Phase 4: Remediation generator
  'remediation',
  'report',
] as const;

/**
 * Agent name type derived from ALL_AGENTS.
 * This ensures type safety and prevents drift between type and array.
 */
export type AgentName = (typeof ALL_AGENTS)[number];

export type PlaywrightSession = 'agent1' | 'agent2' | 'agent3' | 'agent4' | 'agent5';

import type { ActivityLogger } from './activity-logger.js';
import type { EngagementMode } from './engagement.js';

export type AgentValidator = (sourceDir: string, logger: ActivityLogger) => Promise<boolean>;

export type AgentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled-back';

export interface AgentDefinition {
  name: AgentName;
  displayName: string;
  prerequisites: AgentName[];
  promptTemplate: string;
  deliverableFilename: string;
  modelTier?: 'small' | 'medium' | 'large';
  /** Minimum engagement mode required to run this agent. */
  required_mode: EngagementMode;
}

/**
 * Vulnerability types supported by the pipeline.
 */
export type VulnType = 'injection' | 'xss' | 'auth' | 'ssrf' | 'authz' | 'websocket' | 'idor' | 'browser';

/**
 * Decision returned by queue validation for exploitation phase.
 */
export interface ExploitationDecision {
  shouldExploit: boolean;
  shouldRetry: boolean;
  vulnerabilityCount: number;
  vulnType: VulnType;
}

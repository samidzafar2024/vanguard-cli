// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

import { fs, path } from 'zx';

import { validateQueueAndDeliverable } from './services/queue-validation.js';
import type { ActivityLogger } from './types/activity-logger.js';
import type { AgentDefinition, AgentName, AgentValidator, PlaywrightSession, VulnType } from './types/index.js';

// Agent definitions according to PRD
export const AGENTS: Readonly<Record<AgentName, AgentDefinition>> = Object.freeze({
  'osint-recon': {
    name: 'osint-recon',
    displayName: 'OSINT recon agent',
    prerequisites: [],
    promptTemplate: 'osint-recon',
    deliverableFilename: 'osint_recon_deliverable.md',
    required_mode: 'passive',
  },
  'waf-fingerprint': {
    name: 'waf-fingerprint',
    displayName: 'WAF Fingerprint + Bypass agent',
    prerequisites: [],
    promptTemplate: 'waf-fingerprint',
    deliverableFilename: 'waf_fingerprint_deliverable.md',
    modelTier: 'medium',
    required_mode: 'passive',
  },
  profiling: {
    name: 'profiling',
    displayName: 'Target profiling agent',
    prerequisites: ['waf-fingerprint'],
    promptTemplate: 'profiling',
    deliverableFilename: 'target_profile_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  'secrets-detection': {
    name: 'secrets-detection',
    displayName: 'Secrets Detection agent',
    prerequisites: ['waf-fingerprint'],
    promptTemplate: 'secrets-detection',
    deliverableFilename: 'secrets_detection_deliverable.md',
    modelTier: 'medium',
    required_mode: 'passive',
  },
  'hardening-auditor': {
    name: 'hardening-auditor',
    displayName: 'Security Hardening Audit agent',
    prerequisites: ['waf-fingerprint'],
    promptTemplate: 'hardening-auditor',
    deliverableFilename: 'hardening_auditor_deliverable.md',
    modelTier: 'medium',
    required_mode: 'passive',
  },
  'github-leaks': {
    name: 'github-leaks',
    displayName: 'GitHub leaks agent',
    prerequisites: ['osint-recon'],
    promptTemplate: 'github-leaks',
    deliverableFilename: 'github_leaks_deliverable.md',
    required_mode: 'passive',
  },
  'supply-chain': {
    name: 'supply-chain',
    displayName: 'Supply chain agent',
    prerequisites: ['github-leaks'],
    promptTemplate: 'supply-chain',
    deliverableFilename: 'supply_chain_deliverable.md',
    required_mode: 'passive',
  },
  'cred-intel': {
    name: 'cred-intel',
    displayName: 'Credential Intelligence agent',
    prerequisites: ['hardening-auditor'],
    promptTemplate: 'cred-intel',
    deliverableFilename: 'cred_intel_deliverable.md',
    modelTier: 'medium',
    required_mode: 'validated',
  },
  'brain-planner': {
    name: 'brain-planner',
    displayName: 'Brain Planner agent',
    prerequisites: ['cred-intel', 'supply-chain', 'profiling', 'secrets-detection'],
    promptTemplate: 'brain-planner',
    deliverableFilename: 'brain_planner_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  'pre-recon': {
    name: 'pre-recon',
    displayName: 'Pre-recon agent',
    prerequisites: ['profiling'],
    promptTemplate: 'pre-recon-code',
    deliverableFilename: 'pre_recon_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  sast: {
    name: 'sast',
    displayName: 'SAST agent',
    prerequisites: ['pre-recon'],
    promptTemplate: 'sast',
    deliverableFilename: 'sast_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  recon: {
    name: 'recon',
    displayName: 'Recon agent',
    prerequisites: ['sast'],
    promptTemplate: 'recon',
    deliverableFilename: 'recon_deliverable.md',
    required_mode: 'passive',
  },
  'nuclei-scan': {
    name: 'nuclei-scan',
    displayName: 'Nuclei scanner agent',
    prerequisites: ['recon'],
    promptTemplate: 'nuclei-scan',
    deliverableFilename: 'nuclei_scan_deliverable.md',
    required_mode: 'validated',
  },
  'ssl-tls-vuln': {
    name: 'ssl-tls-vuln',
    displayName: 'SSL/TLS vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'ssl-tls-vuln',
    deliverableFilename: 'ssl_tls_deliverable.md',
    required_mode: 'passive',
  },
  'cloud-vuln': {
    name: 'cloud-vuln',
    displayName: 'Cloud security agent',
    prerequisites: ['recon'],
    promptTemplate: 'cloud-vuln',
    deliverableFilename: 'cloud_security_deliverable.md',
    required_mode: 'passive',
  },
  'container-vuln': {
    name: 'container-vuln',
    displayName: 'Container/IaC security agent',
    prerequisites: ['recon'],
    promptTemplate: 'container-vuln',
    deliverableFilename: 'container_security_deliverable.md',
    required_mode: 'passive',
  },
  'aws-vuln': {
    name: 'aws-vuln',
    displayName: 'AWS cloud security agent',
    prerequisites: ['cloud-vuln'],
    promptTemplate: 'aws-vuln',
    deliverableFilename: 'aws_vuln_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  'gcp-vuln': {
    name: 'gcp-vuln',
    displayName: 'GCP cloud security agent',
    prerequisites: ['cloud-vuln'],
    promptTemplate: 'gcp-vuln',
    deliverableFilename: 'gcp_vuln_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  'azure-vuln': {
    name: 'azure-vuln',
    displayName: 'Azure cloud security agent',
    prerequisites: ['cloud-vuln'],
    promptTemplate: 'azure-vuln',
    deliverableFilename: 'azure_vuln_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  'llm-prompt-injector': {
    name: 'llm-prompt-injector',
    displayName: 'LLM prompt injection agent',
    prerequisites: ['recon'],
    promptTemplate: 'llm-prompt-injector',
    deliverableFilename: 'llm_prompt_injection_deliverable.md',
    modelTier: 'large',
    required_mode: 'validated',
  },
  'injection-vuln': {
    name: 'injection-vuln',
    displayName: 'Injection vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-injection',
    deliverableFilename: 'injection_analysis_deliverable.md',
    required_mode: 'validated',
  },
  'xss-vuln': {
    name: 'xss-vuln',
    displayName: 'XSS vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-xss',
    deliverableFilename: 'xss_analysis_deliverable.md',
    required_mode: 'validated',
  },
  'auth-vuln': {
    name: 'auth-vuln',
    displayName: 'Auth vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-auth',
    deliverableFilename: 'auth_analysis_deliverable.md',
    required_mode: 'validated',
  },
  'ssrf-vuln': {
    name: 'ssrf-vuln',
    displayName: 'SSRF vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-ssrf',
    deliverableFilename: 'ssrf_analysis_deliverable.md',
    required_mode: 'validated',
  },
  'authz-vuln': {
    name: 'authz-vuln',
    displayName: 'Authz vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-authz',
    deliverableFilename: 'authz_analysis_deliverable.md',
    required_mode: 'validated',
  },
  'injection-exploit': {
    name: 'injection-exploit',
    displayName: 'Injection exploit agent',
    prerequisites: ['injection-vuln'],
    promptTemplate: 'exploit-injection',
    deliverableFilename: 'injection_exploitation_evidence.md',
    required_mode: 'active',
  },
  'xss-exploit': {
    name: 'xss-exploit',
    displayName: 'XSS exploit agent',
    prerequisites: ['xss-vuln'],
    promptTemplate: 'exploit-xss',
    deliverableFilename: 'xss_exploitation_evidence.md',
    required_mode: 'active',
  },
  'auth-exploit': {
    name: 'auth-exploit',
    displayName: 'Auth exploit agent',
    prerequisites: ['auth-vuln'],
    promptTemplate: 'exploit-auth',
    deliverableFilename: 'auth_exploitation_evidence.md',
    required_mode: 'active',
  },
  'ssrf-exploit': {
    name: 'ssrf-exploit',
    displayName: 'SSRF exploit agent',
    prerequisites: ['ssrf-vuln'],
    promptTemplate: 'exploit-ssrf',
    deliverableFilename: 'ssrf_exploitation_evidence.md',
    required_mode: 'active',
  },
  'authz-exploit': {
    name: 'authz-exploit',
    displayName: 'Authz exploit agent',
    prerequisites: ['authz-vuln'],
    promptTemplate: 'exploit-authz',
    deliverableFilename: 'authz_exploitation_evidence.md',
    required_mode: 'active',
  },
  'brain-guardian': {
    name: 'brain-guardian',
    displayName: 'Brain Guardian agent',
    prerequisites: ['recon'],
    promptTemplate: 'brain-guardian',
    deliverableFilename: 'brain_guardian_status.md',
    modelTier: 'small',
    required_mode: 'passive',
  },
  'websocket-vuln': {
    name: 'websocket-vuln',
    displayName: 'WebSocket vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-websocket',
    deliverableFilename: 'websocket_analysis_deliverable.md',
    required_mode: 'validated',
  },
  'websocket-exploit': {
    name: 'websocket-exploit',
    displayName: 'WebSocket exploit agent',
    prerequisites: ['websocket-vuln'],
    promptTemplate: 'exploit-websocket',
    deliverableFilename: 'websocket_exploitation_evidence.md',
    required_mode: 'active',
  },
  'idor-vuln': {
    name: 'idor-vuln',
    displayName: 'IDOR vuln agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-idor',
    deliverableFilename: 'idor_analysis_deliverable.md',
    required_mode: 'validated',
  },
  'idor-exploit': {
    name: 'idor-exploit',
    displayName: 'IDOR exploit agent',
    prerequisites: ['idor-vuln'],
    promptTemplate: 'exploit-idor',
    deliverableFilename: 'idor_exploitation_evidence.md',
    required_mode: 'active',
  },
  'browser-vuln': {
    name: 'browser-vuln',
    displayName: 'Browser attack surface agent',
    prerequisites: ['recon'],
    promptTemplate: 'vuln-browser',
    deliverableFilename: 'browser_vuln_deliverable.md',
    required_mode: 'validated',
  },
  'browser-exploit': {
    name: 'browser-exploit',
    displayName: 'Browser exploit agent',
    prerequisites: ['browser-vuln'],
    promptTemplate: 'exploit-browser',
    deliverableFilename: 'browser_exploitation_evidence.md',
    required_mode: 'active',
  },
  'post-exploit': {
    name: 'post-exploit',
    displayName: 'Post-exploitation simulation agent',
    prerequisites: [
      'injection-exploit',
      'xss-exploit',
      'auth-exploit',
      'ssrf-exploit',
      'authz-exploit',
      'websocket-exploit',
      'idor-exploit',
      'browser-exploit',
    ],
    promptTemplate: 'post-exploit',
    deliverableFilename: 'post_exploitation_deliverable.md',
    modelTier: 'large',
    required_mode: 'active',
  },
  'network-scan': {
    name: 'network-scan',
    displayName: 'Network Scanner agent',
    prerequisites: ['waf-fingerprint'],
    promptTemplate: 'network-scan',
    deliverableFilename: 'network_scan_deliverable.md',
    modelTier: 'medium',
    required_mode: 'validated',
  },
  'mobile-recon': {
    name: 'mobile-recon',
    displayName: 'Mobile Recon agent',
    prerequisites: ['recon'],
    promptTemplate: 'mobile-recon',
    deliverableFilename: 'mobile_recon_deliverable.md',
    required_mode: 'passive',
  },
  'active-directory': {
    name: 'active-directory',
    displayName: 'Active Directory agent',
    prerequisites: ['container-vuln'],
    promptTemplate: 'active-directory',
    deliverableFilename: 'active_directory_deliverable.md',
    modelTier: 'large',
    required_mode: 'active',
  },
  'kill-chain': {
    name: 'kill-chain',
    displayName: 'Kill Chain Simulation agent',
    prerequisites: ['brain-chain-hunter'],
    promptTemplate: 'kill-chain',
    deliverableFilename: 'kill_chain_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  'brain-critic': {
    name: 'brain-critic',
    displayName: 'Brain Critic agent',
    prerequisites: ['post-exploit'],
    promptTemplate: 'brain-critic',
    deliverableFilename: 'brain_critic_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  'brain-chain-hunter': {
    name: 'brain-chain-hunter',
    displayName: 'Brain Chain Hunter agent',
    prerequisites: ['brain-critic'],
    promptTemplate: 'brain-chain-hunter',
    deliverableFilename: 'brain_chain_hunter_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  remediation: {
    name: 'remediation',
    displayName: 'Remediation generator agent',
    prerequisites: ['kill-chain'],
    promptTemplate: 'remediation',
    deliverableFilename: 'remediation_deliverable.md',
    modelTier: 'large',
    required_mode: 'passive',
  },
  report: {
    name: 'report',
    displayName: 'Report agent',
    prerequisites: ['remediation'],
    promptTemplate: 'report-executive',
    deliverableFilename: 'comprehensive_security_assessment_report.md',
    required_mode: 'passive',
  },
});

// Phase names for metrics aggregation
export type PhaseName =
  | 'osint-recon'
  | 'waf-fingerprint'
  | 'secrets-detection'
  | 'hardening-auditor'
  | 'github-leaks'
  | 'supply-chain'
  | 'cred-intel'
  | 'brain'
  | 'profiling'
  | 'pre-recon'
  | 'sast'
  | 'recon'
  | 'nuclei-scan'
  | 'ssl-tls-vuln'
  | 'cloud-vuln'
  | 'container-vuln'
  | 'aws-vuln'
  | 'gcp-vuln'
  | 'azure-vuln'
  | 'llm-attack'
  | 'network-scan'
  | 'mobile-recon'
  | 'active-directory'
  | 'kill-chain'
  | 'vulnerability-analysis'
  | 'exploitation'
  | 'post-exploitation'
  | 'reporting'
  | 'remediation';

// Map agents to their corresponding phases (single source of truth)
export const AGENT_PHASE_MAP: Readonly<Record<AgentName, PhaseName>> = Object.freeze({
  'osint-recon': 'osint-recon',
  'waf-fingerprint': 'waf-fingerprint',
  profiling: 'profiling',
  'secrets-detection': 'secrets-detection',
  'hardening-auditor': 'hardening-auditor',
  'github-leaks': 'github-leaks',
  'supply-chain': 'supply-chain',
  'cred-intel': 'cred-intel',
  'brain-planner': 'brain',
  'brain-guardian': 'brain',
  'brain-critic': 'brain',
  'brain-chain-hunter': 'brain',
  'pre-recon': 'pre-recon',
  sast: 'sast',
  recon: 'recon',
  'nuclei-scan': 'nuclei-scan',
  'ssl-tls-vuln': 'ssl-tls-vuln',
  'cloud-vuln': 'cloud-vuln',
  'container-vuln': 'container-vuln',
  'aws-vuln': 'aws-vuln',
  'gcp-vuln': 'gcp-vuln',
  'azure-vuln': 'azure-vuln',
  'llm-prompt-injector': 'llm-attack',
  'network-scan': 'network-scan',
  'mobile-recon': 'mobile-recon',
  'active-directory': 'active-directory',
  'kill-chain': 'kill-chain',
  'injection-vuln': 'vulnerability-analysis',
  'xss-vuln': 'vulnerability-analysis',
  'auth-vuln': 'vulnerability-analysis',
  'authz-vuln': 'vulnerability-analysis',
  'ssrf-vuln': 'vulnerability-analysis',
  'websocket-vuln': 'vulnerability-analysis',
  'idor-vuln': 'vulnerability-analysis',
  'browser-vuln': 'vulnerability-analysis',
  'injection-exploit': 'exploitation',
  'xss-exploit': 'exploitation',
  'auth-exploit': 'exploitation',
  'authz-exploit': 'exploitation',
  'ssrf-exploit': 'exploitation',
  'websocket-exploit': 'exploitation',
  'idor-exploit': 'exploitation',
  'browser-exploit': 'exploitation',
  'post-exploit': 'post-exploitation',
  remediation: 'remediation',
  report: 'reporting',
});

// Factory function for vulnerability queue validators
function createVulnValidator(vulnType: VulnType): AgentValidator {
  return async (sourceDir: string, logger: ActivityLogger): Promise<boolean> => {
    try {
      await validateQueueAndDeliverable(vulnType, sourceDir);
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`Queue validation failed for ${vulnType}: ${errMsg}`);
      return false;
    }
  };
}

// Factory function for exploit deliverable validators
function createExploitValidator(vulnType: VulnType): AgentValidator {
  return async (sourceDir: string): Promise<boolean> => {
    const evidenceFile = path.join(sourceDir, `${vulnType}_exploitation_evidence.md`);
    return await fs.pathExists(evidenceFile);
  };
}

// Playwright session mapping - assigns each agent to a specific session for browser isolation
// Keys are promptTemplate values from AGENTS registry
export const PLAYWRIGHT_SESSION_MAPPING: Record<string, PlaywrightSession> = Object.freeze({
  // Wave 0: Passive intelligence (parallel)
  'osint-recon': 'agent1',
  'waf-fingerprint': 'agent2',

  // Wave 1: Surface mapping (parallel batches)
  profiling: 'agent1',
  'secrets-detection': 'agent2',
  'hardening-auditor': 'agent3',
  'github-leaks': 'agent4',
  'supply-chain': 'agent5',
  'cred-intel': 'agent1',

  // Brain Team agents (read-only file analysis)
  'brain-planner': 'agent1',
  'brain-guardian': 'agent1',
  'brain-critic': 'agent1',
  'brain-chain-hunter': 'agent1',

  // Deep scanning phases
  'pre-recon-code': 'agent1',
  sast: 'agent2',
  recon: 'agent2',
  'nuclei-scan': 'agent3',
  'ssl-tls-vuln': 'agent4',
  'cloud-vuln': 'agent5',
  'container-vuln': 'agent1',

  // Phase 4: Cloud-native + LLM agents (conditional)
  'aws-vuln': 'agent2',
  'gcp-vuln': 'agent2',
  'azure-vuln': 'agent2',
  'llm-prompt-injector': 'agent3',

  // Wave 2: Vulnerability Analysis (7 parallel agents)
  'vuln-injection': 'agent1',
  'vuln-xss': 'agent2',
  'vuln-auth': 'agent3',
  'vuln-ssrf': 'agent4',
  'vuln-authz': 'agent5',
  'vuln-websocket': 'agent1',
  'vuln-idor': 'agent2',

  // Wave 3: Exploitation (7 parallel agents)
  'exploit-injection': 'agent1',
  'exploit-xss': 'agent2',
  'exploit-auth': 'agent3',
  'exploit-ssrf': 'agent4',
  'exploit-authz': 'agent5',
  'exploit-websocket': 'agent1',
  'exploit-idor': 'agent2',

  // Phase 5: Network & Enterprise agents
  'network-scan': 'agent3',
  'mobile-recon': 'agent4',
  'active-directory': 'agent3',
  'kill-chain': 'agent1',

  // Phase 4: Browser attacks (8th vuln/exploit pair)
  'vuln-browser': 'agent3',
  'exploit-browser': 'agent4',

  // Phase 4: Post-exploitation + remediation (sequential)
  'post-exploit': 'agent2',
  remediation: 'agent1',

  // Wave 4: Reporting
  'report-executive': 'agent3',
});

// Direct agent-to-validator mapping - much simpler than pattern matching
export const AGENT_VALIDATORS: Record<AgentName, AgentValidator> = Object.freeze({
  // WAF fingerprint agent
  'waf-fingerprint': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'waf_fingerprint_deliverable.md');
    return await fs.pathExists(file);
  },

  // Secrets detection agent
  'secrets-detection': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'secrets_detection_deliverable.md');
    return await fs.pathExists(file);
  },

  // Target profiling agent - validates the target profile deliverable
  profiling: async (sourceDir: string): Promise<boolean> => {
    const profileFile = path.join(sourceDir, 'target_profile_deliverable.md');
    return await fs.pathExists(profileFile);
  },

  // Pre-reconnaissance agent - validates the code analysis deliverable created by the agent
  'pre-recon': async (sourceDir: string): Promise<boolean> => {
    const codeAnalysisFile = path.join(sourceDir, 'pre_recon_deliverable.md');
    return await fs.pathExists(codeAnalysisFile);
  },

  // SAST agent - static analysis (semgrep + gitleaks + trivy)
  sast: async (sourceDir: string): Promise<boolean> => {
    const sastFile = path.join(sourceDir, 'sast_deliverable.md');
    return await fs.pathExists(sastFile);
  },

  // Reconnaissance agent
  recon: async (sourceDir: string): Promise<boolean> => {
    const reconFile = path.join(sourceDir, 'recon_deliverable.md');
    return await fs.pathExists(reconFile);
  },

  // Nuclei scanner agent
  'nuclei-scan': async (sourceDir: string): Promise<boolean> => {
    const nucleiFile = path.join(sourceDir, 'nuclei_scan_deliverable.md');
    return await fs.pathExists(nucleiFile);
  },

  // SSL/TLS vulnerability agent
  'ssl-tls-vuln': async (sourceDir: string): Promise<boolean> => {
    const sslFile = path.join(sourceDir, 'ssl_tls_deliverable.md');
    return await fs.pathExists(sslFile);
  },

  // Cloud security agent
  'cloud-vuln': async (sourceDir: string): Promise<boolean> => {
    const cloudFile = path.join(sourceDir, 'cloud_security_deliverable.md');
    return await fs.pathExists(cloudFile);
  },

  // Container/IaC security agent
  'container-vuln': async (sourceDir: string): Promise<boolean> => {
    const containerFile = path.join(sourceDir, 'container_security_deliverable.md');
    return await fs.pathExists(containerFile);
  },
  'aws-vuln': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'aws_vuln_deliverable.md');
    return await fs.pathExists(file);
  },
  'gcp-vuln': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'gcp_vuln_deliverable.md');
    return await fs.pathExists(file);
  },
  'azure-vuln': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'azure_vuln_deliverable.md');
    return await fs.pathExists(file);
  },
  'llm-prompt-injector': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'llm_prompt_injection_deliverable.md');
    return await fs.pathExists(file);
  },

  'osint-recon': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'osint_recon_deliverable.md');
    return await fs.pathExists(file);
  },
  'hardening-auditor': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'hardening_auditor_deliverable.md');
    return await fs.pathExists(file);
  },
  'github-leaks': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'github_leaks_deliverable.md');
    return await fs.pathExists(file);
  },
  'supply-chain': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'supply_chain_deliverable.md');
    return await fs.pathExists(file);
  },
  'cred-intel': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'cred_intel_deliverable.md');
    return await fs.pathExists(file);
  },
  'brain-planner': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'brain_planner_deliverable.md');
    return await fs.pathExists(file);
  },
  'brain-guardian': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'brain_guardian_status.md');
    return await fs.pathExists(file);
  },
  'brain-critic': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'brain_critic_deliverable.md');
    return await fs.pathExists(file);
  },
  'brain-chain-hunter': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'brain_chain_hunter_deliverable.md');
    return await fs.pathExists(file);
  },

  // Vulnerability analysis agents
  'injection-vuln': createVulnValidator('injection'),
  'xss-vuln': createVulnValidator('xss'),
  'auth-vuln': createVulnValidator('auth'),
  'ssrf-vuln': createVulnValidator('ssrf'),
  'authz-vuln': createVulnValidator('authz'),
  'websocket-vuln': createVulnValidator('websocket'),
  'idor-vuln': createVulnValidator('idor'),
  'network-scan': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'network_scan_deliverable.md');
    return await fs.pathExists(file);
  },
  'mobile-recon': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'mobile_recon_deliverable.md');
    return await fs.pathExists(file);
  },
  'active-directory': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'active_directory_deliverable.md');
    return await fs.pathExists(file);
  },
  'kill-chain': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'kill_chain_deliverable.md');
    return await fs.pathExists(file);
  },
  'browser-vuln': createVulnValidator('browser'),

  // Exploitation agents
  'injection-exploit': createExploitValidator('injection'),
  'xss-exploit': createExploitValidator('xss'),
  'auth-exploit': createExploitValidator('auth'),
  'ssrf-exploit': createExploitValidator('ssrf'),
  'authz-exploit': createExploitValidator('authz'),
  'websocket-exploit': createExploitValidator('websocket'),
  'idor-exploit': createExploitValidator('idor'),
  'browser-exploit': createExploitValidator('browser'),

  'post-exploit': async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'post_exploitation_deliverable.md');
    return await fs.pathExists(file);
  },
  remediation: async (sourceDir: string): Promise<boolean> => {
    const file = path.join(sourceDir, 'remediation_deliverable.md');
    return await fs.pathExists(file);
  },

  // Executive report agent
  report: async (sourceDir: string, logger: ActivityLogger): Promise<boolean> => {
    const reportFile = path.join(sourceDir, 'comprehensive_security_assessment_report.md');

    const reportExists = await fs.pathExists(reportFile);

    if (!reportExists) {
      logger.error('Missing required deliverable: comprehensive_security_assessment_report.md');
    }

    return reportExists;
  },
});

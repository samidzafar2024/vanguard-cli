// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Deliverable Type Definitions
 *
 * Maps deliverable types to their filenames for the save-deliverable CLI.
 */

export enum DeliverableType {
  // Wave 0
  OSINT_RECON = 'OSINT_RECON',
  WAF_FINGERPRINT = 'WAF_FINGERPRINT',

  // Wave 1
  TARGET_PROFILE = 'TARGET_PROFILE',
  SECRETS_DETECTION = 'SECRETS_DETECTION',
  HARDENING_AUDIT = 'HARDENING_AUDIT',
  GITHUB_LEAKS = 'GITHUB_LEAKS',
  SUPPLY_CHAIN = 'SUPPLY_CHAIN',
  CRED_INTEL = 'CRED_INTEL',

  // Brain Team
  BRAIN_PLANNER = 'BRAIN_PLANNER',
  BRAIN_GUARDIAN = 'BRAIN_GUARDIAN',
  BRAIN_CRITIC = 'BRAIN_CRITIC',
  BRAIN_CHAIN_HUNTER = 'BRAIN_CHAIN_HUNTER',

  // Deep scanning
  CODE_ANALYSIS = 'CODE_ANALYSIS',
  SAST = 'SAST',
  RECON = 'RECON',
  NUCLEI_SCAN = 'NUCLEI_SCAN',
  SSL_TLS = 'SSL_TLS',
  SSL_TLS_ANALYSIS = 'SSL_TLS_ANALYSIS',
  CLOUD_SECURITY = 'CLOUD_SECURITY',
  CLOUD_VULN = 'CLOUD_VULN',
  CONTAINER_SECURITY = 'CONTAINER_SECURITY',
  CONTAINER_VULN = 'CONTAINER_VULN',

  // Phase 4: Cloud provider agents
  AWS_VULN = 'AWS_VULN',
  GCP_VULN = 'GCP_VULN',
  AZURE_VULN = 'AZURE_VULN',

  // Phase 4: LLM attack surface
  LLM_PROMPT_INJECTION = 'LLM_PROMPT_INJECTION',

  // Vulnerability analysis agents
  INJECTION_ANALYSIS = 'INJECTION_ANALYSIS',
  XSS_ANALYSIS = 'XSS_ANALYSIS',
  AUTH_ANALYSIS = 'AUTH_ANALYSIS',
  AUTHZ_ANALYSIS = 'AUTHZ_ANALYSIS',
  SSRF_ANALYSIS = 'SSRF_ANALYSIS',
  WEBSOCKET_ANALYSIS = 'WEBSOCKET_ANALYSIS',
  IDOR_ANALYSIS = 'IDOR_ANALYSIS',

  // Exploitation agents
  INJECTION_EVIDENCE = 'INJECTION_EVIDENCE',
  XSS_EVIDENCE = 'XSS_EVIDENCE',
  AUTH_EVIDENCE = 'AUTH_EVIDENCE',
  AUTHZ_EVIDENCE = 'AUTHZ_EVIDENCE',
  SSRF_EVIDENCE = 'SSRF_EVIDENCE',
  WS_EVIDENCE = 'WS_EVIDENCE',
  IDOR_EVIDENCE = 'IDOR_EVIDENCE',

  // Phase 4: Browser attack surface
  BROWSER_ANALYSIS = 'BROWSER_ANALYSIS',
  BROWSER_EVIDENCE = 'BROWSER_EVIDENCE',

  // Phase 4: Post-exploitation
  POST_EXPLOITATION = 'POST_EXPLOITATION',

  // Phase 4: Remediation generator
  REMEDIATION = 'REMEDIATION',

  // Phase 5: Network & Enterprise
  NETWORK_SCAN = 'NETWORK_SCAN',
  MOBILE_RECON = 'MOBILE_RECON',
  ACTIVE_DIRECTORY = 'ACTIVE_DIRECTORY',
  KILL_CHAIN = 'KILL_CHAIN',

  // Reporting
  EXECUTIVE_REPORT = 'EXECUTIVE_REPORT',
}

/**
 * Hard-coded filename mappings from agent prompts
 */
export const DELIVERABLE_FILENAMES: Record<DeliverableType, string> = {
  // Wave 0
  [DeliverableType.OSINT_RECON]: 'osint_recon_deliverable.md',
  [DeliverableType.WAF_FINGERPRINT]: 'waf_fingerprint_deliverable.md',

  // Wave 1
  [DeliverableType.TARGET_PROFILE]: 'target_profile_deliverable.md',
  [DeliverableType.SECRETS_DETECTION]: 'secrets_detection_deliverable.md',
  [DeliverableType.HARDENING_AUDIT]: 'hardening_auditor_deliverable.md',
  [DeliverableType.GITHUB_LEAKS]: 'github_leaks_deliverable.md',
  [DeliverableType.SUPPLY_CHAIN]: 'supply_chain_deliverable.md',
  [DeliverableType.CRED_INTEL]: 'cred_intel_deliverable.md',

  // Brain Team
  [DeliverableType.BRAIN_PLANNER]: 'brain_planner_deliverable.md',
  [DeliverableType.BRAIN_GUARDIAN]: 'brain_guardian_status.md',
  [DeliverableType.BRAIN_CRITIC]: 'brain_critic_deliverable.md',
  [DeliverableType.BRAIN_CHAIN_HUNTER]: 'brain_chain_hunter_deliverable.md',

  // Deep scanning
  [DeliverableType.CODE_ANALYSIS]: 'pre_recon_deliverable.md',
  [DeliverableType.SAST]: 'sast_deliverable.md',
  [DeliverableType.RECON]: 'recon_deliverable.md',
  [DeliverableType.NUCLEI_SCAN]: 'nuclei_scan_deliverable.md',
  [DeliverableType.SSL_TLS]: 'ssl_tls_deliverable.md',
  [DeliverableType.SSL_TLS_ANALYSIS]: 'ssl_tls_deliverable.md',
  [DeliverableType.CLOUD_SECURITY]: 'cloud_security_deliverable.md',
  [DeliverableType.CLOUD_VULN]: 'cloud_security_deliverable.md',
  [DeliverableType.CONTAINER_SECURITY]: 'container_security_deliverable.md',
  [DeliverableType.CONTAINER_VULN]: 'container_security_deliverable.md',

  // Phase 4: Cloud provider agents
  [DeliverableType.AWS_VULN]: 'aws_vuln_deliverable.md',
  [DeliverableType.GCP_VULN]: 'gcp_vuln_deliverable.md',
  [DeliverableType.AZURE_VULN]: 'azure_vuln_deliverable.md',

  // Phase 4: LLM attack surface
  [DeliverableType.LLM_PROMPT_INJECTION]: 'llm_prompt_injection_deliverable.md',

  // Vulnerability analysis agents
  [DeliverableType.INJECTION_ANALYSIS]: 'injection_analysis_deliverable.md',
  [DeliverableType.XSS_ANALYSIS]: 'xss_analysis_deliverable.md',
  [DeliverableType.AUTH_ANALYSIS]: 'auth_analysis_deliverable.md',
  [DeliverableType.AUTHZ_ANALYSIS]: 'authz_analysis_deliverable.md',
  [DeliverableType.SSRF_ANALYSIS]: 'ssrf_analysis_deliverable.md',
  [DeliverableType.WEBSOCKET_ANALYSIS]: 'websocket_analysis_deliverable.md',
  [DeliverableType.IDOR_ANALYSIS]: 'idor_analysis_deliverable.md',

  // Exploitation agents
  [DeliverableType.INJECTION_EVIDENCE]: 'injection_exploitation_evidence.md',
  [DeliverableType.XSS_EVIDENCE]: 'xss_exploitation_evidence.md',
  [DeliverableType.AUTH_EVIDENCE]: 'auth_exploitation_evidence.md',
  [DeliverableType.AUTHZ_EVIDENCE]: 'authz_exploitation_evidence.md',
  [DeliverableType.SSRF_EVIDENCE]: 'ssrf_exploitation_evidence.md',
  [DeliverableType.WS_EVIDENCE]: 'websocket_exploitation_evidence.md',
  [DeliverableType.IDOR_EVIDENCE]: 'idor_exploitation_evidence.md',
  [DeliverableType.BROWSER_ANALYSIS]: 'browser_vuln_deliverable.md',
  [DeliverableType.BROWSER_EVIDENCE]: 'browser_exploitation_evidence.md',
  [DeliverableType.POST_EXPLOITATION]: 'post_exploitation_deliverable.md',
  [DeliverableType.REMEDIATION]: 'remediation_deliverable.md',

  // Phase 5: Network & Enterprise
  [DeliverableType.NETWORK_SCAN]: 'network_scan_deliverable.md',
  [DeliverableType.MOBILE_RECON]: 'mobile_recon_deliverable.md',
  [DeliverableType.ACTIVE_DIRECTORY]: 'active_directory_deliverable.md',
  [DeliverableType.KILL_CHAIN]: 'kill_chain_deliverable.md',

  // Reporting
  [DeliverableType.EXECUTIVE_REPORT]: 'comprehensive_security_assessment_report.md',
};

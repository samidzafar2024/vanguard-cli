// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Engagement configuration types.
 *
 * EngagementConfig is the data contract shared by every Phase 1+ component.
 * Loaded from engagement.yaml or built from CLI flags by engagement-loader.ts.
 */

/** Controls which tools agents are permitted to use. Immutable once set per engagement. */
export type EngagementMode = 'passive' | 'validated' | 'active';

/** Target scope definition — at least one of fqdns or wildcard is required. */
export interface EngagementScope {
  /** Explicit FQDNs in scope (e.g., ["api.target.com", "app.target.com"]) */
  fqdns?: string[];
  /** Wildcard scope (e.g., "*.target.com") */
  wildcard?: string;
  /** Upper bound on hosts discovered via wildcard expansion */
  max_hosts?: number;
}

/** Written authorization for the engagement — required for all modes. */
export interface EngagementAuthorization {
  /** Full name of the authorizing person */
  name: string;
  /** Email address of the authorizing person */
  email: string;
  /** ISO 8601 date the authorization was granted (e.g., "2026-04-28") */
  date: string;
  /** SHA-256 hash of the Rules of Engagement document (optional but recommended) */
  roe_document_hash?: string;
}

/** Full engagement configuration. Loaded from engagement.yaml or built from CLI flags. */
export interface EngagementConfig {
  /** Unique identifier — URL-safe, used in workspace directory names */
  engagement_id: string;
  /** Primary target URL (must be in scope) */
  target_url: string;
  /** Target scope definition */
  scope: EngagementScope;
  /** Written authorization details */
  authorized_by: EngagementAuthorization;
  /** Operating mode — controls which tools agents may use */
  mode: EngagementMode;
  /** Maximum requests per second across all agents */
  rate_limit_rps: number;
  /** Maximum evidence collected per engagement in megabytes */
  evidence_budget_mb: number;
  /** Bug bounty platform handle (e.g., "h1-samidzafar") — used in report headers */
  bug_bounty_handle?: string;
  /** FireProx gateway URL for IP rotation (active mode only) */
  fireprox_gateway?: string;
  /** Contact email shown in report headers */
  contact_email?: string;
  /** TLS/HTTP fingerprint bundle for vanguardFetch */
  ua_bundle?: 'chrome131_mac' | 'chrome130_win' | 'firefox134_linux' | 'safari18_mac';
  /**
   * Explicit confirmation that active mode is authorized.
   * Must be true when mode === 'active' or the dispatcher will block all active-mode tools.
   */
  active_mode_confirmed?: boolean;
  /**
   * Enable credential testing (password spray, credential stuffing).
   * Requires explicit opt-in — false by default even in active mode.
   */
  credential_testing?: boolean;
  /** Optional Shodan API key for threat-intel agent */
  shodan_api_key?: string;
  /** Optional Censys API credentials for threat-intel agent */
  censys_api_id?: string;
  censys_api_secret?: string;
  /** Optional SecurityTrails API key for threat-intel agent */
  securitytrails_api_key?: string;
  /** Optional HIBP API key (free tier has rate limits without it) */
  hibp_api_key?: string;
}

/** Defaults applied when fields are absent from engagement.yaml or CLI flags. */
export const DEFAULT_ENGAGEMENT: Partial<EngagementConfig> = {
  mode: 'validated',
  rate_limit_rps: 2,
  evidence_budget_mb: 10,
  ua_bundle: 'chrome131_mac',
  credential_testing: false,
};

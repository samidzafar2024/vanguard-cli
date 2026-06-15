// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

/**
 * Preflight Validation Service
 *
 * Runs cheap, fast checks before any agent execution begins.
 * Catches configuration and credential problems early, saving
 * time and API costs compared to failing mid-pipeline.
 *
 * Checks run sequentially, cheapest first:
 * 1. Repository path exists and contains .git
 * 2. Config file parses and validates (if provided)
 * 3. Credentials validate via Claude Agent SDK query (API key, OAuth, Bedrock, or Vertex AI)
 * 4. Target URL is reachable from the container (DNS + HTTP)
 */

import { lookup } from 'node:dns/promises';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import type { SDKAssistantMessageError } from '@anthropic-ai/claude-agent-sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolveModel } from '../ai/models.js';
import { parseConfig } from '../config-parser.js';
import type { ActivityLogger } from '../types/activity-logger.js';
import type { EngagementConfig } from '../types/engagement.js';
import { ErrorCode } from '../types/errors.js';
import { err, ok, type Result } from '../types/result.js';
import { isRetryableError, PentestError } from './error-handling.js';

const TARGET_URL_TIMEOUT_MS = 10_000;

function isLoopbackAddress(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '0.0.0.0';
}

// === Repository Validation ===

async function validateRepo(
  repoPath: string,
  logger: ActivityLogger,
  skipGitCheck?: boolean,
): Promise<Result<void, PentestError>> {
  logger.info('Checking repository path...', { repoPath });

  // 1. Check repo directory exists
  try {
    const stats = await fs.stat(repoPath);
    if (!stats.isDirectory()) {
      return err(
        new PentestError(
          `Repository path is not a directory: ${repoPath}`,
          'config',
          false,
          { repoPath },
          ErrorCode.REPO_NOT_FOUND,
        ),
      );
    }
  } catch {
    return err(
      new PentestError(
        `Repository path does not exist: ${repoPath}`,
        'config',
        false,
        { repoPath },
        ErrorCode.REPO_NOT_FOUND,
      ),
    );
  }

  // 2. Check .git directory exists (skipped when consumer removes .git after clone)
  if (!skipGitCheck) {
    try {
      const gitStats = await fs.stat(`${repoPath}/.git`);
      if (!gitStats.isDirectory()) {
        return err(
          new PentestError(
            `Not a git repository (no .git directory): ${repoPath}`,
            'config',
            false,
            { repoPath },
            ErrorCode.REPO_NOT_FOUND,
          ),
        );
      }
    } catch {
      return err(
        new PentestError(
          `Not a git repository (no .git directory): ${repoPath}`,
          'config',
          false,
          { repoPath },
          ErrorCode.REPO_NOT_FOUND,
        ),
      );
    }
  } else {
    logger.info('Skipping .git check (skipGitCheck enabled)');
  }

  logger.info('Repository path OK');
  return ok(undefined);
}

// === Config Validation ===

async function validateConfig(configPath: string, logger: ActivityLogger): Promise<Result<void, PentestError>> {
  logger.info('Validating configuration file...', { configPath });

  try {
    await parseConfig(configPath);
    logger.info('Configuration file OK');
    return ok(undefined);
  } catch (error) {
    if (error instanceof PentestError) {
      return err(error);
    }
    const message = error instanceof Error ? error.message : String(error);
    return err(
      new PentestError(
        `Configuration validation failed: ${message}`,
        'config',
        false,
        { configPath },
        ErrorCode.CONFIG_VALIDATION_FAILED,
      ),
    );
  }
}

// === Credential Validation ===

/** Map SDK error type to a human-readable preflight PentestError. */
function classifySdkError(sdkError: SDKAssistantMessageError, authType: string): Result<void, PentestError> {
  switch (sdkError) {
    case 'authentication_failed':
      return err(
        new PentestError(
          `Invalid ${authType}. Check your credentials in .env and try again.`,
          'config',
          false,
          { authType, sdkError },
          ErrorCode.AUTH_FAILED,
        ),
      );
    case 'billing_error':
      return err(
        new PentestError(
          `Anthropic account has a billing issue. Add credits or check your billing dashboard.`,
          'billing',
          true,
          { authType, sdkError },
          ErrorCode.BILLING_ERROR,
        ),
      );
    case 'rate_limit':
      return err(
        new PentestError(
          `Anthropic rate limit or spending cap reached. Wait a few minutes and try again.`,
          'billing',
          true,
          { authType, sdkError },
          ErrorCode.BILLING_ERROR,
        ),
      );
    case 'server_error':
      return err(
        new PentestError(`Anthropic API is temporarily unavailable. Try again shortly.`, 'network', true, {
          authType,
          sdkError,
        }),
      );
    default:
      return err(
        new PentestError(
          `${authType} validation failed unexpectedly. Check your credentials in .env.`,
          'config',
          false,
          { authType, sdkError },
          ErrorCode.AUTH_FAILED,
        ),
      );
  }
}

/** Validate credentials via a minimal Claude Agent SDK query. */
async function validateCredentials(
  logger: ActivityLogger,
  apiKey?: string,
  providerConfig?: import('../types/config.js').ProviderConfig,
): Promise<Result<void, PentestError>> {
  // 0. If providerConfig is present, credentials are managed by the caller.
  //    The executor will map providerConfig directly to sdkEnv — no process.env needed.
  if (providerConfig) {
    logger.info(
      `Provider config present (type: ${providerConfig.providerType || 'anthropic_api'}) — skipping env-based credential validation`,
    );
    return ok(undefined);
  }

  // 0b. If apiKey provided via config, set it in env for SDK validation
  //     This avoids requiring process.env.ANTHROPIC_API_KEY when key is threaded via input
  if (apiKey) {
    process.env.ANTHROPIC_API_KEY = apiKey;
  }
  // 1. Custom base URL — validate endpoint is reachable via SDK query
  if (process.env.ANTHROPIC_BASE_URL && process.env.ANTHROPIC_AUTH_TOKEN) {
    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    logger.info(`Validating custom base URL: ${baseUrl}`);

    try {
      for await (const message of query({ prompt: 'hi', options: { model: resolveModel('small'), maxTurns: 1 } })) {
        if (message.type === 'assistant' && message.error) {
          return classifySdkError(message.error, `custom endpoint (${baseUrl})`);
        }
        if (message.type === 'result') {
          break;
        }
      }

      logger.info('Custom base URL OK');
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(
        new PentestError(
          `Custom base URL unreachable: ${baseUrl} — ${message}`,
          'network',
          false,
          { baseUrl },
          ErrorCode.AUTH_FAILED,
        ),
      );
    }
  }

  // 2. Bedrock mode — validate required AWS credentials are present
  if (process.env.CLAUDE_CODE_USE_BEDROCK === '1') {
    const required = [
      'AWS_REGION',
      'AWS_BEARER_TOKEN_BEDROCK',
      'ANTHROPIC_SMALL_MODEL',
      'ANTHROPIC_MEDIUM_MODEL',
      'ANTHROPIC_LARGE_MODEL',
    ];
    const missing = required.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      return err(
        new PentestError(
          `Bedrock mode requires the following env vars in .env: ${missing.join(', ')}`,
          'config',
          false,
          { missing },
          ErrorCode.AUTH_FAILED,
        ),
      );
    }
    logger.info('Bedrock credentials OK');
    return ok(undefined);
  }

  // 3. Vertex AI mode — validate required GCP credentials are present
  if (process.env.CLAUDE_CODE_USE_VERTEX === '1') {
    const required = [
      'CLOUD_ML_REGION',
      'ANTHROPIC_VERTEX_PROJECT_ID',
      'ANTHROPIC_SMALL_MODEL',
      'ANTHROPIC_MEDIUM_MODEL',
      'ANTHROPIC_LARGE_MODEL',
    ];
    const missing = required.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      return err(
        new PentestError(
          `Vertex AI mode requires the following env vars in .env: ${missing.join(', ')}`,
          'config',
          false,
          { missing },
          ErrorCode.AUTH_FAILED,
        ),
      );
    }
    // Validate service account credentials file is accessible
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath) {
      return err(
        new PentestError(
          'Vertex AI mode requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account key JSON file',
          'config',
          false,
          {},
          ErrorCode.AUTH_FAILED,
        ),
      );
    }
    try {
      await fs.access(credPath);
    } catch {
      return err(
        new PentestError(
          `Service account key file not found at: ${credPath}`,
          'config',
          false,
          { credPath },
          ErrorCode.AUTH_FAILED,
        ),
      );
    }
    logger.info('Vertex AI credentials OK');
    return ok(undefined);
  }

  // 4. Check that at least one credential is present
  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return err(
      new PentestError(
        'No API credentials found. Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in .env (or use CLAUDE_CODE_USE_BEDROCK=1 for AWS Bedrock, or CLAUDE_CODE_USE_VERTEX=1 for Google Vertex AI)',
        'config',
        false,
        {},
        ErrorCode.AUTH_FAILED,
      ),
    );
  }

  // 5. Validate via SDK query
  const authType = process.env.CLAUDE_CODE_OAUTH_TOKEN ? 'OAuth token' : 'API key';
  logger.info(`Validating ${authType} via SDK...`);

  try {
    for await (const message of query({ prompt: 'hi', options: { model: resolveModel('small'), maxTurns: 1 } })) {
      if (message.type === 'assistant' && message.error) {
        return classifySdkError(message.error, authType);
      }
      if (message.type === 'result') {
        break;
      }
    }

    logger.info(`${authType} OK`);
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = isRetryableError(error instanceof Error ? error : new Error(message));

    return err(
      new PentestError(
        retryable
          ? `Failed to reach Anthropic API. Check your network connection.`
          : `${authType} validation failed: ${message}`,
        retryable ? 'network' : 'config',
        retryable,
        { authType },
        retryable ? undefined : ErrorCode.AUTH_FAILED,
      ),
    );
  }
}

// === Target URL Validation ===

/** HTTP HEAD with TLS verification disabled — we check reachability, not certificate validity. */
function httpHead(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const req = transport.request(
      url,
      {
        method: 'HEAD',
        timeout: timeoutMs,
        ...(isHttps && { rejectUnauthorized: false }),
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Connection timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Check that the target URL is reachable from inside the container. */
async function validateTargetUrl(targetUrl: string, logger: ActivityLogger): Promise<Result<void, PentestError>> {
  logger.info('Checking target URL reachability...', { targetUrl });

  // 1. Parse URL
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return err(
      new PentestError(
        `Invalid target URL: ${targetUrl}`,
        'config',
        false,
        { targetUrl },
        ErrorCode.TARGET_UNREACHABLE,
      ),
    );
  }

  // 2. DNS lookup — detect loopback addresses early for a better hint
  const hostname = parsed.hostname;
  let resolvedAddress: string | undefined;
  try {
    const result = await lookup(hostname);
    resolvedAddress = result.address;
  } catch {
    return err(
      new PentestError(
        `Target URL ${targetUrl} is not reachable. Verify the URL is correct and the site is up.`,
        'network',
        false,
        { targetUrl, hostname },
        ErrorCode.TARGET_UNREACHABLE,
      ),
    );
  }

  // 3. HTTP reachability check
  try {
    await httpHead(targetUrl, TARGET_URL_TIMEOUT_MS);

    logger.info('Target URL OK');
    return ok(undefined);
  } catch (error) {
    const isLoopback = isLoopbackAddress(resolvedAddress);
    const detail = error instanceof Error ? error.message : String(error);

    if (isLoopback) {
      const suggestion = targetUrl.replace(hostname, 'host.docker.internal');
      return err(
        new PentestError(
          `Target URL ${targetUrl} resolves to ${resolvedAddress} (loopback) and is not reachable. ` +
            `For local services, use host.docker.internal instead of ${hostname} (e.g., ${suggestion})`,
          'network',
          false,
          { targetUrl, resolvedAddress, hostname },
          ErrorCode.TARGET_UNREACHABLE,
        ),
      );
    }

    return err(
      new PentestError(
        `Target URL ${targetUrl} is not reachable: ${detail}`,
        'network',
        false,
        { targetUrl, resolvedAddress },
        ErrorCode.TARGET_UNREACHABLE,
      ),
    );
  }
}

// === Preflight Orchestrator ===

/**
 * Run all preflight checks sequentially (cheapest first).
 *
 * 1. Repository path exists and contains .git
 * 2. Config file parses and validates (if configPath provided)
 * 3. Credentials validate (API key, OAuth, Bedrock, or Vertex AI)
 * 4. Target URL is reachable from the container
 *
 * Returns on first failure.
 */
export async function runPreflightChecks(
  targetUrl: string,
  repoPath: string,
  configPath: string | undefined,
  logger: ActivityLogger,
  skipGitCheck?: boolean,
  apiKey?: string,
  providerConfig?: import('../types/config.js').ProviderConfig,
): Promise<Result<void, PentestError>> {
  // 1. Repository check (free — filesystem only)
  const repoResult = await validateRepo(repoPath, logger, skipGitCheck);
  if (!repoResult.ok) {
    return repoResult;
  }

  // 2. Config check (free — filesystem + CPU)
  if (configPath) {
    const configResult = await validateConfig(configPath, logger);
    if (!configResult.ok) {
      return configResult;
    }
  }

  // 3. Credential check (cheap — 1 SDK round-trip, skipped when providerConfig present)
  const credResult = await validateCredentials(logger, apiKey, providerConfig);
  if (!credResult.ok) {
    return credResult;
  }

  // 4. Target URL reachability check (cheap — 1 HTTP round-trip)
  const urlResult = await validateTargetUrl(targetUrl, logger);
  if (!urlResult.ok) {
    return urlResult;
  }

  logger.info('All preflight checks passed');
  return ok(undefined);
}

// === Engagement Preflight ===

const ENGAGEMENT_URL_TIMEOUT_MS = 5_000;
const AUTHORIZATION_WARN_DAYS = 90;
const AUTHORIZATION_ERROR_DAYS = 365;
const BLAST_RADIUS_MAX_DNS_LOOKUPS = 10;
const VALID_MODES = new Set<string>(['passive', 'validated', 'active']);
const COMMON_SUBDOMAINS = ['www', 'api', 'app', 'admin', 'portal', 'dev', 'staging', 'mail', 'cdn', 'static'];

export interface PreflightResult {
  check: string;
  passed: boolean;
  severity: 'error' | 'warn';
  message: string;
}

function makePass(check: string, severity: 'error' | 'warn', message: string): PreflightResult {
  return { check, passed: true, severity, message };
}

function makeWarn(check: string, message: string): PreflightResult {
  return { check, passed: false, severity: 'warn', message };
}

function makeCheckError(
  check: string,
  message: string,
  context: Record<string, unknown>,
): Result<PreflightResult[], PentestError> {
  return err(
    new PentestError(
      `Check ${check} failed: ${message}`,
      'config',
      false,
      { check, ...context },
      ErrorCode.CONFIG_INVALID,
    ),
  );
}

async function checkTlsCert(hostname: string): Promise<Result<string, string>> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port: 443, timeout: ENGAGEMENT_URL_TIMEOUT_MS, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.destroy();

          if (!cert?.valid_to) {
            resolve(ok('TLS certificate present'));
            return;
          }

          const validTo = new Date(cert.valid_to);
          if (isNaN(validTo.getTime())) {
            resolve(ok('TLS certificate present (validity not parsed)'));
            return;
          }

          if (validTo < new Date()) {
            resolve(err(`TLS certificate expired on ${cert.valid_to}`));
          } else {
            resolve(ok(`TLS certificate valid until ${cert.valid_to}`));
          }
        } catch (e) {
          socket.destroy();
          resolve(err(`TLS certificate check error: ${e instanceof Error ? e.message : String(e)}`));
        }
      },
    );

    socket.on('error', (e) => resolve(err(`TLS connection failed: ${e.message}`)));
    socket.setTimeout(ENGAGEMENT_URL_TIMEOUT_MS, () => {
      socket.destroy();
      resolve(err('TLS connection timed out'));
    });
  });
}

async function checkBlastRadius(config: EngagementConfig): Promise<Result<string, string>> {
  const { scope } = config;

  if (scope.fqdns && scope.fqdns.length > 0 && scope.max_hosts !== undefined) {
    if (scope.fqdns.length > scope.max_hosts) {
      return err(`Scope has ${scope.fqdns.length} FQDNs but max_hosts is ${scope.max_hosts}`);
    }
    return ok(`FQDN count (${scope.fqdns.length}) within max_hosts (${scope.max_hosts})`);
  }

  if (scope.wildcard && scope.max_hosts !== undefined) {
    const domain = scope.wildcard.replace(/^\*\./, '');
    const subdomains = COMMON_SUBDOMAINS.slice(0, BLAST_RADIUS_MAX_DNS_LOOKUPS);
    const uniqueIps = new Set<string>();

    for (const sub of subdomains) {
      try {
        const result = await lookup(`${sub}.${domain}`);
        uniqueIps.add(result.address);
      } catch {
        // Subdomain doesn't resolve — skip it
      }
    }

    if (uniqueIps.size > scope.max_hosts) {
      return err(
        `Blast radius estimate (${uniqueIps.size} unique IPs from ${subdomains.length} probes) ` +
          `exceeds max_hosts (${scope.max_hosts})`,
      );
    }
    return ok(`Blast radius estimate: ${uniqueIps.size} unique IPs within max_hosts (${scope.max_hosts})`);
  }

  return ok('Blast radius within bounds');
}

/**
 * Run 15 engagement-specific preflight checks before any agent starts.
 *
 * Returns err() on the first severity:'error' check failure.
 * Warnings are collected and returned in the result array without aborting.
 */
export async function runEngagementPreflight(
  config: EngagementConfig,
  logger: ActivityLogger,
): Promise<Result<PreflightResult[], PentestError>> {
  const results: PreflightResult[] = [];
  logger.info('Running engagement preflight checks...');

  // 1. target_url_format
  try {
    new URL(config.target_url);
    results.push(makePass('target_url_format', 'error', `Valid URL: ${config.target_url}`));
  } catch {
    return makeCheckError('target_url_format', `'${config.target_url}' is not a valid URL`, {
      target_url: config.target_url,
    });
  }

  // 2. authorized_by_present
  if (!config.authorized_by.email?.trim() || !config.authorized_by.date?.trim()) {
    return makeCheckError('authorized_by_present', 'authorized_by.email and authorized_by.date are required', {
      authorized_by: config.authorized_by,
    });
  }
  results.push(makePass('authorized_by_present', 'error', `Authorized by: ${config.authorized_by.email}`));

  // 3. authorized_by_date
  const authDate = new Date(config.authorized_by.date);
  if (isNaN(authDate.getTime())) {
    return makeCheckError('authorized_by_date', `'${config.authorized_by.date}' is not a valid ISO date`, {
      date: config.authorized_by.date,
    });
  }
  const ageDays = (Date.now() - authDate.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > AUTHORIZATION_ERROR_DAYS) {
    return makeCheckError(
      'authorized_by_date',
      `authorization is ${Math.round(ageDays)} days old (max ${AUTHORIZATION_ERROR_DAYS} days)`,
      { age_days: Math.round(ageDays) },
    );
  }
  if (ageDays > AUTHORIZATION_WARN_DAYS) {
    results.push(
      makeWarn('authorized_by_date', `Authorization is ${Math.round(ageDays)} days old — consider renewing`),
    );
  } else {
    results.push(makePass('authorized_by_date', 'error', `Authorization is ${Math.round(ageDays)} days old`));
  }

  // 4. scope_defined
  const hasFqdns = (config.scope.fqdns?.length ?? 0) > 0;
  const hasWildcard = !!config.scope.wildcard?.trim();
  if (!hasFqdns && !hasWildcard) {
    return makeCheckError('scope_defined', 'scope.fqdns or scope.wildcard is required', {
      scope: config.scope,
    });
  }
  results.push(
    makePass(
      'scope_defined',
      'error',
      hasWildcard ? `Wildcard scope: ${config.scope.wildcard}` : `${config.scope.fqdns?.length ?? 0} FQDNs in scope`,
    ),
  );

  // 5. scope_wildcard_depth
  if (hasWildcard) {
    const wc = config.scope.wildcard ?? '';
    const starCount = (wc.match(/\*/g) ?? []).length;
    if (starCount > 1 || (starCount === 1 && !wc.startsWith('*.'))) {
      return makeCheckError(
        'scope_wildcard_depth',
        `wildcard '${wc}' must have exactly one '*' at the start (e.g., '*.target.com')`,
        { wildcard: wc },
      );
    }
    results.push(makePass('scope_wildcard_depth', 'error', `Wildcard format OK: ${wc}`));
  } else {
    results.push(makePass('scope_wildcard_depth', 'error', 'No wildcard — check skipped'));
  }

  // 6. max_hosts_if_wildcard
  if (hasWildcard && config.scope.max_hosts === undefined) {
    return makeCheckError('max_hosts_if_wildcard', 'scope.max_hosts is required when scope.wildcard is set', {
      wildcard: config.scope.wildcard,
    });
  }
  results.push(
    makePass(
      'max_hosts_if_wildcard',
      'error',
      hasWildcard ? `max_hosts: ${config.scope.max_hosts}` : 'No wildcard — check skipped',
    ),
  );

  // 7. rate_limit_range
  if (config.rate_limit_rps < 0.1 || config.rate_limit_rps > 100) {
    return makeCheckError(
      'rate_limit_range',
      `rate_limit_rps must be between 0.1 and 100 (got ${config.rate_limit_rps})`,
      { rate_limit_rps: config.rate_limit_rps },
    );
  }
  results.push(makePass('rate_limit_range', 'error', `rate_limit_rps: ${config.rate_limit_rps}`));

  // 8. mode_valid
  if (!VALID_MODES.has(config.mode)) {
    return makeCheckError('mode_valid', `mode must be 'passive', 'validated', or 'active' (got '${config.mode}')`, {
      mode: config.mode,
    });
  }
  results.push(makePass('mode_valid', 'error', `mode: ${config.mode}`));

  // 9. active_mode_roe
  if (config.mode === 'active' && !config.authorized_by.roe_document_hash?.trim()) {
    return makeCheckError('active_mode_roe', 'authorized_by.roe_document_hash is required for active mode', {
      mode: config.mode,
    });
  }
  results.push(
    makePass(
      'active_mode_roe',
      'error',
      config.mode === 'active'
        ? `ROE hash: ${(config.authorized_by.roe_document_hash ?? '').slice(0, 8)}...`
        : 'Not active mode — check skipped',
    ),
  );

  // 10. active_mode_confirmed
  if (config.mode === 'active' && config.active_mode_confirmed !== true) {
    return makeCheckError('active_mode_confirmed', 'active_mode_confirmed must be true for active mode', {
      mode: config.mode,
    });
  }
  results.push(
    makePass(
      'active_mode_confirmed',
      'error',
      config.mode === 'active' ? 'Active mode explicitly confirmed' : 'Not active mode — check skipped',
    ),
  );

  // 11. duplicate_scope_entries (warn)
  if (hasFqdns) {
    const fqdns = config.scope.fqdns ?? [];
    const unique = new Set(fqdns.map((f) => f.toLowerCase()));
    if (unique.size < fqdns.length) {
      results.push(
        makeWarn('duplicate_scope_entries', `Found ${fqdns.length - unique.size} duplicate FQDN(s) in scope`),
      );
    } else {
      results.push(makePass('duplicate_scope_entries', 'warn', 'No duplicate FQDNs'));
    }
  } else {
    results.push(makePass('duplicate_scope_entries', 'warn', 'No FQDN list — check skipped'));
  }

  // 12. engagement_id_unique (warn)
  try {
    const entries = await fs.readdir('./workspaces').catch(() => [] as string[]);
    const conflict = entries.some((e) => e.includes(config.engagement_id));
    if (conflict) {
      results.push(
        makeWarn(
          'engagement_id_unique',
          `Workspace matching engagement_id '${config.engagement_id}' already exists — will resume if same URL`,
        ),
      );
    } else {
      results.push(makePass('engagement_id_unique', 'warn', `engagement_id '${config.engagement_id}' is unique`));
    }
  } catch {
    results.push(makePass('engagement_id_unique', 'warn', 'Could not check workspaces directory'));
  }

  // 13. target_url_reachable (5s timeout)
  logger.info('Checking target URL reachability (5s timeout)...');
  try {
    await httpHead(config.target_url, ENGAGEMENT_URL_TIMEOUT_MS);
    results.push(makePass('target_url_reachable', 'error', `${config.target_url} is reachable`));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return makeCheckError('target_url_reachable', `${config.target_url} is not reachable: ${detail}`, {
      target_url: config.target_url,
    });
  }

  // 14. target_tls_valid (warn)
  const parsedUrl = new URL(config.target_url);
  if (parsedUrl.protocol === 'https:') {
    const tlsResult = await checkTlsCert(parsedUrl.hostname);
    if (!tlsResult.ok) {
      results.push(makeWarn('target_tls_valid', tlsResult.error));
    } else {
      results.push(makePass('target_tls_valid', 'warn', tlsResult.value));
    }
  } else {
    results.push(makePass('target_tls_valid', 'warn', 'Not HTTPS — TLS check skipped'));
  }

  // 15. scope_blast_radius
  const blastResult = await checkBlastRadius(config);
  if (!blastResult.ok) {
    return makeCheckError('scope_blast_radius', blastResult.error, { max_hosts: config.scope.max_hosts });
  }
  results.push(makePass('scope_blast_radius', 'error', blastResult.value));

  const warnings = results.filter((r) => !r.passed);
  logger.info(`Engagement preflight passed`, { checks: results.length, warnings: warnings.length });

  return ok(results);
}

// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import type { ActivityLogger } from '../types/activity-logger.js';
import { DEFAULT_ENGAGEMENT, type EngagementConfig } from '../types/engagement.js';
import { ErrorCode } from '../types/errors.js';
import { err, ok, type Result } from '../types/result.js';
import { PentestError } from './error-handling.js';

/** Minimal CLI flags used to build an EngagementConfig when no engagement.yaml is provided. */
export interface EngagementCliFlags {
  webUrl: string;
  mode?: EngagementConfig['mode'];
  rateLimitRps?: number;
  evidenceBudgetMb?: number;
}

/**
 * Load an EngagementConfig from a YAML file or build a minimal one from CLI flags.
 *
 * 1. If engagementPath is provided — parse the YAML file and merge with defaults.
 * 2. If not provided — build a minimal config from CLI flags, applying defaults.
 * 3. Validate required fields and active_mode safety gate.
 *
 * Returns Result<EngagementConfig, PentestError> — never throws.
 */
export async function loadEngagement(
  engagementPath: string | undefined,
  flags: EngagementCliFlags,
  logger: ActivityLogger,
): Promise<Result<EngagementConfig, PentestError>> {
  let raw: Partial<EngagementConfig> = {};

  // 1. Parse YAML if a path was provided
  if (engagementPath) {
    logger.info('Loading engagement config...', { engagementPath });

    let content: string;
    try {
      content = await fs.readFile(engagementPath, 'utf8');
    } catch {
      return err(
        new PentestError(
          `engagement.yaml not found: ${engagementPath}`,
          'config',
          false,
          { engagementPath },
          ErrorCode.ENGAGEMENT_NOT_FOUND,
        ),
      );
    }

    let parsed: unknown;
    try {
      // FAILSAFE_SCHEMA prevents JS-specific YAML tags (!!js/undefined, etc.)
      parsed = yaml.load(content, { schema: yaml.FAILSAFE_SCHEMA });
    } catch (yamlErr) {
      const detail = yamlErr instanceof Error ? yamlErr.message : String(yamlErr);
      return err(
        new PentestError(
          `Failed to parse engagement.yaml: ${detail}`,
          'config',
          false,
          { engagementPath },
          ErrorCode.CONFIG_INVALID,
        ),
      );
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return err(
        new PentestError(
          'engagement.yaml must be a YAML object, not a scalar or array',
          'config',
          false,
          { engagementPath },
          ErrorCode.CONFIG_INVALID,
        ),
      );
    }

    raw = parsed as Partial<EngagementConfig>;
  }

  // 2. Merge: YAML file values override defaults; CLI flags fill gaps not covered by YAML
  const merged: Partial<EngagementConfig> = {
    ...DEFAULT_ENGAGEMENT,
    target_url: flags.webUrl,
    ...raw,
    // CLI flags win over YAML for mode/rate if YAML didn't set them
    ...(flags.mode !== undefined && !raw.mode ? { mode: flags.mode } : {}),
    ...(flags.rateLimitRps !== undefined && !raw.rate_limit_rps ? { rate_limit_rps: flags.rateLimitRps } : {}),
    ...(flags.evidenceBudgetMb !== undefined && !raw.evidence_budget_mb
      ? { evidence_budget_mb: flags.evidenceBudgetMb }
      : {}),
  };

  // 3. Auto-generate engagement_id if absent
  if (!merged.engagement_id) {
    merged.engagement_id = `ENG-${randomUUID().slice(0, 8)}`;
  }

  // 4. Validate required fields
  const validationError = validateEngagement(merged, engagementPath);
  if (validationError) {
    return err(validationError);
  }

  const config = merged as EngagementConfig;

  // 5. Active mode safety gate — require explicit confirmation
  if (config.mode === 'active' && !config.active_mode_confirmed) {
    return err(
      new PentestError(
        'active mode requires active_mode_confirmed: true in engagement.yaml. ' +
          'Active mode enables destructive tools. Confirm authorization before proceeding.',
        'config',
        false,
        { mode: config.mode },
        ErrorCode.ACTIVE_MODE_NOT_CONFIRMED,
      ),
    );
  }

  logger.info('Engagement config loaded', {
    engagement_id: config.engagement_id,
    mode: config.mode,
    target_url: config.target_url,
  });

  return ok(config);
}

function validateEngagement(
  config: Partial<EngagementConfig>,
  engagementPath: string | undefined,
): PentestError | null {
  const context = { engagementPath };

  if (!config.target_url) {
    return new PentestError(
      'target_url is required in engagement.yaml (or pass -u <url> via CLI)',
      'config',
      false,
      context,
      ErrorCode.CONFIG_INVALID,
    );
  }

  // Validate target_url is a parseable URL
  try {
    new URL(config.target_url);
  } catch {
    return new PentestError(
      `target_url is not a valid URL: ${config.target_url}`,
      'config',
      false,
      context,
      ErrorCode.CONFIG_INVALID,
    );
  }

  if (!config.authorized_by && config.mode !== 'passive') {
    return new PentestError(
      'authorized_by is required in engagement.yaml for validated and active modes',
      'config',
      false,
      context,
      ErrorCode.CONFIG_INVALID,
    );
  }

  if (config.authorized_by) {
    const { name, email, date } = config.authorized_by;
    if (!name || !email || !date) {
      return new PentestError(
        'authorized_by must include name, email, and date',
        'config',
        false,
        context,
        ErrorCode.CONFIG_INVALID,
      );
    }
  }

  if (!config.scope?.fqdns?.length && !config.scope?.wildcard) {
    // Allow missing scope only in passive mode — other modes need explicit scope
    if (config.mode !== 'passive') {
      return new PentestError(
        'scope must define at least one fqdn or a wildcard pattern for validated/active modes',
        'config',
        false,
        context,
        ErrorCode.CONFIG_INVALID,
      );
    }
  }

  if (typeof config.rate_limit_rps !== 'number' || config.rate_limit_rps <= 0) {
    return new PentestError(
      `rate_limit_rps must be a positive number, got: ${config.rate_limit_rps}`,
      'config',
      false,
      context,
      ErrorCode.CONFIG_INVALID,
    );
  }

  if (typeof config.evidence_budget_mb !== 'number' || config.evidence_budget_mb <= 0) {
    return new PentestError(
      `evidence_budget_mb must be a positive number, got: ${config.evidence_budget_mb}`,
      'config',
      false,
      context,
      ErrorCode.CONFIG_INVALID,
    );
  }

  return null;
}

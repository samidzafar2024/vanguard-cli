// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

import type { ActivityLogger } from '../types/activity-logger.js';
import { err, ok, type Result } from '../types/result.js';
import { PentestError } from './error-handling.js';

const DEFAULT_BUDGET_MB = 10;
const PER_TOOL_LIMIT_MB = 1;

/**
 * Tracks evidence bytes collected across all agents in one engagement.
 *
 * Enforces a hard cap (default 10MB) and a per-tool soft cap (1MB).
 * When the budget is exhausted, agents continue but produce proof-only findings.
 */
export class BlastRadiusTracker {
  private bytesCollected = 0;

  constructor(private readonly budgetMb: number = DEFAULT_BUDGET_MB) {}

  get remainingMb(): number {
    return Math.max(0, this.budgetMb - this.bytesCollected / 1_000_000);
  }

  get isExhausted(): boolean {
    return this.bytesCollected >= this.budgetMb * 1_000_000;
  }

  get usedMb(): string {
    return (this.bytesCollected / 1_000_000).toFixed(1);
  }

  /**
   * Track evidence content against the budget.
   *
   * Returns the (possibly truncated) content on success.
   * Returns err() when the budget is fully exhausted — caller should write a notice instead.
   */
  trackEvidence(content: string, label: string, logger?: ActivityLogger): Result<string, PentestError> {
    if (this.isExhausted) {
      logger?.warn('Evidence budget exhausted — stopping collection', {
        used: this.usedMb,
        budget: this.budgetMb,
        label,
      });
      return err(
        new PentestError(
          `Evidence budget exhausted (${this.usedMb}/${this.budgetMb}MB). ` +
            `Finding confirmed at proof level but evidence collection stopped.`,
          'validation',
          false,
          { used_mb: this.usedMb, budget_mb: this.budgetMb },
        ),
      );
    }

    const limitBytes = PER_TOOL_LIMIT_MB * 1_000_000;
    const encoded = Buffer.from(content, 'utf8');
    let finalContent = content;

    if (encoded.length > limitBytes) {
      finalContent =
        content.slice(0, limitBytes) +
        `\n[EVIDENCE TRUNCATED: exceeded ${PER_TOOL_LIMIT_MB}MB per-tool limit. ` +
        `${encoded.length - limitBytes} bytes omitted.]`;
      logger?.warn('Evidence truncated at per-tool limit', {
        label,
        original_mb: (encoded.length / 1_000_000).toFixed(2),
      });
    }

    this.bytesCollected += Buffer.byteLength(finalContent, 'utf8');
    logger?.info('Evidence tracked', { label, remaining_mb: this.remainingMb.toFixed(1) });
    return ok(finalContent);
  }

  summary(): string {
    return `Evidence budget: ${this.usedMb}/${this.budgetMb}MB used`;
  }

  /** Returns remaining MB as a string for prompt variable injection. */
  contextVar(): string {
    return this.remainingMb.toFixed(1);
  }
}

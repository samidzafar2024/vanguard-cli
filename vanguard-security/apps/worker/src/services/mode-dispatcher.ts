// Copyright (C) 2025 CopointAI, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License version 3
// as published by the Free Software Foundation.

import type { EngagementMode } from '../types/engagement.js';
import { ErrorCode } from '../types/errors.js';
import { err, ok, type Result } from '../types/result.js';
import { PentestError } from './error-handling.js';

const MODE_LEVEL: Record<EngagementMode, number> = {
  passive: 0,
  validated: 1,
  active: 2,
};

/**
 * Enforces engagement mode constraints on tool/agent execution.
 *
 * Mode is immutable per engagement. Agents above the engagement mode are
 * blocked — callers log the rejection and skip the agent rather than crashing.
 */
export class ModeDispatcher {
  private readonly engagementMode: EngagementMode;

  constructor(engagementMode: EngagementMode) {
    this.engagementMode = engagementMode;
  }

  canRun(requiredMode: EngagementMode): boolean {
    return MODE_LEVEL[requiredMode] <= MODE_LEVEL[this.engagementMode];
  }

  assertCanRun(toolName: string, requiredMode: EngagementMode): Result<void, PentestError> {
    if (!this.canRun(requiredMode)) {
      return err(
        new PentestError(
          `Tool '${toolName}' requires mode '${requiredMode}' but engagement mode is '${this.engagementMode}'. ` +
            `Start a new engagement with mode '${requiredMode}' and appropriate authorization.`,
          'config',
          false,
          { tool: toolName, required: requiredMode, current: this.engagementMode },
          ErrorCode.CONFIG_INVALID,
        ),
      );
    }
    return ok(undefined);
  }

  get mode(): EngagementMode {
    return this.engagementMode;
  }
}

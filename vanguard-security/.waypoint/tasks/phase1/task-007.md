# Task 007: Blast-Radius Tracker + Evidence Budget

**Phase**: Phase 1
**Depends on**: Task 001 (EngagementConfig.evidence_budget_mb)
**Estimated**: 1 session
**Labels**: phase1, workflow

## What to build

`blast-radius.ts` service that tracks evidence bytes collected per engagement
and enforces the 10MB hard cap. Wire into DI container + AgentExecutionService.

## Files to create/change

- `apps/worker/src/services/blast-radius.ts` — NEW: `BlastRadiusTracker` class
- `apps/worker/src/services/container.ts` — add BlastRadiusTracker to DI container
- `apps/worker/src/services/agent-execution.ts` — call `tracker.trackEvidence()` before writing deliverables
- `apps/worker/prompts/shared/_rules.txt` — add `blast_radius_remaining_mb` variable instructions

## What to implement

### `blast-radius.ts`

```typescript
import { err, ok, type Result } from '../types/result.js';
import { PentestError } from './error-handling.js';
import type { ActivityLogger } from '../types/activity-logger.js';

const DEFAULT_BUDGET_MB = 10;
const PER_TOOL_LIMIT_MB = 1;

export class BlastRadiusTracker {
  private bytesCollected = 0;

  constructor(
    private readonly budgetMb: number = DEFAULT_BUDGET_MB,
    private readonly logger: ActivityLogger
  ) {}

  get remainingMb(): number {
    return Math.max(0, this.budgetMb - this.bytesCollected / 1_000_000);
  }

  get isExhausted(): boolean {
    return this.bytesCollected >= this.budgetMb * 1_000_000;
  }

  get usedMb(): string {
    return (this.bytesCollected / 1_000_000).toFixed(1);
  }

  trackEvidence(content: string, label: string): Result<string, PentestError> {
    if (this.isExhausted) {
      this.logger.warn('Evidence budget exhausted — stopping collection', {
        used: this.usedMb, budget: this.budgetMb, label
      });
      return err(new PentestError(
        `Evidence budget exhausted (${this.budgetMb}MB used). Finding confirmed at proof level but evidence collection stopped.`,
        'validation',
        false,
        { used_mb: this.usedMb, budget_mb: this.budgetMb }
      ));
    }

    const limitBytes = PER_TOOL_LIMIT_MB * 1_000_000;
    const encoded = Buffer.from(content, 'utf8');
    let finalContent = content;

    if (encoded.length > limitBytes) {
      finalContent = content.slice(0, limitBytes) +
        `\n[EVIDENCE TRUNCATED: exceeded ${PER_TOOL_LIMIT_MB}MB per-tool limit. ${encoded.length - limitBytes} bytes omitted.]`;
      this.logger.warn('Evidence truncated at per-tool limit', { label, original_mb: (encoded.length / 1_000_000).toFixed(2) });
    }

    this.bytesCollected += Buffer.byteLength(finalContent, 'utf8');
    this.logger.info('Evidence tracked', { label, remaining_mb: this.remainingMb.toFixed(1) });
    return ok(finalContent);
  }

  summary(): string {
    return `Evidence budget: ${this.usedMb}/${this.budgetMb}MB used`;
  }

  contextVar(): string {
    return this.remainingMb.toFixed(1);
  }
}
```

### `agent-execution.ts` change

Before writing the deliverable content to disk, call:
```typescript
const tracked = this.blastRadiusTracker.trackEvidence(deliverableContent, agentName);
if (isErr(tracked)) {
  // Budget exhausted — write truncated content with note, mark finding as proof_level_only
  deliverableContent = `[EVIDENCE BUDGET EXHAUSTED]\n${tracked.error.message}\n\n---\n${partialContent}`;
}
```

### `_rules.txt` update

Add variable injection:
```
Evidence budget remaining: {{BLAST_RADIUS_REMAINING_MB}}MB
If < 1MB remaining: limit evidence to proof-only (confirm vulnerability exists, do NOT dump data).
```

## Acceptance Criteria

- [ ] `new BlastRadiusTracker(10, logger).trackEvidence(bigString, 'test')` truncates at 1MB
- [ ] After 10MB total, `trackEvidence()` returns `err`
- [ ] `isExhausted` returns `true` after budget exceeded
- [ ] `summary()` returns readable string
- [ ] Agent deliverable truncated gracefully when budget hit (not crashed)
- [ ] `pnpm run check` passes
- [ ] `pnpm biome` passes

## Notes

- `bytesCollected` counts UTF-8 bytes, not JS string chars
- Budget tracks across all agents in one engagement (container-level, not per-agent)
- When budget exhausted, workflow does NOT stop — agents continue but produce proof-only findings
- Report agent reads tracker summary and includes it in report footer

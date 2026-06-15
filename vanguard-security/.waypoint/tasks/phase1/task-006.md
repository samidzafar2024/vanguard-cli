# Task 006: Three-Mode Dispatcher

**Phase**: Phase 1
**Depends on**: Task 001 (EngagementConfig.mode)
**Estimated**: 1 session
**Labels**: phase1, workflow

## What to build

`mode-dispatcher.ts` service + wire it into the DI container and agent execution.
All tool calls tagged with required mode. Dispatcher blocks tools above engagement mode.

## Files to create/change

- `apps/worker/src/services/mode-dispatcher.ts` — NEW: `ModeDispatcher` class
- `apps/worker/src/services/container.ts` — add ModeDispatcher to DI container
- `apps/worker/src/session-manager.ts` — add `required_mode` to all AgentDefinition entries
- `apps/worker/src/types/agents.ts` — add `required_mode` to `AgentDefinition` type

## What to implement

### `mode-dispatcher.ts`

```typescript
import { err, ok, type Result } from '../types/result.js';
import { PentestError } from './error-handling.js';
import type { EngagementMode } from '../types/engagement.js';

const MODE_LEVEL: Record<EngagementMode, number> = {
  passive: 0,
  validated: 1,
  active: 2,
};

export class ModeDispatcher {
  constructor(private readonly engagementMode: EngagementMode) {}

  canRun(requiredMode: EngagementMode): boolean {
    return MODE_LEVEL[requiredMode] <= MODE_LEVEL[this.engagementMode];
  }

  assertCanRun(toolName: string, requiredMode: EngagementMode): Result<void, PentestError> {
    if (!this.canRun(requiredMode)) {
      return err(new PentestError(
        `Tool '${toolName}' requires mode '${requiredMode}' but engagement mode is '${this.engagementMode}'. Start a new engagement with mode '${requiredMode}' and appropriate authorization.`,
        'config',
        false,
        { tool: toolName, required: requiredMode, current: this.engagementMode }
      ));
    }
    return ok(undefined);
  }
}
```

### `session-manager.ts` — add `required_mode` to AgentDefinition

```typescript
// In AgentDefinition interface (types/agents.ts):
required_mode: EngagementMode;   // 'passive' | 'validated' | 'active'

// In AGENTS record — all existing agents get 'validated':
{
  name: 'injection-vuln',
  deliverableFilename: 'injection_analysis_deliverable.md',
  required_mode: 'validated',   // ADD THIS
  ...
}

// Recon/OSINT agents get 'passive':
{
  name: 'osint-recon',
  required_mode: 'passive',    // passive-safe
}
{
  name: 'pre-recon',
  required_mode: 'passive',
}
```

### `container.ts` — add to DI container

Add `ModeDispatcher` instance created from `EngagementConfig.mode` at workflow start.
`AgentExecutionService` gets dispatcher injected and calls `assertCanRun()` before starting each agent.

## Acceptance Criteria

- [ ] `ModeDispatcher('validated').assertCanRun('inject-exploit', 'active')` → `err`
- [ ] `ModeDispatcher('active').assertCanRun('inject-exploit', 'active')` → `ok`
- [ ] `ModeDispatcher('passive').assertCanRun('injection-vuln', 'validated')` → `err`
- [ ] All existing agents have `required_mode` set
- [ ] `pnpm run check` passes
- [ ] `pnpm biome` passes
- [ ] Rejected tool call is logged to audit (not silently swallowed)

## Notes

- Mode is IMMUTABLE per engagement — ModeDispatcher has no setter
- When dispatcher rejects an agent, the workflow continues (other agents still run), the rejected agent logs `ModeError` to audit and marks itself skipped
- Post-exploit agents (Phase 4) will be registered with `required_mode: 'active'`

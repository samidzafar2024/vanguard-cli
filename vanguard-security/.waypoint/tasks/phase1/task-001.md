# Task 001: EngagementConfig type + loader

**Phase**: Phase 1
**Depends on**: nothing
**Estimated**: 1 session
**Labels**: phase1, workflow

## What to build

Create `EngagementConfig` TypeScript type and `engagement-loader.ts` service.
This is the data contract that every other Phase 1 component reads from.

## Files to create/change

- `apps/worker/src/types/engagement.ts` — NEW: `EngagementConfig`, `EngagementMode`, `EngagementScope`, `EngagementAuthorization`
- `apps/worker/src/services/engagement-loader.ts` — NEW: `loadEngagement()` function
- `apps/worker/src/types/config.ts` — add `EngagementConfig` re-export or import reference

## What to implement

### `apps/worker/src/types/engagement.ts`
```typescript
export type EngagementMode = 'passive' | 'validated' | 'active';

export interface EngagementScope {
  fqdns?: string[];
  wildcard?: string;
  max_hosts?: number;
}

export interface EngagementAuthorization {
  name: string;
  email: string;
  date: string;
  roe_document_hash?: string;
}

export interface EngagementConfig {
  engagement_id: string;
  target_url: string;
  scope: EngagementScope;
  authorized_by: EngagementAuthorization;
  mode: EngagementMode;
  rate_limit_rps: number;
  evidence_budget_mb: number;
  bug_bounty_handle?: string;
  fireprox_gateway?: string;
  contact_email?: string;
  ua_bundle?: 'chrome131_mac' | 'chrome130_win' | 'firefox134_linux' | 'safari18_mac';
  active_mode_confirmed?: boolean;
}

export const DEFAULT_ENGAGEMENT: Partial<EngagementConfig> = {
  mode: 'validated',
  rate_limit_rps: 2,
  evidence_budget_mb: 10,
  ua_bundle: 'chrome131_mac',
};
```

### `apps/worker/src/services/engagement-loader.ts`
- Read YAML file at `engagementPath` using FAILSAFE_SCHEMA
- If no engagement.yaml provided, build minimal config from CLI flags (`webUrl` → `target_url`)
- Auto-generate `engagement_id` as `ENG-${crypto.randomUUID().slice(0, 8)}` if not provided
- Apply `DEFAULT_ENGAGEMENT` defaults
- Return `Result<EngagementConfig, PentestError>`
- Use `ErrorCode.CONFIG_INVALID` for schema failures

## Acceptance Criteria

- [ ] `pnpm run check` passes (TypeScript)
- [ ] `pnpm biome` passes
- [ ] `loadEngagement(undefined, { webUrl: 'https://example.com' })` returns valid `EngagementConfig` with defaults
- [ ] `loadEngagement('engagement.yaml', ...)` correctly reads YAML fields
- [ ] Missing `target_url` returns `err(PentestError)` with `ErrorCode.CONFIG_INVALID`
- [ ] No `console.log` — uses `ActivityLogger`

## Notes

- Use `smol-toml` for TOML and `yaml` with `FAILSAFE_SCHEMA` for YAML (already in deps)
- `engagement_id` must be URL-safe (used in workspace directory names)
- `Result<T,E>` pattern required — no throws from this service

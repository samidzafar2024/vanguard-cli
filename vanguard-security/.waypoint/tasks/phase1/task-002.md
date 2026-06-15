# Task 002: 15 Engagement Preflight Checks

**Phase**: Phase 1
**Depends on**: Task 001 (EngagementConfig type)
**Estimated**: 1 session
**Labels**: phase1, workflow

## What to build

Extend `apps/worker/src/services/preflight.ts` with a new `runEngagementPreflight()` function
that runs 15 engagement-specific checks before any agent starts.

## Files to change

- `apps/worker/src/services/preflight.ts` — ADD `runEngagementPreflight()` function
- `apps/worker/src/temporal/activities.ts` — call `runEngagementPreflight()` in setup activity

## What to implement

### New function in `preflight.ts`

```typescript
export interface PreflightResult {
  check: string;
  passed: boolean;
  severity: 'error' | 'warn';
  message: string;
}

export async function runEngagementPreflight(
  config: EngagementConfig,
  logger: ActivityLogger
): Promise<Result<PreflightResult[], PentestError>>
```

Run all 15 checks, collect results. Return `err()` on first `severity: 'error'` failure.
Warnings are collected and returned in the array but do not abort.

### The 15 checks (in order, cheapest first)

1. `target_url_format` — `new URL(config.target_url)` must not throw. **error**
2. `authorized_by_present` — `authorized_by.email` and `authorized_by.date` non-empty. **error**
3. `authorized_by_date` — parse date, within 365 days. >90 days = **warn**, >365 = **error**
4. `scope_defined` — `fqdns?.length > 0` OR `wildcard` present. **error**
5. `scope_wildcard_depth` — wildcard has at most one `*` and it's at start. **error**
6. `max_hosts_if_wildcard` — if wildcard used, `max_hosts` must be set. **error**
7. `rate_limit_range` — `0.1 <= rate_limit_rps <= 100`. **error**
8. `mode_valid` — value is `passive | validated | active`. **error**
9. `active_mode_roe` — if `mode === 'active'`, `roe_document_hash` required. **error**
10. `active_mode_confirmed` — if `mode === 'active'`, `active_mode_confirmed === true`. **error**
11. `duplicate_scope_entries` — no duplicate entries in `fqdns`. **warn**
12. `engagement_id_unique` — check `workspaces/` dir for existing engagement with same ID. **warn**
13. `target_url_reachable` — HEAD request with 5s timeout, 200/30x passes. **error**
14. `target_tls_valid` — TLS cert not expired (reuse existing TLS check logic). **warn**
15. `scope_blast_radius` — DNS-expand wildcard, count unique IPs, fail if > `max_hosts`. **error**

### Integration in `activities.ts`

Add `runEngagementPreflight()` call in the setup/preflight activity, before agent execution starts.
On `err` result → throw `ApplicationFailure` (non-retryable).

## Acceptance Criteria

- [ ] `pnpm run check` passes
- [ ] `pnpm biome` passes
- [ ] All 15 checks run when called
- [ ] Missing `authorized_by.email` → returns `err` with message referencing check name
- [ ] `mode: 'active'` without `roe_document_hash` → hard fail
- [ ] Warnings don't abort — returned in result array
- [ ] Check `target_url_reachable` has 5s timeout (not the existing 10s)
- [ ] No `console.log`

## Notes

- Keep existing `runPreflightChecks()` function intact — add new function alongside it
- Check 15 (`scope_blast_radius`) can be slow — DNS lookup per unique host in expansion. Cap at 10 DNS lookups max then extrapolate.
- Check 12 (`engagement_id_unique`) is a warning not error — same ID = resume, not conflict

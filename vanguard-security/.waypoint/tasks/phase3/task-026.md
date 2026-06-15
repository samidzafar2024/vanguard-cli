# Task 026: Brain Guardian

**Phase**: Phase 3
**Wave**: Background — runs continuously during all vuln + exploit waves
**Depends on**: Task 008 (waf-fingerprint — provides baseline WAF config)
**Labels**: phase3, brain, opsec

## Why This Matters

A real penetration test can get blocked mid-scan. Cloudflare re-challenges after
50 requests. An AWS WAF rule triggers on SQL-like patterns. An intrusion detection
system starts rate-limiting. A honeypot serves unique canary values.

Without the Brain Guardian, Vanguard blindly keeps sending requests, burns the IP,
and triggers an incident response. The client's SOC sees "automated attack" and
the engagement ends prematurely.

The Guardian watches for these signals in real time and intervenes — reducing rate,
rotating UA bundle, pausing — before any blocking becomes permanent.

**The Guardian keeps the engagement alive.**

## What to Build

### Agent: `brain-guardian`

**Agent definition** (`apps/worker/src/session-manager.ts`):
```typescript
'brain-guardian': {
  name: 'brain-guardian',
  displayName: 'Brain Guardian',
  prerequisites: ['waf-fingerprint'],
  promptTemplate: 'brain-guardian',
  deliverableFilename: 'brain_guardian_deliverable.md',
  modelTier: 'medium',
  required_mode: 'passive',
},
```

**Prompt file**: `apps/worker/prompts/brain-guardian.txt`

---

### How Guardian Runs (Background Mode)

The Guardian is not a sequential agent — it runs as a background loop:

```typescript
// apps/worker/src/temporal/workflows.ts
// Start Guardian as background monitor alongside vuln waves
const guardianHandle = await startBackgroundMonitor('brain-guardian', {
  checkIntervalSeconds: 30,
  activityInput,
});

// Run vuln + exploit waves normally
await Promise.allSettled([...vulnAgents]);

// Stop Guardian when waves complete
await guardianHandle.stop();
```

Every 30 seconds, Guardian reads the latest HTTP response patterns from the
shared audit log and decides if intervention is needed.

---

### Detection Patterns and Responses

```
PATTERN 1 — Rate Limit Engaged
  Signal: 3+ consecutive 429 responses within 60 seconds
  Action: Halve current RPS (e.g. 2 RPS → 1 RPS), pause all agents 30 seconds
  Log: "Guardian: rate limit detected (3× 429). RPS reduced to 1. Paused 30s."

PATTERN 2 — WAF Re-Engagement
  Signal: 5+ consecutive 403 responses with new challenge token in body
  Action: Rotate UA bundle (cycle through chrome131 → firefox134 → safari18 → linux)
  Log: "Guardian: WAF challenge re-engaged. Rotating UA to firefox134_linux."

PATTERN 3 — IP-Based Throttling
  Signal: Response time > 10s on endpoints that previously responded < 1s
  Threshold: 3 consecutive slow responses on the same endpoint
  Action: Flag for FireProx rotation if configured, else reduce to 0.5 RPS
  Log: "Guardian: IP throttling detected (avg 12s response). Rate reduced to 0.5 RPS."

PATTERN 4 — Honeypot Detection
  Signal: Unique canary token appears in response (consistent across repeated requests,
          but value is suspiciously unique like a UUID or tracking hash)
  Identify: Same unique value in 3 different response paths
  Action: STOP scan immediately. Alert user. Do not send further requests.
  Log: "Guardian: CRITICAL — honeypot canary detected. Scan stopped. Manual review required."
  User alert: print to terminal, add to deliverable as OPSEC_WARNING

PATTERN 5 — Soft Block Incoming
  Signal: Response codes shift from 200 → 302 with login redirect on previously open endpoints
  Action: Pause 5 minutes, then retry with new session
  Log: "Guardian: session invalidated (mass redirect to login). Pausing 5min."
```

---

### Intervention Mechanism

Guardian writes intervention directives to a shared state that activities read:

```typescript
// apps/worker/src/services/guardian-state.ts — NEW
export class GuardianState {
  private currentRps: number;
  private currentUaBundle: string;
  private paused: boolean = false;
  private honeypotDetected: boolean = false;

  applyIntervention(intervention: GuardianIntervention): void
  getCurrentRps(): number
  getCurrentUaBundle(): string
  isPaused(): boolean
  isHoneypotDetected(): boolean
}
```

Every `vanguardFetch` call checks `GuardianState` before executing:
```typescript
// apps/worker/src/services/vanguard-fetch.ts (Phase 1 component — MODIFY)
if (guardianState.isHoneypotDetected()) {
  throw new PentestError(ErrorCode.HONEYPOT_DETECTED, 'Guardian halted scan');
}
if (guardianState.isPaused()) {
  await sleep(guardianState.getPauseRemainingMs());
}
const rps = guardianState.getCurrentRps();
```

---

### Guardian Deliverable

```markdown
## Brain Guardian — Interventions Log

| Time  | Event                  | Action Taken                  |
|-------|------------------------|-------------------------------|
| 14:23 | 3× 429 responses       | RPS halved: 2 → 1             |
| 14:31 | WAF challenge reissued | UA rotated: safari → firefox  |
| 14:45 | Response times > 10s   | RPS halved: 1 → 0.5           |

**No honeypots detected.**
**Final rate at completion: 0.5 RPS**
**Final UA bundle: firefox134_linux**
```

---

## Files to Create/Change

- `apps/worker/prompts/brain-guardian.txt` — NEW
- `apps/worker/src/services/guardian-state.ts` — NEW: shared mutable state for interventions
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add `runBrainGuardianMonitor` (background mode)
- `apps/worker/src/temporal/workflows.ts` — start Guardian before vuln waves, stop after
- `apps/worker/src/services/vanguard-fetch.ts` — check GuardianState before each request (Phase 1 file)
- `apps/worker/src/types/errors.ts` — add `HONEYPOT_DETECTED` to ErrorCode

## Acceptance Criteria

- [ ] Detects 3 consecutive 429 responses and halves RPS
- [ ] Rotates UA bundle after 5 consecutive 403s with challenge
- [ ] Stops scan completely when honeypot canary detected
- [ ] `vanguardFetch` respects Guardian pause/RPS/UA settings
- [ ] Guardian runs in background — doesn't block vuln wave execution
- [ ] Deliverable contains intervention log with timestamps
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/02-opsec-industry-standards.md`
- GuardianState is in-memory per workflow — never persisted to Temporal history
- Honeypot detection is conservative — better to false-alarm than scan a honeypot
- Guardian output is OPSEC-critical — every intervention logged to audit trail
- Temporal constraint: Guardian reads audit log, not Temporal signals (simpler + safe for replay)

# Task 024: Brain Critic

**Phase**: Phase 3
**Wave**: Post-exploit — runs after ALL vuln + exploit pairs complete, before report
**Depends on**: All vuln/exploit agents complete, Task 023 (Brain Planner)
**Labels**: phase3, brain

## Why This Matters

Today, if `injection-vuln` finds a false positive (a 500 error page that looks like
SQLi but isn't), that finding goes directly into the report. The client gets a
Critical finding that turns out to be wrong. That destroys credibility.

The Brain Critic is the quality gate. It reviews every finding before it enters the
report. False positives get flagged. Duplicate findings from multiple agents get
merged. Severity scores get validated against actual evidence.

**Without Brain Critic:** Every finding goes into the report, including false positives.
**With Brain Critic:** Every finding is validated. The report has zero false positives.

## What to Build

### Agent: `brain-critic`

**Agent definition** (`apps/worker/src/session-manager.ts`):
```typescript
'brain-critic': {
  name: 'brain-critic',
  displayName: 'Brain Critic',
  prerequisites: ['brain-planner'],   // runs after all agents complete
  promptTemplate: 'brain-critic',
  deliverableFilename: 'brain_critic_deliverable.md',
  modelTier: 'large',
  required_mode: 'passive',
},
```

**Prompt file**: `apps/worker/prompts/brain-critic.txt`

---

### Input: All Finding Deliverables

```typescript
// Critic loads every completed agent's deliverable
const findings = await loadAllFindings([
  'injection_vuln_deliverable.md',
  'xss_vuln_deliverable.md',
  'auth_vuln_deliverable.md',
  'authz_vuln_deliverable.md',
  'ssrf_vuln_deliverable.md',
  'injection_exploit_deliverable.md',
  'xss_exploit_deliverable.md',
  // ... all available
]);
```

---

### Critic Review Checklist (per finding)

```
For each finding, answer:

1. REPRODUCIBILITY
   - Is there a request/response pair or code reference as evidence?
   - Could this be reproduced from the evidence alone?
   - If NO evidence → status: needs_review, reason: "no evidence provided"

2. SEVERITY ACCURACY
   - Does the CVSS score match the actual impact described?
   - Critical: full data access, RCE, authentication bypass
   - High: significant data exposure, privilege escalation
   - Medium: limited impact, requires user interaction
   - Low: informational, defense in depth
   - If over-scored → downgrade + reason

3. FALSE POSITIVE DETECTION
   - Error page that mentions SQL but no injection confirmed → false positive
   - 403 on admin endpoint = expected behavior, not AuthZ vuln → false positive
   - Reflected parameter in response but CSP blocks execution → downgrade to Low

4. DEDUPLICATION
   - Same XSS endpoint found by xss-vuln AND xss-exploit → merge into one finding
   - SQLi in /login found by injection-vuln AND also in its exploit → one finding

5. CVSS VALIDATION
   - Cross-check base score against described impact + exploitability
   - No authentication required = AV:N/AC:L/PR:N → verify these match
```

---

### Output Format

```typescript
interface ReviewedFinding {
  original_finding_id: string;
  status: 'confirmed' | 'false_positive' | 'needs_review' | 'downgraded' | 'merged';
  original_severity: string;
  final_severity: string;
  reason?: string;          // required if status != 'confirmed'
  merged_into?: string;     // for status: 'merged' — ID of primary finding
  evidence_quality: 'strong' | 'moderate' | 'weak';
}

// Critic deliverable
interface BrainCriticDeliverable {
  total_reviewed: number;
  confirmed: number;
  false_positives: number;
  downgraded: number;
  merged_duplicates: number;
  reviewed_findings: ReviewedFinding[];
}
```

---

### Example Critic Decisions

**False positive rejection**:
```
Finding: "SQL error in response at /api/users?id=1'"
Critic: Response is a generic 500 page. No SQL error text. No blind timing differential (response time identical ± 3ms). No database error pattern.
Decision: false_positive — reason: "Error page does not confirm SQL injection. No timing or error-based evidence."
```

**Severity downgrade**:
```
Finding: "Reflected XSS in search parameter — Critical"
Critic: Target has Content-Security-Policy: script-src 'self'. XSS is reflected but blocked by CSP. Exploitation requires CSP bypass not demonstrated.
Decision: downgraded — Critical → Medium. reason: "CSP prevents script execution. Finding valid but severity overstated without demonstrated bypass."
```

**Deduplication merge**:
```
Finding A: injection-vuln — "SQLi in /login email field"
Finding B: injection-exploit — "Confirmed SQLi in /login email field — dumped user table"
Critic: B is a deeper version of A, same endpoint.
Decision: merge B into A, elevate severity to Critical (confirmed + exploited), preserve B evidence.
```

---

### Workflow Placement

```typescript
// After ALL vuln + exploit pairs complete:
await Promise.allSettled([...vulnAgents, ...exploitAgents]);

// Brain Critic runs before Chain Hunter and Report
await runSequentialPhase('brain-critic', 'brain-critic', a.runBrainCriticAgent);

// Chain Hunter and Report receive only confirmed findings
const confirmedFindings = await a.loadConfirmedFindings('brain_critic_deliverable.md');
activityInput.brainHints += `Confirmed findings: ${confirmedFindings.length}. False positives removed.`;
```

## Files to Create/Change

- `apps/worker/prompts/brain-critic.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add `runBrainCriticAgent` + `loadConfirmedFindings`
- `apps/worker/src/temporal/workflows.ts` — insert after all vuln/exploit, before chain-hunter
- `apps/worker/src/types/findings.ts` — add `ReviewedFinding` and `BrainCriticDeliverable` types

## Acceptance Criteria

- [ ] Correctly identifies 500 error page response as false positive
- [ ] Correctly downgrades XSS finding when CSP is present and no bypass demonstrated
- [ ] Merges duplicate findings from vuln + exploit agents into single finding
- [ ] Output deliverable contains `confirmed`, `false_positive`, `downgraded`, `merged` counts
- [ ] Chain Hunter and Report receive only `confirmed` findings
- [ ] Phase 4 `remediator` reads from brain-critic output (confirmed findings only)
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/01-hpc-ag-architecture.md`
- Critic is reasoning-only — no HTTP requests, no tool calls
- False positive rate target: < 5% (Critic should be conservative — doubt the finding, not the target)
- CVSS scoring: use CVSS 3.1 base score formula — don't rely on agent's self-assessment
- Merged findings: preserve ALL evidence from both originals

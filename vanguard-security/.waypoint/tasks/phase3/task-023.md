# Task 023: Brain Planner

**Phase**: Phase 3
**Wave**: Between Wave 0 and Wave 1 (and again between Wave 1 and vuln phase)
**Depends on**: Task 010 (osint-recon), Task 013 (CredentialStore)
**Labels**: phase3, brain

## Why This Matters

Without the Brain Planner, every agent runs with the same priority and no context
from prior agents. `xss-vuln` doesn't know that osint-recon found an Express CVE
with EPSS 0.87. `cloud-vuln` doesn't know that github-leaks found an AWS key.

The Brain Planner is the strategic layer. It reads everything discovered so far
and makes intelligent routing decisions: which agents should run next, what should
they focus on, and what credentials or findings should they receive.

**Without Brain Planner:**  Every agent runs blind, same order, every time.
**With Brain Planner:**  Agents run in priority order driven by actual threat intelligence.

## What to Build

### Agent: `brain-planner`

**Agent definition** (`apps/worker/src/session-manager.ts`):
```typescript
'brain-planner': {
  name: 'brain-planner',
  displayName: 'Brain Planner',
  prerequisites: ['osint-recon'],
  promptTemplate: 'brain-planner',
  deliverableFilename: 'brain_planner_deliverable.md',
  modelTier: 'large',     // Opus — strategic reasoning matters
  required_mode: 'passive',
},
```

**Prompt file**: `apps/worker/prompts/brain-planner.txt`

---

### Inputs the Planner Reads

```
1. osint-recon deliverable:
   - tech_stack: ["Express 4.17.1", "React 18", "AWS S3"]
   - active_cves: [{ cve: "CVE-2024-XXXX", epss: 0.87, component: "Express" }]
   - breach_history: "2 breaches (2021, 2023)"
   - high_value_targets: ["admin.target.com", "api.target.com"]
   - subdomains_found: 47

2. CredentialStore.summary():
   - "aws_key found by github-leaks (not yet validated)"
   - "admin:admin confirmed on /grafana by cred-intel"

3. waf-fingerprint deliverable:
   - waf_detected: "cloudflare"
   - bypass_strategy: { rate: 1, tamper: "space2comment", ua: "safari18_mac" }

4. Any partial wave results (e.g. profiling tech stack details)
```

---

### Output: Priority Plan

```markdown
## Brain Planner — Wave 2 Priority Plan

**Priority 1 — cloud-vuln** (inject AWS key from github-leaks)
  Reason: aws_key found in git history, not yet validated. CRITICAL if live.
  brain_hint: "Test AWS key AKIA**** found by github-leaks in commit abc123"

**Priority 2 — injection-vuln** (focus on Express endpoints)
  Reason: CVE-2024-XXXX for Express 4.17.1, EPSS 0.87 = actively exploited
  brain_hint: "Focus on Express route handlers — active CVE for this version"

**Priority 3 — auth-vuln** (use found credentials)
  Reason: admin:admin confirmed on /grafana — test if same creds work elsewhere
  brain_hint: "Try admin:admin on /api/, /admin/, /dashboard/ — confirmed on /grafana"

**Deprioritize — container-vuln**
  Reason: no container indicators in tech stack, skip to save time

**Deprioritize — nuclei-scan**
  Reason: Cloudflare WAF present — nuclei payloads will 403, low value
```

---

### Workflow Execution Points

Brain Planner runs at TWO points:

**Run 1** — After Wave 0 (osint-recon complete), before Wave 1:
```typescript
// workflows.ts
await runSequentialPhase('osint-recon', 'osint-recon', a.runOsintReconAgent);

// Brain Planner Run 1
await runSequentialPhase('brain-planner', 'brain-planner', a.runBrainPlannerAgent);
const plannerOutput = await a.loadDeliverable('brain_planner_deliverable.md');
activityInput.brainHints += plannerOutput.wave1_hints;
```

**Run 2** — After Wave 1 (surface scan + cred-intel complete), before vuln pairs:
```typescript
// Wave 1 complete: profiling, secrets-detection, hardening-auditor, cred-intel done
// Brain Planner Run 2 (re-plan with new credential knowledge)
await runSequentialPhase('brain-planner', 'brain-planner-2', a.runBrainPlannerAgent);
const plan2Output = await a.loadDeliverable('brain_planner_deliverable.md');
activityInput.brainHints += plan2Output.vuln_wave_hints;
```

---

### What Brain Planner Does NOT Do

- Does NOT dynamically reorder Temporal activities (breaks determinism)
- Does NOT make HTTP requests (passive — reasoning only)
- Does NOT store any state outside its deliverable
- Does NOT block agents from running — only adds priority weight via brain_hints

The planner's output is **brain_hints text** injected into each agent's prompt.
Agents self-prioritize based on those hints. The execution order stays deterministic.

## Files to Create/Change

- `apps/worker/prompts/brain-planner.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add `runBrainPlannerAgent` activity wrapper
- `apps/worker/src/temporal/workflows.ts` — insert at 2 execution points, inject output as brain_hints

## Acceptance Criteria

- [ ] Reads osint-recon target_profile and produces priority list
- [ ] Injects AWS key hint into cloud-vuln brain_hints when key found
- [ ] Injects CVE hint into injection-vuln when relevant EPSS score found
- [ ] Outputs deprioritization for agents with no relevant signals
- [ ] Runs twice: after Wave 0 and after Wave 1
- [ ] brain_hints injected into all subsequent agents
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/01-hpc-ag-architecture.md`
- Model tier: Opus (large) — this is the strategic brain, quality matters
- Planner is reasoning-only — no tools, no HTTP, no file writes except deliverable
- If CredentialStore empty + no CVEs + no breach history → output "no priority changes, proceed normally"
- On Temporal replay: planner re-runs from deliverable content (deterministic)

# Task 028: Multi-Target Pipeline

**Phase**: Phase 5
**Wave**: Workflow mode — not an agent, a CLI + workflow feature
**Depends on**: Phase 4 complete (credential feedback loop + CredentialStore must work cross-run)
**Labels**: phase5, platform, workflow

## Why This Matters

Real engagements often have multiple targets. A company has `app.target.com`,
`api.target.com`, `admin.target.com`, and `grafana.target.com` all in scope.

Running Vanguard separately on each means credentials found on Target A are never
tested on Target B. A password found on the Grafana instance might also unlock SSH
on the backend server — but separate runs will never discover this.

Multi-target mode runs Vanguard across all targets in sequence with a shared
CredentialStore, then cross-analyzes for credential reuse and cross-target chains.

**This is how real attackers operate — they test everything they find everywhere.**

## What to Build

### CLI Change: `--targets` flag

```bash
# Current (single target):
./vanguard start -u https://app.target.com -r ./repo

# New (multi-target):
./vanguard start -c engagement.yaml   # engagement.yaml defines target list
```

**engagement.yaml multi-target format**:
```yaml
engagement_id: ENG-2024-CORP
mode: active
active_mode_confirmed: true
authorized_by:
  name: "Security Lead"
  email: "security@corp.com"
  date: "2026-04-28"

multi_target_scope: true
targets:
  - url: https://app.targetcorp.com
    name: main-app
    scope:
      fqdns: ["app.targetcorp.com"]
    repo_path: ./repos/main-app
  - url: https://api.targetcorp.com
    name: api-server
    scope:
      fqdns: ["api.targetcorp.com"]
    repo_path: ./repos/api-server
  - url: https://grafana.targetcorp.com
    name: grafana
    scope:
      fqdns: ["grafana.targetcorp.com"]
    repo_path: ~   # black-box for this target
```

---

### Workflow Mode: Sequential Runs + Shared Store

```typescript
// apps/worker/src/temporal/workflows.ts
async function pentestPipelineWorkflow(input: WorkflowInput): Promise<WorkflowOutput> {
  if (input.multiTargetMode && input.targets && input.targets.length > 0) {
    return runMultiTargetPipeline(input);
  }
  return runSingleTargetPipeline(input);
}

async function runMultiTargetPipeline(input: WorkflowInput): Promise<WorkflowOutput> {
  const sharedCredentialStore = new CredentialStore();
  const allResults: TargetResult[] = [];

  // Run each target sequentially (sequential: credentials from T1 feed into T2)
  for (const target of input.targets!) {
    log.info(`Starting scan: ${target.name} (${target.url})`);

    const result = await runSingleTargetPipeline({
      ...input,
      targetUrl: target.url,
      repoPath: target.repo_path,
      scope: target.scope,
      credentialStore: sharedCredentialStore,    // SHARED: credentials persist across targets
    });

    allResults.push({ target: target.name, result });

    // After each target, check for new credentials to carry forward
    const newCreds = sharedCredentialStore.getAll().filter(c => c.source_target === target.name);
    if (newCreds.length > 0) {
      log.info(`${target.name}: ${newCreds.length} credential(s) found — will test on remaining targets`);
    }
  }

  // Cross-target analysis after all runs complete
  return runCrossTargetAnalysis(allResults, sharedCredentialStore);
}
```

---

### Cross-Target Analysis

After all individual target runs complete:

```typescript
async function runCrossTargetAnalysis(
  results: TargetResult[],
  store: CredentialStore,
): Promise<CrossTargetReport> {

  const crossTargetFindings: CrossTargetFinding[] = [];

  // Finding 1: Credential reuse
  for (const cred of store.getAll()) {
    const usedOn = cred.validated_on_targets ?? [];
    if (usedOn.length > 1) {
      crossTargetFindings.push({
        type: 'credential_reuse',
        severity: 'critical',
        description: `${cred.type} from ${cred.source_target} also valid on: ${usedOn.join(', ')}`,
        affected_targets: usedOn,
      });
    }
  }

  // Finding 2: Same vuln class across multiple targets (systemic issue)
  const vulnsByType = groupFindingsByType(results);
  for (const [vulnType, targets] of vulnsByType) {
    if (targets.length >= 3) {
      crossTargetFindings.push({
        type: 'systemic_vulnerability',
        severity: 'high',
        description: `${vulnType} found on ${targets.length}/${results.length} targets — likely framework-level issue`,
        affected_targets: targets,
        recommendation: 'Fix at the framework/shared library level, not target by target',
      });
    }
  }

  return {
    targets_scanned: results.length,
    cross_target_findings: crossTargetFindings,
    credential_reuse_detected: crossTargetFindings.some(f => f.type === 'credential_reuse'),
    systemic_issues: crossTargetFindings.filter(f => f.type === 'systemic_vulnerability'),
    individual_results: results,
  };
}
```

---

### DiscoveredCredential Update (CredentialStore)

Add `source_target` and `validated_on_targets` fields:

```typescript
// apps/worker/src/services/credential-store.ts — MODIFY
export interface DiscoveredCredential {
  // ... existing fields ...
  source_target: string;              // which target this was found on
  validated_on_targets: string[];     // which targets this credential worked on
}
```

---

### `engagement.yaml` Schema Update

```typescript
// apps/worker/src/types/engagement.ts — MODIFY
export interface EngagementTarget {
  url: string;
  name: string;
  scope: EngagementScope;
  repo_path?: string;
}

export interface EngagementConfig {
  // ... existing fields ...
  multi_target_scope?: boolean;
  targets?: EngagementTarget[];
}
```

---

### Report: Multi-Target Summary

The final report includes a cross-target section:

```markdown
## Cross-Target Analysis

**Targets Scanned**: 3
**Credential Reuse Detected**: YES — CRITICAL

### Credential Reuse Finding
- admin:Password123! found on grafana.targetcorp.com (via cred-intel)
- SAME credential valid on api.targetcorp.com SSH (port 22)
- Cross-target attack path: Grafana → SSH → internal API

### Systemic Issues (3 targets affected)
- Missing HSTS header: app.targetcorp.com, api.targetcorp.com, grafana.targetcorp.com
  → Fix at reverse proxy / load balancer level
```

## Files to Create/Change

- `apps/worker/src/temporal/workflows.ts` — add `runMultiTargetPipeline`, `runCrossTargetAnalysis`
- `apps/worker/src/types/engagement.ts` — add `EngagementTarget`, `multi_target_scope`, `targets`
- `apps/worker/src/services/credential-store.ts` — add `source_target`, `validated_on_targets`
- `apps/cli/src/commands/start.ts` — support engagement.yaml multi-target format as primary input
- `apps/worker/src/types/findings.ts` — add `CrossTargetFinding`, `CrossTargetReport`

## Acceptance Criteria

- [ ] `./vanguard start -c engagement.yaml` works with multi-target list
- [ ] Credential found on Target A is tested on Target B automatically
- [ ] Credential reuse across targets generates Critical cross-target finding
- [ ] Same vuln class on 3+ targets flagged as systemic issue
- [ ] Each target still produces its own individual deliverable
- [ ] Cross-target analysis section at end of combined report
- [ ] CredentialStore cleared completely at end of multi-target run
- [ ] Single-target mode unchanged when `multi_target_scope` is absent
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/10-multi-target-strategies.md`
- Sequential (not parallel) runs by design — credentials from earlier targets must be available for later ones
- Max targets per engagement: 10 (practical limit — not enforced but noted in docs)
- CredentialStore shared across targets — still in-memory only, still cleared at end
- Black-box mode works per-target: targets with no repo_path run black-box automatically

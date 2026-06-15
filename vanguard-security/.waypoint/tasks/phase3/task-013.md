# Task 013: Credential Feedback Loop — Inter-Agent Secret Passing

**Phase**: Phase 3
**Wave**: Brain layer — runs between waves
**Depends on**: Task 010 (osint-recon), Task 011 (cred-intel), Phase 2 complete
**Labels**: phase3, brain, agent

## Why This Matters

Right now agents are isolated silos. `github-leaks` finds an AWS key. Done.
Nobody else knows about it. `cloud-vuln` runs independently with no credentials.

Real attackers don't work in silos. When they find a key, they immediately use it.
The Credential Feedback Loop wires the agents together so found secrets
automatically become ammunition for subsequent agents.

**This is what enables the full black-box attack chain:**
```
URL → github-leaks finds AWS key → brain-planner hands key to cloud-vuln
    → cloud-vuln enumerates with real credentials → S3/RDS/IAM exposed
    → chain-hunter connects: "GitHub history → AWS → prod data"
```

## What to Build

### 1. Credential Store (in-run, in-memory only)

A lightweight in-memory store that agents write to and read from during a run.
**Never persisted to disk. Never logged. Cleared when run ends.**

```typescript
// apps/worker/src/services/credential-store.ts
export interface DiscoveredCredential {
  type: 'aws_key' | 'github_token' | 'stripe_key' | 'db_url' | 'api_key' | 'generic';
  key_id?: string;          // public part (e.g. AKIA****)
  secret_redacted: string;  // NEVER stored — reference only
  source_agent: AgentName;
  source_location: string;  // e.g. "github.com/targetcorp/api-server commit 8f3a21"
  validated: boolean;       // has it been tested and confirmed live?
  permissions?: string[];   // what can this key do? (populated by cloud-vuln/cred-intel)
  discovered_at: number;
}

export class CredentialStore {
  private store: Map<string, DiscoveredCredential> = new Map();

  add(cred: DiscoveredCredential): void
  getByType(type: DiscoveredCredential['type']): DiscoveredCredential[]
  markValidated(keyId: string, permissions: string[]): void
  summary(): string  // safe summary for brain_hints — no secret values
}
```

**CRITICAL security constraint:** Secret values are NEVER stored in the credential store.
The store holds metadata only. The actual secret is passed directly agent-to-agent
via the brain-planner's `<brain_hints>` injection — and only to the specific agent
that needs it, and only for that one run.

### 2. Brain Planner Integration

When `github-leaks`, `secrets-detection`, or `cred-intel` completes and found credentials:

```
brain-planner checks CredentialStore
  → AWS keys found + validated? → inject into cloud-vuln brain_hints
  → GitHub token found? → inject into github-leaks second pass (private repos)
  → DB URL found? → inject into injection-vuln brain_hints (try real connection)
  → Stripe key found? → flag as Critical, skip exploit (financial data — report only)
```

### 3. Agent Prompt Updates

Agents that PRODUCE credentials must write to store:
- `github-leaks` — found keys in git history
- `secrets-detection` — found keys in JS bundles
- `cred-intel` — validated default credentials
- `osint-recon` — API keys from Wayback/URLScan historical data

Agents that CONSUME credentials receive them via `<brain_hints>`:
- `cloud-vuln` — AWS/GCP/Azure keys
- `github-leaks` (second pass) — GitHub token for private repos
- `injection-vuln` — DB connection strings
- `cred-intel` — uses found email patterns for HIBP + spray

### 4. Black-Box Attack Chain Support

Make `-r` (repo path) fully optional. When no repo is provided:
- Skip `pre-recon` and `sast` agents automatically
- All other 28+ agents run normally
- `github-leaks` does public GitHub org discovery from the URL domain
- `secrets-detection` focuses entirely on live JS bundles and exposed files

```typescript
// workflows.ts change
if (input.repoPath) {
  await runSequentialPhase('pre-recon', 'pre-recon', a.runPreReconAgent);
  await runSequentialPhase('sast', 'sast', a.runSastAgent);
} else {
  log.info('No repo path provided — black-box mode, skipping pre-recon and SAST');
  state.completedAgents.push('pre-recon', 'sast');
}
```

## Files to Create/Change

- `apps/worker/src/services/credential-store.ts` — NEW: in-memory credential store
- `apps/worker/src/services/container.ts` — register CredentialStore in DI container
- `apps/worker/src/temporal/workflows.ts` — black-box mode (optional repoPath)
- `apps/worker/prompts/brain-planner.txt` — add credential routing logic
- `apps/worker/prompts/github-leaks.txt` — write found credentials to store
- `apps/worker/prompts/secrets-detection.txt` — write found credentials to store
- `apps/worker/prompts/cloud-vuln.txt` — read AWS/GCP/Azure creds from brain_hints

## Attack Chain This Enables

```
./vanguard start -u https://target.com   ← no repo, no creds, no access

osint-recon     → finds github.com/targetcorp
github-leaks    → git history: AWS key in deleted commit 6mo ago
                → CredentialStore.add({ type: 'aws_key', ... })
brain-planner   → cloud-vuln ko inject: "test this AWS key"
cloud-vuln      → aws sts get-caller-identity → VALID
                → s3 ls → targetcorp-prod-backups (PUBLIC)
chain-hunter    → CRITICAL: URL → GitHub → AWS key → prod S3 accessible
report          → full chain with evidence, one-click reproducible
```

## Acceptance Criteria

- [ ] `./vanguard start -u <url>` works with no `-r` flag (black-box mode)
- [ ] `github-leaks` writes discovered credentials to CredentialStore
- [ ] `brain-planner` reads store and injects into relevant agents via brain_hints
- [ ] `cloud-vuln` uses injected AWS key if provided in brain_hints
- [ ] Secret values never appear in any log file, deliverable, or audit trail
- [ ] CredentialStore is cleared when workflow ends (no persistence)
- [ ] `pnpm run check` passes

## Notes

- Secret values must NEVER be stored — store key_id (public part) only
- The actual secret is passed as an ephemeral brain_hint to a specific agent
- If a found credential is financial (Stripe, PayPal) — report it, don't test it
- GitHub token found in public repo → immediately test if it works
- Validated credentials = auto-elevated to Critical severity in report

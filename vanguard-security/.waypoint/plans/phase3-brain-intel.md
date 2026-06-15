# Plan: Phase 3 — Intelligence Agents + Brain Core

**Status**: Draft
**Date**: 2026-04-28
**Spec ref**: `.waypoint/specs/phase3-brain-intel.md`
**Tasks**: task-010, task-011, task-012, task-013, task-023, task-024, task-025, task-026

---

## Architecture Overview

Phase 3 adds five components across two categories:

**Intelligence Agents** (task-010, task-011, task-012) — new attack-surface agents that run in early waves.
**Brain Core + Feedback Loop** (task-013) — the reasoning layer that coordinates all agents and enables credential chaining.

```
Temporal Workflow (post Phase 1+2)
  │
  ▼
═══════════════════════════════════════════════════════
WAVE 0 — Zero Contact (NEW)
  ├── [C1] osint-recon (repositioned from Phase 4 chain)
  │         No target contact. Public sources only.
  │         crt.sh + HIBP + Shodan (optional) + NVD/CVE
  │         Output → target_profile for Brain Planner
═══════════════════════════════════════════════════════
  │
  ▼
  [C5] Brain Planner reads osint-recon output           (NEW)
       Prioritises agent execution order based on:
       - EPSS scores for detected tech stack
       - Breach history → escalate cred-intel priority
       - Discovered subdomains → add to scan scope
  │
  ▼
═══════════════════════════════════════════════════════
WAVE 0B — First Probes (existing Phase 2)
  ├── waf-fingerprint (Phase 2)
═══════════════════════════════════════════════════════
  │
  ▼
═══════════════════════════════════════════════════════
WAVE 1 — Surface + Hardening (parallel)
  ├── profiling (existing)
  ├── secrets-detection (Phase 2)
  ├── [C3] hardening-auditor (NEW)
═══════════════════════════════════════════════════════
  │
  ▼
pre-recon → sast → recon (existing sequential)
  │
  ▼
nuclei-scan | ssl-tls | cloud | container (parallel — Phase 1 fix)
  │
  ▼
[C2] cred-intel (after recon finds login endpoints)    (NEW)
  │
  │   writes to CredentialStore if credentials found
  │
  ▼
  [C5] Brain Planner checks CredentialStore             (NEW)
       → injects found credentials into cloud-vuln, injection-vuln
  │
  ▼
7 vuln/exploit pairs (existing, now credential-aware)
  │
  ▼
  [C6] Brain Critic validates all findings              (NEW)
  [C7] Brain Chain Hunter connects findings             (NEW)
  [C8] Brain Guardian monitors OPSEC                   (NEW)
  │
  ▼
report
```

---

## Component Designs

### C1 — Enhanced osint-recon (Wave 0 reposition)

**Files**:
- `apps/worker/prompts/osint-recon.txt` — UPDATE (enhance with zero-contact OSINT sources)
- `apps/worker/src/session-manager.ts` — change prerequisites from `['container-vuln']` to `[]`
- `apps/worker/src/temporal/workflows.ts` — move to Wave 0 before profiling

**Prerequisite change** (session-manager.ts):
```typescript
'osint-recon': {
  // ...existing fields...
  prerequisites: [],   // WAS: ['container-vuln'] — now runs Wave 0
  modelTier: 'large',
}
```

**Prompt additions** (`osint-recon.txt`):

Zero-contact phase (before any target request):
```
1. crt.sh API: GET https://crt.sh/?q=%.{domain}&output=json
   → extract unique subdomains, wildcard patterns
2. URLScan.io public: GET https://urlscan.io/api/v1/search/?q=domain:{domain}
   → historical scans, JS files seen, cookies observed
3. Wayback Machine: GET https://web.archive.org/cdx/search/cdx?url=*.{domain}&output=json
   → old endpoints, old JS files with possible leaked data
4. HaveIBeenPwned: GET https://haveibeenpwned.com/api/v3/breaches (filter by domain)
   → domain breach history (use HIBP_API_KEY if in engagement.yaml)
5. NVD CVE API: GET https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch={tech}
   → CVEs for each detected tech stack component
6. EPSS scores: GET https://api.first.org/data/v1/epss?cve={cve_id}
   → exploitation probability for each CVE found
```

Optional (if API keys in engagement.yaml):
```
Shodan:         GET https://api.shodan.io/dns/domain/{domain}?key={SHODAN_API_KEY}
Censys:         POST https://search.censys.io/api/v2/hosts/search
SecurityTrails: GET https://api.securitytrails.com/v1/domain/{domain}/subdomains
```

Output format:
```json
{
  "target_profile": {
    "company_size": "inferred from sub count + Shodan",
    "tech_stack": ["React", "Node.js", "AWS"],
    "subdomains_found": 47,
    "high_value_targets": ["admin.target.com", "api.target.com"],
    "breach_history": "2 breaches (2021, 2023)",
    "active_cves": [
      { "cve": "CVE-2024-XXXX", "component": "Express", "epss": 0.87, "severity": "high" }
    ],
    "credentials_hint": "domain in 2 breaches — check cred-intel agent"
  }
}
```

**Workflow placement** (`workflows.ts`):
```typescript
// === Wave 0: OSINT — zero target contact ===
await runSequentialPhase('osint-recon', 'osint-recon', a.runOsintReconAgent);

// Brain Planner reads profile + adjusts priority
const targetProfile = await a.loadTargetProfile(activityInput);
activityInput.brainHints += buildPlannerHints(targetProfile);
```

---

### C2 — Credential Intelligence Agent (`cred-intel`)

**Files**:
- `apps/worker/prompts/cred-intel.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity
- `apps/worker/src/temporal/workflows.ts` — after recon, before vuln pairs

**Agent definition**:
```typescript
'cred-intel': {
  name: 'cred-intel',
  displayName: 'Credential Intelligence agent',
  prerequisites: ['recon'],
  promptTemplate: 'cred-intel',
  deliverableFilename: 'cred_intel_deliverable.md',
  modelTier: 'medium',
  required_mode: 'validated',
}
```

**Prompt responsibilities**:

Step 1 — Default credential testing (always runs, safe):
```
For each admin panel found by recon (/admin, /jenkins, /grafana, /kibana, /wp-admin):
  Try: admin:admin, admin:password, admin:123456
  One attempt per panel. NOT a spray. Safe.
```

Step 2 — HIBP domain check (always runs):
```
GET https://haveibeenpwned.com/api/v3/breaches (filter by target domain)
→ if breaches found → add breach_count + latest_breach to CredentialStore
```

Step 3 — Password spray (only if validated mode + engagement.yaml allows):
```
Rate: max 1 attempt per account per 10 minutes
Patterns: [Company2024!, Welcome1!, Password1!, Summer2024!]
Stop after: 5 attempts per account OR first success
Track all attempts → NEVER lock out accounts
```

Step 4 — Credential stuffing (only if credential_testing: true in engagement.yaml + active mode):
```
Take breach email:password pairs (from cred-intel deliverable or CredentialStore)
Test against login endpoint: 1 attempt per pair, 30s minimum between attempts
```

**CRITICAL**: credential values NEVER in deliverable. `credentials: "admin:****"` format only.

---

### C3 — Hardening + Misconfiguration Auditor (`hardening-auditor`)

**Files**:
- `apps/worker/prompts/hardening-auditor.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity
- `apps/worker/src/temporal/workflows.ts` — Wave 1 parallel with profiling

**Agent definition**:
```typescript
'hardening-auditor': {
  name: 'hardening-auditor',
  displayName: 'Hardening + Misconfiguration Auditor',
  prerequisites: ['waf-fingerprint'],
  promptTemplate: 'hardening-auditor',
  deliverableFilename: 'hardening_auditor_deliverable.md',
  modelTier: 'medium',
  required_mode: 'passive',
}
```

**Scoring logic** (in prompt):
```
Start at 100.
For each finding:
  Critical → -30 pts
  High     → -15 pts
  Medium   → -5  pts
  Low      → -1  pt

Grade: A=90+, B=75+, C=60+, D=40+, F=<40
Quick wins = findings where fix = "add one header" or "set one flag"
```

**Output**:
```json
{
  "security_score": 42,
  "grade": "D",
  "quick_wins": 3,
  "findings": [
    {
      "type": "missing_hsts",
      "severity": "medium",
      "endpoint": "https://target.com",
      "evidence_safe": "Strict-Transport-Security header absent",
      "remediation": "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains"
    }
  ]
}
```

---

### C4 — Credential Feedback Loop + CredentialStore

**File**: `apps/worker/src/services/credential-store.ts` — NEW

```typescript
export type CredentialType =
  | 'aws_key' | 'github_token' | 'stripe_key'
  | 'db_url' | 'api_key' | 'generic';

export interface DiscoveredCredential {
  id: string;                  // uuid, used as reference
  type: CredentialType;
  key_id_hint: string;         // first 4 chars only: "AKIA****"
  source_agent: AgentName;
  source_location: string;     // "github.com/org/repo commit abc123"
  validated: boolean;
  permissions?: string[];      // populated after validation
  discovered_at: number;
}

export class CredentialStore {
  private readonly store = new Map<string, DiscoveredCredential>();

  add(cred: Omit<DiscoveredCredential, 'id'>): string
  getByType(type: CredentialType): DiscoveredCredential[]
  markValidated(id: string, permissions: string[]): void
  hasValidated(type: CredentialType): boolean
  summary(): string              // safe text for brain_hints injection
  clear(): void                  // called at workflow end
}
```

**Secret passing mechanism** — secrets never stored in CredentialStore.
They are passed agent-to-agent through a single-use `SecretEnvelope`:
```typescript
// apps/worker/src/services/secret-envelope.ts
export class SecretEnvelope {
  private secrets = new Map<string, string>();

  seal(credentialId: string, secretValue: string): void
  open(credentialId: string): string | undefined
  destroyAfterUse(credentialId: string): void  // removes from map after one read
}
```

SecretEnvelope lives only in the workflow DI container memory.
Destroyed at workflow end. Never serialized. Never logged.

**Brain Planner integration** — after each wave, Planner checks store:
```typescript
// In workflows.ts, after github-leaks + secrets-detection complete:
const creds = credentialStore.getByType('aws_key');
if (creds.length > 0) {
  activityInput.brainHints += `\nAWS credentials found by ${creds[0].source_agent}.
    Use secretEnvelope.open('${creds[0].id}') in cloud-vuln to test.`;
}
```

---

### C5 — Brain Planner

**File**: `apps/worker/prompts/brain-planner.txt` — NEW
**Agent definition**:
```typescript
'brain-planner': {
  name: 'brain-planner',
  displayName: 'Brain Planner',
  prerequisites: ['osint-recon'],
  promptTemplate: 'brain-planner',
  deliverableFilename: 'brain_planner_deliverable.md',
  modelTier: 'large',    // Opus — this is the strategic thinker
  required_mode: 'passive',
}
```

**Prompt responsibilities**:
- Read `target_profile` from osint-recon deliverable
- Read `CredentialStore.summary()`
- Read WAF bypass config
- Output: ordered priority list with reasoning
  ```
  Priority 1: github-leaks (breach history: 2 breaches, likely leaked creds)
  Priority 2: injection-vuln (CVE-2024-XXXX EPSS 0.87 for Express)
  Priority 3: auth-vuln (cred-intel found admin:admin on /grafana)
  ...
  ```
- Runs between Wave 0 and Wave 1, and again between Wave 1 and vuln phase

---

### C6 — Brain Critic

**File**: `apps/worker/prompts/brain-critic.txt` — NEW
**Runs**: after all vuln/exploit pairs complete, before report

**Responsibilities**:
- Reviews each finding for: reproducibility, severity accuracy, evidence completeness
- Deduplicates findings across agents (same vuln found by two agents = one finding)
- Marks false positives with reason
- Validates CVSS score against evidence
- Output: reviewed finding list with `status: confirmed | false_positive | needs_review`

---

### C7 — Brain Chain Hunter

**File**: `apps/worker/prompts/brain-chain-hunter.txt` — NEW
**Runs**: after Critic, before report

**Pattern library** (`apps/worker/configs/chain-patterns.yaml`):
```yaml
patterns:
  - id: xss_cors_session
    components: [xss, cors_wildcard, missing_samesite]
    severity: critical
    chain: "XSS steals token via CORS-enabled fetch, SameSite bypass"

  - id: ssrf_imds_cloud
    components: [ssrf, aws_imds_reachable]
    severity: critical
    chain: "SSRF reaches IMDS, leaks AWS credentials"

  - id: github_history_aws
    components: [git_secret_found, aws_key_validated]
    severity: critical
    chain: "Deleted git commit contains live AWS credentials"

  - id: open_redirect_oauth
    components: [open_redirect, oauth_flow]
    severity: high
    chain: "Open redirect hijacks OAuth token in redirect_uri"
  # ... 76 more patterns
```

---

### C8 — Brain Guardian

**File**: `apps/worker/prompts/brain-guardian.txt` — NEW
**Runs**: continuously as a background heartbeat during vuln/exploit waves

**Detection patterns**:
```
- 3 consecutive 429s → rate limit engaged → halve RPS, wait 30s
- 5 consecutive 403s with new challenge token → WAF re-engaged → rotate UA bundle
- Response time > 10s on previously fast endpoints → IP-based throttling → switch to FireProx
- Honeypot indicators (unique canary values in responses) → stop scan, alert user
```

---

### C9 — Black-Box Mode (optional repoPath)

**File**: `apps/worker/src/temporal/workflows.ts` — modify

```typescript
// Black-box mode: skip source-code-dependent agents if no repo provided
if (activityInput.repoPath) {
  await runSequentialPhase('pre-recon', 'pre-recon', a.runPreReconAgent);
  await runSequentialPhase('sast', 'sast', a.runSastAgent);
} else {
  log.info('Black-box mode — no repo path provided. Skipping pre-recon and SAST.');
  state.completedAgents.push('pre-recon', 'sast');
}
```

**CLI change** — make `-r` optional:
```typescript
// apps/cli/src/index.ts — repoPath is now optional
// When absent: repoPath = '' or undefined, passed through to worker
```

---

## ALL_AGENTS Update

```typescript
export const ALL_AGENTS = [
  'osint-recon',         // repositioned: Wave 0 (WAS: after container-vuln)
  'waf-fingerprint',     // Phase 2: Wave 0B
  'profiling',
  'secrets-detection',   // Phase 2: Wave 1
  'hardening-auditor',   // Phase 3: Wave 1
  'pre-recon',
  'sast',
  'recon',
  'nuclei-scan',
  'ssl-tls-vuln',
  'cloud-vuln',
  'container-vuln',
  'github-leaks',
  'supply-chain',
  'cred-intel',          // Phase 3: after recon
  'brain-planner',       // Phase 3: between waves
  // ... 7 vuln + 7 exploit agents (existing) ...
  'brain-critic',        // Phase 3: after all exploits
  'brain-chain-hunter',  // Phase 3: after critic
  'report',
] as const;
```

---

## Dependencies Between Components

```
C1 (osint-recon Wave 0)
  └─► C5 (Brain Planner reads target_profile)
  └─► C2 (cred-intel uses breach_history hint)

C2 (cred-intel)
  └─► C4 (CredentialStore — writes found credentials)

Phase 2 (waf-fingerprint, secrets-detection)
  └─► C4 (CredentialStore — secrets-detection writes found API keys)

C4 (CredentialStore)
  └─► C5 (Brain Planner reads store, routes credentials)
  └─► cloud-vuln (receives AWS keys via brain_hints)
  └─► injection-vuln (receives DB URLs via brain_hints)

C5 (Brain Planner)
  └─► ALL subsequent agents (priority hints via brain_hints)

All vuln/exploit agents
  └─► C6 (Brain Critic validates findings)

C6 (Critic)
  └─► C7 (Chain Hunter receives validated findings)

C7 (Chain Hunter)
  └─► report (chains included in final report)

C8 (Guardian) — parallel to all waves, no dependencies
C9 (Black-box mode) — workflow-level flag, no agent dependencies
```

**Build order**:
1. C9 (black-box mode) — simple workflow change, unblock everything
2. C1 (osint-recon reposition) — change prerequisites + workflow placement
3. C3 (hardening-auditor) — new agent, independent
4. C2 (cred-intel) — new agent, depends on recon
5. C4 (CredentialStore) — new service, needed before brain agents
6. C5 (Brain Planner) — needs C4 + C1 output
7. C6 (Brain Critic) — needs all vuln/exploit complete
8. C7 (Chain Hunter) — needs C6 output
9. C8 (Guardian) — background monitor, can ship last

---

## Integration Points (existing files to modify)

| File | Change |
|---|---|
| `apps/worker/src/types/agents.ts` | Add 5 new agents to ALL_AGENTS, reorder |
| `apps/worker/src/session-manager.ts` | Add definitions for all new agents, fix osint-recon prereqs |
| `apps/worker/src/temporal/activities.ts` | Add activity wrappers for each new agent |
| `apps/worker/src/temporal/workflows.ts` | Wave 0 placement, credential routing, black-box mode |
| `apps/worker/src/services/container.ts` | Add CredentialStore + SecretEnvelope to DI container |
| `apps/worker/src/temporal/activities.ts` | Add `loadTargetProfile`, `loadWafHints` helpers |
| `apps/cli/src/index.ts` | Make `-r` flag optional |
| `apps/worker/configs/chain-patterns.yaml` | NEW — 80 chain patterns |

---

## Open Questions (resolved)

1. **Brain agents: do they run as Claude Agent SDK agents or as pure prompt calls?** → Pure prompt calls via `query()` (no tools). They reason over deliverable text, produce structured output. No tool use needed — they are reasoning-only.
2. **CredentialStore thread safety in Temporal?** → Temporal activities are single-threaded per worker. No concurrency issue. CredentialStore is per-workflow, not shared.
3. **Brain Planner changes execution order — how?** → Planner writes a priority manifest. Workflow reads it before dispatching vuln agents. Does not dynamically reorder Temporal activities (determinism constraint). Instead: Planner output is passed as brain_hints weight — agents self-prioritize within their own context.
4. **SecretEnvelope in Temporal replay?** → SecretEnvelope is never serialized or put in workflow state. On replay, secrets are re-discovered by agents naturally. This is safe — Temporal replay re-executes activities.
5. **osint-recon rename to threat-intel?** → No rename. Keep `osint-recon`. Saves churn across all files. The prompt content changes, not the agent name.

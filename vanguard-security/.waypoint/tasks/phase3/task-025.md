# Task 025: Brain Chain Hunter

**Phase**: Phase 3
**Wave**: After Brain Critic, before report
**Depends on**: Task 024 (Brain Critic — needs confirmed findings as input)
**Labels**: phase3, brain

## Why This Matters

Individual findings are easy to underestimate. "Medium: reflected XSS in search" sounds
manageable. "Low: CORS wildcard on /api/token" sounds like nothing.

But together: XSS steals the auth token via CORS-enabled fetch = **Critical: account takeover**.

The Brain Chain Hunter reads all confirmed findings and applies an 80-pattern library
to detect these multi-step exploit chains. A chain turns a Medium + Low into a Critical.
This is what produces the headline finding in every good pentest report.

**This is what separates a Vanguard report from a vulnerability list.**

## What to Build

### Agent: `brain-chain-hunter`

**Agent definition** (`apps/worker/src/session-manager.ts`):
```typescript
'brain-chain-hunter': {
  name: 'brain-chain-hunter',
  displayName: 'Brain Chain Hunter',
  prerequisites: ['brain-critic'],
  promptTemplate: 'brain-chain-hunter',
  deliverableFilename: 'brain_chain_hunter_deliverable.md',
  modelTier: 'large',
  required_mode: 'passive',
},
```

**Prompt file**: `apps/worker/prompts/brain-chain-hunter.txt`

---

### Chain Pattern Library

**New file**: `apps/worker/configs/chain-patterns.yaml`

```yaml
version: "1.0"
patterns:

  # ── Authentication Chains ──────────────────────────────────────────
  - id: xss_cors_account_takeover
    components: [xss_reflected_or_stored, cors_wildcard_api]
    severity: critical
    chain: "XSS in any page → fetch() to CORS-open API endpoint → steal auth token → account takeover"
    mitre: "T1185 — Man in the Browser"

  - id: open_redirect_oauth_hijack
    components: [open_redirect, oauth_redirect_uri]
    severity: high
    chain: "Open redirect → craft malicious OAuth redirect_uri → authorization code stolen"
    mitre: "T1550.001 — Use Alternate Authentication Material"

  - id: xss_csrf_bypass
    components: [xss_stored, missing_csrf_token]
    severity: critical
    chain: "Stored XSS extracts CSRF token from DOM → forges authenticated state-change request"
    mitre: "T1185"

  # ── Credential Chains ──────────────────────────────────────────────
  - id: github_history_aws_access
    components: [git_secret_found, aws_key_type]
    severity: critical
    chain: "Deleted git commit contains live AWS key → IAM enumeration → cloud resource access"
    mitre: "T1552.004 — Unsecured Credentials: Private Keys"

  - id: ssrf_imds_credential_theft
    components: [ssrf_confirmed, cloud_environment_detected]
    severity: critical
    chain: "SSRF → IMDS endpoint (169.254.169.254) → temporary AWS/GCP/Azure credentials → full cloud access"
    mitre: "T1552.005 — Cloud Instance Metadata API"

  - id: default_creds_lateral_movement
    components: [default_credentials_confirmed, internal_service_found]
    severity: high
    chain: "Default credentials on admin panel → pivot to internal network services"
    mitre: "T1078.001 — Default Accounts"

  # ── Injection Chains ──────────────────────────────────────────────
  - id: sqli_file_read_rce
    components: [sqli_confirmed, mysql_file_priv_or_mssql]
    severity: critical
    chain: "SQLi with FILE privilege → read /etc/passwd → write web shell → RCE"
    mitre: "T1505.003 — Web Shell"

  - id: sqli_auth_bypass_priv_esc
    components: [sqli_in_login, admin_panel_found]
    severity: critical
    chain: "SQLi in login form → bypass authentication → admin panel access → privilege escalation"
    mitre: "T1190 — Exploit Public-Facing Application"

  # ── SSRF Chains ──────────────────────────────────────────────────
  - id: ssrf_internal_services
    components: [ssrf_confirmed, internal_port_found]
    severity: high
    chain: "SSRF → internal service scan → unauthenticated Redis/Elasticsearch/Jenkins → data access"
    mitre: "T1018 — Remote System Discovery"

  - id: ssrf_s3_exfil
    components: [ssrf_confirmed, s3_bucket_found]
    severity: critical
    chain: "SSRF → S3 bucket listing → unauthenticated bucket read → data exfiltration path"
    mitre: "T1530 — Data from Cloud Storage"

  # ── Infrastructure Chains ─────────────────────────────────────────
  - id: subdomain_takeover_xss
    components: [subdomain_dangling_cname, xss_via_subdomain]
    severity: critical
    chain: "Dangling CNAME → claim subdomain on third-party → XSS on parent domain via cookie sharing"
    mitre: "T1584.001 — Compromise Infrastructure: Domains"

  - id: exposed_git_source_code_analysis
    components: [git_directory_exposed, source_code_accessible]
    severity: high
    chain: ".git directory exposed → download full source code → find hardcoded credentials or logic flaws"
    mitre: "T1552.001 — Unsecured Credentials: Credentials in Files"

  - id: debug_mode_rce
    components: [debug_mode_enabled, framework_debugger]
    severity: critical
    chain: "Django/Laravel debug mode enabled → interactive debugger on error pages → arbitrary Python/PHP execution"
    mitre: "T1059 — Command and Scripting Interpreter"

  # ── Supply Chain Chains ───────────────────────────────────────────
  - id: outdated_dependency_known_cve
    components: [outdated_library_detected, known_cve_for_version]
    severity: high
    chain: "Outdated dependency with known CVE → exploit existing PoC → application compromise"
    mitre: "T1195.002 — Supply Chain Compromise: Compromise Software Supply Chain"

  # ... 66 more patterns (full library in research ref)
```

---

### Chain Detection Logic (in prompt)

```
For each pattern in chain-patterns.yaml:
  1. Check if ALL required components are present in confirmed findings
  2. If match: create a ChainFinding with:
     - component_findings: references to original findings
     - chain_description: step-by-step reproduction path
     - elevated_severity: chain severity (usually higher than individual components)
     - mitre_technique: ATT&CK ID
  3. Rank chains by: severity DESC, component_count DESC

Output: top chains (max 5 — report should headline the most critical)
```

---

### Output Format

```typescript
interface ChainFinding {
  chain_id: string;          // e.g. "ssrf_imds_credential_theft"
  chain_severity: 'critical' | 'high' | 'medium';
  title: string;             // human-readable: "SSRF → AWS Credential Theft"
  steps: string[];           // numbered reproduction steps
  component_finding_ids: string[];  // which findings make up the chain
  mitre_technique: string;
  reproduction: string;      // one paragraph plain English
}
```

---

### Workflow Placement

```typescript
// After Brain Critic:
await runSequentialPhase('brain-critic', 'brain-critic', a.runBrainCriticAgent);

// Chain Hunter receives confirmed findings
await runSequentialPhase('brain-chain-hunter', 'brain-chain-hunter', a.runBrainChainHunterAgent);

// Report includes both individual findings + chain findings
```

## Files to Create/Change

- `apps/worker/prompts/brain-chain-hunter.txt` — NEW
- `apps/worker/configs/chain-patterns.yaml` — NEW (80 patterns)
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add `runBrainChainHunterAgent`
- `apps/worker/src/temporal/workflows.ts` — insert after brain-critic, before report
- `apps/worker/src/types/findings.ts` — add `ChainFinding` type

## Acceptance Criteria

- [ ] Detects `ssrf_imds_credential_theft` chain when SSRF + AWS environment both confirmed
- [ ] Detects `xss_cors_account_takeover` when XSS + CORS wildcard both confirmed
- [ ] Chain severity correctly elevates (e.g. Medium XSS + Low CORS → Critical chain)
- [ ] No chain detected when only ONE component present (not a chain with missing components)
- [ ] Report agent receives chain findings alongside individual findings
- [ ] chain-patterns.yaml contains at least 20 patterns (start with these, expand to 80)
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/06-h1-chain-corpus.md` (real HackerOne chain patterns)
- Start with the 14 patterns in this task — expand to 80 by referencing the corpus
- Chain Hunter is reasoning-only — no HTTP, no tool calls
- A finding can be part of multiple chains — that's valid
- Chains with 3+ components get the highest escalation priority in the report
- chain-patterns.yaml should be git-committed — it's the "intelligence" of the platform

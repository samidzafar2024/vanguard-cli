# Task 019: Network Recon Agent

**Phase**: Phase 5
**Wave**: Wave 0.5 — after osint-recon, before Wave 1
**Depends on**: Phase 4 complete
**Labels**: phase5, agent, network

## Why This Matters

Web vulnerability scanners see what's on port 80 and 443. Real enterprise networks
have internal admin panels on port 8080, databases on 5432, SMB shares on 445,
and domain controllers on 389. A target that looks like "just a website" might be
the public face of a full Windows domain network.

`network-recon` gives Vanguard the ability to see the full attack surface — not just
the web tier. Everything it finds feeds other agents: SSH services go to cred-intel
for default password testing, SMB/LDAP signals go to ad-attack for domain enumeration.

## What to Build

### Agent: `network-recon`

**Agent definition**:
```typescript
'network-recon': {
  prerequisites: ['osint-recon'],
  promptTemplate: 'network-recon',
  deliverableFilename: 'network_recon_deliverable.md',
  modelTier: 'medium',
  required_mode: 'validated',
},
```

**Prompt file**: `apps/worker/prompts/network-recon.txt`

---

### Scanning Strategy

```
Phase A — Host Discovery (validated mode)
  nmap -sn <scope_cidrs>   # ping sweep, no port scan yet
  → Identify live hosts

Phase B — Port Scan (validated mode)
  nmap -sS -sV --top-ports 1000 <live_hosts>
  → Service banner grab for top 1000 ports

Phase C — Full Port + OS (active mode, if enabled)
  nmap -sS -sV -O -p 1-65535 <live_hosts>
  → Full port range + OS fingerprint

Phase D — Service Enumeration
  Per discovered service, run targeted scripts:
  - TCP 22  (SSH):  nmap --script ssh-auth-methods
  - TCP 25  (SMTP): nmap --script smtp-commands
  - TCP 53  (DNS):  nmap --script dns-zone-transfer
  - TCP 139/445 (SMB): nmap --script smb-vuln-* smb-enum-shares
  - TCP 389/636 (LDAP): nmap --script ldap-search
  - TCP 3306 (MySQL): nmap --script mysql-info
  - TCP 5432 (Postgres): nmap --script pgsql-brute
  - TCP 27017 (Mongo): nmap --script mongodb-info
  - TCP 8080/8443: treat as web → feed to vuln pipeline
```

---

### Scope Enforcement

```typescript
// CRITICAL: never scan outside defined scope
function validateScopeCompliance(target: string, scope: EngagementScope): boolean {
  const isInFQDN = scope.fqdns?.some(fqdn => target.endsWith(fqdn));
  const isInCIDR = scope.ip_ranges?.some(cidr => ipInCidr(target, cidr));
  return isInFQDN || isInCIDR;
}

// In prompt:
CONSTRAINT = "NEVER scan IPs or hosts outside the engagement scope. 
              If a discovered host resolves outside scope, log it but do not scan it."
```

---

### Output → Other Agents

```typescript
interface NetworkReconDeliverable {
  live_hosts: string[];
  services: ServiceEntry[];
  topology: {
    domain_controllers: string[];   // port 389/636/3268 → ad-attack
    databases: string[];            // port 3306/5432/27017 → injection-vuln
    web_panels: string[];           // port 8080/8443 → existing vuln pipeline
    ssh_hosts: string[];            // port 22 → cred-intel
    smb_hosts: string[];            // port 445 → ad-attack
  };
  os_fingerprints: Record<string, string>;  // ip → OS guess
}
```

Brain Planner reads this and routes:
- `domain_controllers` detected → schedule `ad-attack`
- SSH hosts detected → pass to `cred-intel` for default credential testing
- Port 8080 web panels → add to existing web vuln pipeline scope

## Files to Create/Change

- `apps/worker/prompts/network-recon.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity wrapper
- `apps/worker/src/temporal/workflows.ts` — insert as Wave 0.5 (between osint-recon and Wave 1)
- `apps/worker/src/types/engagement.ts` — add `ip_ranges?: string[]` to `EngagementScope`

## Acceptance Criteria

- [ ] Runs after osint-recon, before Wave 1 agents
- [ ] Never scans hosts outside engagement scope
- [ ] Produces topology map distinguishing DC/DB/web/SSH hosts
- [ ] DC detection triggers ad-attack scheduling via Brain Planner
- [ ] SSH host list passed to cred-intel via brain_hints
- [ ] `pnpm run check` passes

## Notes

- nmap is already in the Kali container — no additional tooling needed
- Scope enforcement is mandatory — network scanning outside scope is a legal liability
- OS fingerprinting requires root (already running as root in Kali container)
- Full port scan (-p 1-65535) is slow (10-20 min) — only run in active mode
- For validated mode: top-1000 ports only

# Task 011: Credential Intelligence Agent

**Phase**: Phase 3
**Wave**: Wave 1 — runs with/before auth testing
**Depends on**: Phase 1 + 2, Task 010 (threat intel may have breach hints)
**Labels**: phase3, agent

## Why This Matters

#1 attack vector in real breaches = compromised credentials.
Password spraying + credential stuffing = most common initial access.
If breach DBs have the target's employee passwords, why run complex exploits?

## What to Build

### Agent: `cred-intel`
Tests credential-based attacks in authorized scope.

### Capabilities

**Leaked credential check:**
- Take employee email patterns from threat-intel (e.g., `firstname.lastname@company.com`)
- Check HaveIBeenPwned for those email patterns
- Check if company domain appears in known breach dumps
- Generate likely password patterns from breach data:
  ```
  Company name + year: "Target2024!", "Target@2024"
  Common patterns: "Welcome1!", "Password123!", "Summer2024!"
  Seasonal patterns: "Spring2024", "Winter2023!"
  ```

**Default credential testing:**
- Common admin panels with default creds:
  ```
  /admin → admin:admin, admin:password, admin:123456
  /jenkins → admin:admin, jenkins:jenkins
  /grafana → admin:admin
  /kibana → elastic:changeme
  /wp-admin → admin:admin
  ```
- Service defaults (only in active mode):
  ```
  SSH → root:root, ubuntu:ubuntu, ec2-user:ec2-user
  Database → sa:sa, root:root, postgres:postgres
  ```

**Password spray (validated mode — rate limited):**
- 1 password attempt per account per 10 minutes (avoid lockouts)
- Common passwords: `Company2024!`, `Welcome1!`, `Password1!`
- Stop after first success OR after 5 attempts per account
- Jitter between attempts

**Credential stuffing (if breach data available):**
- Take breach email:password pairs
- Test against target login (1 attempt per pair, heavily rate-limited)
- ONLY with explicit `credential_testing: true` in engagement.yaml

### Output

```json
{
  "findings": [
    {
      "type": "default_credentials",
      "endpoint": "/admin",
      "credentials": "admin:admin",
      "severity": "critical",
      "evidence_safe": "Default credentials accepted on admin panel"
    },
    {
      "type": "password_spray_success",
      "account": "john.doe@target.com",
      "pattern": "company_year_pattern",
      "severity": "critical"
    }
  ],
  "domain_in_breaches": true,
  "breach_count": 3,
  "recommended_actions": ["Enable MFA", "Force password reset for breached accounts"]
}
```

## Files to Create/Change

- `apps/worker/prompts/cred-intel.txt` — NEW
- `apps/worker/src/session-manager.ts` — register agent
- `apps/worker/src/types/agents.ts` — add to AgentName
- `apps/worker/src/temporal/workflows.ts` — Wave 1 (before auth-vuln)

## Acceptance Criteria

- [ ] Checks HIBP for target domain
- [ ] Tests default creds on `/admin`, `/login` endpoints
- [ ] Password spray rate ≤ 1 attempt per 10 min per account
- [ ] Never locks out accounts (track attempt count)
- [ ] Credential values NEVER stored in plaintext in deliverable
- [ ] `credential_testing: false` in engagement.yaml → skip spray/stuffing
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/14-auth-identity-deep-dive.md`
- CRITICAL: account lockout avoidance is mandatory — misconfigured spray = DoS on auth system
- Default creds check is always safe (not a spray, one attempt per panel)
- Credential stuffing requires explicit opt-in AND active mode
- HIBP API key optional — free tier has rate limits

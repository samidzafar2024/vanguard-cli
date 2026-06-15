# Task 012: Hardening + Misconfiguration Auditor

**Phase**: Phase 3
**Wave**: Wave 1 — runs parallel with recon
**Depends on**: Phase 1 + 2 complete
**Labels**: phase3, agent

## Why This Matters

Misconfigs are the easiest wins — always present, easy to find, real impact.
Debug mode on? .git exposed? Security headers missing?
These take 5 minutes to find and are in every real pentest report.

## What to Build

### Agent: `hardening-auditor`
Checks for common misconfigurations and missing security hardening
that real pentesters always look for.

### Checks to Run

**Security Headers (HTTP response analysis):**
```
HSTS missing / max-age too low      → Medium
X-Frame-Options missing             → Medium (clickjacking)
CSP missing / too permissive        → Medium
X-Content-Type-Options missing      → Low
Referrer-Policy missing             → Low
Permissions-Policy missing          → Low
CORS: Access-Control-Allow-Origin: * → High (if credentialed)
Server header leaking version       → Info
X-Powered-By leaking framework      → Info
```

**Exposed Sensitive Endpoints:**
```
/.git/              → Critical (full source code)
/.env               → Critical (credentials)
/.DS_Store          → Medium (directory structure)
/wp-config.php.bak  → Critical
/phpinfo.php        → High
/server-status      → High (Apache status)
/actuator/          → High (Spring Boot internals)
/actuator/env       → Critical (env vars with secrets)
/actuator/heapdump  → Critical (memory dump)
/.well-known/       → Info
/swagger-ui.html    → Info (API docs exposed)
/api-docs           → Info
/graphql            → Info (check if introspection on)
/adminer.php        → Critical (DB admin panel)
/phpmyadmin/        → Critical
```

**TLS/SSL Configuration:**
```
TLS 1.0 / 1.1 still supported  → High
Weak cipher suites              → High
Certificate expiry < 30 days   → Medium
Self-signed cert                → Medium
Certificate mismatch            → High
```

**Cookie Security:**
```
Session cookie missing HttpOnly  → High
Session cookie missing Secure    → High
Session cookie missing SameSite  → Medium
Cookie with sensitive name not protected → High
```

**Information Leakage:**
```
Stack traces in error responses     → Medium
Internal IPs in responses           → Medium
Software version in error pages     → Low
Comment blocks with internal info   → Low
```

**Debug Mode Indicators:**
```
Django DEBUG=True → detailed error pages    → High
Laravel APP_DEBUG=true                       → High
Express stack traces in production           → High
Source maps exposed (.js.map files)         → Medium
```

### Output Format

```json
{
  "findings": [
    {
      "type": "missing_hsts",
      "severity": "medium",
      "endpoint": "https://target.com",
      "evidence_safe": "Strict-Transport-Security header absent",
      "remediation": "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains"
    },
    {
      "type": "git_exposed",
      "severity": "critical",
      "endpoint": "https://target.com/.git/config",
      "evidence_safe": "/.git/config returns 200 with git config content"
    }
  ],
  "security_score": 42,
  "grade": "D",
  "quick_wins": 3
}
```

## Files to Create/Change

- `apps/worker/prompts/hardening-auditor.txt` — NEW
- `apps/worker/src/session-manager.ts` — register agent
- `apps/worker/src/types/agents.ts` — add to AgentName
- `apps/worker/src/temporal/workflows.ts` — Wave 1

## Acceptance Criteria

- [ ] Checks all security headers on target homepage
- [ ] Checks top 10 exposed endpoint paths
- [ ] Checks TLS config
- [ ] Checks cookie flags
- [ ] Produces security score (0-100) + grade (A-F)
- [ ] Produces `hardening_auditor_deliverable.md`
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/17-browser-side-attack-surface.md`
- Security score = weighted sum: critical=30pts each, high=15, medium=5, low=1
- Grade: A=90+, B=75+, C=60+, D=40+, F=<40
- Quick wins = findings with trivial fix (add header, disable debug)
- This agent alone often finds 3-5 reportable findings per engagement

# Task 009: Secrets Detection Agent

**Phase**: Phase 2
**Wave**: Wave 1 — runs with recon
**Depends on**: Phase 1 complete, Task 008 (WAF fingerprint)
**Labels**: phase2, agent

## Why This Is High Value

One AWS key in a JS bundle = instant Critical finding.
Happens in real apps ALL THE TIME.
Current github-leaks only checks GitHub repos — not live runtime secrets.

## What to Build

### Agent: `secrets-detection`
Scans ALL sources for exposed secrets/credentials:
- JavaScript bundles loaded by the app
- HTTP response headers and bodies
- Git history (`.git` exposed)
- Common exposed files (`/.env`, `/config.json`, `/api-keys.txt`)
- HTML source comments
- Sitemap + robots.txt paths
- Error pages leaking stack traces

### Prompt: `apps/worker/prompts/secrets-detection.txt`

Detection patterns:
```
AWS:        AKIA[0-9A-Z]{16}  (Access Key ID)
            [0-9a-zA-Z/+]{40} (Secret Key)
Stripe:     sk_live_[0-9a-zA-Z]{24}
            pk_live_[0-9a-zA-Z]{24}
Twilio:     AC[a-z0-9]{32}
SendGrid:   SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}
GitHub:     ghp_[a-zA-Z0-9]{36}
            gho_[a-zA-Z0-9]{36}
JWT:        eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+
Private key: -----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----
Google API: AIza[0-9A-Za-z-_]{35}
Slack:      xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}
Generic:    password=, api_key=, secret=, token= (in JS/HTML)
```

Exposed file check:
```
/.env, /.env.local, /.env.production
/.git/config, /.git/HEAD
/config.json, /app-config.json
/api-keys.txt, /credentials.txt
/wp-config.php, /config.php
/.aws/credentials
/docker-compose.yml
/package.json (devDependencies leaks)
```

Output:
```json
{
  "findings": [
    {
      "type": "aws_access_key",
      "value_redacted": "AKIA****EXAMPLE",
      "location": "https://target.com/static/js/main.chunk.js:1:45231",
      "severity": "critical",
      "trust_tier": "untrusted",
      "evidence_safe": "AWS Access Key ID pattern found in JS bundle at offset 45231",
      "evidence_tool_output": "regex match, file size 2.3MB"
    }
  ]
}
```

## Files to Create/Change

- `apps/worker/prompts/secrets-detection.txt` — NEW
- `apps/worker/src/session-manager.ts` — register agent
- `apps/worker/src/types/agents.ts` — add to AgentName
- `apps/worker/src/temporal/workflows.ts` — Wave 1 (parallel with recon)

## Acceptance Criteria

- [ ] Detects `AKIA*` pattern in a test JS file
- [ ] Checks `/.env` endpoint (expects 403/404 — logs if 200)
- [ ] Checks `/.git/config` (subdomain takeover indicator)
- [ ] Produces `secrets_detection_deliverable.md`
- [ ] Redacts actual secret values in deliverable (shows first 4 chars only)
- [ ] NEVER logs full secret values to audit files
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/18-supply-chain-attacks.md`
- CRITICAL security note: never store full secret in deliverable or logs
- Always redact: show `AKIA****` not `AKIAIOSFODNN7EXAMPLE`
- False positive handling: confidence score per match type

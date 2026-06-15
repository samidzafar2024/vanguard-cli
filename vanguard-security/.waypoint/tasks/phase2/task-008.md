# Task 008: WAF Fingerprint + Bypass Agent

**Phase**: Phase 2
**Wave**: Wave 0 — runs BEFORE all other agents
**Depends on**: Phase 1 complete (vanguardFetch must exist)
**Labels**: phase2, agent, opsec

## Why This Is Critical

Without WAF detection, every other agent is flying blind.
Cloudflare blocks sqlmap in 2 seconds. AWS WAF blocks nuclei instantly.
WAF fingerprint must run first — output tells all other agents HOW to behave.

## What to Build

### Agent: `waf-fingerprint`
Detects which WAF is present, its confidence level, and generates
a bypass strategy that all subsequent agents will use.

### Prompt: `apps/worker/prompts/waf-fingerprint.txt`

Capabilities:
- Send crafted probe requests via `vanguardFetch`
- Detect WAF vendor from response signatures:
  ```
  Cloudflare  → cf-ray header, __cfduid cookie, "Attention Required" page
  AWS WAF     → x-amzn-requestid, 403 with "Request blocked"
  Akamai      → aka-debug header, "Access Denied" Akamai-style
  Imperva     → x-iinfo header, "incident" in body
  Vercel      → x-vercel-id header
  Cloudfront  → x-amz-cf-id header
  Fastly      → x-served-by with cache node
  None        → proceed normally
  ```
- Generate bypass config for detected WAF:
  ```json
  {
    "waf_detected": "cloudflare",
    "confidence": 0.95,
    "bypass_strategy": {
      "rate_limit_rps": 1,
      "tamper_scripts": ["space2comment", "between", "charunicodeescape"],
      "user_agent": "safari18_mac",
      "encoding": "unicode_escape",
      "fragmentation": true,
      "recommended_tools": ["sqlmap --tamper=space2comment", "ffuf -rate 10"]
    }
  }
  ```
- Output saved to `deliverables/waf_fingerprint_deliverable.md`
- Brain reads this before dispatching any vuln agent

### How Other Agents Use It

Every vuln/exploit agent reads `waf_fingerprint_deliverable.md` via `<brain_hints>`:
```
WAF detected: Cloudflare (confidence: 95%)
Bypass strategy: use space2comment tamper, rate 1 RPS, safari UA
Apply these settings to ALL requests in this session.
```

## Files to Create/Change

- `apps/worker/prompts/waf-fingerprint.txt` — NEW agent prompt
- `apps/worker/src/session-manager.ts` — register waf-fingerprint agent
- `apps/worker/src/types/agents.ts` — add to AgentName union
- `apps/worker/src/temporal/workflows.ts` — add as Wave 0 (before pre-recon)
- `apps/worker/src/temporal/activities.ts` — add activity wrapper

## Acceptance Criteria

- [ ] Agent runs before any other agent in the pipeline
- [ ] Detects Cloudflare correctly on a CF-protected target
- [ ] Produces `waf_fingerprint_deliverable.md` with bypass config
- [ ] Other agents receive WAF bypass hints via brain_hints
- [ ] If no WAF detected → proceeds normally, no bypass overhead
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/03-waf-detection-mechanics.md`
- WAF detection via `vanguardFetch` — never raw curl
- Confidence score matters: 0.5 = uncertain → conservative bypass
- Per-vendor bypass playbook in research doc #03

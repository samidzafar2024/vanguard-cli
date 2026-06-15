# Spec: Phase 2 — Intelligence Layer

**Status**: Draft
**Date**: 2026-04-28
**Research refs**: `docs/research/03-waf-detection-mechanics.md`, `docs/research/18-supply-chain-attacks.md`, `docs/research/14-auth-identity-deep-dive.md`
**Tasks**: task-008 (WAF Fingerprint), task-009 (Secrets Detection), task-027 (Profiling — tech stack + cloud + LLM fingerprinting)

---

## Executive Summary

Phase 2 adds two agents that run **before** the main attack pipeline and make every subsequent agent smarter and more effective.

Without Phase 2, Vanguard is flying blind:
- Without WAF fingerprint, sqlmap/nuclei/ffuf get blocked in seconds by Cloudflare/AWS WAF
- Without secrets detection, a critical AWS key sitting in a JS bundle gets missed entirely

These two agents run in Wave 0 and Wave 1. Their output is injected as `<brain_hints>` into every subsequent agent. They are not optional — they are the intelligence layer that determines whether the attack pipeline succeeds or gets blocked.

---

## Users

### U1 — Bug Bounty Hunter
- Targets often behind Cloudflare. Without WAF bypass, every probe gets 403'd.
- Needs WAF fingerprint to know: "rate limit to 1 RPS, use space2comment tamper, set safari UA"
- Secrets detection is their #1 high-value finding — one AWS key = instant Critical

### U2 — Pentest Team Lead
- Client apps may expose secrets in JS bundles unknowingly
- WAF bypass strategy needed to ensure full coverage without triggering incident response
- Needs both agents in every engagement, not optional

### U3 — Internal Red Team
- Own apps may have secrets accidentally bundled in frontend builds
- WAF config may differ between prod/staging — fingerprint each separately

---

## Functional Requirements

### F1 — WAF Fingerprint Agent (`waf-fingerprint`)
- Sends crafted probe requests via `vanguardFetch` to detect WAF vendor
- Detects: Cloudflare (cf-ray header), AWS WAF (x-amzn-requestid), Akamai (aka-debug), Imperva (x-iinfo), Vercel, Cloudfront, Fastly
- Generates bypass strategy: rate_limit_rps, tamper_scripts, ua_bundle, encoding
- Output saved to `waf_fingerprint_deliverable.md`
- If no WAF detected → proceeds normally, zero bypass overhead
- Confidence score: 0.5 = uncertain → conservative bypass

### F2 — Secrets Detection Agent (`secrets-detection`)
- Scans JavaScript bundles loaded by the live app
- Scans exposed files: `/.env`, `/.env.local`, `/.git/config`, `/config.json`, `/docker-compose.yml`
- Scans HTML source comments and HTTP response headers
- Detection patterns: AWS AKIA keys, Stripe sk_live, GitHub ghp_ tokens, JWT eyJ, private keys, SendGrid, Twilio, Slack
- Confidence score per match type (regex-only = 0.6, contextual = 0.9)
- CRITICAL: secret values are NEVER stored in deliverable — shows first 4 chars only (`AKIA****`)

### F3 — WAF Bypass Propagation
- Every subsequent agent receives WAF bypass config via `<brain_hints>`
- Brain reads `waf_fingerprint_deliverable.md` before dispatching any vuln agent
- Format: `WAF: Cloudflare (95%). Apply: rate 1 RPS, ua safari18_mac, tamper space2comment`

### F4 — Black-Box Compatibility
- Both agents work with zero source code — `vanguardFetch` only
- `secrets-detection` finds secrets in live JS bundles, not in source files
- No `-r` (repo path) required for either agent

---

## Security Scenarios

### Scenario A — Cloudflare protected target
`waf-fingerprint` detects `cf-ray` header, confidence 0.95. Generates bypass: rate 1 RPS, safari18 UA, space2comment tamper. All subsequent agents receive these settings. Nuclei, ffuf, sqlmap all operate within bypass parameters. Zero 403s.

### Scenario B — AWS key in JS bundle
`secrets-detection` scans `main.chunk.js` (2.3MB). Finds pattern `AKIA[A-Z0-9]{16}` at offset 45231. Stores: `value_redacted: "AKIA****EXAMPLE"`, `location: "main.chunk.js:1:45231"`, `severity: critical`. Brain Planner flags this for `cred-intel` validation and `cloud-vuln` escalation in Phase 3.

### Scenario C — No WAF detected
`waf-fingerprint` sends probes, no WAF signatures found. Output: `waf_detected: null, bypass_strategy: null`. All subsequent agents proceed at full configured rate. No tamper, no UA spoofing overhead.

### Scenario D — False positive secret
`secrets-detection` finds `password=` in a comment block. Confidence score: 0.3 (generic pattern, no format match). Marked as low-confidence, included in deliverable with `confidence: 0.3` and note: "generic pattern, manual review recommended."

---

## Non-Functional Requirements

- WAF fingerprint must complete in under 60 seconds
- Secrets detection must handle JS bundles up to 10MB
- Both agents must work in all three modes (passive/validated/active)
- False positive rate for secret detection must be < 15% (confidence scoring handles this)
- No secret value ever appears in logs, audit files, or deliverables

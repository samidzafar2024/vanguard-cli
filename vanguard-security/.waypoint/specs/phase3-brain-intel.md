# Spec: Phase 3 — Intelligence Agents + Brain Core

**Status**: Draft
**Date**: 2026-04-28
**Research refs**: `docs/research/01-hpc-ag-architecture.md`, `docs/research/06-h1-chain-corpus.md`, `docs/research/14-auth-identity-deep-dive.md`, `docs/research/23-modern-tool-ecosystem.md`
**Tasks**: task-010 (osint-recon enhanced), task-011 (cred-intel), task-012 (hardening-auditor), task-013 (credential feedback loop + black-box mode), task-023 (brain-planner), task-024 (brain-critic), task-025 (brain-chain-hunter), task-026 (brain-guardian)

---

## Executive Summary

Phase 3 delivers two things simultaneously:

**1. Three new intelligence agents** — osint-recon enhanced to run Wave 0, credential intelligence, and hardening auditor. These give Vanguard eyes before any attack begins.

**2. The Brain Core** — Planner, Critic, Chain Hunter, Guardian. This is the reasoning layer that makes Vanguard fundamentally different from any scanner. Without the Brain, Vanguard finds individual vulnerabilities. With the Brain, it finds attack chains.

The Credential Feedback Loop (task-013) ties both together: when any intelligence agent finds a secret, the Brain Planner automatically routes it to the agents that can use it. This enables the full black-box attack chain — starting from just a URL and ending at live credential exploitation.

---

## Users

### U1 — Bug Bounty Hunter (Black-Box Mode)
- No source code, no credentials, no inside knowledge
- Runs `./vanguard start -u https://target.com` — nothing else
- Needs: osint-recon to find GitHub org, github-leaks to find secrets, credential feedback loop to route found keys to cloud-vuln
- End goal: find a chain that goes from public URL to live data access

### U2 — Pentest Team Lead (White-Box Mode)
- Has source code, has credentials, wants depth
- Needs: hardening-auditor to give client a scored security posture (A-F grade)
- Needs: chain-hunter to produce the "executive headline" finding for the report
- Needs: critic to eliminate false positives before the report goes to client

### U3 — Internal Red Team (Continuous Mode)
- Runs Vanguard on every major deploy
- Needs: osint-recon to catch new subdomain exposure
- Needs: critic to reduce noise (same finding every run = boring, flag only new ones)
- Needs: guardian to ensure scans don't trigger security alerts

---

## Functional Requirements

### F1 — Enhanced osint-recon (Wave 0, zero contact)
- Runs before ANY request to target
- Sources: crt.sh, URLScan.io, Wayback Machine (free, no key required)
- Optional sources with API keys: Shodan, Censys, SecurityTrails, VirusTotal
- Breach check: HaveIBeenPwned for target domain
- Tech stack from LinkedIn job postings + BuiltWith data
- CVE matching: NVD feed + EPSS scores for detected stack
- Output: `target_profile` JSON with subdomains, breach_history, tech_stack, active_cves, high_value_targets
- EPSS score > 0.7 = auto-highlighted in deliverable as "actively exploited CVE"

### F2 — Credential Intelligence Agent (`cred-intel`)
- Default credential testing on discovered admin panels (`/admin`, `/jenkins`, `/grafana`, `/kibana`)
- HIBP domain check for breach history
- Password spray: max 1 attempt per account per 10 minutes (lockout prevention)
- Credential stuffing: only if `credential_testing: true` in engagement.yaml AND active mode
- Account lockout tracking: stops after 3 attempts per account regardless of rate
- CRITICAL: credential values never stored in deliverable or logs

### F3 — Hardening + Misconfiguration Auditor (`hardening-auditor`)
- Security headers: HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, CORS
- Exposed sensitive endpoints: /.git, /.env, /phpinfo.php, /actuator/env, /adminer.php
- TLS config: protocol versions, cipher suites, cert expiry
- Cookie security: HttpOnly, Secure, SameSite flags
- Debug mode indicators: Django DEBUG, Laravel APP_DEBUG, source maps exposed
- Security score 0-100: Critical=-30pts, High=-15pts, Medium=-5pts, Low=-1pt
- Grade: A=90+, B=75+, C=60+, D=40+, F=<40
- Quick wins: findings with trivial fixes (add header, disable debug)

### F4 — Brain Planner
- Reads osint-recon deliverable before dispatching Wave 1+
- Reorders agent priority based on: EPSS scores, breach history, detected tech stack
- Example: "Express 4.17.1 detected + CVE-2022-24999 EPSS 0.94 → prioritize injection-vuln"
- Reads CredentialStore — if credentials found, injects into relevant agents
- Output: ordered agent execution plan with reasoning

### F5 — Brain Critic
- Reviews every finding from every agent before it enters the report
- Checks: is the finding reproducible? Is severity accurate? Is evidence present?
- Marks false positives: `status: false_positive, reason: "..."`
- Deduplicates: same finding from multiple agents → merged into one
- Validates CVSS scores against evidence

### F6 — Brain Chain Hunter
- Runs after all vuln/exploit agents complete
- Takes all validated findings as input
- Applies 80-pattern library to find multi-step exploit chains
- Output: chains ranked by impact, with full step-by-step reproduction
- Example chain: "SSRF → IMDS → AWS credentials → S3 full access"

### F7 — Brain Guardian
- Monitors HTTP response patterns in real-time
- Detects: WAF rate limiting engaged, IP-based blocking, honeypot indicators
- Actions: reduce rate, rotate UA bundle, pause and alert
- Logs all guardian interventions to audit trail

### F8 — Credential Feedback Loop
- In-memory CredentialStore shared across agents within one run
- Agents write discovered credentials (metadata only, no secret values)
- Brain Planner reads store and injects into relevant agent brain_hints
- Store cleared at end of workflow — never persisted

### F9 — Black-Box Mode
- `-r` (repo path) optional
- When no repo provided: pre-recon and SAST automatically skipped
- All 28+ other agents run normally
- `./vanguard start -u https://target.com` is a valid complete command

---

## The Full Black-Box Attack Chain (key scenario)

```
./vanguard start -u https://target.com

osint-recon (Wave 0, no contact):
  → company: "TargetCorp"
  → github_org: "github.com/targetcorp"
  → breach: "domain in 2 breaches (2021, 2023)"
  → cves: [CVE-2024-XXXX epss:0.87 Express]

brain-planner reads profile:
  → prioritize: github-leaks (breach history), injection-vuln (CVE match)

github-leaks:
  → git history scan: AWS_SECRET_KEY found in deleted commit 6mo ago
  → CredentialStore.add({ type: aws_key, source: commit 8f3a21 })

brain-planner detects credential:
  → injects AWS key into cloud-vuln brain_hints

cloud-vuln (with injected key):
  → aws sts get-caller-identity → VALID
  → s3 ls → targetcorp-prod-backups (PUBLIC READ)
  → rds describe-db-snapshots → accessible

chain-hunter:
  CRITICAL CHAIN: URL → GitHub history → AWS key → prod S3 + RDS
  One URL. No login. Full data breach. Time: 45 minutes.

report:
  Executive finding: Critical
  Evidence: git commit hash, aws sts output, s3 bucket listing
  Remediation: rotate key, enable git-secrets pre-commit hook
```

---

## Security Scenarios

### Scenario A — Password spray lockout prevention
`cred-intel` attempts `admin@target.com` with `Company2024!`. Records attempt. Waits 10 minutes before next attempt on same account. After 3 attempts per account, stops entirely regardless of timing. Lockout never triggered.

### Scenario B — Critic rejects false positive
`injection-vuln` reports: "SQL error in response — possible SQLi". Critic reviews: error message is a generic 500 page, no SQL error text, no blind timing differential. Marks: `status: false_positive, reason: "error page does not indicate SQL injection"`. Finding removed from report.

### Scenario C — Chain Hunter finds critical chain
`xss-vuln` found reflected XSS (Medium). `cred-intel` found CORS `*` on `/api/token` (Low). Chain Hunter applies pattern #14: "XSS + CORS on token endpoint = account takeover". Output: Critical chain with full reproduction steps.

### Scenario D — Guardian detects blocking
After 50 requests, target starts returning 429 with `X-RateLimit-Block: true`. Guardian detects pattern, immediately halves rate to 0.5 RPS, switches UA bundle from chrome131_mac to firefox134_linux. Logs: "Guardian intervention: rate reduced, UA rotated". Scan continues.

---

## Non-Functional Requirements

- osint-recon must complete in under 5 minutes (free sources only)
- Chain Hunter must process up to 50 findings in under 30 seconds
- Critic must process each finding in under 10 seconds
- CredentialStore must be cleared within 1 second of workflow completion
- Black-box mode: all agents must run without any repo path
- No credential values in any log, audit trail, or deliverable

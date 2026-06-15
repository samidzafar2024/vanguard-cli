# Task 010: Enhance osint-recon → Threat Intelligence Wave 0

**Phase**: Phase 3
**Wave**: Wave 0 — runs BEFORE anything touches the target
**Depends on**: Phase 1 + 2 complete
**Labels**: phase3, agent
**Note**: This task REPLACES the existing `osint-recon` agent with a threat-intelligence
powered version. The agent name stays `osint-recon` in code — no rename needed.
The key change is: (1) it runs Wave 0 (before profiling), and (2) it queries
public OSINT sources before sending any probe to the target.

## Why This Matters

Real hackers spend 80% of time on recon BEFORE touching the target.
"Know everything about the target before sending one packet."

The existing `osint-recon` agent runs AFTER `container-vuln` and works contextually.
This task repositions it to Wave 0 and gives it public-source intelligence capabilities
so every subsequent agent benefits from pre-loaded context.

## What to Build

### Enhanced prompt: `apps/worker/prompts/osint-recon.txt`
Update the existing prompt to query public sources FIRST (zero target contact),
then pivot using discovered infrastructure.

### Sources to Query (zero-contact phase)

**Technical intelligence:**
- crt.sh — certificate transparency (all subdomains ever issued certs) → FREE, no key
- URLScan.io — historical scans, JS files, cookies → FREE public API
- Wayback Machine — old endpoints, old JS with leaked keys → FREE
- Shodan — exposed services, banners (optional, uses SHODAN_API_KEY from engagement.yaml)
- Censys — TLS certs, open ports (optional, uses CENSYS_API_ID)
- SecurityTrails — DNS history (optional, uses SECURITYTRAILS_API_KEY)
- VirusTotal — domain reputation, passive DNS (optional)

**Breach intelligence:**
- HaveIBeenPwned API — email domains in known breaches → uses HIBP_API_KEY from engagement.yaml
- Free fallback: check BreachDirectory public lookup

**Company intelligence:**
- GitHub org — public repos, employee accounts → github.com/orgs/{company}
- BuiltWith/Wappalyzer public data — tech stack fingerprint

**Threat context:**
- NVD/CVE feeds — recent CVEs for detected tech stack
- EPSS scores — which CVEs are actively exploited (epss.cyentia.com)

### Output Format

```json
{
  "target_profile": {
    "company_size": "enterprise",
    "tech_stack": ["React", "Node.js", "AWS", "Okta", "Cloudflare"],
    "exposed_services": ["443/https", "22/ssh (staging only)"],
    "subdomains_found": 47,
    "breach_history": "Domain in 2 known breaches (2021, 2023)",
    "active_cves": [
      {"cve": "CVE-2024-XXXX", "component": "Express", "epss": 0.87, "severity": "high"}
    ],
    "leaked_credentials_hint": "3 credential pairs found — check cred-intel agent",
    "high_value_targets": ["admin.target.com", "api.target.com", "internal.target.com"]
  }
}
```

Brain/Planner reads this profile before dispatching any vuln agents.

## Files to Create/Change

- `apps/worker/prompts/osint-recon.txt` — UPDATE to include zero-contact OSINT sources
- `apps/worker/src/session-manager.ts` — move prerequisites: from `['container-vuln']` to `[]`
  (osint-recon now depends on nothing — runs Wave 0 before profiling)
- `apps/worker/src/temporal/workflows.ts` — move osint-recon to run before profiling,
  NOT in the Phase 4 sequential chain

## Acceptance Criteria

- [ ] Queries crt.sh for subdomains (no API key needed)
- [ ] Checks HaveIBeenPwned for domain
- [ ] Produces enriched `osint_recon_deliverable.md` with tech stack + breach info
- [ ] API keys for Shodan/Censys optional — graceful degradation without them
- [ ] Zero direct target contact in the zero-contact phase (no requests to target IP)
- [ ] EPSS score > 0.7 = auto-highlighted in deliverable
- [ ] `pnpm run check` passes

## Notes

- Keep the agent name `osint-recon` — no rename needed, saves churn across all files
- Optional API keys: SHODAN_API_KEY, CENSYS_API_ID, SECURITYTRAILS_API_KEY, HIBP_API_KEY in engagement.yaml
- Without API keys: uses free sources only (crt.sh, wayback, urlscan public)
- This deliverable becomes `<brain_hints>` context for every subsequent agent

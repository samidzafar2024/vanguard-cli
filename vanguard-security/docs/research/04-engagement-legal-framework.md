# Research #04 — Engagement Legal/Ethical Framework

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** New `engagement.yaml` schema, preflight check system, runtime enforcement points, refusal templates, hard scope/jurisdiction denylists

---

## Executive summary

Vanguard executes real attacks. Without a proper engagement framework, users could violate ToS, computer fraud laws (CFAA, UK CMA, India DPDP §66), or harm production. After cross-referencing **NIST SP 800-115**, **PTES Pre-Engagement**, **OWASP WSTG v4.2**, **HackerOne/Bugcrowd/Intigriti policies**, **EU AI Act**, and **disclose.io v2 safe-harbor**, this doc defines:

1. The **`engagement.yaml` schema** Vanguard reads from each project root
2. **15 preflight checks** that must pass before any engagement starts
3. **8 runtime enforcement points** in the dispatch pipeline
4. **6 structured refusal templates** for over-reach scenarios
5. **Hard denylists** that are non-negotiable (CN/RU/KP/IR/SY/CU geographies, banking/healthcare/gov/defense critical infrastructure, persistent implants, ransomware-class encryption)

**Key 2024-2026 development**: HackerOne (Aug 2024) and Bugcrowd (Nov 2024) require AI-generated reports to be labeled. Vanguard must inject `Generated-By: Vanguard v1.0` + human reviewer name on every external submission.

---

## Research questions

1. What does a professional ROE document look like? What's universal vs vendor-specific?
2. How do the major bug bounty platforms differ (HackerOne, Bugcrowd, Intigriti, YesWeHack, Synack)?
3. What's the legal landscape per jurisdiction (US/EU/UK/India/China)?
4. What blast radius standards are enforceable?
5. What's the EU AI Act / White House EO 14110 implication for autonomous offensive AI?
6. What does the `engagement.yaml` schema need to capture?
7. What preflight + runtime enforcement points must Vanguard have?

---

## Key findings

### 1. Universal ROE core (NIST/PTES/OWASP/SANS converge)

Every professional ROE has 7 non-negotiable sections:

1. **Authorization & signatories** — named individuals with legal authority, date, "I am authorized to bind [Entity]" language. NIST 800-115 §3.3 explicitly requires written permission — verbal insufficient for CFAA defense.
2. **Scope (positive)** — IPs, CIDRs, FQDNs, cloud account IDs, applications, APIs
3. **Out-of-scope (negative)** — production DBs, payment processors, etc.
4. **Allowed techniques** — network/web/social/physical
5. **Time window** — start/end, allowed hours, blackout windows
6. **Communication & escalation** — primary/secondary, emergency phone, "stop test" trigger
7. **Evidence, reporting, retention** — storage, transmission, deletion

PTES adds **"Goals"** — distinguishing compliance-driven from threat-emulation. Vanguard adopts this.

### 2. Vendor-specific ROE differences

| Platform | Distinctive |
|---|---|
| **HackerOne** | Safe-harbor language modeled on `disclose.io` v2; explicit DMCA §1201 waiver; CFAA "good faith" carve-out |
| **Bugcrowd** | VRT (Vulnerability Rating Taxonomy) defines severity *and* in-scope simultaneously |
| **Intigriti** | EU-centric; explicit GDPR Art. 6(1)(f) "legitimate interest" basis; mandates 30-day data deletion |
| **Synack** | Managed/closed; NDA-bound researchers, no public disclosure ever |
| **YesWeHack** | Bilingual EN/FR; references French *Loi pour une République Numérique* Art. 47 |
| **ZDI** | 120-day disclosure default; extends only with vendor patch commitment |
| **Self-hosted (RFC 9116 `security.txt`)** | Minimum viable ROE — `Contact:`, `Expires:`, `Policy:`. Insufficient alone for autonomous tooling |

**Vanguard baseline:** Default to `disclose.io` v2 safe-harbor. Treat anything weaker as insufficient.

### 3. Legal frameworks per jurisdiction

#### United States
- **CFAA (18 U.S.C. §1030)** — *Van Buren v. United States* (2021) narrowed "exceeding authorized access" to gates not purposes — but autonomous tools probing outside scope still expose operator. **Implication: scope enforcement must be technical, not advisory.**
- **DMCA §1201** — Anti-circumvention pentest exemption renewed through 2027 (37 CFR §201.40), only for "good-faith security research"
- **State laws** — CA SB-327 (IoT), NY SHIELD, TX HB-4390
- **Federal contracts** — Refuse `.gov`/`.mil` by default

#### European Union
- **GDPR Article 32** — Mandates regular security testing (legal basis); Article 6 still requires lawful processing of any personal data encountered. **Vanguard must auto-redact PII at evidence collection.**
- **NIS2 Directive** (Oct 2024) — Member State CSIRT coordination for "significant" incidents
- **EU AI Act (Reg. 2024/1689)** — Article 5(1)(b) prohibits AI exploiting "vulnerabilities of natural persons" — narrow read = social-eng only, conservative read flags Vanguard's social engineering. **Open question.**

#### United Kingdom
- **Computer Misuse Act 1990 §1, §3, §3ZA** — Stricter than CFAA; even *attempted* unauthorized access criminal. 2023 Law Commission proposed research defense; **not yet enacted as of 2026-04**.

#### Other
- **Brazil (LGPD + Marco Civil)** — Pentest legal under contract; cross-border export requires ANPD adequacy
- **India (DPDP Act 2023 + IT Act §66)** — §66 used aggressively against researchers; **require local counsel sign-off**
- **China / Russia** — Effectively impossible. Vanguard hard-refuses `.cn`/Chinese cloud accounts, Russian targets

#### Cross-Border Trilemma
Three locations matter: **operator**, **target**, **data**. Refuse if any is on denylist (CN, RU, KP, IR, SY, CU + Crimea/Donetsk/Luhansk per OFAC).

### 4. Blast radius standards

#### Banned by default (no flag enables)
- Persistent implants (C2 beacon, scheduled task, cron job)
- `DROP TABLE`, `DELETE FROM`, `rm -rf`, S3 bucket deletion, IAM role deletion
- Ransomware-class encryption (even reversible)
- Hardware/firmware writes (BIOS, BMC, IPMI flash)
- Mobile carrier infrastructure (SS7, Diameter, GTP)
- Critical infrastructure: SCADA/ICS, medical device networks, aviation, financial settlement (SWIFT, FedWire), election systems
- Shared SaaS/CDN backplane (Cloudflare, Akamai, Fastly, AWS control plane)

#### Gated (require explicit flag + dual confirmation)
- DoS-class testing (`allow_dos: true` + signed waiver)
- Account takeover beyond test accounts (`allow_real_user_ato: true` — should never be true)
- Lateral movement crossing cloud-tenant boundaries
- Social engineering / phishing (`allow_se: true` + per-target consent)
- Data exfiltration > 1 KB sample

#### Default-on (allowed in safe mode)
- Read-only enumeration
- Authenticated testing with provided credentials
- Web app fuzzing within rate limit
- Cloud IAM enumeration (read-only `iam:Get*`, `iam:List*`)
- Subdomain enumeration of declared parent domains

**Proof-without-overreach rule:** For data exposure, capture *schema + 1 row with PII auto-redacted* — never bulk extraction.

### 5. The `engagement.yaml` schema (authoritative v1)

```yaml
apiVersion: vanguard.io/v1
kind: Engagement

metadata:
  id: ENG-2026-001                      # required, format: ENG-YYYY-NNN
  created: 2026-04-25T00:00:00Z
  expires: 2026-05-09T23:59:59Z         # hard kill switch
  goals: [compliance_pci, threat_emulation]

authorization:
  authorized_by:
    name: "Jane Roe"
    role: "CISO"
    email: "ciso@acme.example"
    signature_method: "docusign"        # docusign | pgp | wet_ink_scan
  evidence_path: "./roe-signed.pdf"
  evidence_sha256: "abc123..."
  authorizing_entity:
    legal_name: "Acme Corporation, Inc."
    jurisdiction_of_incorporation: "us-de"
  safe_harbor:
    program: "hackerone://acme-corp"    # or "selfhosted", "intigriti://...", "none"
    disclose_io_version: "2.0"

scope:
  hosts: ["*.acme.example", "api.acme.example"]
  cidrs: ["203.0.113.0/24"]
  cloud_accounts:
    aws: ["123456789012"]
    gcp: ["acme-prod-001"]
    azure: ["sub-uuid-here"]
  excluded_paths: ["/admin/billing/*", "/api/v1/payments/*"]
  excluded_subdomains: ["status.acme.example", "*.dev.acme.example"]
  excluded_third_parties:               # MUST exclude SaaS by default
    - "stripe.com"
    - "auth0.com"
    - "twilio.com"
    - "sendgrid.com"
  new_asset_discovery:
    auto_include: false                 # default false; recon hits → review queue
    review_contact: "primary_emergency"

blast_radius:
  allow_destructive: false
  allow_account_takeover:
    test_accounts: true
    real_users: false
  allow_dos: false
  allow_persistence: false              # banned regardless
  allow_lateral_movement:
    intra_tenant: true
    cross_tenant: false
  allow_social_engineering: false
  max_concurrent_requests: 10
  rate_limit_rps: 5
  max_data_exfil_bytes: 1024            # 1 KB proof-of-access only
  destructive_dry_run_only: true

schedule:
  allowed_hours_utc: "13:00-21:00"
  timezone: "America/New_York"
  duration_days: 14
  blackout_windows:
    - "2026-04-30T00:00Z/2026-05-01T00:00Z"
  pause_on_holidays: true
  hard_stop: 2026-05-09T23:59:59Z

contacts:
  primary_emergency:
    name: "John Doe"
    phone: "+1-555-0100"
    email: "soc@acme.example"
    pgp: "0xABCD1234"
  secondary: { name: "Jane Smith", phone: "+1-555-0101" }
  escalation:
    legal: "legal@acme.example"
    pr: "comms@acme.example"

identification:
  bug_bounty_handle: "vanguard-acme-eng001"
  identification_header: "X-Vanguard-Engagement: ENG-2026-001"
  user_agent_suffix: "VanguardScanner/1.0 (+https://vanguard.io/abuse)"
  source_ips: ["198.51.100.0/24"]

evidence:
  storage_path: "./evidence/"
  encrypt: true
  encryption_key_ref: "age://recipients.txt"
  retention_days: 90
  auto_redact_pii: true
  pii_redaction_profile: "gdpr_strict"
  chain_of_custody_log: "./evidence/chain.jsonl"

legal:
  jurisdictions:
    operator: "us-ca"
    target: "us-de"
    data_residency: "us"
  applicable_laws: [cfaa, dmca_1201, ccpa, gdpr]
  insurance:
    carrier: "Beazley"
    policy_number: "BPI-2026-..."
    coverage_usd: 5000000

ai_disclosure:
  tool: "Vanguard"
  version: "1.0.0"
  models: ["claude-opus-4-7"]
  disclose_in_report: true              # H1/Bugcrowd 2024 policy mandate
  human_review_before_submission: true
```

### 6. Pre-flight checks (15 hard gates)

Implement in `vanguard/engagement/preflight.py`:

1. **Schema validation** — `engagement.yaml` parses + conforms to JSON Schema
2. **Authorization evidence** — file exists, SHA-256 matches, < 30 days old
3. **Signatory verification** — DocuSign envelope ID resolves OR PGP signature verifies
4. **Scope resolution** — every host resolves; resolved IPs match `scope.cidrs`
5. **Third-party exclusion** — DNS doesn't land on Stripe/Auth0/Cloudflare/AWS shared infra (cross-ref `as-org` via Team Cymru)
6. **Critical-infra denylist** — no target ASN matches banking/healthcare/gov/defense/aviation lists
7. **Geographic denylist** — no target IP geolocates to CN/RU/KP/IR/SY/CU/Crimea
8. **Time window** — current UTC within `allowed_hours_utc`, not in blackout, not past `hard_stop`
9. **Identification header** — `opsec.yaml` sets `X-Vanguard-Engagement` matching `metadata.id`
10. **Agent allowlist** — all planned cookbook agents in `blast_radius`-compatible list
11. **Rate limit sanity** — `rate_limit_rps × max_concurrent_requests < 100` unless explicit override
12. **Evidence vault** — storage path writable, encryption key resolves, retention enforceable
13. **Insurance check** — policy number present, expiry > engagement end
14. **AI disclosure** — `ai_disclosure.disclose_in_report: true`, human reviewer named
15. **Emergency contact reachability** — test ping to primary/secondary, ack within 15min before start

Any failure → engagement refuses to start with structured error.

### 7. Runtime enforcement points (8 chokepoints)

| Phase | Location | Enforcement |
|---|---|---|
| Agent dispatch | `vanguard/orchestrator/dispatch.py` | Scope check on each target |
| HTTP request | `vanguard/net/http_client.py` | Inject identification header; rate limit; reject outside `allowed_hours_utc` |
| Subprocess exec | `vanguard/exec/sandbox.py` | Filter sqlmap/nuclei flags for destructive options |
| SQL injection PoC | `vanguard/cookbook/sqli.py` | If payload includes `DROP|DELETE|UPDATE|INSERT`, require `allow_destructive: true` |
| Cloud IAM | `vanguard/cloud/iam.py` | Restrict to `Get*`/`List*`/`Describe*` unless flag set |
| Lateral movement | `vanguard/postex/lateral.py` | Tenant boundary check before each pivot |
| Evidence collection | `vanguard/evidence/collector.py` | PII redaction; truncate exfil to `max_data_exfil_bytes` |
| Disclosure submission | `vanguard/report/submitter.py` | Require human review checkbox; inject AI disclosure footer |

Every enforcement point emits structured audit event to `./evidence/chain.jsonl` (append-only, hash-chained).

### 8. Refusal templates (structured, not free-form)

**E-SCOPE-001: Out-of-scope target**
> REFUSED: Target `payments.acme.example` resolves to `52.84.x.x` (AWS CloudFront shared infrastructure). Engagement ENG-2026-001 explicitly excludes third-party SaaS. To proceed, obtain authorization from AWS via `aws.amazon.com/security/penetration-testing/` and re-run preflight.

**E-BLAST-002: Destructive payload**
> REFUSED: Payload contains `DROP TABLE users` (destructive). Engagement sets `allow_destructive: false` and `destructive_dry_run_only: true`. Showing payload for human review only; not executed. Two-person approval required to enable.

**E-TIME-003: Outside time window**
> REFUSED: Current time 03:42 UTC outside allowed window 13:00-21:00 UTC. Next allowed start: 13:00 UTC (in 9h 18m). Use `--emergency` flag (requires primary emergency contact phone confirmation).

**E-CRIT-004: Critical infrastructure detected**
> REFUSED: Target ASN AS3856 (PCH.NET) on critical-infrastructure denylist (DNS root). Not configurable. Contact primary_emergency to re-scope.

**E-JURIS-005: Jurisdiction conflict**
> REFUSED: Operator US-CA, target geolocates to CN-BJ. Cross-border testing into China hard-refused regardless of authorization.

**E-AI-006: AI disclosure missing**
> REFUSED: `ai_disclosure.disclose_in_report` is false. HackerOne (Aug 2024) and Bugcrowd (Nov 2024) require AI-generated reports labeled. Submission blocked.

### 9. AI-specific concerns (2024-2026)

- **2024 LLM-spam wave** — H1, Bugcrowd, curl maintainer Daniel Stenberg banned automated LLM submissions. **Vanguard must require human review + label all output.**
- **EU AI Act Annex III** — Currently does NOT classify offensive security AI as high-risk, but Article 50 transparency: users must know it's AI-generated.
- **White House EO 14110** + NIST AI RMF — Voluntary; align with GOVERN-MAP-MEASURE-MANAGE.
- **Liability** — Default contract: liability on operator running Vanguard, vendor provides E&O via reseller. Indemnification mutual.
- **Attribution** — Reports MUST include `Generated-By: Vanguard v1.0` + reviewer name. Non-negotiable.

### 10. Insurance & liability

- **Professional liability (E&O)**: $1M-$5M typical, $5M for enterprise
- **Cyber liability**: $2M-$10M
- **General liability**: $1M
- Carriers familiar with pentest: **Beazley, Hiscox, Coalition, At-Bay**
- Vanguard vendor should carry separate Tech E&O ($10M+)

---

## Implementation decisions

| Decision | Rationale | Implementation |
|---|---|---|
| `engagement.yaml` mandatory at project root | Hard authorization gate | New schema in `apps/cli/src/engagement/schema.ts` |
| 15 preflight checks before any run | Defense in depth | New `preflight.cjs` script |
| 8 runtime enforcement chokepoints | Layered scope/safety | Multiple file additions |
| `disclose.io v2` safe harbor as default | Industry baseline | Reference template ships with Vanguard |
| Hard geographic denylist (CN/RU/KP/IR/SY/CU) | Legal protection | Built-in IP geolocation check |
| Hard critical-infra denylist | Prevent catastrophic outcomes | Built-in ASN check |
| AI disclosure mandatory in reports | H1/Bugcrowd 2024 policy | Auto-injected footer |
| Structured refusal codes (E-SCOPE-001, etc.) | Operability | Refusal grammar in error system |
| Hash-chained audit log | Chain of custody | `./evidence/chain.jsonl` append-only |

---

## Open questions

1. **EU AI Act classification** — Is Vanguard "high-risk" under Article 6(2)? Need EU counsel before EU launch.
2. **UK CMA research defense** — Will 2026 amendment pass? If not, UK engagements need extra-strong written authorization.
3. **India DPDP §66** — Has anyone successfully run autonomous pentest in India post-DPDP? Local counsel needed.
4. **AWS/Azure/GCP autonomous-tool policies** — Cloud test policies don't address autonomous AI explicitly. Need clarification letters.
5. **Synack-style managed-only tier** — Reduces liability but limits market.
6. **Bug bounty platform LLM bans** — Will H1/Bugcrowd carve out exceptions for "transparent AI tooling with human review"? Lobby now.
7. **State-level AI laws** — CO AI Act (Feb 2026), CA SB-1047 returning. Track.
8. **Insurance market** — Underwriters still figuring this out; may need self-insurance for first cohort.

---

## Sources

### Standards
- [NIST SP 800-115](https://csrc.nist.gov/publications/detail/sp/800-115/final)
- [PTES Pre-Engagement](http://www.pentest-standard.org/index.php/Pre-engagement)
- [OWASP WSTG v4.2](https://owasp.org/www-project-web-security-testing-guide/)

### Bug bounty platforms
- [HackerOne policy](https://hackerone.com/security) and [disclose.io](https://disclose.io/)
- [Bugcrowd VRT v1.14](https://github.com/bugcrowd/vulnerability-rating-taxonomy)
- [Intigriti policies](https://www.intigriti.com/researchers/blog/our-policies)
- [Synack legal](https://www.synack.com/legal/)
- [ZDI disclosure](https://www.zerodayinitiative.com/disclosures/)
- [security.txt RFC 9116](https://datatracker.ietf.org/doc/rfc9116/)

### US law
- [CFAA 18 U.S.C. §1030](https://www.law.cornell.edu/uscode/text/18/1030)
- Van Buren v. United States, 593 U.S. 374 (2021)
- DMCA §1201 exemption — 37 CFR §201.40 (2024 renewal)

### EU/UK law
- [GDPR Art. 32](https://gdpr-info.eu/art-32-gdpr/)
- NIS2 Directive (EU 2022/2555)
- EU AI Act (Regulation 2024/1689)
- [UK CMA 1990](https://www.legislation.gov.uk/ukpga/1990/18)
- [NCSC CHECK](https://www.ncsc.gov.uk/information/check-fundamental-principles)

### Cloud test policies
- [AWS pentest](https://aws.amazon.com/security/penetration-testing/)
- [GCP compliance](https://cloud.google.com/security/compliance)
- [Azure pentest](https://learn.microsoft.com/en-us/azure/security/fundamentals/pen-testing)

### AI policy
- White House EO 14110 (Oct 2023)
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)

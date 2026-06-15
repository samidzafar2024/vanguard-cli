# Research #10 — Multi-Target / Shared-Tenant Strategies

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** **Unified attack graph** with `target_id` as node property (not boundary); 4-phase pipeline (discovery → triage → deep → cross-target chains); 7 new cross-target chain patterns; engagement-level Critic; root-cause deduplication

---

## Executive summary

Vanguard's current single-target framing **leaves 60-70% of real-engagement value undiscovered**. Cross-target chains are not nice-to-have — **they are the entire reason a customer hires a pentest firm over running internal SAST.** Real engagements span 50+ subdomains with shared cookie scopes, shared IdPs, shared infrastructure, transitive trust — and that's where the highest-CVSS bugs live (Sam Curry's "Hacking the Auto Industry" = 16 manufacturers compromised via shared vendor SSO).

**Core architectural change**: single unified graph with `engagement_id`/`target_id` as node properties, NOT as graph boundaries. Multi-graph design fails the moment you ask "which subdomains share this cookie scope?"

**4-phase pipeline**: Discovery (5%) → Triage (15%) → Deep (60%) → **Cross-target chain mining (20%)**. Phase 3 is highest-EV but never runs in current Vanguard.

**Root-cause deduplication via `:RootCause` nodes** — same React XSS on 30 marketing subdomains = ONE root cause with 30 occurrences, not 30 findings. CVSS aggregates to higher-than-per-host because impact is multiplied.

---

## Research questions

1. What do real multi-target engagements look like?
2. What cross-target chain classes exist?
3. Single-graph vs multi-graph architecture?
4. How to balance discovery vs targeting?
5. How to deduplicate findings across targets (same root cause)?
6. How to handle shared-tenant pentesting?
7. Should Critic operate engagement-level vs target-level?
8. What concrete schema/prompt changes for Vanguard?

---

## Key findings

### 1. Multi-target engagement realities

Real scope shapes fall into 5 archetypes:

**Wildcard bug bounty programs.** `*.tesla.com` = ~400 live hosts spanning marketing (Drupal CMS), corporate apps (Workday SSO), engineering (Jenkins, GitLab), customer portals (custom Rails), supplier portals (legacy Java), acquired-company holdovers.

**Parent-subsidiary estates.** Marriott/Starwood acquisition: breach path was Starwood reservation system trusting Marriott AD. Sam Curry "Hacking the Auto Industry" (Jan 2023): 16 manufacturers compromised via shared vendor SSO (SiriusXM Connected Vehicle Services), reused JWT signing keys across consumer + dealer + corporate domains.

**Multi-region SaaS.** Salesforce-style: `na1.example.com`, `eu2.example.com`, `ap-south.example.com` run "the same app" with regional drift — different patch versions, different feature flags, different WAF rules. Vulnerability patched in NA may live in EU3 for months.

**White-label / multi-tenant.** Auth0, WorkOS, Frontegg, Stripe Connect, Shopify storefronts. One logical product, N tenant subdomains. **2022 Frans Rosén CDN cache poisoning** across `*.cdn.shopifycdn.com` hit thousands of tenants from a single bug.

**M&A holdover and shadow IT.** Acquired-company DNS pointing at S3 buckets parent forgot to claim. Why `subzy`, `subjack`, nuclei takeover templates exist.

**Vanguard treating each as 50 isolated runs leaves the highest-EV bugs on the table.** Cross-target bugs are systematically the highest-CVSS findings because they prove infrastructure-level (not app-level) compromise.

### 2. Cross-target attack chain classes (5 categorically different)

**Cookie scope leakage.** Cookie set on `.example.com` is sent to every subdomain. If `marketing.example.com` runs vulnerable WordPress and reflects session cookie into log endpoint, every other subdomain's session is implicitly compromised. **Steam 2019 ATO**: cookie-scoped XSS on forgotten subdomain pivoting into main login.

**Shared SSO / IdP trust.** Okta, Auth0, Azure AD federation across subdomains. If `dev.example.com` accepts SAML assertions from misconfigured second IdP for testing, attacker minting assertions there can replay against `prod.example.com` if SP doesn't validate AudienceRestriction. **Microsoft `nOAuth` (June 2023, Descope)**: any tenant accepting unverified `email` claim from Azure AD multi-tenant apps could be hijacked across hundreds of SaaS vendors.

**Shared infrastructure leaks.** S3 bucket `assets.example.com` with `s3:ListBucket` public exposes filenames containing tenant IDs, customer names. Sentry/Datadog/Bugsnag DSNs leaked in one subdomain's bundle.js letting attacker read crash traces from every other subdomain. **2022 Toyota GitHub leak** (5-year-exposed credentials) gave access to telemetry across all consumer-facing properties.

**Transitive trust via service accounts.** `internal-api.example.com` accepts JWT signed with `kid=primary`. Same signing key signs tokens for `partner-api.example.com`. Compromise partner endpoint's verification logic (e.g., `alg=none`) → mint tokens valid against internal API. **Sam Curry BMW**: dealer portal → consumer portal via shared signing keys.

**CORS / postMessage trust webs.** `app.example.com` whitelists `*.example.com` for postMessage origin. Any takeover-able subdomain becomes token-exfil sink. Detection requires enumerating full set of `Access-Control-Allow-Origin` reflections + postMessage listeners across estate, computing trust closure.

**DNS takeover into trusted-origin pivots.** Classic dangling CNAME → claim Heroku app → now you're same-origin attacker for cookie scope and CORS allowlist. **Detloff 2021 `*.shopify.com` takeover** chained into Shopify-hosted JS getting executed in storefront contexts.

Add: shared CI/CD secret leakage (one repo's `.env` covers 40 subdomains), shared third-party SDK keys (Algolia, Stripe restricted keys leaked on one subdomain useful against another's data), shared K8s ingress where Host header confusion bypasses tenant isolation.

### 3. Single-graph vs multi-graph architecture

**Single unified graph with target labels as node properties, NOT graph boundaries.**

Multi-graph (one Neo4j per target, federated query layer) optimizes for isolation/parallelism. **Fails** the moment you ask "which subdomains share this cookie scope?" — you cannot run path queries across database boundaries without expensive cross-DB joins. Cannot use graph algorithms (PageRank for asset criticality, community detection for trust clusters) on federated view.

**Correct schema:**

```cypher
(:Host {fqdn, target_id, parent_target_id, region, tenant_id, scope_tag})
(:Cookie {name, domain_scope, secure, samesite})
(:AuthRealm {idp, sp_entity_id, signing_key_kid})
(:SharedAsset {type: 's3'|'cdn'|'sentry_dsn'|'jwt_kid', identifier})

(:Host)-[:SETS]->(:Cookie)
(:Host)-[:RECEIVES]->(:Cookie)        // computed from Domain= scope
(:Host)-[:FEDERATES_WITH]->(:AuthRealm)
(:Host)-[:USES]->(:SharedAsset)
(:Host)-[:CAN_TAKEOVER]->(:Host)      // computed: dangling CNAME + cookie scope overlap
```

`target_id` is just a label. Chain-finding queries naturally span targets. Critic queries naturally surface infrastructure-level patterns. Cost: concurrency contention on writes from 50 parallel scout agents — solvable with per-target write partitions and merge semantics on shared nodes.

**For Vanguard**: keep one graph instance, add `engagement_id` and `target_id` as required properties on every node, add `:SharedAsset` and `:AuthRealm` labels, rewrite brain's chain-search to optionally cross `target_id`. Per-target views become filtered queries, not separate stores.

### 4. Discovery vs targeting — 4-phase pipeline

The honest answer is **both, in phases, with explicit budget:**

**Phase 0: Asset discovery (5% budget)** — subfinder + amass + crt.sh + DNSx + httpx. **No vuln scanning.** Goal: enumerate full estate, fingerprint stack per host, identify shared infrastructure (same TLS cert, CDN, IdP, ASN). Output: `:Host` + `:SharedAsset` graph backbone.

**Phase 1: Triage and targeting (15% budget)** — "scout" agent per host doing only: tech detection, auth flow mapping, exposed-endpoint inventory. **No exploitation.** Goal: rank hosts by attack-surface score (auth complexity × stack age × shared-infra centrality × scope-tag-priority). Top 20% get full Vanguard treatment.

**Phase 2: Deep per-target (60% budget)** — Vanguard's existing pipeline runs against targeting shortlist. Standard waves, full agent stack.

**Phase 3: Cross-target chain mining (20% budget) — THE NEW WAVE.** With Phases 0-2 graph populated, run Critic-class agents whose only job is querying graph for cross-target chains. **This is highest-EV but never runs in current Vanguard.**

Customer should never have to choose narrow-or-broad. Vanguard defaults to 4-phase; scope flags toggle phases off.

### 5. Cross-target deduplication — `:RootCause` nodes

The 30-subdomain identical-finding problem ruins reports. Customer sees 30 "Reflected XSS" findings, eyes glaze, dismisses entire report. **Vanguard must dedupe by root cause, not occurrence.**

```cypher
(:Finding {id, host, endpoint, payload, evidence})
(:RootCause {id, class, signature_hash, description, fix_owner})
(:Finding)-[:CAUSED_BY]->(:RootCause)
```

`signature_hash` computed from: vuln class + sink fingerprint + framework + (optionally) source code path if SAST available. Reflected XSS in same React component used across 30 marketing subdomains hashes to **one root cause with 30 findings attached**.

Report renderer groups by `:RootCause`, shows count + host list, reports CVSS at root-cause level (often higher than per-host because impact aggregates).

**Critic earns its name here**: rejects chains that are "30 independent chains" and merges into "one chain instantiated 30 times."

### 6. Shared-tenant pentesting

When customer hands Vanguard 80 tenant IDs in `acme.cloud-product.com/t/{tenant_id}`, **interesting bugs are tenant-isolation bugs:**

- Can tenant A read tenant B's data via IDOR on shared API endpoints?
- Does shared CDN cache leak tenant-scoped responses across tenants? (**Slack 2020 cache-key bug**)
- Are tenant-scoped JWTs validated for `tenant_id` claim, or does any signed JWT work?
- Do shared rate-limit buckets let tenant A DOS tenant B?
- Does tenant subdomain cookie scope (`tenant1.app.com` vs `.app.com`) leak sessions across tenants?

**Vanguard needs tenant-aware test harness**: same agent runs same probe across N tenant IDs; comparator agent looks for response-shape differences indicating isolation breaks. **Structurally different from "scan tenant1, then scan tenant2"** — dedup is built in, diff is the signal.

```cypher
(:Tenant {id, parent_target_id, plan_tier, region})
(:IsolationProbe {endpoint, technique, expected_isolation: 'data'|'session'|'rate'|'cache'})
(:IsolationResult {tenant_a, tenant_b, leaked: bool, evidence})
```

The Frontegg/Auth0/WorkOS class of misconfig (multi-tenant IdP allowing cross-tenant token replay) captured here.

### 7. Coordination across targets — engagement-level Critic

**Critic must operate at engagement level, not target level.** Three Critic-level patterns to implement:

**Pattern detection.** "20 of 50 subdomains run Drupal 7.78. CVE-2022-XXXX affects this version. Spawn focused exploit-attempt wave on those 20." Wave-routing intelligence Vanguard doesn't currently have.

**Trust-graph closure.** "Subdomains A, B, C trust IdP X. IdP X has misconfig (e.g., open redirect on `/authorize`). Therefore A, B, C all inherit misconfig — but only A has been tested." Critic generates deferred-test queue.

**Blast-radius scoring.** When finding lands on host H, Critic re-scores by computing: how many other in-scope hosts share H's cookie scope, IdP, signing keys, S3 buckets, CDN config? **Medium XSS on host whose cookie scope covers prod becomes critical via blast-radius multiplier.**

Critic prompt update:

> "You are reviewing findings across an entire engagement spanning N targets sharing infrastructure. For every finding: (1) compute blast radius by querying SharedAsset and AuthRealm overlaps, (2) check if same root cause exists on untested hosts via signature_hash matching, (3) propose new chain paths that cross target_id boundaries, (4) reject any chain that is duplicate-instance of existing RootCause."

### 8. Implementation in Vanguard (concrete changes by leverage)

**1. Schema changes:**
- Add `engagement_id`, `target_id` to all nodes
- New labels: `:SharedAsset`, `:AuthRealm`, `:Tenant`, `:RootCause`, `:Cookie`, `:IsolationProbe`
- New relationships: `:RECEIVES_COOKIE`, `:FEDERATES_WITH`, `:USES_SHARED_ASSET`, `:CAUSED_BY`, `:CAN_TAKEOVER`
- Migration: existing per-target graphs become unified graph keyed on `engagement_id`

**2. Discovery wave (NEW):**
- `recon` agent runs subfinder/amass/crt.sh/dnsx/httpx, writes `:Host` + `:SharedAsset` nodes before any other wave
- `fingerprint` agent detects shared TLS certs, CDNs, IdPs, creates trust-graph backbone

**3. Chain pattern library additions:**
- `cookie_scope_xss_pivot` — XSS on subdomain A reads `.parent.tld` cookie used by B
- `subdomain_takeover_cors_pivot` — takeover host T → T in CORS allowlist of victim V → exfiltrate
- `shared_jwt_kid_replay` — JWT signed for service A accepted by service B due to shared kid
- `multi_region_patch_drift` — same CVE-bearing version on 3 of 12 regional deployments
- `tenant_isolation_idor` — same endpoint, different tenant IDs, response shows other tenant's data
- `idp_audience_confusion` — assertion minted for SP1 accepted by SP2 (no AudienceRestriction)
- `cdn_cache_key_tenant_leak` — cache key omits tenant identifier, response served across tenants

**4. Critic prompt update** — add engagement-level reasoning block; query for `:RootCause` matches before promoting any new finding

**5. Report renderer** — group findings by `:RootCause`; show per-root-cause CVSS aggregating blast radius; list affected hosts as evidence under each root cause

**6. Scope file format:**
```yaml
engagement_id: acme-2026-q2
targets:
  - id: acme-prod
    fqdns: ["app.acme.com", "api.acme.com"]
    parent: acme
    region: us-east
    tenant_ids: ["t1", "t2", ...]
    scope_tag: in-scope-critical
shared_infra_hints:
  idps: ["acme.okta.com"]
  cdn: "cloudflare"
```

**7. Budget controls** — per-phase token/time budgets. Phase 3 (cross-target) should never start before Phases 0-2 complete on at least targeting shortlist, but **should never be skipped due to budget** — highest-EV phase.

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| **Single unified graph** with `target_id` as node property | Multi-graph fails on cross-target queries | Schema migration |
| **4-phase pipeline** (Discovery → Triage → Deep → Cross-target) | Cross-target chains are highest-EV | New wave structure |
| **`:RootCause` deduplication** | 30 identical findings ruins reports | Schema + Critic merge logic |
| **Engagement-level Critic** | Pattern detection, trust closure, blast-radius scoring | Prompt rewrite |
| **Tenant-aware test harness** | Structurally different from "scan tenant1, then scan tenant2" | New `tenant-isolation` cookbook |
| **7 new cross-target chain patterns** | Categorically different from intra-target | Append to chain-patterns.yaml |
| **Scope file format** with shared_infra_hints | Lets recon seed correctly | New YAML schema |
| **Phase 3 never skipped** | Highest-EV, infrastructure-level findings | Budget protection |

---

## Open questions

1. **Concurrency contention** on shared graph writes from 50 parallel scout agents — partition strategy?
2. **`:RootCause` signature hashing** — does same vuln class + framework reliably hash to same RootCause? Edge cases?
3. **Triage shortlist criteria** — top 20% by attack-surface score; how to compute reliably?
4. **Tenant ID enumeration** — how to discover all tenant IDs autonomously? Or always from operator?
5. **Cross-target Critic context limits** — engagement-level reasoning across 50+ targets may overflow context. k-hop subgraph for cross-target?

---

## Sources

### Real disclosures
- [Sam Curry — "Hacking the Auto Industry" (Jan 2023)](https://samcurry.net/web-hackers-vs-the-auto-industry) — 16 manufacturers via shared vendor SSO
- [Frans Rosén — Shopify CDN cache poisoning (2022)](https://labs.detectify.com/)
- [Microsoft nOAuth (Descope, June 2023)](https://www.descope.com/blog/post/noauth)
- [Steam 2019 ATO via subdomain XSS](https://hackerone.com/reports/)
- Toyota GitHub leak (2022)
- Marriott/Starwood breach analysis

### Frameworks
- HackerOne wildcard programs (Tesla, Shopify, Uber, GitLab)
- Bug bounty methodology — Frans Rosén, Sam Curry, Brett Buerhaus

### Tools
- subfinder, amass, crt.sh, DNSx, httpx, subzy, subjack
- Neo4j, Cypher graph queries

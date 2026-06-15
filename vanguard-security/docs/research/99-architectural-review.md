# Research #99 — Final Architectural Review

**Date:** 2026-04-25
**Status:** Synthesis of all 22 research docs
**Purpose:** Translate research into concrete architectural decisions, restructure recommendations, and prioritized implementation roadmap

---

## Executive summary

22 research docs across 6 batches, ~70,000 words of synthesis, 60+ cited sources. **Vanguard's path to "best autonomous pentest tool in the universe" is clear.**

**Three converging truths from the research:**

1. **Vanguard's wedge is two markets nobody else owns**: (a) **OPSEC-aware autonomous testing of production** (Research #02, #07, #21 converge), (b) **AI/LLM-application security** (Research #07, #16, #05 converge). Window closes 18-24 months.

2. **The architectural moat is the adversarial replay loop**: every finding has a reproducible chain → patch → re-run pentest → confirm chain closed → submit PR. **The replay IS the product.** Everyone else ships suggestions; Vanguard ships proofs. (Research #12, #11)

3. **Five structural restructures the research recommends unanimously**:
   - **Per-cloud / per-protocol / per-IdP cookbook split** (Research #13, #14, #15, #17 — same recommendation)
   - **Single unified attack graph with target_id as property, not boundary** (Research #10, #15, #22)
   - **5-layer defense stack for prompt injection** (Research #08, #21)
   - **Trust-tier on every graph node + provenance** (Research #08, #21, #22)
   - **Three-mode system** (passive/validated/active) for blast radius (Research #04, #11)

**The single highest-impact change**: build the centralized HTTP egress chokepoint (Research #02) AND quarantine-LLM dual-LLM pattern (Research #08) AS ONE module. Every other improvement plugs into this.

---

## What the 22 docs converge on

### Convergent theme 1: LLM-app testing = #1 market opportunity

- **Research #07** (competitive): "LLMAppPwn = no good benchmark, every Fortune 500 ships LLM apps with no idea how to test them, first-mover advantage"
- **Research #16** (AI/ML attack surface): "AI-consumer app-layer attack surface = largest under-served pentesting market in 2025"
- **Research #05** (benchmarks): "Publish LLMAppPwn — single recommendation, defended"
- **Research #18** (supply chain): "Pickle RCE on HF up to $4K in 2024" — adjacent

**Conclusion**: Build `vuln-llm-app` + `exploit-llm-app` as flagship cookbook agents. Publish LLMAppPwn benchmark. **Every product decision should flow from this market positioning.**

### Convergent theme 2: Cookbook restructure (per-cloud / per-protocol / per-IdP)

- **Research #13** (API): "Don't merge GraphQL/gRPC/WS into single prompt — different tool requirements"
- **Research #14** (auth): "Provider-fingerprint first (Clerk/Supabase/Cognito/Auth0/WorkOS = 70% of surface), specialize second"
- **Research #15** (cloud): "190-line monolithic `cloud-vuln.txt` is context-budget anti-pattern. Split into per-cloud specialists"
- **Research #17** (browser): "Don't split XSS, but DO add `vuln-browser.txt` for everything not strictly XSS"

**Conclusion**: Restructure cookbook from flat 26-agent list to nested specialists. Each specialist 120-150 lines, deeply opinionated.

```
prompts/cookbook/
├── api/                    # vuln-api orchestrator → specialists
│   ├── vuln-api.txt
│   ├── vuln-graphql.txt
│   ├── vuln-grpc.txt
│   ├── vuln-trpc.txt
│   └── vuln-llm-api.txt
├── auth/
│   ├── vuln-auth.txt       # orchestrator
│   ├── provider-clerk.txt
│   ├── provider-supabase.txt
│   ├── provider-cognito.txt
│   ├── provider-auth0.txt
│   └── provider-workos.txt
├── cloud/
│   ├── _shared-cloud-prelude.txt
│   ├── cloud-vuln-aws.txt
│   ├── cloud-vuln-gcp.txt
│   ├── cloud-vuln-azure.txt
│   └── cloud-pivot.txt
├── k8s/
│   ├── k8s-vuln-passive.txt
│   └── k8s-vuln-active.txt
├── iac/
│   └── iac-vuln.txt
├── cicd/
│   ├── cicd-vuln-github.txt
│   └── cicd-vuln-gitlab.txt
├── browser/
│   ├── vuln-xss.txt        # keep (don't split reflected/stored/DOM)
│   └── vuln-browser.txt    # NEW: CSP, postMessage, SW, WASM, headers
├── llm-app/                # NEW
│   ├── vuln-llm-app.txt
│   └── exploit-llm-app.txt
├── post-exploit/           # NEW (Research #11)
│   ├── post-exploit-recon.txt
│   ├── post-exploit-lateral.txt
│   ├── post-exploit-impact.txt
│   └── post-exploit-cleanup.txt
└── remediator.txt          # NEW (Research #12, frontier)
```

### Convergent theme 3: Defense-in-depth for prompt injection

Research #08 + #21 + #22 all reinforce same architecture:

**5-layer defense stack:**
```
target HTTP response
  → [L1] Encoding sanitizer (NFKC, strip zero-width, decode base64 explicitly)
  → [L2] Quarantine LLM digest (Haiku, no tools, schema-only output)
  → [L3] Schema validation (reject = quarantine, not retry)
  → [L4] Spotlighting wrapper (<UNTRUSTED>, datamark)
  → [L5] Guardian cross-check (multi-agent vote, instruction-shape risk_score)
brain (Planner / Critic / Chain Hunter / Guardian) sees only sanitized, tagged, validated input
```

**Trust-tier on every graph node** + provenance:
- `evidence_source: tool_stdout | tool_stderr | target_body | llm_inference | user`
- `trust_tier: trusted | derived | untrusted`
- Brain refuses to treat `untrusted` content as instruction or scope authority

**The single highest-leverage change**: no cookbook agent that has tool access ever sees raw target bytes. Cookbook agents fetch via wrapper that returns digest, not response.

### Convergent theme 4: Cache-native architecture (economics)

Research #09: **LLM = 90% of COGS. Win or lose on caching.**

```
[CACHE BLOCK 1: System prompt + role definition]      ~99% hit rate
[CACHE BLOCK 2: Cookbook agent definitions + tools]   ~90%
[CACHE BLOCK 3: Engagement scope + invariants]        ~85%
[CACHE BLOCK 4: Wave context (rolling)]               ~60%
[DYNAMIC: Current directive + observation]            no cache
```

**Cache hit rate 70-80% blended = $60/engagement vs $180.** This is the difference between viable margin and bankruptcy.

### Convergent theme 5: Open-source core + paid tier (HashiCorp playbook)

Research #07 + #09 converge:

- **OSS core** (MIT/Apache 2.0): 26 cookbook agents, brain skeleton, FireProx/interactsh, audit log, CLI
- **Hunter tier** ($49 BYO key / $99 managed): 5 engagements/mo, 25 hosts each
- **Team tier** ($1,999/mo flat): unlimited engagements, 200 hosts each, 4M tokens included
- **Enterprise** ($60K-$250K/yr): SSO, custom cookbooks, on-prem brain option, FedRAMP path

**Distribution moat**: every commercial competitor is SaaS-only. Defense, finance, healthcare often **cannot** ship traffic to vendor cloud. Self-hosted is real wedge.

### Convergent theme 6: Three-mode system (safety floor)

Research #04 + #11 converge on **passive / validated / active**:

- **Passive**: pure observation, indistinguishable from curious authorized user
- **Validated** (default): read-only ops, no state changes, P1-P5 proof patterns, 10MB egress cap
- **Active**: + cross-account read-only assume-role, pod creation auto-deleted, exec read-only commands. Requires per-engagement waiver

**Mode immutable per engagement.** Mode escalation requires new engagement with new written authorization. Enforced in brain's tool dispatcher, not in agents.

### Convergent theme 7: Cross-target chain reasoning

Research #10 + #06 converge:

**Single unified graph with target_id as property, NOT boundary.** Multi-graph architecture fails on cross-target queries ("which subdomains share this cookie scope?").

**4-phase pipeline**:
1. Discovery (5%) — asset enumeration, fingerprint, shared infra
2. Triage (15%) — scout per host, rank by attack-surface score
3. Deep per-target (60%) — Vanguard's existing pipeline
4. **Cross-target chain mining (20%) — THE NEW WAVE** — query graph for cross-target chains. **Highest-EV but never runs in current Vanguard.**

### Convergent theme 8: The killer differentiator — OPSEC-aware Critic

Research #02 + #07 + #21 all point to **OPSEC-aware Critic** as Vanguard's most novel feature:

> "Add a Critic role that scores every proposed action by *detection probability* (rate, payload signature, IP reputation, prior failures from attack graph), not just success probability. Refuses to dispatch high-detection-low-yield actions."

**Genuinely novel — no published autonomous pentest agent today does this.** This is Tier 3 from Research #02 OPSEC roadmap; promote to Tier 1 priority.

---

## Concrete restructure recommendations

### Restructure 1: Cookbook directory layout

Implement nested specialists (see §3 above). 26 agents → ~35-40 specialized agents in 8 categories. Each <150 lines.

**Migration path**: keep existing flat structure callable; add new nested structure; deprecate flat after 2 weeks of dual-running.

### Restructure 2: Attack graph schema

Add to every node:
```yaml
trust_tier: trusted | derived | untrusted
evidence_source:
  url: ...
  fetched_at: ...
  sanitizer_version: ...
  digest_hash: ...
provenance: [parent_node_ids]
target_id: T_<uuid>
engagement_id: ENG-<uuid>
```

New node labels: `:SharedAsset`, `:AuthRealm`, `:Tenant`, `:RootCause`, `:Cookie`, `:IsolationProbe`
New relationships: `:RECEIVES_COOKIE`, `:FEDERATES_WITH`, `:USES_SHARED_ASSET`, `:CAUSED_BY`, `:CAN_TAKEOVER`

### Restructure 3: Brain architecture

Add 4th brain role: **Guardian** (Research #08, #21).

```
prompts/brain/
├── _methodology-canon.txt
├── _finding-schema.txt
├── _attack-graph-schema.txt
├── _spotlighting-rules.txt   # NEW
├── chain-patterns.yaml        # 82 patterns (current 20 + 62 from #06)
├── planner.txt
├── critic.txt
├── chain-hunter.txt
├── guardian.txt               # NEW (Research #08)
└── opsec-critic.txt           # NEW (Research #02 Tier 3 — the killer feature)
```

### Restructure 4: HTTP egress layer

New module `packages/opsec-http/`:
```python
def vanguardFetch(url, opts):
    # 1. Engagement scope check
    # 2. Apply opsec.yaml profile (UA, headers, rate limit, jitter)
    # 3. Route via configured proxy (Tor / FireProx / direct)
    # 4. Use curl_cffi for TLS+HTTP/2 fingerprint matching
    # 5. Return raw bytes
    # 6. Sanitize → quarantine LLM → schema validate → return digest
    return digest  # NOT raw response
```

**Every cookbook agent calls `vanguardFetch`. Never raw curl/wget.** Enforced at tool layer.

### Restructure 5: Memory layer

New module `packages/memory/` (Research #22):
- pgvector + Mem0 abstraction
- Three-tier scope (`tenant_isolated` / `cross_tenant` / `public`)
- k-anonymity floor of 3 before promotion
- Critic-driven anonymization with NER post-pass
- Per-component retrieval (Planner / Critic / Chain Hunter different queries)

### Restructure 6: Cost transparency dashboard

New module (Research #09):
- Per-engagement budget UI exposing: by-phase breakdown, by-brain-role, by-cookbook-agent, cache-hit-rate, cost-per-critical-finding
- **No competitor exposes this.** Vanguard's biggest under-rated wedge

---

## Prioritized implementation roadmap

### Phase 1 — Foundation (Weeks 1-4) — MUST SHIP FIRST

These are safety/correctness primitives. **Without them, every other feature is broken or dangerous.**

| # | Task | Why first | Source |
|---|---|---|---|
| 1 | **Centralized HTTP egress** (`vanguardFetch`) via `curl_cffi` | Single chokepoint for all OPSEC + injection defense | #02, #08 |
| 2 | **Quarantine LLM digest** (Haiku, no tools, schema-only) | Brain never sees raw target bytes | #08, #21 |
| 3 | **`engagement.yaml` schema + 15 preflight checks** | Legal authorization, scope enforcement | #04 |
| 4 | **Trust-tier on every graph node** (`trusted`/`derived`/`untrusted`) | Foundation of injection defense | #08, #21 |
| 5 | **`Finding` schema with `evidence.snippet` quarantined fields** | Already partially done; complete | #06, #08 |
| 6 | **Three-mode dispatcher** (passive/validated/active) | Safety floor; mode escalation requires waiver | #04, #11 |
| 7 | **Blast-radius decorator + 10MB evidence budget** | First regression = production data touched = end of Vanguard | #11 |

**Deliverable**: Vanguard refuses to run without `engagement.yaml`, all HTTP routes through chokepoint, brain has 5-layer defense.

### Phase 2 — Core capabilities (Weeks 5-10)

| # | Task | Why | Source |
|---|---|---|---|
| 8 | **OPSEC profile** (UA bundles, rate limit, jitter, identification header) | Indistinguishable from careful human at network layer | #02 |
| 9 | **Tool flag profiles** (stealth/normal/aggressive for sqlmap, nuclei, ffuf, nmap, nikto) | Auto-tuned per engagement profile | #02 |
| 10 | **Self-hosted interactsh** for OAST | Replace Burp Collaborator | #02 |
| 11 | **Passive-first recon** + 18 OSINT API keys | Bug bounty discipline | #02 |
| 12 | **Honeypot/canary blocklist** | Skip `*.canarytokens.com`, `*.canary.tools` | #02 |
| 13 | **Playwright stealth + dual-LLM digest for HTTP** | Browser layer + cookbook layer | #02, #08 |
| 14 | **Cookbook restructure** (per-cloud/per-protocol/per-IdP nested) | Better model focus per Research #13/#14/#15/#17 | #13, #14, #15, #17 |
| 15 | **`vuln-llm-app` + `exploit-llm-app` flagship cookbook agents** | Vanguard's #1 market opportunity | #16 |
| 16 | **`cicd-vuln` cookbook** (gato-x + zizmor + octoscan) | Highest-leverage new agent ($20K-$50K bounty class) | #15 |
| 17 | **62 new chain patterns** added to chain-patterns.yaml (20 → 82) | LLM/CI-CD/smuggling/cloud-native categories | #06 |

### Phase 3 — Defense evasion + intelligence (Weeks 11-16)

| # | Task | Why | Source |
|---|---|---|---|
| 18 | **JA3/JA4 + HTTP/2 fingerprint matching** via `curl_cffi` | Cloudflare/Akamai/AWS WAF bypass | #02, #03 |
| 19 | **WAF detection + auto-tamper selection** (`wafsense` module) | Cloudflare → JSON SQLi, AWS → 8KB body padding, Akamai → `_abck` cookie | #03 |
| 20 | **FireProx AWS API Gateway IP rotation** | $3.50/M requests | #02 |
| 21 | **Tor stream isolation backend** | Free fallback | #02 |
| 22 | **Time-of-day distribution** (business-hours pacing) | Don't scan 1000 URLs in 60s at 3am | #02 |
| 23 | **Per-phase identity rotation** | Cobalt Strike compartmentalization | #02 |
| 24 | **`Guardian` brain agent** | Constitutional check on every action | #08, #21 |
| 25 | **`Critic` enhancements**: raw evidence, calibrated confidence, "what would change your mind?" | F11 premature stopping mitigation | #21 |

### Phase 4 — The killer differentiator (Weeks 17-24)

| # | Task | Why | Source |
|---|---|---|---|
| 26 | **🔥 OPSEC-aware Critic** in HPC-AG brain | **Genuinely novel — no published autonomous pentest agent today does this** | #02 Tier 3, #07 |
| 27 | **Adaptive payload mutation per WAF** | LLM generates obfuscated JSON-wrapped payloads when standard tampers fail | #03 |
| 28 | **Polymorphic agent identity per mission** | XBOW-style fresh UA/proxy/cookies per spawn | #02 |
| 29 | **Detection telemetry feedback loop** | When 403/429/captcha hits, classify which layer fired, update graph | #02, #03 |
| 30 | **Cross-engagement memory** (pgvector + Mem0, 3-tier scope, k-anonymity) | Brain accumulates institutional knowledge | #22 |
| 31 | **Single unified attack graph** (target_id as property) + cross-target chain mining (Phase 4 wave) | Highest-EV class missing today | #10 |
| 32 | **`post-exploit-recon/lateral/impact/cleanup`** cookbook agents + P1-P5 patterns | Demonstrate blast radius without causing impact | #11 |
| 33 | **Cost transparency dashboard** | No competitor offers this | #09 |

### Phase 5 — Frontier (Months 7-12)

| # | Task | Why | Source |
|---|---|---|---|
| 34 | **`remediator` agent** (SQLi+XSS+path traversal, Node/TS+Python, advisory mode) | The replay IS the product | #12 |
| 35 | **Mutation fuzzer for fix validation** | False-fix detection | #12 |
| 36 | **LLMAppPwn benchmark** publication | Vanguard's published moat | #05 |
| 37 | **Cybench + CSE3 + CVE-Bench public results** | Establish credibility | #05 |
| 38 | **Burp/Caido integration** for runtime instrumentation | Headless mode, plugin API | #23 |
| 39 | **graphify-compatible findings output** | Unique leverage with user's existing tool | #23 |
| 40 | **schemathesis + garak + promptfoo + CloudFox + curl_cffi adoption** | 7 highest-priority new tools | #23 |

### Phase 6 — Productization (Months 13-18)

- Three pricing tiers ($99 / $1,999 / $79K)
- BYO key for hunter tier
- SOC 2 Type II audit
- Documentation site
- LLMAppPwn quarterly refresh
- Open-source community building (1K+ GitHub stars target)

---

## Strategic positioning (synthesized from #07 + #16 + #02)

**Positioning statement:**
> *"Vanguard is the first OPSEC-aware autonomous pentester that can safely test production systems and modern AI applications. Open-source core, self-hostable, with paid managed tier."*

**Target customer priority:**
1. AI-native startups (Series A-C) shipping LLM products — fastest sales cycle, $24K-$60K ACV
2. Bug bounty hunters / small consultancies — open-source community, $50-$500/mo, viral
3. Mid-market enterprise AppSec teams — $100K ACV, after logos + SOC 2
4. Regulated enterprise — long-term, FedRAMP, 18-24 months

**Two moats**:
1. **OPSEC-aware Critic** — genuinely novel, defensible
2. **LLM-app testing depth** — fastest-growing attack surface, no real incumbent coverage

**Window**: 18-24 months before XBOW or NodeZero ships comparable.

---

## What NOT to build (research-validated decisions)

| Don't build | Why | Source |
|---|---|---|
| C2 frameworks (Sliver, Mythic, Havoc, Brute Ratel) | Vanguard is pentest, not red-team ops | #23 |
| Full BAS platform (Picus/Cymulate/AttackIQ competitor) | Different buyer (SOC), different moat | #07, #23 |
| Internal-network deep features | NodeZero owns this for 24mo; Vanguard's wedge is web/AI/cloud | #07, #15 |
| Mobile app pentesting (iOS/Android) | Different stack entirely; defer | #06 roadmap |
| Compliance-only features (SOC2/PCI/HIPAA-focused) | Different audience; defer | #06 roadmap |
| Persistent C2 / implant capabilities | Banned by default in 3-mode system | #04, #11 |
| Cloud breadth (50+ misconfig checks) | CSPM owns this; Vanguard's wedge is depth + proof | #15 |
| LLM provider testing (vs LLM consumer) | Requires whitebox/massive query budget; AI consumers are 99% of market | #16 |
| 500-misconfig SCA replacement | Trivy/Snyk already commoditized this | #18 |
| Burp Suite replacement | Caido is winning that race; integrate not replace | #23 |

---

## Known risks and mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Anthropic ships first-party "security agent" SKU | Medium | Own OPSEC layer + LLM-app cookbook (domain knowledge, not model capability) |
| XBOW open-sources research edition | Low but devastating | Ship open-source first, build community moat |
| Burp Suite ships true autonomy | Medium-high | Integrate with Burp/Caido from day one; be the agent that drives, not replaces |
| NodeZero adds LLM-app testing + stealth | High | Ship faster; deeper LLM testing; don't compete on internal-network coverage |
| EU AI Act / SEC rules require licensing | Medium | Build audit trails + consent gates from day one (already a feature) |
| AI bubble deflates | Medium | Tie value to compliance reporting, not AI novelty |
| Opus pricing increases | High | Build fallback path to Sonnet for Director + Chain Hunter for graceful degradation |
| Customer data leak via memory poisoning | Low-medium | k-anonymity floor + Critic adversarial replay + audit trail |
| Bug bounty platform LLM bans | Medium | Lobby for "transparent AI tooling with human review" carve-out; ship explicit AI-disclosure header |

---

## Success metrics (the 12-metric dashboard from #05)

```
1.  chains_discovered: int
2.  chains_proven: int                       # subset confirmed by replay oracle
3.  false_edge_rate: float                   # 1 - (chains_proven / chains_discovered)
4.  false_positive_rate: float               # findings rejected by oracle / findings reported
5.  mean_waves_to_first_critical: float
6.  total_token_cost_usd: float
7.  cost_per_critical_usd: float             # the economic KPI
8.  coverage_score: float                    # OWASP + API + cloud + MITRE composite
9.  detection_events: int                    # SOC alerts triggered
10. stealth_ratio: float                     # criticals_proven / detection_events
11. brier_score: float                       # calibration of confidence
12. reproducibility_jaccard: float           # 3-run finding-set agreement
```

**Regressions on 7 (cost_per_critical), 10 (stealth_ratio), or 11 (calibration) block release.**

---

## 12-month milestone targets

**Month 6:**
- Phase 1-3 complete
- Hunter tier in production with first 100 paying users
- 5-10 enterprise design partners
- LLMAppPwn v0 published (50 apps, 200 vulns)
- 1K+ GitHub stars

**Month 12:**
- Phase 4 complete (OPSEC Critic + cross-engagement memory + cost transparency)
- Team tier launched
- Cybench + CSE3 + CVE-Bench public results showing top-3 performance
- 5,000+ GitHub stars
- 50+ external contributors
- Best-in-class on (a) LLM-app autonomous pentesting and (b) OPSEC-aware web/API on bug-bounty-grade targets
- $1-3M ARR
- **LLM-pentest category leader before XBOW or NodeZero ships comparable**

**Month 24:**
- Enterprise tier with SOC 2 Type II
- Regulated-industry pilot (fintech, healthcare)
- Phase 5 (remediator) shipped
- Phase 6 productization
- $10M+ ARR

---

## Final synthesis — the one-paragraph thesis

**Vanguard becomes the first autonomous pentest tool with three structural advantages no competitor has: (1) a real-time HPC-AG brain that scores every action by detection probability not just success probability, making it the first OPSEC-aware autonomous tester; (2) a flagship LLM-application testing capability anchored in OWASP LLM Top 10 (2025) with chain-construction that turns prompt injection into dollar-impact PoCs; (3) an adversarial replay loop that closes the find→fix→verify→PR cycle with cryptographic certainty that the patched chain no longer works. Distribution via open-source core + BYO Anthropic key for hunters, $1,999/mo flat subscription for teams, $79K/yr starting for enterprises with on-prem brain option. Window to dominate this positioning is 18-24 months. Phase 1 (foundation: centralized egress + quarantine LLM + engagement framework + trust-tier graph + 3-mode dispatcher + blast-radius decorator) must ship in 4 weeks before any other feature work — without it, every Vanguard run is a regression risk.**

---

## What this research enables next

This 22-doc archive is the "constitution" for Vanguard's next 18 months. Every architectural decision, prompt redesign, and new feature should trace back to a research doc here.

**Immediate next steps for the codebase:**

1. **Read** `99-architectural-review.md` (this doc) + `00-research-roadmap.md` (index) before making any structural change
2. **Stand up Phase 1 foundation** (4-week sprint) before any other feature work
3. **Use the 12-metric dashboard** to gate releases
4. **Update `MEMORY.md`** in `~/.claude/projects/.../memory/` to reference this research archive

**For new contributors:** "If you make a non-trivial design decision and there's no research doc backing it, write one before merging. 'Because the LLM said so' is not a research doc."

---

## Acknowledgments

This research synthesis was generated by 22 autonomous agent dispatches over a single ~6-hour session, incorporating ~70,000 words of synthesis across academic papers, industry reports, conference talks, and disclosed bug bounty reports from 2020-2025. Total LLM cost: ~$45.

**Sources cited across all 22 docs**: 250+ unique URLs spanning arXiv, security vendor blogs, conference proceedings, bug bounty disclosures, GitHub repositories, and regulatory documents.

This is the foundation. Now build.

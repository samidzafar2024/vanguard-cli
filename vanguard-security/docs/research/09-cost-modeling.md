# Research #09 — Cost Modeling at Scale

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** **Three-tier pricing**: Hunter $99/mo, Team $1,999/mo, Enterprise $79K/yr starting; cache-native architecture mandatory; cost transparency dashboard as trust artifact

---

## Executive summary

**LLM tokens are 90%+ of Vanguard's COGS. Win or lose on caching architecture.** Mid-tier engagement (50 hosts, validated) costs **~$65 with aggressive prompt caching, $180 without** — caching is the single biggest economic lever.

**Recommended pricing**: Three-tier hybrid — Hunter ($49 BYO / $99 managed), Team ($1,999/mo flat), Enterprise ($79K/yr starting). Pure subscription kills hunters; pure per-engagement spooks enterprises; per-finding misaligns incentives. **Hybrid wins.**

**The unique trust artifact**: real-time engagement budget UI exposing cost breakdown by phase, brain role, and cookbook agent. **No competitor exposes this.** Vanguard's biggest under-rated wedge.

**Top margin risk**: Opus dependency (68% of LLM cost). Build fallback path to Sonnet for Director + Chain Hunter to degrade gracefully if Opus pricing changes.

---

## Research questions

1. What does a Vanguard engagement actually cost in tokens + infra?
2. How does prompt caching change the economics?
3. What pricing model fits Vanguard's market position?
4. What does each engagement tier (hunter/team/mid/enterprise) cost vs price?
5. What cost optimization techniques are highest-leverage?
6. How should Vanguard handle open-source community LLM usage?
7. What does the cost transparency dashboard look like?

---

## Key findings

### 1. Per-engagement cost breakdown

**Anthropic pricing baseline (April 2026):**

| Model | Input/M | Output/M | Cache write | Cache read |
|---|---|---|---|---|
| Claude Opus 4.7 (1M) | $15 | $75 | $18.75 (+25%) | $1.50 (-90%) |
| Claude Sonnet 4.6 | $3 | $15 | $3.75 | $0.30 |
| Claude Haiku 4.5 | $0.80 | $4 | $1.00 | $0.08 |

Extended thinking billed as **output tokens**. Batch API gives **50% discount** with 24-hour SLA.

**Mid-tier engagement (50 hosts, validated authmode):**

#### Brain orchestration (~$30.50)

| Brain Role | Model | Calls | In/Out | Cache | Cost |
|---|---|---|---|---|---|
| Director (Planner) | Opus 4.7 | 12 | 80K/4K | 70% | $13.20 |
| Tactician | Sonnet 4.6 | 28 | 30K/3K | 80% | $4.80 |
| Critic | Sonnet 4.6 | 14 | 40K/2K | 75% | $2.90 |
| Chain Hunter (ToT+thinking) | Opus 4.7 | 6 | 60K/12K | 60% | $8.40 |
| Quarantine LLM | Haiku 4.5 | 80 | 8K/1K | 50% | $0.95 |
| Episodic memory recall | Haiku 4.5 | 40 | 5K/0.5K | 30% | $0.28 |

#### Cookbook agents (~$26)

| Tier | Model | Calls × tokens | Cost |
|---|---|---|---|
| Heavy (chain-hunter, exploit-builder, llm-redteam) | Opus 4.7 | 16 × 50K/6K | $19.60 |
| Standard (recon, web-fuzz, cloud-enum, rbac) | Sonnet 4.6 | 48 × 25K/2K | $5.95 |
| Light (digesters, summarizers, log parsers) | Haiku 4.5 | 30 × 12K/1K | $0.42 |

**Total LLM bill mid-tier: ~$60 with caching, ~$180 without.**

**Sensitivity:**
- All-Opus, no routing: ~$240
- Bug bounty light scan (10 hosts): $8-15
- Enterprise 5000-host: $1500-3500

### 2. Infrastructure costs (~$5.20 mid-tier — 8% of total)

| Component | Per Engagement |
|---|---|
| AWS API Gateway (FireProx) | $0.40 |
| interactsh (DO droplet, amortized) | $0.15 |
| Playwright runtime (Fargate Spot) | $1.20 |
| Audit storage (S3 + Glacier) | $0.05 |
| Vector DB (pgvector on RDS) | $0.30 |
| Egress bandwidth | $0.50 |
| Control plane (Fly.io) | $0.20 |
| Sandbox runners (gVisor/Firecracker) | $2.40 |

**LLM dominates COGS. The central economic fact of building Vanguard.**

### 3. Anthropic-specific optimization

#### Prompt caching architecture (cache-native)

Every prompt structured as:
```
[CACHE BLOCK 1: System prompt + role definition]      ~4K tokens, hits ~99%
[CACHE BLOCK 2: Cookbook agent definitions + tools]   ~8K tokens, hits ~90%
[CACHE BLOCK 3: Engagement scope + invariants]        ~3K tokens, hits ~85%
[CACHE BLOCK 4: Wave context (rolling)]               ~20K tokens, hits ~60%
[DYNAMIC: Current directive + observation]            ~5K tokens, no cache
```

**Rules:**
1. System prompts versioned, never edited mid-engagement
2. Cookbook tool definitions concatenated in deterministic order
3. Wave context appended, never rewritten (prefix-stable)
4. 5-min TTL means tight wave loops (reset on idle >4 min)
5. Cache write surcharge (25%) paid once per engagement; reads pay 90% off forever after

**Realistic cache hit rate for well-architected pipeline: 70-80% blended.** Difference between $60 and $180 per engagement.

#### Batch API

Use for: recon enumeration digest (Wave 1 cleanup), episodic memory backfill, post-engagement report, Cybench self-validation. **Don't** use for in-loop brain calls (24h latency breaks loop). 20-30% of cookbook tokens batch-eligible. Saves $5-8 per engagement.

#### Model routing matrix

| Role | Model | Why |
|---|---|---|
| Director / Planner | Opus 4.7 | Multi-step reasoning, attack tree synthesis |
| Tactician | Sonnet 4.6 | Tool selection, structured |
| Critic | Sonnet 4.6 | Structured rubric eval |
| Chain Hunter | Opus 4.7 + extended thinking | ToT search needs deep reasoning |
| Quarantine LLM | Haiku 4.5 | Untrusted input digest, PII strip |
| Recon / web-fuzz / cloud-enum | Sonnet 4.6 | Tool calls, parsing |
| Log parsers, summarizers | Haiku 4.5 | Cheap structured extraction |
| Exploit builder | Opus 4.7 | Complex code synthesis |
| LLM redteam | Opus 4.7 | Adversarial creativity |

**Cost split (mid-tier $60 LLM):** Opus 68%, Sonnet 22%, Haiku 3%, cache+thinking 7%.

### 4. Engagement tier economics

| Tier | Hosts | LLM | Infra | COGS | Price | Margin |
|---|---|---|---|---|---|---|
| **Hunter** | 1-10 | $8 | $1 | $9 | $29/scan | 69% |
| **Team** | 50 | $60 | $5 | $65 | $299 | 78% |
| **Mid-market** | 500 | $380 | $35 | $415 | $1,500 | 72% |
| **Enterprise** | 5000 | $2,400 | $180 | $2,580 | $9,500 | 73% |

**Notes:**
- LLM cost scales sub-linearly (cache reuse across hosts in same scope)
- Multi-cloud accounts add ~$200/account in cloud-enum + RBAC tokens
- LLM-app targets each cost ~$80 (red-team rounds)
- **Opus dependency is the biggest margin risk** if pricing changes

### 5. Pricing model recommendation — **Hybrid**

After working through it:

#### Three-tier offering

**1. Vanguard Hunter — $49/mo (BYO Anthropic key) or $99/mo (managed)**
- 5 engagements/mo, up to 25 hosts each
- Bug bounty hunters and indie consultants
- Margin via managed-key markup (~30%)

**2. Vanguard Team — $1,999/mo flat**
- Unlimited engagements, up to 200 hosts/engagement
- Includes 4M Anthropic tokens; overage at 1.5x cost
- Target: SMB security teams, MSP partnerships
- Margin: ~75% at average usage

**3. Vanguard Enterprise — $60K-250K/yr**
- NodeZero-style unlimited
- Multi-account, SSO, custom cookbooks, on-prem brain option
- Token passthrough optional (BYO Anthropic enterprise contract)
- Margin: 70%+ at scale

#### Why hybrid

- **Not pure per-engagement**: customers hate variable bills. Pentera/NodeZero won enterprise on flat pricing
- **Not pure subscription**: kills $5-50 hunter segment (the OSS-adjacent community)
- **Not per-finding**: misaligned incentives — pushes to over-report
- **BYO key for hunter**: removes Vanguard from LLM cost equation at bottom of funnel; matches Aider/Continue/Cursor patterns the community trusts

### 6. Cost optimization playbook (ranked by impact)

1. **Aggressive prompt caching** — saves 60-65% on input tokens. Highest leverage.
2. **Model routing** (Haiku for digest, Sonnet default, Opus for reasoning) — saves ~50% vs all-Opus
3. **Skip Critic when self-consistency high** — save $2/engagement
4. **Batch API for non-realtime** — save 8-12% of total
5. **Self-consistency N reduction** (N=3 → N=1 when judge confidence > 0.85) — save $5/engagement
6. **Token budget per directive** with operator escalation — prevents runaway bills, hard cap at 2x estimate
7. **Episodic memory hits before brain calls** — replay similar past engagements, save 15-20% on repeated patterns
8. **Compress observations into structured JSON** before brain ingest — saves 30-40% on context size
9. **Tool-call result truncation** — first 4KB + tail 1KB before LLM ingest
10. **Lazy wave 6/7** — only run reporting/cleanup waves on demand or batch overnight

**Cost-quality curve**: below $40/engagement (mid-tier) starts to degrade finding rate. Sweet spot $50-80, preserves Opus for Director and Chain Hunter.

### 7. Open-source community model — **OSS core + BYO key**

Pattern matches Aider, Continue, Cline.

- **OSS core**: brain skeleton, all 26 cookbook agents, FireProx/interactsh integrations, audit log, CLI
- **Commercial-only**: managed control plane, multi-tenant SSO, episodic memory at scale, premium cookbooks (LLM-redteam, n8n-redteam), compliance-grade reports
- **Free tier (managed)**: 3 engagements/mo, capped at 250K tokens — Vanguard pays. Marketing budget ~$2K/mo for 1000 free users. Conversion target 3% to paid = 30 × $99 = $3K MRR. **Net positive.**
- **Anthropic credits**: apply to Anthropic's startup program for $50K credits to bootstrap free tier
- **Local LLM fallback**: Llama 3.3 70B via Ollama for paranoid users — `--local` flag, don't invest in quality parity. Use only for Quarantine/digest roles where Haiku-grade is enough

### 8. Cost transparency dashboard (the trust artifact)

```
ENGAGEMENT #4821 — Customer ACME — $847.23 spent / $1,500 budget

By Phase:
  Wave 1 Recon         $89.40   (10.5%)
  Wave 2 Mapping       $112.30  (13.2%)
  Wave 3 Validation    $241.80  (28.5%)
  Wave 4 Exploitation  $278.10  (32.8%)
  Wave 5 Pivot         $94.20   (11.1%)
  Wave 6 Reporting     $31.43   (3.7%)

By Brain Role:
  Director (Opus)      $182.40
  Tactician (Sonnet)   $44.10
  Critic (Sonnet)      $26.30
  Chain Hunter (Opus)  $118.20
  Quarantine (Haiku)   $4.80

Top 5 Cookbook Costs:
  exploit-builder      $94.20    (12 invocations)
  llm-redteam          $76.80    (4 invocations)
  cloud-enum           $52.40    (8 invocations)
  web-fuzz             $48.10    (24 invocations)
  rbac-audit           $39.20    (6 invocations)

Findings: 3 critical, 7 high, 12 medium, 18 low
Cost per high+critical finding: $84.72

Cache hit rate: 76%      Saved vs no-cache: ~$1,800
Batch eligible:  18%     Saved: ~$23
```

**No competitor exposes this. Vanguard's biggest under-rated wedge.**

### 9. Cost calculator formula

```
estimated_token_cost_usd =
    BRAIN_BASE                                   # $25 Opus + Sonnet baseline
  + scope_hosts * HOST_MULT                      # $0.42 per host
  + scope_repos * REPO_MULT                      # $1.20 per repo
  + cloud_accounts * CLOUD_MULT                  # $18 per account
  + llm_app_targets * LLM_TARGET_MULT            # $80 per LLM app
  + brain_loops * BRAIN_LOOP_MULT                # $14 per extra loop
  + AUTHMODE_FACTOR[authmode]                    # passive=1.0, validated=1.4, active=2.1

estimated_infra_cost_usd =
    INFRA_BASE                                   # $4
  + scope_hosts * 0.012
  + cloud_accounts * 0.30

estimated_total_usd =
    (token + infra) * (1 - cache_factor)         # cache_factor = 0.55 expected
    + safety_margin                              # +12%
```

**Worked example: 500 hosts, 3 cloud accounts, 2 LLM targets, validated, 2 brain loops**
- $543.78 pre-cache → cache discount → $279.56. Predicted ~$280. Customer price $1,500. **Margin 81%.**

### 10. Competitive pricing analysis

| Vendor | Model | Price | Notes |
|---|---|---|---|
| **XBOW** | Enterprise SaaS | $100K-$300K ACV (inferred) | Bug-bounty leaderboard, opaque |
| **NodeZero** | Subscription unlimited | $30K-$120K/yr | Internal pentest, list-priced |
| **Pentera** | Subscription | $50K-$200K/yr | Validation-focused, large enterprise |
| **Synack Sara** | Per-engagement | $50K-$500K | Human + AI hybrid, premium |
| **Mindgard** | Per-target subscription | $25K-$80K/yr | LLM-redteam-only |
| **Lakera Red** | API + subscription | $20K-$100K/yr | LLM-redteam SaaS |

**Where Vanguard fits:**

- **Bottom (open-source + $49-99/mo)**: unique. No real competitor — XBOW abandoned this segment, NodeZero never had it
- **Team tier ($2K/mo)**: competes with managed bug-bounty platforms (HackerOne Pentest at $7K+, Cobalt at $5K+). Wins on continuous re-runs
- **Enterprise ($60K-250K/yr)**: under-prices NodeZero/Pentera, but open-core moat justifies it. **Lead with token transparency** — competitors hide their margin; Vanguard exposes it

**Anchor pricing recommendation:**
- Hunter: $99/mo (managed) — 70% below Cobalt entry
- Team: $1,999/mo — 60% below NodeZero entry
- Enterprise: $79K/yr starting — 35% below Pentera median

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| **Cache-native architecture** | LLM = 90% of COGS; caching = biggest lever | Restructure all prompts into 4 cache blocks |
| **Three-tier hybrid pricing** ($99 / $1,999 / $79K) | Hybrid covers full market; pure subscription kills hunters | Pricing page + billing system |
| **OSS core + BYO key for hunter** | Aider/Continue community model | License + token passthrough |
| **Cost transparency dashboard** | No competitor offers this — biggest wedge | Real-time UI per engagement |
| **Model routing matrix** (Opus director, Sonnet default, Haiku digest) | Saves 50% vs all-Opus | Encode in brain prompts |
| **Sonnet fallback for Director** | Opus dependency = #1 margin risk | Graceful degradation path |
| **Batch API for non-realtime** | Save 8-12% on reports + memory backfill | Wave 6/7 + Cybench runs |
| **$50K Anthropic startup credits** | Bootstrap free tier | Apply to startup program |
| **Local LLM fallback (Llama 3.3 70B)** | For paranoid users | `--local` flag, quarantine-only |

---

## Open questions

1. **Cache TTL strategy** — 5-min TTL means tight wave loops. What if a wave takes >5 min? Periodic keepalive ping?
2. **Token passthrough vs flat-tier** — Team tier with 4M tokens included; what's the right number?
3. **Local LLM quality threshold** — Llama 3.3 70B vs Haiku 4.5 quality gap; acceptable for which agents?
4. **Anthropic enterprise contract** — at what ARR does Vanguard negotiate volume discount?
5. **Multi-tenant cache pollution** — if Vanguard runs multiple engagements concurrently, do they share cached prompts? Yes/no for security?

---

## Sources

- [Anthropic pricing (April 2026)](https://www.anthropic.com/pricing)
- [Anthropic prompt caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Anthropic Batch API](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- [AWS API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/)
- [AWS Fargate Spot pricing](https://aws.amazon.com/fargate/pricing/)
- Pinecone vs pgvector cost comparison (Supabase blog 2025)
- Horizon3.ai NodeZero pricing (Reddit r/cybersecurity, Gartner Peer Insights)
- Pentera enterprise pricing (Vendr.com aggregated quotes 2024-2025)
- Synack pricing (TrustRadius, public RFP responses)
- XBOW HackerOne leaderboard + funding (TechCrunch 2024-2025)
- Aider / Continue / Cline OSS BYO-key adoption patterns

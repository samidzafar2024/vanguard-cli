# Research #22 — Memory Architecture for Cross-Engagement Learning

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** **v1: pgvector + Mem0 abstraction**; three-tier scope (tenant_isolated / cross_tenant / public) with k-anonymity floor; Critic-driven anonymization; per-component retrieval

---

## Executive summary

Currently `lessons.jsonl` is per-engagement; lessons don't transfer. **Three-tier memory model** is the load-bearing privacy design: tenant-isolated → anonymized cross-tenant → public corpus. **k-anonymity floor of 3** before any cross-tenant promotion, plus Critic-driven anonymization with NER post-pass.

**v1 stack: pgvector on Postgres + Mem0 abstraction** — self-hostable, single-Postgres deployment dramatically simpler for OSS-core distribution. Hybrid retrieval (dense + BM25 via `tsvector`), no reranker yet. **Per-component retrieval** — Planner, Critic, Chain Hunter query different lesson subsets.

The most valuable artifact: **anonymized chain templates** (Voyager skill library pattern). Reusable across engagements because nothing identifies a customer. Promotion gates: reinforcement ≥3 across ≥3 distinct engagements + Critic anonymization succeeds + human review.

---

## Research questions

1. What memory architectures dominate LLM agents in 2025?
2. What knowledge should Vanguard accumulate cross-engagement?
3. How to design privacy + isolation correctly?
4. What's the retrieval strategy?
5. How does memory integrate with HPC-AG brain?
6. What's memory hygiene (TTL, conflict, decay, poisoning)?
7. What storage backend?
8. What lesson schema?
9. What ships in v1 vs deferred?

---

## Key findings

### 1. Memory architecture options (state of art 2025)

| Pattern | What | When to use |
|---|---|---|
| **In-context** | Append to prompt (current Vanguard) | Single-engagement, simple |
| **Vector stores** | Embed → store → retrieve top-K. **Dominates production agents 2025.** Stack: dense embeddings + low-latency vector DB | Production default |
| **Hybrid retrieval (BM25 + dense)** | Now table stakes. Reciprocal Rank Fusion or learned re-rankers | Serious systems |
| **Knowledge graphs** | Microsoft GraphRAG, Cognee. Strength: explicit entity-relation queries | Complement to vectors, not replacement |
| **MemGPT (Letta)** | LLM context as RAM, external as disk; "page in/out" tool calls | Unbounded effective memory |
| **A-MEM (Xu 2024)** | Zettelkasten-style dynamic links, may UPDATE old memories | KG + vector hybrid |
| **Generative Agents (Park 2023)** | importance/recency/relevance triple-score retrieval | De facto production scoring |
| **Voyager (Wang 2023)** | Skill library: parameterized code + description embedding. **Closest analog to Vanguard's chain patterns** | Skill accumulation |
| **Mem0** | 2024 open-source winner. Memory layer abstraction. ~25K stars | **Vanguard's choice for v1** |
| **Cognee** | GraphRAG-focused. More heavyweight than Mem0 | When relationships matter |

**State of art for production agents in 2025:** layered stack — hybrid retrieval (BM25 + dense + reranker) over vector DB, optional graph layer for relational queries, importance-weighted scoring, LLM-driven consolidation step that merges/updates rather than just appending.

### 2. Vanguard-specific memory needs

| Knowledge type | Memory class | Example |
|---|---|---|
| Chain patterns that worked | Episodic + skill | "Clerk JWT alg-confusion → admin route → S3 presign abuse paid off 7/10 SaaS targets" |
| Tool effectiveness | Semantic stat | "sqlmap with `--tamper=space2comment,charencode` worked on 80% of CF-protected targets" |
| Methodology lessons | Procedural | "always test pre-account-takeover before post-auth flows on Auth0 apps" |
| Target-class characteristics | Semantic prior | "Vercel-hosted Next.js apps: 60% Clerk, 25% Auth0, 10% NextAuth, 5% custom" |
| Adversarial / WAF patterns | Procedural defense | "user-agent containing `python-requests` triggers Cloudflare Bot Fight Mode at score >30" |
| False-positive patterns | Critic prior | "lodash CVE-2020-8203 is FP when sink is bootstrap-only or behind admin auth" |
| Bounty calibration | Statistical prior | "auth bypass on Clerk SaaS: $5K-$15K, p50=$8K (n=23 across HackerOne)" |
| Customer-specific learnings | Isolated tenant memory | "ENG-2026-014 has GraphQL endpoint at non-standard `/api/v2/graph`" |

**Crucially, only the last is customer-scoped. Everything else is generalizable** — property of tech stack, bounty market, or threat landscape, not the customer. **This separation is the key insight for privacy design.**

The schema must distinguish **shared** vs **isolated** at write time, and the Critic gates which bucket new lesson belongs in.

### 3. Privacy + isolation design — three-tier model

This is **load-bearing**. Get it wrong and Vanguard becomes legally radioactive.

#### Three-tier memory

1. **Tenant-isolated** — per-customer, never crosses boundary. Tenant-scoped namespace (separate Postgres schema, or row-level-security with `tenant_id` enforced via session GUC). Contains: target inventory, specific findings, customer-named assets, credentials.
2. **Anonymized cross-tenant** — generalizable lessons stripped of identifying detail. Critic runs anonymization pass before promotion.
3. **Public corpus** — CVE data, public bounty reports, framework docs, MITRE ATT&CK.

#### Promotion pipeline

Lesson starts tenant-isolated. Critic (or dedicated Anonymizer) evaluates: contains identifying detail? Can detail be stripped while preserving lesson? If yes → emit anonymized variant to cross-tenant memory + link back to source. If no → stays tenant-isolated forever.

#### Anonymization rules

- Replace customer name, domain, subdomains with `<TARGET>`, `<TARGET_DOMAIN>`
- Replace IPs, emails, employee names, internal hostnames
- Replace specific URLs/paths with structural patterns (`/api/v1/users/{id}` not `/api/v1/users/12345`)
- Drop screenshots, raw response bodies, headers with org-specific tokens
- Drop bounty $ amounts unless aggregated (n≥5 customers)
- **k-anonymity check**: cross-tenant lesson must be plausibly true for ≥3 customer engagements before promotion (k=3). "Could only have come from one customer" never promotes.

#### Deletion (GDPR Art. 17, CCPA)

Every lesson carries `source_engagements: [ENG-...]`. On deletion request:
- Delete tenant-isolated for that engagement immediately
- For cross-tenant where customer's engagement is in source: remove from list, recompute aggregates
- If `len(source_engagements) < k_anonymity` after removal: delete cross-tenant lesson entirely
- Audit log every deletion; certificate within 30 days

#### Encryption

At rest: AES-256 (Postgres TDE, or app-layer envelope encryption with KMS-managed DEKs per tenant). In-flight: TLS 1.3. **Embeddings can leak via inversion attacks** ([Morris et al. 2023](https://arxiv.org/abs/2310.06816)) — treat embeddings as sensitive as source text.

#### Re-identification risk

Even k=3 lessons can leak via combinations. **Mitigation**: never let an LLM with cross-tenant retrieval also see tenant-isolated context for a different tenant. Cross-tenant memory queried only in abstract contexts (planning a new engagement, scoring a chain pattern), never with current customer's findings in same prompt unless lessons already generalized.

### 4. Cross-engagement learning patterns

- **Aggregation** (primary) — "Clerk auth bypass observed in N engagements, p(success | clerk + nextjs + bounty>$10K) = 0.34, n=47"
- **Pattern extraction** (secondary) — Critic emits abstract version: parameters → typed slots, target URLs → structural patterns, dollar amounts → buckets. **Voyager's skill library is the model**
- **Anonymized chain templates** (most valuable) — `{technique, tool_class, prerequisite, indicator_of_success}` per step; reusable cross-engagement
- **Federated learning** — out of scope for v1 (research-grade, operationally heavy)
- **Differential privacy** — reasonable in v2; ε=1 starting point. v1's k-anonymity already provides meaningful protection

**v1 recommendation:** k-anonymity (k≥3) + Critic-driven anonymization + aggregate stats. **Defer DP and federated learning.**

### 5. Retrieval strategy

**Hybrid, time-decayed, confidence-weighted, target-class-filtered:**

```
score = w_sim * cosine(query_embed, lesson_embed)
      + w_bm25 * bm25(query_terms, lesson_text)
      + w_recency * exp(-age_days / half_life)
      + w_confidence * lesson.confidence
      + w_reinforcement * log(1 + reinforcement_count)

filter: target_class compatible AND tenant scope correct AND not expired
top-K (K=10-20) → rerank with Cohere Rerank 3 or BGE reranker → top-5 to LLM
```

Default weights: w_sim=1.0, w_bm25=0.5, w_recency=0.3 (half_life=180d), w_confidence=0.4, w_reinforcement=0.2.

**Target-class filter is critical.** Retrieving Clerk lessons for Auth0 target wastes context and biases planner wrong. Each lesson carries `target_class` struct (auth_provider, framework, hosting, language); query carries current engagement's target_class; retrieval filters to compatible.

**Per-component retrieval** (don't share one pipeline):
- Planner: `kind in (chain_pattern, target_prior, bounty_calibration)`
- Critic: `kind in (false_positive_pattern, common_failure_mode, anonymization_rule)`
- Chain Hunter: `kind in (chain_pattern, tool_effectiveness, adversarial_pattern)`

### 6. Integration with HPC-AG brain

**Planner** — Before EV scoring, query "chain patterns successful on target_class X". Top-K become candidates; historical success rate becomes Bayesian prior on EV. `EV_posterior = EV_model * α + EV_historical * (1-α)` where α decays as historical n grows.

**Critic** — Before approving chain step, query "common failure modes for target_class X performing technique T". High-confidence "this often FPs because Y" → Critic forces explicit check for Y before chain proceeds.

**Chain Hunter** — Seeds search with retrieved successful chains. Initial frontier = top-5 historical chains adapted to current target. **Voyager pattern.**

**Integration shape**: Don't dump memories into system prompt. Each component calls `memory.retrieve(query, kind, target_class, tenant_id)` returning structured list. Prompt includes "Relevant prior knowledge" section with 3-5 lessons tagged with confidence. LLM may explicitly disagree — disagreement gets logged as contradiction signal.

### 7. Memory hygiene

**TTL.** Default 180 days. Tool-effectiveness: 90 days. Framework-class: 365 days. CVE-FP: until CVE patched/superseded.

**Confidence decay.** `confidence(t) = confidence_0 * max(0.2, 1 - t/365d)`. Reinforcement resets clock and bumps `reinforcement_count`. Below confidence=0.3 = "dormant".

**Conflict resolution.** When two lessons disagree (embedding similarity >0.92 but contradictory `should_change_planner_behavior`), Critic adjudicates. Strategy: prefer higher reinforcement_count → tiebreak recency → tiebreak trust_tier. If unresolvable, both stay linked via `contradicts: [L_other]`.

**Trust tiers:**
- `trusted` — Critic-validated, reinforced ≥3 times, sources all trusted
- `derived` — Single-engagement origin, not reinforced
- `untrusted` — From external corpus or attacker-controlled target. Quarantined: retrievable only with explicit flag, cannot influence Planner EV without human review

**Memory poisoning detection.** Malicious target could inject lessons by behaving in patterns designed to teach Vanguard wrong things ("always skip /admin"). **Defenses:**
- Critic anomaly detection: contradicts strong existing prior with low evidence → quarantine
- Single-engagement lessons cannot promote without k-anonymity; one poisoned engagement cannot poison shared memory
- "Suspiciously convenient" lessons (those causing Vanguard to NOT test things) flagged for review
- Periodic adversarial replay: take quarantined lessons, simulate effect on Planner

### 8. Storage backend recommendation

**v1: pgvector on Postgres + Mem0 abstraction layer**

Reasoning:
- Self-hostable, single-Postgres deployment dramatically simpler for OSS-core
- pgvector 0.7+ supports HNSW with quantization, sub-10ms p50 retrieval at 1M vectors, scales to 10M+ on single node
- Postgres gives transactional consistency between lessons table, audit log, RLS — needed anyway for compliance
- **Mem0 abstraction**: vendor-agnostic API, automatic consolidation logic, swap-out path to Qdrant/Pinecone if scale demands. Mem0 is Apache 2.0; safe for OSS core

**v2 (paid tier scale):** Qdrant Cloud or self-hosted Qdrant cluster — better hybrid retrieval, better multi-tenant isolation, better filtering at scale. Migrate via Mem0 abstraction with no app changes.

**Skip:** Pinecone (cost), Weaviate (operationally heavier), Letta Cloud (locks to MemGPT), Chroma (lacks production multi-tenancy).

**Add later (v2):** lightweight knowledge graph (Kùzu — embedded, ~SQLite for graphs) for chain pattern relationships.

### 9. Lesson schema (refined)

```yaml
lesson_id: L_<sha256_12>            # deterministic from content
schema_version: 1
kind: chain_pattern | tool_effectiveness | methodology
      | target_prior | adversarial_pattern | false_positive_pattern
      | bounty_calibration | customer_fact
text: "Concise lesson, 1-3 sentences, anonymized if scope=cross_tenant"
text_embedding: [float; 1024]       # bge-large or text-embedding-3-large
tags: [auth, jwt, clerk, alg_confusion]

scope: tenant_isolated | cross_tenant | public
tenant_id: T_<uuid> | null          # null iff scope != tenant_isolated
source_engagements: [ENG-2026-014, ENG-2026-022, ENG-2026-031]
k_anonymity_satisfied: true         # cross_tenant requires k>=3

trust_tier: trusted | derived | untrusted
confidence: 0.0-1.0
reinforcement_count: int
contradiction_count: int
contradicts: [L_other_id, ...]      # explicit conflict links

target_class:
  framework: nextjs | django | rails | flask | spring | ... | any
  auth_provider: clerk | auth0 | nextauth | cognito | custom | any
  hosting: vercel | aws | gcp | azure | self_hosted | any
  language: ts | py | go | rust | java | any
  bounty_tier: low | mid | high | crit | any

actionable:
  should_change_planner_behavior: "Bias EV +20% on alg-confusion chains"
  should_change_critic_behavior: "Require explicit FP check for X"
  should_change_chain_hunter_seed: "Seed with chain template T_clerk_jwt_001"

evidence:
  sample_size: int
  success_rate: 0.0-1.0 | null
  ci_95: [low, high] | null

created_at: timestamp
created_engagement: ENG-2026-014
last_reinforced_at: timestamp
ttl_expires_at: timestamp

provenance:
  emitted_by: critic | reflexion | manual | extractor
  validation: critic_approved | unvalidated | human_reviewed
  anonymizer_version: "v1.2"
```

**Key fields:** explicit `scope` (privacy bit), `kind` enum (drives per-component retrieval), `actionable` block (forces specifying *what to do differently* — vague lessons don't ship), `evidence` block (proper Bayesian weighting), `provenance` (audit + poisoning detection), `contradicts` for conflict tracking.

### 10. Lesson lifecycle

```
1. EMIT (during engagement)
   Wave runs → Critic observes outcome →
   Critic emits draft lesson with scope=tenant_isolated, trust_tier=derived

2. VALIDATE
   Schema check → Critic self-review (LLM-as-judge: actionable? specific? not duplicating?)
   → Embed → store in tenant-isolated namespace

3. REINFORCE / CONTRADICT (this and future engagements)
   Future wave matches preconditions → outcome compared:
   - matches → reinforcement_count++, last_reinforced_at=now, confidence += δ, ttl extended
   - diverges → contradiction_count++, confidence -= δ, log to contradiction queue

4. PROMOTE (anonymize → cross_tenant)
   Trigger: reinforcement_count ≥ 3 across ≥3 distinct engagements (k-anonymity)
            AND lesson is generalizable
            AND Critic anonymization pass succeeds
            AND human review (v1: every promotion; v2: sample 10%)

5. RETRIEVE (every Planner/Critic/Chain Hunter call)
   query → hybrid search → time-decay + confidence scoring →
   target-class filter → tenant filter → rerank → top-5 to LLM

6. DECAY
   Daily job: confidence *= decay_factor for unreinforced
   Weekly job: lessons past ttl_expires_at without reinforcement → archived

7. DELETE (customer request OR contradiction OR poisoning)
   Customer deletion: drop tenant-isolated; recompute cross_tenant aggregates
   Contradiction-driven: contradiction_count > 2*reinforcement_count → quarantine
   Poisoning suspect: Critic flag → quarantine
```

### 11. v1 vs deferred (opinionated)

**Ship in v1:**
- pgvector + Mem0 abstraction
- Hybrid retrieval (dense + BM25 via `tsvector`), no reranker yet
- Per-component retrieval
- Lesson schema as above
- Three-tier scope with k-anonymity floor of 3
- Critic-driven anonymization with regex+NER post-pass
- Time decay + confidence weighting
- Reinforcement / contradiction tracking
- **Manual human review on every cross-tenant promotion** (slow but safe)
- Customer deletion pipeline + audit log
- Encryption at rest + in flight
- Trust tiers including untrusted-quarantine

**Defer to v2:**
- Cohere/BGE reranker on top of hybrid
- Differential privacy on aggregate stats
- Knowledge graph layer (Kùzu) for chain-pattern relationships
- Sample-based human review (10%) instead of every-promotion
- Migration to Qdrant if pgvector hits scale ceiling
- A-MEM-style dynamic linking
- MemGPT-style explicit paging

**Defer to v3+:**
- Federated learning across customer deployments
- Cross-tenant fine-tuning
- Auto-promotion without human review

**v1 path: ~6-8 engineering weeks for real cross-engagement learning while keeping privacy story defensible enough for SOC2 control narrative.**

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| **pgvector + Mem0 abstraction** | Self-hostable, single-Postgres for OSS-core | Replace `lessons.jsonl` |
| **Three-tier scope (tenant_isolated / cross_tenant / public)** | Privacy load-bearing | Schema requirement |
| **k-anonymity floor of 3** before promotion | "Could only come from one customer" never promotes | Critic enforcement |
| **Critic-driven anonymization** + regex+NER post-pass | Defense in depth | New anonymizer pipeline |
| **Per-component retrieval** (Planner/Critic/Chain Hunter different queries) | Wrong lessons waste context, bias incorrectly | Each role retrieves separately |
| **Hybrid retrieval (BM25 + dense)** | Pure semantic misses exact-match | tsvector + pgvector |
| **Target-class filter** | Don't retrieve Clerk lessons for Auth0 target | Schema field |
| **Manual human review** every cross-tenant promotion (v1) | Safe; defer auto-promotion to v3 | Workflow |
| **Customer deletion pipeline** with audit | GDPR Art. 17, CCPA | Required from day one |
| **Encryption at rest** (AES-256, KMS-managed DEKs per tenant) | Embeddings = sensitive (Morris 2023) | TDE or app-layer envelope |

---

## Open questions

1. **Embedding model choice** — bge-large vs text-embedding-3-large? Cost vs quality
2. **Reranker latency** — does Cohere Rerank 3 add too much latency for in-loop retrieval?
3. **Anonymization model** — same Claude that emits lesson, or separate cheap model?
4. **Human review volume** — at 100 engagements/month, how many lessons need review per week?
5. **Mem0 lock-in** — if Mem0 changes API, migration cost?
6. **Tenant database isolation** — separate schemas vs RLS on shared schema?

---

## Sources

### Foundational
- [Park et al. 2023, Generative Agents](https://arxiv.org/abs/2304.03442) — importance/recency/relevance retrieval
- [Packer et al. 2023, MemGPT](https://arxiv.org/abs/2310.08560) — hierarchical memory paging
- [Wang et al. 2023, Voyager](https://arxiv.org/abs/2305.16291) — skill library pattern
- [Shinn et al. 2023, Reflexion](https://arxiv.org/abs/2303.11366) — Critic-emits-lessons
- [Xu et al. 2024, A-MEM](https://arxiv.org/abs/2502.12110) — Zettelkasten-style dynamic memory
- [Morris et al. 2023, Text Embeddings Reveal](https://arxiv.org/abs/2310.06816) — embedding inversion
- [Edge et al. 2024 (Microsoft), GraphRAG](https://arxiv.org/abs/2404.16130)

### Tools
- [Mem0 docs](https://mem0.ai/) — open-source memory layer
- [Letta docs](https://www.letta.com/) — productized MemGPT
- [Cognee docs](https://cognee.ai/) — KG + RAG hybrid
- [pgvector 0.7 release notes](https://github.com/pgvector/pgvector/releases) — HNSW + quantization
- [Qdrant hybrid search documentation](https://qdrant.tech/documentation/concepts/hybrid-queries/)

### Compliance
- GDPR Art. 17 (Right to Erasure)
- CCPA §1798.105
- NIST SP 800-188 (de-identification)
- HIPAA Safe Harbor / Expert Determination

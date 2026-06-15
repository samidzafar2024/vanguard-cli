# Research #01 — HPC-AG Brain Architecture

**Date:** 2026-04-25
**Status:** Complete · Implemented
**Implementation:** `apps/worker/prompts/brain/`, `apps/worker/dist/scripts/brain-graph.cjs`

---

## Executive summary

Vanguard's "hacker brain" is the strategic reasoning layer that sits above the 26 cookbook agents. It reads findings, builds a persistent attack graph, hunts multi-hop exploit chains, and dispatches cookbook agents with priority hints. After researching state-of-the-art LLM agent architectures and academic attack-graph theory, we adopted **HPC-AG (Hierarchical Planner-Critic with Attack Graph memory)** — three specialized brain roles (Planner, Critic, Chain Hunter) sharing one durable graph as long-term memory. This decisively beats single-prompt monolithic brains (PentestGPT failure mode), pure ReAct loops (no global state), and pure RL approaches (can't reason over novel natural-language vulns). Smoke-tested end-to-end on 2026-04-25; all three brain agents produce contract-compliant JSON output.

---

## Research questions

1. How do real senior offensive researchers think? (mental model)
2. What LLM agent architectures handle long-horizon, multi-hop reasoning best?
3. How should we represent vulnerabilities and exploitation paths in memory?
4. How do we compute "expected value" of an attack to prioritize wisely?
5. How do we prevent context overflow when 26 agents are emitting findings across many waves?
6. How do we prevent the brain from hallucinating chains?
7. What does the existing literature on autonomous pentest agents tell us about failure modes?

---

## Key findings

### 1. The four pillars of senior hacker reasoning

From distilling [Bug Hunter's Methodology v4 (Haddix)](https://www.youtube.com/watch?v=p4JgIu1mceI), [nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters](https://github.com/nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters), Frans Rosén's Detectify writeups, and HackerOne Hacktivity disclosed reports:

1. **Authentication boundaries are gold** — every endpoint has one of three states (pre-auth, authenticated, admin); the most valuable bugs straddle boundaries
2. **IDs are intent** — every `?id=`, `/users/123/`, JWT subject, tenant header is a server-side trust assumption to test
3. **Chain > single bug** — a low-severity info leak + a low-severity CSRF can compose to critical account takeover; never dismiss low-severity until graph is built
4. **Recon never ends** — every successful exploit reveals new attack surface; loop back to discovery after every win

These four principles are encoded into `prompts/brain/_methodology-canon.txt` (the "Real Hacker Mindset" section, 13 distilled rules) and inform the Critic's methodology-error checklist.

### 2. LLM reasoning architectures — the hierarchical decision

Three competing approaches were evaluated:

| Approach | Strength | Weakness | Verdict |
|---|---|---|---|
| **Single monolithic prompt** | Simple | Context bloat, "lost in the middle", no self-correction | ❌ Reject |
| **Pure ReAct** ([Yao et al. 2023](https://arxiv.org/abs/2210.03629)) | Strong local reasoning | No global state, forgets earlier findings | ❌ Reject as global controller |
| **Pure RL** (e.g. [AutoPentest-DRL, Schwartz & Kurniawati 2019](https://arxiv.org/abs/1905.05965)) | Provable chaining in known envs | Cannot reason over novel natural-language vulns | ❌ Reject |
| **Hierarchical Planner+Critic+Hunter** | Compartmentalized roles, durable memory | More complex orchestration | ✅ **Adopted** |

The chosen architecture composes:

- **Plan-and-Solve prompting** ([Wang et al. ACL 2023](https://arxiv.org/abs/2305.04091)) — for the Planner role
- **Reflexion** ([Shinn et al. NeurIPS 2023](https://arxiv.org/abs/2303.11366)) — for the Critic role
- **Tree of Thoughts** ([Yao et al. NeurIPS 2023](https://arxiv.org/abs/2305.10601)) — for the Chain Hunter role
- **Multi-agent debate insight** ([Du et al. 2023](https://arxiv.org/abs/2305.14325)) — Critic uses different prompt/temperature than Planner to prevent reward hacking
- **ReAct** is used at the cookbook-agent level (local Thought-Action-Observation), but never as the global controller

### 3. PentestGPT's documented failure modes — what to avoid

[Deng et al. 2023, USENIX Security 2024 (arXiv:2308.06782)](https://arxiv.org/abs/2308.06782) identified two dominant failure classes in their PentestGPT system:

1. **Context loss** — LLM forgets earlier findings as engagement progresses
2. **Lost in the middle** — long context degrades attention to important information

**Our mitigation:** persistent attack graph + k-hop subgraph retrieval. Brain agents never see the full graph; they see only a 2-hop or 3-hop neighborhood around the current frontier plus top-N findings. This is the single most important engineering decision in HPC-AG — without it, we replicate PentestGPT's failure mode.

### 4. Attack graph representation — MulVAL + Bayesian extensions

[MulVAL (Ou, Govindavajhala, Appel, USENIX Sec 2005)](https://www.usenix.org/legacy/event/sec05/tech/full_papers/ou/ou.pdf) introduced the canonical formalism: nodes are states (assets, capabilities, accesses), edges are exploitation transitions. Each finding declares its `prerequisites` and `grants` as capability strings — these become the load-bearing fields that let the graph builder draw chain edges automatically.

**Example mapping:**

```
SQLi finding:        prerequisites = []                  grants = ["sql_injection_confirmed", "db_read"]
Leaked AWS key:      prerequisites = []                  grants = ["aws_iam_credential"]
Cloud exploit:       prerequisites = ["aws_iam_credential"] grants = ["s3_bucket_access:..."]
```

When the third finding's prerequisites match the second's grants, the graph builder auto-draws an edge. **This is what enables chain reasoning without LLM hallucination** — the graph structure derives from typed declarations, not free-form prose.

[Bayesian attack graphs (Poolsappasit, Dewri, Ray, IEEE TDSC 2012)](https://ieeexplore.ieee.org/document/6175929) extended this with edge likelihoods for prioritization. We adopted the likelihood field but currently use heuristic priors (manual calibration in chain-patterns.yaml) rather than full Bayesian inference, which is overkill at our scale.

### 5. Expected Value scoring rubric

For every directive the Planner emits, EV is computed as:

```
EV = (likelihood × impact × novelty) / cost

likelihood ∈ [0.0, 1.0]   # P(this attack succeeds given current evidence)
impact     ∈ [1, 10]      # severity if it lands
novelty    ∈ [0.5, 1.5]   # 1.0 default; >1 if surfaces unexplored attack class
cost       ∈ [1, 10]      # estimated wave-time + token cost
```

Reject directives where likelihood < 0.15, prerequisites unmet, or duplicate of completed directive. Cap parallel directives at 7 per wave.

### 6. Failure modes and mitigations

| Risk | Mitigation |
|---|---|
| **Context overflow at wave 5+** | Subgraph retriever — never feed full graph; k-hop neighborhood + top-N findings only |
| **Hallucinated chains** | Every `add_edge` mutation must cite `evidence_findings` IDs; orchestrator rejects unprovenanced edges |
| **Goal drift / shiny-object chasing** | Open objectives carry forward with stickiness penalty; abandonment requires explicit reason + evidence |
| **Reward hacking** | Critic uses different prompt + temperature than Planner ([Du et al. 2023 multi-agent debate](https://arxiv.org/abs/2305.14325)) |
| **Schema drift** | Strict JSON output contracts; orchestrator validates before commit |

### 7. What the commercial state-of-the-art does

Public materials on **XBOW**, **Project Naptime / Big Sleep**, **Horizon3 NodeZero**, and **Synack Sara** were investigated. Most relevant patterns:

- XBOW: multi-agent with model-alloy strategy; agents retired after mission to prevent bias accumulation. [XBOW platform](https://xbow.com/platform), [Uproot Security analysis](https://www.uprootsecurity.com/blog/xbow-hackerone-ai-penetration-testing).
- Big Sleep: separate Sampler/Researcher roles — mirrors our Planner/Chain-Hunter split. [Project Zero blog](https://projectzero.google/2024/10/from-naptime-to-big-sleep.html).
- Synack Sara: hundreds of specialized agents pairing with humans. [Synack Agentic AI](https://www.synack.com/platform/agentic-ai-for-pentesting/).
- NodeZero: "blast radius" guardrails. [NodeZero](https://horizon3.ai/nodezero/).

**Conclusion:** none publish detailed reasoning architectures. The HPC-AG approach is competitive with anything documented and arguably more interpretable thanks to the typed attack graph.

### 8. Empirical priors from CTF benchmarks

[Cybench (Zhang et al., ICLR 2025)](https://arxiv.org/abs/2408.08926), [NYU CTF Bench (Shao et al., NeurIPS 2024)](https://arxiv.org/abs/2406.05590), and [HackingBuddyGPT (Happe & Cito 2023)](https://arxiv.org/abs/2310.11409) provide priors on what LLM agents currently can/can't do. We use these to calibrate the brain's confidence — e.g. JWT secret cracking is well-handled (high confidence), novel race condition discovery is harder (lower confidence prior).

---

## Implementation decisions

| Decision | Driven by | Implemented in |
|---|---|---|
| Three brain roles (Planner / Critic / Chain Hunter) | Hierarchical reasoning + Reflexion + ToT | `prompts/brain/{planner,critic,chain-hunter}.txt` |
| Persistent attack graph as JSON file | MulVAL formalism, simplicity over Neo4j | `dist/scripts/brain-graph.cjs` |
| `prerequisites` + `grants` capability vocabulary | MulVAL `Finding`-as-typed-declaration | `prompts/brain/_finding-schema.txt` |
| k-hop subgraph retrieval (not full graph) | PentestGPT context-loss mitigation | `brain-graph.cjs get-subgraph --k=2` |
| Strict JSON output contracts for all brain agents | Schema drift prevention | All three brain prompts |
| Provenance check on graph mutations | Hallucination mitigation | `brain-graph.cjs apply-mutations` rejects unprovenanced |
| 20 distilled chain patterns from real bug bounty literature | Chain Hunter pattern matching | `prompts/brain/chain-patterns.yaml` |
| Methodology canon as shared partial | Consistency across brain roles | `prompts/brain/_methodology-canon.txt` |
| EV-based prioritization with novelty boost | Plan-and-Solve + manual calibration | Encoded in Planner prompt |
| Critic uses different prompt than Planner | Multi-agent debate insight | Separate prompt files |

---

## Open questions

1. **Bayesian inference for likelihoods** — currently heuristic priors; would full Bayesian update on observed evidence improve calibration? Probably yes; medium effort.
2. **Chain pattern coverage** — we have 20 patterns; HackerOne disclosed reports could yield 50+ more. See [Research #06 planned](./README.md).
3. **OPSEC awareness** — brain currently scores success probability only; should also score detection probability. See [Research #02](./02-opsec-industry-standards.md) Tier 3.
4. **Cross-engagement learning** — `lessons.jsonl` is per-engagement; could we share lessons across engagements (anonymized)? Privacy implications.
5. **Adversarial prompt injection** — what if a target's deliberate output tries to manipulate the brain? Currently undefended.

---

## Sources

### Academic — reasoning architectures
- [PentestGPT (Deng et al., USENIX Security 2024, arXiv:2308.06782)](https://arxiv.org/abs/2308.06782)
- [Reflexion (Shinn et al., NeurIPS 2023, arXiv:2303.11366)](https://arxiv.org/abs/2303.11366)
- [Tree of Thoughts (Yao et al., NeurIPS 2023, arXiv:2305.10601)](https://arxiv.org/abs/2305.10601)
- [ReAct (Yao et al., ICLR 2023, arXiv:2210.03629)](https://arxiv.org/abs/2210.03629)
- [Plan-and-Solve (Wang et al., ACL 2023, arXiv:2305.04091)](https://arxiv.org/abs/2305.04091)
- [Multi-agent debate (Du et al. 2023, arXiv:2305.14325)](https://arxiv.org/abs/2305.14325)

### Academic — attack graphs
- [MulVAL (Ou, Govindavajhala, Appel, USENIX Sec 2005)](https://www.usenix.org/legacy/event/sec05/tech/full_papers/ou/ou.pdf)
- [Bayesian Attack Graphs (Poolsappasit, Dewri, Ray, IEEE TDSC 2012)](https://ieeexplore.ieee.org/document/6175929)

### Empirical — benchmarks
- [Cybench (Zhang et al., ICLR 2025, arXiv:2408.08926)](https://arxiv.org/abs/2408.08926)
- [NYU CTF Bench (Shao et al., NeurIPS 2024, arXiv:2406.05590)](https://arxiv.org/abs/2406.05590)
- [HackingBuddyGPT (Happe & Cito 2023, arXiv:2310.11409)](https://arxiv.org/abs/2310.11409)

### Industry methodology
- [Penetration Testing Execution Standard (PTES)](http://www.pentest-standard.org/)
- [MITRE ATT&CK Framework](https://attack.mitre.org/)
- [Cyber Kill Chain (Hutchins, Cloppert, Amin, Lockheed Martin 2011)](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/cyber/LM-White-Paper-Intel-Driven-Defense.pdf)
- [OWASP Testing Guide v4.2](https://owasp.org/www-project-web-security-testing-guide/v42/)
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)

### Bug bounty methodology
- [nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters](https://github.com/nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters)
- [Bug Hunter's Methodology v4 (Jason Haddix, NahamCon 2020)](https://www.youtube.com/watch?v=p4JgIu1mceI)
- [Detectify Labs writeups (Frans Rosén)](https://labs.detectify.com/)
- [LiveOverflow YouTube methodology series](https://www.youtube.com/c/LiveOverflow)

### Commercial autonomous pentest products
- [XBOW platform](https://xbow.com/platform), [Uproot Security XBOW analysis](https://www.uprootsecurity.com/blog/xbow-hackerone-ai-penetration-testing)
- [Horizon3 NodeZero](https://horizon3.ai/nodezero/)
- [Synack Sara](https://www.synack.com/platform/agentic-ai-for-pentesting/)
- [Project Zero — From Naptime to Big Sleep](https://projectzero.google/2024/10/from-naptime-to-big-sleep.html)
- [Pentera](https://pentera.io/)
- [Picus Security](https://www.picussecurity.com/)
- [Cymulate](https://cymulate.com/)

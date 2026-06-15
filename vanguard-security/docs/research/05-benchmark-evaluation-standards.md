# Research #05 — Benchmark + Evaluation Standards

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** New `vanguard-eval/` infrastructure; 12-metric dashboard on every engagement; **publish LLMAppPwn benchmark as Vanguard's moat**

---

## Executive summary

Without measurable benchmarks Vanguard can't prove "best in industry" claims. **Cybench (40 CTF tasks, ICLR 2025) is the single benchmark Vanguard must outperform publicly** — it's small, reproducible, peer-reviewed, and cited by every commercial vendor. None of XBOW, Synack Sara, or NodeZero publish scientifically comparable metrics — **the vendor that publishes a Cybench/CSE3 number with full methodology will dominate the credibility narrative.**

**Vanguard's published benchmark moat: LLMAppPwn** — 50 containerized LLM-powered apps with 200+ planted vulns. No good benchmark exists for prompt-injection, tool-abuse, agentic-app exploitation. First-mover advantage; cited by both security and ML-safety communities (double academic audience). Aligns with Research #07's positioning thesis.

**12-metric dashboard** on every engagement: capability (chains_discovered/proven), quality (false_edge_rate, brier_score), efficiency (cost_per_critical_usd), operational (stealth_ratio, detection_events), process (reproducibility_jaccard).

---

## Research questions

1. What benchmarks exist for autonomous pentest tools?
2. What metrics actually measure quality vs marketing?
3. How do XBOW / Sara / NodeZero claim performance? How comparable?
4. What CTF targets should Vanguard's regression suite use?
5. What evaluation infrastructure is needed for reproducibility?
6. What benchmark should Vanguard publish as a moat?
7. What 12 metrics should Vanguard track per engagement?

---

## Key findings

### 1. Benchmark landscape

#### Cybench (Zhang et al., ICLR 2025) — the must-beat

**40 professional CTF tasks** from HackTheBox/Sekai/Glacier/HKCert. Each task ships:
- Docker-composed reproducible target
- Hidden flag as ground truth
- Subtask decomposition (4-12 ordered checkpoints)
- First-solve-time bins (1-min easy → 24-hour pro)

Scoring: binary final-flag + subtask completion rate. Frontier models evaluated under unified ReAct harness.

Headline numbers:
- **Claude 3.5 Sonnet**: 17.5% unguided, ~40% with subtask hints
- **GPT-4o**: ~12.5% unguided
- Below-1-hour tasks: ~50% best models. 4-hour+ tasks: <5%

**This is the single benchmark Vanguard must outperform publicly.** Small (40 tasks), reproducible, peer-reviewed, widely cited.

#### NYU CTF Bench (Shao et al., NeurIPS 2024)
**200 challenges** from CSAW CTF 2011-2023. Larger and more variable than Cybench but lower-quality on hard end. GPT-4 Turbo ~25% with tool-using harness. Use for breadth (regression at scale), not headline claims.

#### Project Naptime / Big Sleep (Google DeepMind, 2024-2025)
Not public benchmark — internal evaluation harness. Public: **CYBRBN** internally, **Naptime framework** (Code Browser + Python + Debugger + Reporter tools). 2024 blog: Naptime improved over baseline **20x on Meta CyberSecEval2** memory-safety category.

**Architectural lesson**: tool decomposition (browser/debugger/reporter) is the right pattern.

#### CyberSecEval 2 & 3 (Meta, 2024)
**Strongest public benchmark Vanguard should run alongside Cybench.** CSE3 covers:
- Prompt injection robustness (the agent IS the target)
- Spear phishing capability
- Autonomous offensive cyber operations (12 simulated network ranges)
- Vuln-exploitation in compiled binaries

Reproducible, well-scoped, Meta-maintained. Adopt as CI gate.

#### SWE-bench (Princeton, 2023)
Not security per se, but **gold standard for agent evaluation methodology**. SWE-bench Verified (500 human-validated issues) is the right model. A security analog would be 500 disclosed-then-fixed CVEs with "patch produces correct exploit POC" oracle. **Vanguard should clone the methodology, not the content.**

#### InjecAgent (arXiv:2403.02691)
**1,054 adversarial prompts** testing whether tool-using agents follow injected instructions from observation/tool output. GPT-4 attack-success-rate ~17%; smaller models 30%+. **Use to measure Vanguard's adversarial robustness** — autonomous pentest tools are themselves prompt-injection targets.

#### CVE-Bench (arXiv:2503.17332, 2025)
**40 real CVEs with executable PoC oracle**, open exploit-replay environment. Strong choice for vendor demo.

#### Skip these
- HackTheBox writeups → contamination
- Pwnable.kr → too narrow (binary exploitation only)
- AutoPentester paper → small N, methodology thin
- PentestGPT eval suite → dated baseline only
- Defcon CTF → too pwn-heavy + contaminated

### 2. Metrics that matter (categorized)

**Capability** (what can it find?)
- Final-objective success rate (binary)
- Subtask/checkpoint completion rate (Cybench-style partial credit)
- Chain-discovery rate (% of pre-known multi-hop chains found)
- Coverage: OWASP Top 10, API Top 10, CIS cloud, MITRE ATT&CK

**Quality** (is the output trustworthy?)
- False-positive rate on findings (validated by replay oracle)
- False-edge rate on chains (% of proposed edges that don't validate when re-executed)
- **Calibration: Brier score and ECE on confidence scores**
- Self-consistency: N=3 sampling agreement (Jaccard on findings sets)

**Efficiency** (what does it cost?)
- Token cost USD/engagement
- Wall-clock time to first critical
- Mean waves to first critical
- Sample efficiency: success vs token budget curve (AUC)

**Operational** (how does it behave in the wild?)
- Detection rate by target SOC (alert count)
- **Stealth ratio: findings discovered ÷ alerts triggered**
- Reproducibility: identical-seed run agreement (Jaccard)
- Adversarial robustness: ASR under InjecAgent-style payloads

**Process** (does it learn?)
- N-back improvement: success on attempt N vs attempt 1
- Cross-engagement transfer: lift on engagement B given lessons from A
- Directive payoff %: % of self-issued sub-objectives that produced a finding

The non-obvious ones — **false-edge rate, calibration, stealth ratio** — are where Vanguard differentiates. **No public competitor reports them.**

### 3. Competitive performance claims (none scientifically comparable)

#### XBOW
"Top of HackerOne US leaderboard" (June 2025). What this means: across a defined window, XBOW's bot submitted more **valid** bugs than any human researcher on H1 platform.

Methodological gaps:
- Sample biased to programs XBOW chose
- "Valid" = triaged, not necessarily critical
- No denominator (false-positive submissions rejected?)
- Not reproducible by third parties

Useful as marketing, weak as science.

#### Synack Sara
Claims "X% of findings AI-assisted." Co-pilot framing, not autonomy. No public benchmark; gated behind NDAs.

#### NodeZero
Annual report with aggregate stats — engagements run, weaknesses found, % with domain-admin path. Their own tool measuring its own work. Useful directional signal, **not a benchmark**.

**Verdict: none scientifically comparable. The vendor publishing Cybench/CSE3 with full methodology dominates the credibility narrative.**

### 4. Vanguard's regression test suite (tiered)

**Tier 0 — Smoke (every PR, ~5 min)**
- DVWA (3 modules)
- OWASP Juice Shop (5 challenges)
- A picoCTF web challenge
- Catches breakage, not capability

**Tier 1 — Capability (nightly, ~2 hours)**
- **PortSwigger Web Security Academy** — pick 30 labs spanning SQLi, XSS, SSRF, IDOR, auth, deserialization. Best-curated by vuln class anywhere. Free, scriptable, headless-friendly.
- WebGoat full
- 5 retired HTB easy/medium boxes (pinned, post-cutoff)

**Tier 2 — Public benchmarks (weekly, ~12 hours)**
- Cybench full 40
- CyberSecEval 3 autonomous-cyber subset
- NYU CTF Bench (rotating 50-task sample)
- CVE-Bench (rotating 20-task sample)

**Tier 3 — Frontier (monthly or pre-release)**
- HTB Pro Labs (Dante, Offshore)
- Vanguard's own LLMAppPwn
- Internal red-team scenarios with Splunk in the loop (for stealth metrics)

Regression suite **must** use pinned, hash-verified Docker images. PortSwigger labs are highest signal-to-noise per dollar.

### 5. Evaluation infrastructure

```
vanguard-eval/
├── targets/                  # one dir per target, all containerized
│   └── <target_id>/
│       ├── docker-compose.yml
│       ├── snapshot.tar.zst  # filesystem snapshot for reset
│       ├── ground_truth.json # flags, expected findings, chain edges
│       └── metadata.yml      # difficulty, category, source
├── harness/
│   ├── runner.py             # snapshot → run → score → teardown
│   ├── seed_manager.py       # forces temp=0, fixed seed, locked tool versions
│   ├── cost_tracker.py       # tokens × pricing → USD per run
│   └── oracle/               # per-target validators (replay PoC)
├── results/
│   ├── runs/<run_id>.json    # raw transcript + metrics
│   └── baselines/            # frozen historical results
└── ci/
    └── gates.yml             # PR fails if any Tier-1 metric regresses >5%
```

**Key choices:**
- **Snapshot/restore via OverlayFS or btrfs subvolumes** — not container restart (pwned containers may have persisted artifacts)
- **Determinism**: `temperature=0`, fixed seed (Anthropic supports `seed` in Beta), pinned model version (`claude-opus-4-7-20260415` not aliases), pinned tool binary hashes
- **Cost tracking** at API call level, not run level. Tag every call with `(run_id, wave, agent, purpose)`
- **Result diffing**: every run produces canonical JSON; CI computes `jaccard(run.findings, baseline.findings)`
- **Three replicate runs per target** for any benchmark headline; report median + IQR
- **Isolation**: each run in fresh network namespace

Best-in-class reference: **METR's eval harness** (model evaluation for risk) and **Anthropic's evals infrastructure** (public via `anthropic-evals`).

### 6. Vanguard's published benchmark — **LLMAppPwn**

The four candidates evaluated:

- **VanguardChain** (multi-hop chain discovery from H1 reports) — ground truth fuzzy, hard to score
- **OPSECBench** (detection vs success) — high friction, low adoption (build internal, don't publish first)
- **🏆 LLMAppPwn** (50 deployed LLM apps with planted vulns) — **THE MOAT**
- **CloudPivotBench** — too crowded (Wiz/Orca/Prisma all publish)

#### Why LLMAppPwn wins

- No good benchmark exists for prompt-injection, tool-abuse, agentic-app exploitation
- Every Fortune 500 ships LLM apps with no idea how to test them
- First-mover advantage
- Ground truth clean (planted vulns = oracle)
- Reproducible (containers)
- Hard to game (Vanguard controls hidden vuln set; rotates quarterly)
- Aligned with Vanguard positioning per Research #07
- Citations from BOTH security and ML-safety communities (double academic audience)

#### LLMAppPwn v0 spec sketch

- **50 containerized LLM-powered apps** (chatbots, RAG over docs, function-calling agents, multi-agent systems, code assistants)
- Each has 1-5 planted vulns from taxonomy: prompt injection, tool abuse, RAG poisoning, system-prompt leak, sandbox escape, PII exfil, supply-chain
- **200+ planted vulns total**, hash-committed, gradually disclosed
- Scoring: vuln-found rate, exploit-validation rate (PoC must trigger oracle), false-positive rate, cost per vuln
- Released under Apache-2.0, leaderboard at vanguard.sh/llmapppwn
- Quarterly refresh: 10 new apps, 40 new vulns, public changelog

### 7. The 12-metric engagement dashboard

```
1.  chains_discovered: int
2.  chains_proven: int                       # subset confirmed by replay oracle
3.  false_edge_rate: float                   # 1 - (chains_proven / chains_discovered)
4.  false_positive_rate: float               # findings rejected by oracle / findings reported
5.  mean_waves_to_first_critical: float
6.  total_token_cost_usd: float
7.  cost_per_critical_usd: float             # token_cost / criticals_proven  -- THE economic KPI
8.  coverage_score: float                    # weighted composite of OWASP + API + cloud + MITRE
9.  detection_events: int                    # SOC alerts triggered
10. stealth_ratio: float                     # criticals_proven / detection_events
11. brier_score: float                       # calibration of confidence on findings
12. reproducibility_jaccard: float           # 3-run finding-set agreement
```

**Why these 12** — every metric maps to a buyer concern:
- CISO: "will I find the bug?" → 1, 2, 8
- CFO: "what does it cost?" → 6, 7
- Blue team: "will it nuke my SIEM?" → 9, 10
- CTO: "can I trust the report?" → 3, 4, 11, 12

Track all 12 on every engagement. Display median + p90 over rolling 30-day window. **Regressions on 7 (cost_per_critical), 10 (stealth_ratio), or 11 (calibration) should block release.**

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| Run Cybench + CSE3 + CVE-Bench publicly | Establish credibility on existing benchmarks | New `vanguard-eval/` infrastructure |
| **Publish LLMAppPwn as Vanguard's moat** | First-mover in fastest-growing attack class | Spec + 50 apps + leaderboard |
| Tiered regression suite (T0 PR → T1 nightly → T2 weekly → T3 monthly) | Balance fast feedback vs comprehensive coverage | CI integration |
| 30 PortSwigger labs as primary T1 | Best-curated by vuln class, free, scriptable | Pinned subset selection |
| Snapshot/restore via OverlayFS or btrfs | Pwned containers persist artifacts | Infra requirement |
| Pinned model version + temp=0 + seed | Determinism for reproducibility | Eval harness |
| 3 replicate runs per benchmark headline | Single-run claims are noise | Reporting standard |
| 12-metric dashboard per engagement | Maps to all buyer concerns | New metrics tracker |
| Block release on regression in cost_per_critical / stealth_ratio / brier_score | Quality gates | CI gate |

**The bet:** Run Cybench + CSE3 + CVE-Bench publicly with full methodology to establish credibility. Then **publish LLMAppPwn as moat** — the vuln class nobody else benchmarks, where Vanguard's LLM-app-testing thesis matches market urgency. Track the 12-metric dashboard internally on every engagement; expose median/p90 to customers as the trust artifact no competitor offers.

---

## Open questions

1. **Anthropic seed support** — currently in beta; production stability?
2. **Replay oracle complexity** — for cloud chains, "replay PoC" means re-running cloud API calls. State management hard.
3. **LLMAppPwn legal status** — planted vulns in published apps may be flagged as malicious by registry scanners. License + signed releases?
4. **Cybench result publication timing** — when do we have a strong enough number to publish? Don't publish below GPT-4o baseline.
5. **HackTheBox Pro Lab licensing** — usable for benchmarking commercially?

---

## Sources

### Benchmarks
- [Cybench (Zhang et al., ICLR 2025, arXiv:2408.08926)](https://arxiv.org/abs/2408.08926)
- [NYU CTF Bench (Shao et al., NeurIPS 2024, arXiv:2406.05590)](https://arxiv.org/abs/2406.05590)
- [Project Naptime (Project Zero, 2024)](https://googleprojectzero.blogspot.com/2024/06/project-naptime.html)
- [Big Sleep SQLite finding](https://googleprojectzero.blogspot.com/2024/10/from-naptime-to-big-sleep.html)
- [CyberSecEval 3 (Meta, 2024, arXiv:2408.01605)](https://arxiv.org/abs/2408.01605)
- [SWE-bench (Princeton, ICLR 2024, arXiv:2310.06770)](https://arxiv.org/abs/2310.06770)
- [SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)
- [InjecAgent (arXiv:2403.02691)](https://arxiv.org/abs/2403.02691)
- [AutoPentester (arXiv:2510.05605, 2025)](https://arxiv.org/abs/2510.05605)
- [PentestGPT (Deng et al., USENIX 2024, arXiv:2308.06782)](https://arxiv.org/abs/2308.06782)
- [CVE-Bench (arXiv:2503.17332, 2025)](https://arxiv.org/abs/2503.17332)

### Competitor claims
- [XBOW H1 leaderboard blog](https://xbow.com/blog/top-1-how-xbow-did-it)
- [Horizon3.ai NodeZero report](https://horizon3.ai/resources/)
- [HackerOne AI-assisted reports](https://www.hackerone.com/ai-safety)

### Targets / training infrastructure
- [HackTheBox Pro Labs](https://www.hackthebox.com/business/pro-labs)
- [PortSwigger Web Security Academy](https://portswigger.net/web-security)
- [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/)
- [DVWA](https://github.com/digininja/DVWA)
- [WebGoat](https://owasp.org/www-project-webgoat/)
- [picoCTF](https://picoctf.org/)
- [awesome-vulnerable-applications](https://github.com/vavkamil/awesome-vulnerable-apps)

### Methodology
- [METR evaluation methodology](https://metr.org/blog)
- [Anthropic evaluations infrastructure (anthropic-evals)](https://github.com/anthropics/evals)

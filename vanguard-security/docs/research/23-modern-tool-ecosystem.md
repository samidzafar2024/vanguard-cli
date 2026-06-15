# Research #23 — Modern Tool Ecosystem 2025

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** **7 highest-priority additions**: katana, httpx v2, schemathesis, garak, promptfoo, CloudFox, curl_cffi. Phase out: nikto, ffuf-for-SPA, theHarvester-for-subdomains, amass

---

## Executive summary

The pentest tooling ecosystem went through a generational reshuffling in 2024-2025. **Three macro shifts:**

1. **ProjectDiscovery's Go-native suite became the default offensive stack** — `subfinder | dnsx | httpx | katana | nuclei | notify` is now the standard pipeline
2. **Burp Suite's monopoly cracked** — Caido shipped 1.0 (Rust, scriptable, headless mode), Burp responded with Burp AI (Pro-locked)
3. **AI red-teaming consolidated around three tools** — garak (NVIDIA) for static probe coverage, PyRIT (Microsoft) for orchestrated multi-turn, promptfoo for eval-style regression
4. **Cloud pentest stopped being "run ScoutSuite"** — CloudFox, Stratus Red Team, gato-x/zizmor/octoscan trio replaced audit-focused tools with attack-graph-oriented workflows

**The 7 highest-priority additions** close the four biggest 2025 gaps: SPA crawling (katana), HTTP probing (httpx), API fuzzing (schemathesis), LLM red-team (garak + promptfoo), AWS post-exploit (CloudFox), stealth (curl_cffi).

---

## Research questions

1. What new tools shipped in 2024-2025?
2. What should Vanguard add per category?
3. What should Vanguard deprecate?
4. Native vs Docker vs binary vs API integration strategy?
5. License compatibility for OSS-core?
6. What's the maintenance burden per tool?

---

## Key findings

### 1. The 2025 macro shifts

**Shift 1: ProjectDiscovery's Go-native suite = default offensive stack.** Tightly-integrated pipeline with consistent JSON output, shared config, stdin/stdout composability. **This is the Unix-pipe philosophy Vanguard already follows — these tools should be the spine.**

**Shift 2: Burp's monopoly cracked.** Caido shipped 1.0 mid-2024 (Rust, scriptable via JS plugins, far better performance on large engagements). Burp responded with Burp AI (Pro-locked). For autonomous AI tool: **Caido's headless mode + plugin API make it the right integration target** — Burp's Java-only extension model is hostile to AI orchestration.

**Shift 3: AI red-teaming consolidated.** garak + PyRIT + promptfoo emerged as de-facto trio. HarmBench is benchmark, Llama Guard 3 / Prompt Guard 2 are defense classifiers everyone tests against. Lakera Gandalf is CTF, not tool.

**Shift 4: Cloud pentest evolved.** CloudFox (Bishop Fox), Stratus Red Team (Datadog), GitHub Actions trio (gato-x, zizmor, octoscan) replaced older audit tools with attack-graph workflows. BloodHound CE shipped 2023, now stable; RustHound replaces SharpHound for cross-platform.

### 2. Tool-by-category recommendations

#### 2.1 Web Recon and Crawling — REPLACE, don't extend

Current `subfinder + ffuf` incomplete for modern SPAs. **Add full ProjectDiscovery pipeline:**

- **katana** — replaces ffuf for SPA content discovery. Headless Chrome catches XHR endpoints, GraphQL ops, DOM-rendered routes
- **httpx v2** — replaces ad-hoc curl. TLS, status, tech-stack, CDN, favicon-hash in one pass with JSONL
- **dnsx** — replaces `dig`/`host` shell-outs. Wildcard detection
- **naabu v2** — keep nmap for service-version, use naabu for initial sweep on >1000 hosts (10x faster)
- **alterx** — subdomain permutation. `subfinder | alterx | dnsx` for 3-5x more findings
- **chaos** — PD's public subdomain dataset, free API
- **mapcidr** — CIDR utility
- **shuffledns** — high-throughput DNS bruteforce
- **notify** — pipeline notification (Slack, Discord, Teams)

**Verdict: Adopt all eight.** `brew install projectdiscovery/tap/<tool>`.

#### 2.2 Web Pentest UI — ADOPT Caido headlessly

Caido has CLI mode (`caido-cli`) and Rust SDK. **Add as optional integration** — not core. Burp Suite Pro is hard-no for OSS-core (license, JVM, hostile to automation).

#### 2.3 API & Schema Fuzzing — CRITICAL GAP, add now

Vanguard has **zero coverage** here today. Biggest missing capability.

- **schemathesis** — property-based OpenAPI 3.x and GraphQL fuzzer. Hypothesis-based shrinker. Apache 2.0
- **kiterunner** — API path bruteforce using Swagger/Postman wordlists
- **arjun** — HTTP parameter discovery (GET/POST/JSON). Beats Burp's param miner

**Verdict: Add schemathesis + kiterunner + arjun.** Skip paramspider (overlaps arjun, less maintained).

#### 2.4 Offensive AI / LLM — ADOPT garak + promptfoo, defer PyRIT

This is where Vanguard differentiates per Research #07 + #16.

- **garak (NVIDIA)** — the nmap of LLM testing. ~80 probes covering prompt injection, jailbreak, data leakage. **Adopt as core**
- **promptfoo** — eval framework with red-team plugins (50+). Better for CI integration. **Adopt as core**
- **PyRIT (Microsoft)** — multi-turn orchestrated. **Defer** until Vanguard has multi-turn attack patterns mature
- **HarmBench** — benchmark dataset, not tool. Use as ground-truth for evals
- **Llama Guard 3 / Prompt Guard 2** — defense classifiers; run as target to verify bypass rates
- **Vec2Text** — embedding inversion. Niche
- **Invariant Labs MCP attack tools** — 2025 MCP fast-moving. Track but don't depend

**Verdict: garak + promptfoo non-negotiable. PyRIT next.**

#### 2.5 Cloud Security — ADOPT CloudFox + Stratus + BloodHound CE

- **CloudFox (Bishop Fox)** — AWS post-exploitation reconnaissance. Single Go binary, Apache 2.0. **Adopt as core for AWS**
- **Stratus Red Team (Datadog)** — generates real cloud TTPs. Useful as target generator for defense-evaluation mode
- **Pacu (Rhino)** — heavy Python deps, mutable state. **Docker-only integration**. Don't make default
- **K8s offensive: kdigger + peirates** — adopt both. Skip kube-hunter (Aqua deprioritized). botb niche
- **gato-x** — replaces gato. Apache 2.0. **Adopt**
- **zizmor** — GHA static analyzer (Rust, single binary). MIT. **Adopt** (complements gato-x)
- **octoscan** — older, less active. Skip
- **Entra/Azure AD: ROADrecon + GraphRunner** — adopt. AADInternals is PowerShell-only. TokenSmith bleeding-edge, defer
- **Trivy** — best-in-class container/IaC scanner. Apache 2.0. **Adopt** (replaces nikto for containers)
- **Grype** — overlaps Trivy. Skip
- **OSV-Scanner (Google)** — best for SCA against OSV database. **Adopt** alongside pip-audit
- **Socket-CLI** — supply-chain malicious-package detection, free tier. **Adopt**
- **Cartography (Lyft)** — Neo4j-based. **Defer** unless Vanguard adopts graph backend (graphify suggests it might)
- **PMapper** — IAM principal mapper. Lightweight Python. **Adopt**
- **steampipe** — query cloud as SQL. **Optional**

#### 2.6 Recon / OSINT — TRIM AND FOCUS

- **amass** — slow, heavy. subfinder + alterx + chaos covers 90% at 10x speed. **Skip**
- **gitrob** — unmaintained. Use trufflehog + gato-x
- **Maigret** — modern fork of Sherlock. **Adopt** if Vanguard does username/persona enum
- **Photon** — abandoned 2022. Skip
- **theHarvester** — superseded for subdomains; useful only for email harvesting
- **Shodan + Censys** — sufficient. Skip Fofa/Quake/ZoomEye unless scope demands

#### 2.7 Stealth / Evasion — ADOPT curl-impersonate + playwright-stealth

Critical: Vanguard's current Playwright detectable by any modern WAF.

- **curl-impersonate** / **curl_cffi** (Python binding) — matches Chrome/Firefox TLS+HTTP2 fingerprints. **Adopt curl_cffi** as drop-in for `requests`
- **playwright-stealth** — patches obvious Playwright giveaways. **Adopt** as default for all browser sessions
- **tls-client (Go)** — overlaps curl-impersonate. Pick one. curl_cffi wins on Python ergonomics
- **FireProx / requests-ip-rotator** — AWS IP rotation. **Optional**, opt-in only (cleanup burden)
- **proxychains-ng / Tor** — Tor stream isolation = cheap rotation. **Adopt** as config-flag backend
- **httpcloak** — niche, very new. Track

#### 2.8 Auth Tooling — KEEP jwt_tool + ADD scim-attacker

- **jwt_tool** — still standard. Keep
- **hashcat -m 16500** — JWT HS256 cracking. Document workflow
- **SAMLRaider** — Burp-only, GUI-bound. Skip; replicate as Vanguard agent logic
- **Burp Autorize / Authmatrix** — Burp-bound. Replicate authz-matrix natively
- **scim-attacker** — niche but increasingly relevant. **Adopt** as optional

#### 2.9 AI-Augmented Pentest — TRACK, DON'T DEPEND

- **Burp AI** — Pro-locked. Skip
- **Caido AI plugins** — promising, watch
- **CodeRabbit / Greptile / Snyk DeepCode** — code-review side, out of scope

#### 2.10 C2 and Adversary Emulation — DEFER

Sliver, Mythic, Havoc, Brute Ratel, Caldera, Atomic Red Team are post-exploitation / detection-engineering. Vanguard is *pentest*, not red-team ops. **Skip C2 entirely.** Adopt Atomic Red Team test definitions as reference corpus only (MITRE-mapped TTP YAML).

#### 2.11 Reporting / Graph — ADOPT BloodHound CE + leverage graphify

- **BloodHound CE** — AD/Entra attack-path graphing. **Adopt** for any AD-in-scope engagement
- **AzureHound / RustHound** — collectors. **RustHound-CE** is modern cross-platform choice. **Adopt**
- **graphify** — user's own tool. **Vanguard should emit findings in graphify-compatible JSON** so existing `/graphify` workflow visualizes pentest results natively. **Unique leverage.**

### 3. Tool deprecations

| Tool | Reason | Replacement |
|---|---|---|
| **nikto** | Last meaningful release 2022, signature DB stale | nuclei + Trivy |
| **wscat** | Manual WS testing only, not automatable | Custom Vanguard WS agent using `websockets` (Python) |
| **theHarvester** (subdomains) | subfinder+chaos+alterx outperforms | Keep only for email mode |
| **ffuf** (SPA crawl) | Doesn't execute JS | katana (keep ffuf for pure dir-brute) |
| **amass** | Heavy, slow, redundant | subfinder+chaos+alterx pipeline |
| **gitrob** | Unmaintained | trufflehog + gato-x |
| **Photon** | Abandoned 2022 | katana |
| **Sherlock** | Maigret is active fork | Maigret |
| **kube-hunter** | Aqua deprioritized | kdigger + peirates |

### 4. The 7 most important additions (opinionated)

If Vanguard can only add seven tools this quarter:

1. **katana** — closes SPA crawling gap. Single biggest coverage improvement
2. **httpx v2** — replaces ad-hoc HTTP probing with structured pipeline primitive
3. **schemathesis** — closes API fuzzing gap. **Vanguard has zero coverage here today**
4. **garak** — closes LLM red-team gap. Differentiator for AI-pentest positioning
5. **promptfoo** — eval/regression layer for AI testing. Pairs with garak
6. **CloudFox** — closes AWS post-exploitation gap. Single binary, low burden
7. **curl_cffi** — single-line stealth upgrade. Stops Vanguard's Python `requests` from being trivially fingerprinted

**Honorable mentions**: gato-x (CI/CD attack surface exploding), BloodHound CE + RustHound (AD-in-scope), Trivy (containers).

### 5. Integration strategy

| Strategy | Use For | Examples |
|---|---|---|
| **brew/go install** (single binary) | Go-based PD tools, CloudFox, gato-x, zizmor, RustHound | katana, httpx, naabu, dnsx, mapcidr, shuffledns, alterx, chaos, notify, cloudfox, gato-x, zizmor, kdigger |
| **pip install** (Python) | Clean-deps Python tools | schemathesis, garak, arjun, jwt_tool, scim-attacker, ROADrecon, PMapper, curl_cffi, Maigret |
| **npm install** (Node) | promptfoo, Caido CLI plugins | promptfoo |
| **Docker** | Messy deps or untrusted code | Pacu, Stratus Red Team (state-mutating), GraphRunner |
| **Shipped binary** (vendored release) | Frequently-updated, version-pinned | nuclei (templates change weekly — pin via `nuclei -update-templates`) |
| **Web API** | Subscription data sources | Shodan, Censys, chaos (PD API), Socket |
| **Skip / wrap natively** | GUI-only or Burp-locked | SAMLRaider, Authmatrix, Autorize |

**Heuristics:**
- Single Go binary, no state → `brew` it
- Mutates cloud state (Pacu, Stratus) → Docker. Containment matters
- Python tool with conflicting native deps → Docker
- Templates/signatures change >1x/week → auto-update on first run

### 6. License compatibility (for OSS-core Vanguard)

| Tool | License | OSS-core safe? |
|---|---|---|
| ProjectDiscovery suite | MIT | Yes |
| Caido | Free tier + paid Pro; CLI/SDK permissive | Yes (free tier) |
| schemathesis | MIT | Yes |
| garak | Apache 2.0 | Yes |
| promptfoo | MIT | Yes |
| PyRIT | MIT | Yes |
| CloudFox | Apache 2.0 | Yes |
| Stratus Red Team | Apache 2.0 | Yes |
| BloodHound CE | Apache 2.0 | Yes |
| **RustHound-CE** | **GPL-3.0** | ⚠️ **Shell-out only**, no linking/bundling |
| Pacu | BSD-3 | Yes |
| Trivy | Apache 2.0 | Yes |
| OSV-Scanner | Apache 2.0 | Yes |
| Socket-CLI | MIT | Yes |
| curl-impersonate | MIT (mostly), some GPL deps | ⚠️ Verify build chain |
| curl_cffi | MIT | Yes |
| **jwt_tool** | **GPL-3.0** | ⚠️ **Shell-out only**, no linking |
| Burp Suite | Proprietary | ❌ No |

**Action**: GPL tools (RustHound-CE, jwt_tool) must be shell-outs only — no linking, no embedding. Document the boundary.

### 7. Installation playbook

```bash
# ProjectDiscovery (one-shot)
brew install projectdiscovery/tap/{subfinder,httpx,naabu,katana,dnsx,nuclei,notify,mapcidr,shuffledns,alterx,chaos}

# Cloud
brew install bishopfox/cloudfox/cloudfox
brew install aquasecurity/trivy/trivy
go install github.com/google/osv-scanner/cmd/osv-scanner@latest
go install github.com/AdnaneKhan/Gato-X@latest
brew install zizmor

# Python (one venv)
pip install schemathesis garak arjun jwt-tool curl-cffi maigret roadrecon pmapper scim-attacker

# AI red-team
pip install garak
npm install -g promptfoo

# Stealth
pip install curl-cffi playwright-stealth

# Docker (state-mutating only)
docker pull rhinosecuritylabs/pacu
docker pull datadog/stratus-red-team
```

### 8. Tool wrapper design

Vanguard's Unix-pipe philosophy is correct. Codify:

```
agents/<category>/<tool>.py
  - class ToolWrapper(BaseTool):
    - binary: str
    - install_check(): which/version probe
    - run(target, **opts) -> ToolResult
    - parse(stdout) -> list[Finding]
    - to_graphify() -> GraphifyNodes
```

**Conventions:**
- Every wrapper emits normalized `Finding` schema (id, severity, asset, evidence, references, raw)
- JSON-out by default; tools without JSON parsed once at wrapper boundary
- `subprocess.run` with timeouts, never embedded
- Every wrapper has `install_check()` for self-diagnosis
- `--dry-run` mode prints command without executing (audit/safety)
- Tools hitting live targets respect global `--rate-limit` and `--scope` allowlist

### 9. Maintenance burden

| Update Frequency | Tools | Vanguard Action |
|---|---|---|
| **Weekly** (signatures/templates) | nuclei templates, garak probes, Trivy DB, OSV DB, gato-x patterns | Auto-update on run; cache 24h |
| **Monthly** (binary releases) | ProjectDiscovery suite, CloudFox, schemathesis | Pin minor, bump in CI monthly |
| **Quarterly** | promptfoo, jwt_tool, BloodHound CE | Manual bump |
| **Slow** | Pacu, RustHound | Pin and forget |

**Highest burden**: garak (probes evolving fast), gato-x (CI/CD attack research is hot), nuclei templates (~100 PRs/week). Allocate weekly maintenance time for these three.

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| **7 priority additions** (katana, httpx, schemathesis, garak, promptfoo, CloudFox, curl_cffi) | Closes 4 biggest 2025 gaps | Phase 1 install |
| **Phase out** nikto, ffuf-for-SPA, theHarvester-subdomains, amass, gitrob, Photon, Sherlock, kube-hunter | Superseded by better tools | Removal in deprecation cycle |
| **Caido (not Burp)** for runtime instrumentation | Headless mode, plugin API, OSS-friendly | Replace Burp dependency |
| **graphify-compatible output** for findings | Unique leverage with user's existing tool | Output transformer |
| **GPL tools shell-out only** (RustHound-CE, jwt_tool) | License boundary | Documented in code |
| **Tool wrapper convention** (BaseTool class) | Consistency across 30+ tools | Standardized in `agents/` dir |
| **Auto-update for signature-driven tools** (nuclei, garak, Trivy) | Probes evolve weekly | Cache 24h |
| **Skip C2 frameworks entirely** | Vanguard is pentest not red-team ops | Defer Sliver/Mythic/etc |

---

## Open questions

1. **Caido CLI maturity** — fast-moving project; lock to specific version?
2. **garak probe maintenance burden** — probes evolve weekly. Acceptable cost?
3. **MCP attack tooling** — Invariant Labs is fast-moving. When stable enough to depend on?
4. **Llama Guard 3 / Prompt Guard 2** as test target — how to integrate with promptfoo?
5. **Tool selection decision tree** — should each cookbook agent declare required tools at top of prompt for install validation?

---

## Sources

### Tools
- [ProjectDiscovery suite](https://github.com/projectdiscovery)
- [Katana](https://github.com/projectdiscovery/katana)
- [httpx](https://github.com/projectdiscovery/httpx)
- [naabu](https://github.com/projectdiscovery/naabu)
- [Caido](https://caido.io)
- [schemathesis](https://github.com/schemathesis/schemathesis)
- [garak](https://github.com/NVIDIA/garak)
- [promptfoo](https://www.promptfoo.dev)
- [PyRIT](https://github.com/Azure/PyRIT)
- [HarmBench](https://www.harmbench.org)
- [Llama Guard 3](https://llama.meta.com/trust-and-safety/)
- [CloudFox](https://github.com/BishopFox/cloudfox)
- [Stratus Red Team](https://github.com/DataDog/stratus-red-team)
- [Pacu](https://github.com/RhinoSecurityLabs/pacu)
- [gato-x](https://github.com/AdnaneKhan/Gato-X)
- [zizmor](https://github.com/woodruffw/zizmor)
- [BloodHound CE](https://github.com/SpecterOps/BloodHound)
- [RustHound-CE](https://github.com/g0h4n/RustHound-CE)
- [ROADtools](https://github.com/dirkjanm/ROADtools)
- [GraphRunner](https://github.com/dafthack/GraphRunner)
- [Trivy](https://github.com/aquasecurity/trivy)
- [OSV-Scanner](https://github.com/google/osv-scanner)
- [Socket](https://socket.dev)
- [curl-impersonate](https://github.com/lwthiker/curl-impersonate)
- [curl_cffi](https://github.com/lexiforest/curl_cffi)
- [playwright-stealth](https://github.com/AtuboDad/playwright_stealth)
- [jwt_tool](https://github.com/ticarpi/jwt_tool)
- [arjun](https://github.com/s0md3v/Arjun)
- [kiterunner](https://github.com/assetnote/kiterunner)
- [Maigret](https://github.com/soxoj/maigret)
- [kdigger](https://github.com/quarkslab/kdigger)
- [peirates](https://github.com/inguardians/peirates)
- [Atomic Red Team](https://github.com/redcanaryco/atomic-red-team)

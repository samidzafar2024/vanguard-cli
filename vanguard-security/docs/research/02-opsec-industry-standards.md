# Research #02 — OPSEC Industry Standards for Autonomous Pentest Tools

**Date:** 2026-04-25
**Status:** Complete · Implementation pending
**Implementation:** Pending — see "Implementation roadmap" section.

---

## Executive summary

Vanguard today runs every tool with shipped defaults: `User-Agent: sqlmap/1.7.x`, no rate limiting, no proxy, no TLS profiling, single-IP origin, no jitter. Against any modern target (Cloudflare, AWS WAF, Akamai, Imperva, custom rate limiters, Datadog/Sentry alerting) this gets blocked, banned, or — worse for an autonomous agent — silently fed false negatives. After researching what professionals actually do in 2025-2026, **Vanguard is roughly two months of focused work away from being competitive with bug-bounty-hunter-grade tooling, and a quarter away from rivaling commercial autonomous platforms**. The single biggest lever is centralizing every outbound request through one OPSEC-aware HTTP/proxy layer — once you have that chokepoint, every other improvement plugs into it. The killer differentiator (Tier 3) is an **OPSEC-aware Critic** in the HPC-AG brain that scores actions by detection probability — something no published autonomous pentest agent does today.

---

## Research questions

1. What do professional red teams actually do for OPSEC? (Cobalt Strike-grade tradecraft)
2. What do top bug bounty hunters do day-to-day to avoid getting banned?
3. What are competing autonomous pentest products (XBOW, NodeZero, Synack Sara, Pentera) doing for stealth?
4. Tool by tool — what are the standard OPSEC flags for sqlmap, nuclei, ffuf, nmap, nikto, Playwright?
5. What does network-layer evasion look like in 2025? (proxies, residential, FireProx, Tor)
6. What does application-layer mimicry require? (JA3/JA4, HTTP/2 fingerprints, behavioral)
7. What do modern detection systems (Cloudflare, AWS WAF, Akamai, Imperva) actually look for?
8. How can Vanguard become best-in-class given all of this?

---

## Key findings

### 1. The three-layer fingerprinting reality

Modern bot/scanner detection operates at **three concurrent layers**. All three must tell the same story or you're flagged.

| Layer | What is fingerprinted | Tool/library to spoof |
|---|---|---|
| **TLS (JA3/JA4)** | Cipher suite list, extension list, ALPN values | `curl_cffi` (Python), `curl-impersonate`, uTLS (Go) |
| **HTTP/2 (Akamai-H2)** | SETTINGS frame values, WINDOW_UPDATE, pseudo-header order | `httpcloak` (Go), `curl_cffi` |
| **Header (JA4H)** | Order, casing, Sec-CH-UA-* consistency with UA | Manual matched bundles |

**Critical insight:** UA spoofing alone is meaningless. If you send `Chrome 141 macOS` UA but your TLS fingerprint is Python `requests`, Cloudflare flags you in 2 seconds. **All layers must match.**

JA4 (FoxIO 2023) sorts cipher suites and extensions canonically, defeating naive randomization that worked against older JA3. Sources: [scrapehero TLS bypass 2026](https://www.scrapehero.com/tls-fingerprint-bypass-techniques/), [JA4 in the wild (Devesh Shetty)](https://deveshshetty.com/blog/ja4-client-fingerprinting/), [curl_cffi customization docs](https://curl-cffi.readthedocs.io/en/latest/impersonate/customize.html).

The HTTP/2 layer is **protocol-level** and cannot be bluffed by header spoofing — it's the SETTINGS frame and pseudo-header order that gets fingerprinted. Sources: [Akamai HTTP/2 Passive Fingerprinting Whitepaper, Black Hat EU 2017](https://blackhat.com/docs/eu-17/materials/eu-17-Shuster-Passive-Fingerprinting-Of-HTTP2-Clients-wp.pdf), [scrapfly HTTP/2 fingerprint guide](https://scrapfly.io/blog/posts/http2-http3-fingerprinting-guide), [Trickster Dev — Understanding HTTP/2 fingerprinting](https://www.trickster.dev/post/understanding-http2-fingerprinting/).

### 2. Behavioral-layer detection

Cloudflare Bot Management scores **session-wide signals**: request timing variance, mouse movement, scroll, time-on-page. Pure HTTP clients have no behavior to score, *which is itself the signal*. Sources: [scrapeup CF bypass 2026](https://blog.scrapeup.com/cf-bypass-minimal-meta/), [Cloudflare per-customer bot defenses](https://blog.cloudflare.com/per-customer-bot-defenses/), [Cloudflare Detection IDs](https://developers.cloudflare.com/bots/additional-configurations/detection-ids/).

Mitigation requires browser automation (Playwright) with stealth plugins + injected behavior (mouse jitter, scroll, dwell). Pure HTTP request stacks cannot pass Cloudflare's behavioral layer regardless of fingerprint quality.

### 3. Professional red team OPSEC (C2 baseline)

[Cobalt Strike Malleable C2 profiles](https://github.com/threatexpress/malleable-c2/blob/master/MalleableExplained.md) are the canonical reference. Every byte on the wire is configurable. The 2025 OPSEC-safe profile checklist mandates:

- `stage.beacon_gate` proxying all 23 functions
- `sleep_mask "true"`
- `syscall_method "indirect"`
- Redirector layer in front of teamserver

Sources: [White Knight Labs Cobalt Strike EDR Evasion Part 2 (2025)](https://whiteknightlabs.com/2025/05/19/harnessing-the-power-of-cobalt-strike-profiles-for-edr-evasion-part-2/), [WKL-Sec/Malleable-CS-Profiles](https://github.com/WKL-Sec/Malleable-CS-Profiles), [Unit42 — Detecting Cobalt Strike Malleable C2](https://unit42.paloaltonetworks.com/cobalt-strike-malleable-c2/).

Open-source successors (Sliver, Mythic, Havoc, Brute Ratel) converge on the same pillars: protocol blending (DNS/HTTPS/mTLS/WireGuard mix), polymorphic stagers, in-memory operations, modular comms channels. Sources: [alphahunt 2025-2026 C2 review](https://blog.alphahunt.io/modular-c2-frameworks-quietly-redefine-threat-operations-for-2025-2026/), [Sliver C2 Deep Dive](https://infosecwriteups.com/sliver-c2-deep-dive-a-comprehensive-command-control-framework-series-4f8ba55f7a45), [Red Canary — C2 Frameworks Threat Detection Report](https://redcanary.com/threat-detection-report/trends/c2-frameworks/).

The recurring meta-principle is **compartmentalization**: separate IPs/domains per phase, ephemeral infrastructure, redirectors hiding the real source, never re-using infra across engagements. Sources: [PenTesting.org OPSEC](https://www.pentesting.org/opsec-best-practices/), [Awesome RedTeam Cheatsheet OPSEC Guide](https://github.com/RistBS/Awesome-RedTeam-Cheatsheet/blob/master/Miscs/OPSEC%20Guide.md), [Parrot CTFs — Red Team Infrastructure 2025](https://parrot-ctfs.com/blog/red-team-infrastructure-complete-guide-to-setup-and-best-practices-in-2025/).

For Vanguard (web-app pentest, not implants), the relevant translation: **(a) every request looks like a legitimate browser, (b) traffic is shaped to look human, (c) source IP/identity rotates per phase, (d) callback channels (OAST) use disposable infrastructure.**

### 4. Bug bounty hunter ground truth

Two facts dominate practitioner write-ups:

**Fact 1: Programs cap automated testing at 2-10 RPS.** Repeat offenders get warned → reports invalidated → banned. Source: [Intigriti — Aggressive scanning in bug bounty](https://www.intigriti.com/researchers/blog/hacking-tools/aggressive-scanning-in-bug-bounty-and-how-to-avoid-it). Vanguard must default to **2 RPS hard cap** with jitter, configurable up.

**Fact 2: Top hunters are religiously passive-first.** Subdomain enum from cert transparency / passive DNS / OSINT before any active probing. Sources: [nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters](https://github.com/nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters), [Bug Hunter's Methodology v4 — Haddix](https://www.youtube.com/watch?v=p4JgIu1mceI), [Subdomain Enum Guide](https://sidxparab.gitbook.io/subdomain-enumeration-guide/passive-enumeration/passive-sources). Subfinder/Amass passive sources require API key wiring for full coverage: [Subfinder API Key Configuration](https://deepwiki.com/projectdiscovery/subfinder/4-api-key-configuration). Vanguard must default to **passive-only**, require explicit `--active` flag.

Many programs require an **identification header** (`X-Bug-Bounty: <handle>`) so blue teams can distinguish researchers from real attackers. Source: [nuclei docs](https://docs.projectdiscovery.io/tools/nuclei/running). This must be a first-class config knob.

### 5. AI-driven autonomous pentest tools — current state

| Product | What's known | OPSEC story |
|---|---|---|
| **XBOW** | Multi-agent, model-alloy strategy, agents retired after mission | Not publicly documented; multi-agent implies natural identity isolation |
| **Horizon3 NodeZero** | "Blast radius" guardrails, zero-downtime production testing | Framed as safety, not stealth |
| **Pentera / Picus / Cymulate** | BAS tools running against own infra, 100k+ adversary actions library | Not optimized for adversary mimicry |
| **Synack Sara** | Hundreds of specialized agents, paired with human Red Team | Markets "persistent and stealthy tactics" but specifics not public |

The academic frontier (PentestAgent ACM AsiaCCS, RapidPen, CurriculumPT, CheckMate, AutoPentester) **all acknowledge stealthy strategies remain an open research problem**. Sources: [PentestAgent (arXiv:2411.05185)](https://arxiv.org/pdf/2411.05185), [RapidPen (arXiv:2502.16730)](https://arxiv.org/abs/2502.16730), [CurriculumPT (MDPI 2025)](https://www.mdpi.com/2076-3417/15/16/9096), [AutoPentester (arXiv:2510.05605)](https://arxiv.org/html/2510.05605v1), [LLM Pentest Survey (arXiv:2507.00829)](https://arxiv.org/html/2507.00829v1).

**Net result: there is no published autonomous pentest agent today with a strong OPSEC story.** This is open territory for Vanguard to lead.

### 6. Tool-level evasion playbook

| Tool | Defaults are bad because… | Standard 2025 OPSEC flags |
|---|---|---|
| **sqlmap** | `User-Agent: sqlmap/1.x`, payloads hit signatures instantly | `--random-agent --proxy --delay=2 --timeout=30 --threads=1 --retries=2 --tamper=between,randomcase,charencode,space2comment --skip-waf --keep-alive --level=5 --risk=3` |
| **nuclei** | concurrent 25/host, generic UA | `-rl 10 -bs 5 -c 10 -timeout 10 -retries 1 -H "User-Agent: <real Chrome>" -H "X-Bug-Bounty: <handle>" -proxy <proxy> -system-resolvers` |
| **ffuf** | 40 threads, identifiable UA | `-rate 10 -t 10 -p 0.1-2.0 -H "User-Agent: <UA>" -H "Accept-Language: en-US,en;q=0.9" -replay-proxy` |
| **subfinder/amass** | active mode pings target's infra | passive only by default; wire 18+ source API keys via `provider-config.yaml` |
| **nmap** | T3 default, real source IP, no decoys | `-T1 --max-retries 1 --scan-delay 5s --source-port 53 --data-length 25 -D RND:5 -f --randomize-hosts --reason` |
| **trufflehog** | callbacks for verification | `trufflehog filesystem --no-verification --no-update` for full air-gap mode |
| **nikto** | `User-Agent: Nikto/2.x` | `-evasion 1234A -useragent "<real UA>" -Tuning x -Pause 3 -nointeractive -ask no` |
| **Playwright** | `navigator.webdriver=true`, default viewport, fixed locale | `playwright-stealth` (Python v2.0.2) or `puppeteer-extra-plugin-stealth`; randomize viewport + locale + timezone |

Sources: [gasmask WAF bypass 2025](https://medium.com/@gasmask/bypassing-wafs-in-2025-new-techniques-and-evasion-tactics-fdb3508e6b46), [regaan/sqlmap-tamper-collection](https://github.com/regaan/sqlmap-tamper-collection), [ProjectDiscovery Ultimate Nuclei Guide](https://projectdiscovery.io/blog/ultimate-nuclei-guide), [Vespersec ffuf cheat](https://vespersec.net/docs/osint-reconnaissance/subdomain-brute-force-cheat-sheet/), [nukIeer Nmap Stealth Cheatsheet](https://github.com/nukIeer/Nmap-Stealth-Scanning-Cheatsheet), [squidhacker Nikto 2025](https://squidhacker.com/2025/04/master-nikto-in-2025-50-essential-commands-every-hacker-needs-with-bonus-web-security-cheat-sheet/), [Scrapfly Playwright Stealth](https://scrapfly.io/blog/posts/playwright-stealth-bypass-bot-detection).

### 7. Network-layer evasion

Three concentric layers of identity rotation are the 2025 standard:

1. **FireProx / AWS API Gateway** — every request appears from a different AWS IP for ~$3.50/M requests + bandwidth. Open-source via [ustayready/fireprox](https://github.com/ustayready/fireprox) and [Ge0rg3/requests-ip-rotator](https://github.com/Ge0rg3/requests-ip-rotator). **Caveat:** Cloudflare maintains AWS-range blocklists, so this rotates through but doesn't bypass IP-reputation-aware WAFs. Source: [Sprocket Security Gigaproxy](https://www.sprocketsecurity.com/blog/gigaproxy). **Legal note:** AWS AUP requires authorization for the target.
2. **Tor with stream isolation** — `IsolateDestAddr`, `IsolateDestPort`, per-connection SOCKS auth credentials force a new circuit per request. Sources: [Tor stream-isolation spec](https://spec.torproject.org/path-spec/stream-isolation.html), [Whonix Stream Isolation](https://www.whonix.org/wiki/Stream_Isolation). Slow but free; many WAFs don't yet rate-limit individual exit nodes hard.
3. **Residential proxy pools** — Smartproxy/Decodo at $8.5/GB ($75 min, $15 micro plans), Oxylabs at $10/GB ($300 min), BrightData at $10.5/GB. **All three explicitly disallow security-testing use cases for many target categories — read TOS carefully.** Sources: [BrightData best residential proxy providers](https://brightdata.com/blog/proxy-101/best-residential-proxy-providers), [BrightData vs Oxylabs vs Smartproxy 2026](https://dev.to/agenthustler/bright-data-vs-oxylabs-vs-smartproxy-which-proxy-provider-should-you-choose-in-2026-2bk5).

For OAST/blind-vuln callbacks, **interactsh** (ProjectDiscovery's open-source Burp Collaborator alternative) self-hosted is the gold standard — disposable, no leaks to PortSwigger infra. Sources: [projectdiscovery/interactsh](https://github.com/projectdiscovery/interactsh), [TCM Security OOB](https://tcm-sec.com/find-and-exploit-blind-ssrf-with-out-of-band-oob-techniques/), [PortSwigger OAST](https://portswigger.net/burp/application-security-testing/oast).

For DNS, [DNS over HTTPS (DoH)](https://en.wikipedia.org/wiki/DNS_over_HTTPS) (Cloudflare 1.1.1.1, Quad9) prevents ISP-level DNS logging from leaking your target list.

### 8. Honeypot/canary awareness — the missing layer

Most autonomous tools **don't filter honeypots**. Thinkst Canary now ships "honeypot scanner detected" alerts for known fingerprinters. An autonomous agent dumb enough to hit `/admin-test-please-do-not-click` or DNS-resolve `*.canarytokens.com` URIs is broadcasting its presence. Sources: [Thinkst honeypot scanner detection](https://help.canary.tools/hc/en-gb/articles/18387238624157-Detecting-Honeypot-Scanners), [mthcht canary tokens](https://mthcht.medium.com/canary-tokens-and-callback-urls-a-double-edged-sword-303140e0bbb7), [canarytokens.org](https://canarytokens.org/).

Vanguard must filter known canary patterns before any tool dispatches against them.

### 9. WAF bypass — what actually works in 2025

Cloudflare's documented six-layer stack: IP reputation → TLS fingerprint → HTTP/2 fingerprint → header consistency → JS challenge → behavioral scoring. They wrote 50+ heuristics on bot detection between June 2025 and now, much of it post-AI-crawler. Sources: [Cloudflare per-customer bot defenses](https://blog.cloudflare.com/per-customer-bot-defenses/), [Cloudflare detection IDs](https://developers.cloudflare.com/bots/additional-configurations/detection-ids/).

**Known 2025 bypasses that work:**

- **JSON-based SQLi** — most major WAFs don't parse JSON SQL. Source: [Picus JSON SQLi](https://www.picussecurity.com/resource/blog/waf-bypass-using-json-based-sql-injection-attacks).
- **Oversized POST bodies** — size-limit inspection windows.
- **Double-encoding** — `%2527` decodes to `'` after WAF inspection.
- **Custom HTML attributes for XSS** — non-standard event handlers (`onpointerrawupdate`, etc.).
- **Parsing discrepancy attacks** — WAFFLED paper (2025). Source: [WAFFLED arxiv](https://arxiv.org/html/2503.10846v1).
- **Unicode normalization tricks** — homoglyph + normalization differences between WAF and origin.

Sources: [waf-bypass collection (Mar 2025)](https://waf-bypass.com/2025/03/), [Mastering SQLMap+Ghauri WAF Bypass](https://infosecwriteups.com/mastering-sqlmap-and-ghauri-a-practical-guide-to-waf-bypass-techniques-1aaa9eee9d32).

---

## Implementation roadmap — three tiers

### Tier 1 — Table stakes (~2 weeks)

Without these, Vanguard is below bug-bounty-hunter grade.

| # | Feature | Effort | Implementation file/dir |
|---|---|---|---|
| 1 | Centralized HTTP egress layer (`vanguardFetch`) via `curl_cffi` | 3-5 days | `packages/opsec-http/` (new) |
| 2 | Realistic UA + header bundle rotation | 1 day | `data/ua-bundles.json` (new) |
| 3 | Per-target rate limit + jitter at egress | 1-2 days | inside `opsec-http` |
| 4 | Tool flag profiles (stealth/normal/aggressive) | 2 days | `scripts/render-tool-flags.cjs` (new) |
| 5 | Bug-bounty `X-Bug-Bounty` identification header | 1 hour | env var `VANGUARD_BB_HANDLE` |
| 6 | Self-hosted interactsh for OAST | 1 day | `scripts/oast-token.cjs` (new) |
| 7 | Passive-first recon discipline + 18 API keys | 1 day | env vars + `provider-config.yaml` |
| 8 | Honeypot/canary blocklist filter | 0.5 days | `scripts/canary-filter.cjs` (new) |
| 9 | Playwright stealth wired by default | 1 day | `packages/browser-stealth/` (new) |
| 10 | OPSEC-aware logging | 1 day | `~/.vanguard/engagements/<id>/requests.ndjson` |

After Tier 1: Vanguard goes from "obvious scanner" → "passable as a careful human bug bounty hunter at the network layer."

### Tier 2 — Differentiators (~1 month)

Above typical commercial automation toolkits.

| # | Feature | Effort |
|---|---|---|
| 11 | JA3/JA4 + HTTP/2 fingerprint matching via `curl_cffi` | 3-5 days |
| 12 | FireProx-style AWS API Gateway IP rotation | 2-3 days |
| 13 | Tor stream isolation backend | 2 days |
| 14 | WAF detection → tamper-script auto-selection | 3-5 days |
| 15 | Time-of-day distribution (business-hours pacing) | 2 days |
| 16 | Behavioral session emulation in Playwright | 2-3 days |
| 17 | Per-phase identity rotation (recon ≠ exploit ≠ post-exploit) | 2 days |
| 18 | Engagement YAML config + scope/hours enforcement | 3 days |

### Tier 3 — Cutting edge (the killer differentiator)

State-of-the-art — what nobody else has.

| # | Feature | Effort |
|---|---|---|
| 19 | **HPC-AG OPSEC-aware Critic** — scores actions by detection probability, not just success | 1-2 weeks |
| 20 | Adaptive payload mutation per WAF (LLM generates obfuscated payloads when standard tampers fail) | 1-2 weeks |
| 21 | Polymorphic agent identity per mission (XBOW-style fresh UA/proxy/cookies per spawn) | 1 week |
| 22 | Detection telemetry feedback loop (when blocked, classify which layer fired, update graph) | 2 weeks |
| 23 | Live TLS profile harvesting (scrape current Chrome/Firefox/Safari JA4 fingerprints) | 3-5 days |

---

## The single most important thing

**Build the centralized HTTP egress layer (Tier 1 #1) first.** Every other improvement plugs into this one chokepoint. Without it:

- Each cookbook agent re-implements (or forgets) OPSEC ad-hoc
- Global rules cannot be enforced (rate limit, identification header, canary filter)
- Audit trail is fragmented across 26 agents
- Future Tier 2/3 features require touching every agent

Once the chokepoint exists, even shipping with just real UAs + 2 RPS + jitter + identification header transforms Vanguard's detectability profile overnight.

---

## Implementation decisions (pending)

| Decision | Driven by | Will be implemented in |
|---|---|---|
| `curl_cffi` for Python or `undici + httpcloak` for Node | TLS+HTTP/2 fingerprint matching | `packages/opsec-http/` |
| `~/.vanguard/opsec.yaml` config schema | Centralized OPSEC rules | new module |
| `VANGUARD_OPSEC_PROFILE` env var (stealth/normal/aggressive) | Tool flag profile selection | env var + `render-tool-flags.cjs` |
| Pool of 30+ matched browser bundles | UA + Sec-CH-UA + Accept-* + JA3 must match | `data/ua-bundles.json` |
| Self-hosted interactsh on clean domain | OAST without third-party leaks | `~/.vanguard/opsec.yaml::oast` |
| 18 OSINT API keys env-based | Passive recon coverage | env vars |
| `vanguard opsec doctor` and `vanguard opsec test <target>` CLIs | Self-validation before launch | `apps/cli/src/commands/opsec.ts` |
| `engagement.yaml` per project | Scope/hours/RPS enforcement | new config loader |

---

## Open questions

1. **`curl_cffi` vs Go uTLS** — Python vs Node implementation tradeoff. Vanguard is currently Node/TypeScript. May need a Python sidecar service or migrate to Node-native solution.
2. **FireProx legal posture** — AWS AUP authorization for target — how does Vanguard collect engagement-level authorization?
3. **Residential proxies TOS** — most disallow pentest. Self-host? Skip?
4. **Adversarial output handling** — what if a target deliberately serves payloads designed to manipulate Vanguard's brain via prompt injection? See [Research #08 planned].
5. **Cost at scale** — Tier 3 features add LLM token + AWS + interactsh costs. Need cost modeling.

---

## Sources (full citations)

### Industry C2 / red team OPSEC
- [White Knight Labs — Cobalt Strike Profiles for EDR Evasion Part 2 (2025)](https://whiteknightlabs.com/2025/05/19/harnessing-the-power-of-cobalt-strike-profiles-for-edr-evasion-part-2/)
- [WKL-Sec/Malleable-CS-Profiles](https://github.com/WKL-Sec/Malleable-CS-Profiles)
- [threatexpress/malleable-c2 Reference](https://github.com/threatexpress/malleable-c2/blob/master/MalleableExplained.md)
- [Unit42 — Detecting Cobalt Strike Malleable C2](https://unit42.paloaltonetworks.com/cobalt-strike-malleable-c2/)
- [alphahunt — Modular C2 Frameworks 2025-2026](https://blog.alphahunt.io/modular-c2-frameworks-quietly-redefine-threat-operations-for-2025-2026/)
- [Sliver C2 Deep Dive](https://infosecwriteups.com/sliver-c2-deep-dive-a-comprehensive-command-control-framework-series-4f8ba55f7a45)
- [Red Canary — C2 Frameworks Threat Detection Report](https://redcanary.com/threat-detection-report/trends/c2-frameworks/)
- [Pentest-book — Modern C2 Frameworks](https://www.pentest-book.com/exploitation/modern-c2)
- [PenTesting.org — OPSEC for Red Teams](https://www.pentesting.org/opsec-best-practices/)
- [Awesome RedTeam Cheatsheet — OPSEC Guide](https://github.com/RistBS/Awesome-RedTeam-Cheatsheet/blob/master/Miscs/OPSEC%20Guide.md)
- [Parrot CTFs — Red Team Infrastructure 2025](https://parrot-ctfs.com/blog/red-team-infrastructure-complete-guide-to-setup-and-best-practices-in-2025/)
- [TrustedSec — Red Team Engagement Guide](https://trustedsec.com/blog/red-team-engagement-guide-how-an-organization-should)
- [MITRE ATT&CK TA0005 Defense Evasion](https://attack.mitre.org/tactics/TA0005/)

### Commercial autonomous pentest products
- [XBOW Platform](https://xbow.com/platform), [Uproot Security XBOW analysis](https://www.uprootsecurity.com/blog/xbow-hackerone-ai-penetration-testing)
- [Horizon3 NodeZero](https://horizon3.ai/nodezero/)
- [Synack Sara Agentic AI](https://www.synack.com/platform/agentic-ai-for-pentesting/)
- [Picus BAS](https://www.picussecurity.com/breach-and-attack-simulation), [Cymulate vs Picus](https://cymulate.com/cymulate-vs-competitors/picus-security/)
- [Project Zero — From Naptime to Big Sleep](https://projectzero.google/2024/10/from-naptime-to-big-sleep.html)

### Academic — autonomous pentest
- [PentestAgent (arxiv 2411.05185)](https://arxiv.org/pdf/2411.05185)
- [RapidPen (arxiv 2502.16730)](https://arxiv.org/abs/2502.16730)
- [CurriculumPT (MDPI)](https://www.mdpi.com/2076-3417/15/16/9096)
- [AutoPentester (arxiv 2510.05605)](https://arxiv.org/html/2510.05605v1)
- [LLM Pentest survey (arxiv 2507.00829)](https://arxiv.org/html/2507.00829v1)

### WAF bypass
- [gasmask — Bypassing WAFs in 2025](https://medium.com/@gasmask/bypassing-wafs-in-2025-new-techniques-and-evasion-tactics-fdb3508e6b46)
- [regaan/sqlmap-tamper-collection](https://github.com/regaan/sqlmap-tamper-collection)
- [Mastering SQLMap and Ghauri WAF Bypass](https://infosecwriteups.com/mastering-sqlmap-and-ghauri-a-practical-guide-to-waf-bypass-techniques-1aaa9eee9d32)
- [WAFFLED parsing-discrepancy paper (arxiv 2503.10846)](https://arxiv.org/html/2503.10846v1)
- [Picus — JSON-based SQLi WAF Bypass](https://www.picussecurity.com/resource/blog/waf-bypass-using-json-based-sql-injection-attacks)
- [waf-bypass collection (Mar 2025)](https://waf-bypass.com/2025/03/)

### Tool-specific OPSEC
- [ProjectDiscovery — Ultimate Nuclei Guide](https://projectdiscovery.io/blog/ultimate-nuclei-guide), [Nuclei docs running](https://docs.projectdiscovery.io/tools/nuclei/running), [Otterly Nuclei at Mass Scale](https://ott3rly.com/using-nuclei-at-mass-scale/)
- [Subfinder API Key Configuration](https://deepwiki.com/projectdiscovery/subfinder/4-api-key-configuration), [Subdomain Enum Guide](https://sidxparab.gitbook.io/subdomain-enumeration-guide/passive-enumeration/passive-sources)
- [ffuf random user agents PR #837](https://github.com/ffuf/ffuf/pull/837), [Vespersec ffuf cheat sheet](https://vespersec.net/docs/osint-reconnaissance/subdomain-brute-force-cheat-sheet/), [c9lab ffuf complete guide](https://c9lab.com/blog/fuzzing-web-applications-using-ffuf-the-complete-mastery-guide/)
- [nukIeer Nmap Stealth Cheatsheet](https://github.com/nukIeer/Nmap-Stealth-Scanning-Cheatsheet), [Undercode Nmap 2026 playbook](https://undercodetesting.com/nmap-firewall-evasion-the-ultimate-stealth-scanning-playbook-for-2026-video/)
- [highon.coffee Nikto cheat](https://highon.coffee/blog/nikto-cheat-sheet/), [squidhacker Nikto 2025](https://squidhacker.com/2025/04/master-nikto-in-2025-50-essential-commands-every-hacker-needs-with-bonus-web-security-cheat-sheet/)
- [trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog)

### Browser stealth / fingerprint
- [Scrapfly Playwright Stealth](https://scrapfly.io/blog/posts/playwright-stealth-bypass-bot-detection)
- [BrightData Playwright Stealth](https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth)
- [playwright-stealth PyPI](https://pypi.org/project/playwright-stealth/)
- [puppeteer-extra-plugin-stealth](https://www.npmjs.com/package/puppeteer-extra-plugin-stealth)

### TLS / HTTP/2 fingerprinting
- [scrapehero — TLS Fingerprint Bypass 2026](https://www.scrapehero.com/tls-fingerprint-bypass-techniques/)
- [JA4 in the Wild](https://deveshshetty.com/blog/ja4-client-fingerprinting/)
- [curl_cffi customize fingerprints](https://curl-cffi.readthedocs.io/en/latest/impersonate/customize.html)
- [scrapfly JA3/JA4 tool](https://scrapfly.io/web-scraping-tools/ja3-fingerprint)
- [Akamai HTTP/2 Passive Fingerprinting Whitepaper (Black Hat EU 2017)](https://blackhat.com/docs/eu-17/materials/eu-17-Shuster-Passive-Fingerprinting-Of-HTTP2-Clients-wp.pdf)
- [scrapfly HTTP/2 fingerprint guide](https://scrapfly.io/blog/posts/http2-http3-fingerprinting-guide)
- [httpcloak (Go)](https://github.com/sardanioss/httpcloak)
- [Trickster Dev — HTTP/2 fingerprinting](https://www.trickster.dev/post/understanding-http2-fingerprinting/)

### Cloudflare / detection
- [scrapeup — Cloudflare bypass 2026](https://blog.scrapeup.com/cf-bypass-minimal-meta/)
- [Cloudflare per-customer bot defenses](https://blog.cloudflare.com/per-customer-bot-defenses/)
- [Cloudflare Detection IDs](https://developers.cloudflare.com/bots/additional-configurations/detection-ids/)
- [dreamscrape JA4 CF bypass](https://dreamscrape.app/blog/ja4-bypass-cloudflare-without-browser)
- [rebrowser User-Agent Guide 2025](https://rebrowser.net/blog/python-requests-user-agent-guide-advanced-techniques-for-web-scraping-and-api-access)
- [aceproxies Browser Fingerprinting Playbook 2025](https://www.aceproxies.com/proxy-blog/browser-fingerprinting-for-web-scraping-the-2025-playbook)

### Proxy infrastructure
- [ustayready/fireprox](https://github.com/ustayready/fireprox)
- [Ge0rg3/requests-ip-rotator](https://github.com/Ge0rg3/requests-ip-rotator)
- [Sprocket Security — Gigaproxy](https://www.sprocketsecurity.com/blog/gigaproxy)
- [Tor Stream Isolation spec](https://spec.torproject.org/path-spec/stream-isolation.html)
- [Whonix Stream Isolation](https://www.whonix.org/wiki/Stream_Isolation)
- [BrightData best residential proxy providers](https://brightdata.com/blog/proxy-101/best-residential-proxy-providers)
- [BrightData vs Oxylabs vs Smartproxy 2026](https://dev.to/agenthustler/bright-data-vs-oxylabs-vs-smartproxy-which-proxy-provider-should-you-choose-in-2026-2bk5)

### OAST / DNS
- [projectdiscovery/interactsh](https://github.com/projectdiscovery/interactsh)
- [TCM Security — Blind SSRF OOB](https://tcm-sec.com/find-and-exploit-blind-ssrf-with-out-of-band-oob-techniques/)
- [PortSwigger OAST](https://portswigger.net/burp/application-security-testing/oast)
- [DNS over HTTPS (Wikipedia)](https://en.wikipedia.org/wiki/DNS_over_HTTPS)

### Bug bounty methodology
- [HackerOne — Clear Rules of Engagement](https://www.hackerone.com/policies/clear-rules-of-engagement)
- [Intigriti — Aggressive scanning in bug bounty](https://www.intigriti.com/researchers/blog/hacking-tools/aggressive-scanning-in-bug-bounty-and-how-to-avoid-it)
- [Bugcrowd Engagement Overview](https://docs.bugcrowd.com/customers/engagement-management/engagement-overview-page/)
- [nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters](https://github.com/nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters)
- [NahamSec — Getting Started](https://www.nahamsec.com/getting-started-in-bug-bounty)
- [Bug Hunter's Methodology v4 — Haddix NahamCon2020](https://www.youtube.com/watch?v=p4JgIu1mceI)
- [STÖK — How to get started in bug bounty](https://medium.com/@stokochtrubbel/how-to-get-started-in-bug-bounty-9-pro-tips-69c13f3c74c6)

### Honeypot awareness
- [Thinkst Canary — Honeypot Scanner Detection](https://help.canary.tools/hc/en-gb/articles/18387238624157-Detecting-Honeypot-Scanners)
- [mthcht — Canary Tokens and Callback URLs](https://mthcht.medium.com/canary-tokens-and-callback-urls-a-double-edged-sword-303140e0bbb7)
- [canarytokens.org](https://canarytokens.org/)

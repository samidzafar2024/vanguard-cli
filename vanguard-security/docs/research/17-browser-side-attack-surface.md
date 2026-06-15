# Research #17 — Browser-Side Attack Surface

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** New `vuln-browser.txt` cookbook agent (peer to `vuln-xss.txt`); 10 new chain patterns; JSONP-in-CDN-allowlist corpus + DOMPurify-version-to-mXSS-CVE map (highest ROI quick wins)

---

## Executive summary

The 2025 browser is a hardened-but-leaky environment. **Trusted Types is now a defensive primitive that defenders deploy and attackers bypass** — not a future thing. CSP v3 widely deployed (~40% of Tranco top-1k use `strict-dynamic`) but bypassable via JSONP allowlist abuse, base-uri injection, AngularJS/Vue gadgets in CDN, missing `base-uri`.

**Recommendation: don't split XSS into reflected/stored/DOM** (triples maintenance for ~20% unique content). **Add new `vuln-browser.txt`** for everything not strictly XSS — CSP, DOM clobbering, postMessage, service workers, WASM, cookies, Trusted Types, iframe sandbox, COOP/COEP/CORP, SRI, web cache deception for SPAs.

**Highest ROI quick wins**: ship the JSONP-in-CDN-allowlist corpus + DOMPurify-version-to-mXSS-CVE map. These two reproduce a large fraction of recent six-figure browser bounties.

---

## Research questions

1. What's the modern client-side surface map (2025)?
2. What's the current CSP bypass playbook?
3. What DOM-based attacks dominate?
4. postMessage / service worker / WASM specifics?
5. Cookie ecosystem 2025?
6. What tooling is best?
7. Should `vuln-xss.txt` split or stay?
8. What new chain patterns?

---

## Key findings

### 1. Modern client-side surface map (2025)

| Primitive | 2025 default | What attackers exploit |
|---|---|---|
| **CSP** | v3 widely deployed, ~40% top-1k use `strict-dynamic` | JSONP/Angular gadgets in CDN allowlists; missing `base-uri`; nonce reuse on cached pages |
| **Trusted Types** | Chrome enforces in `require-trusted-types-for 'script'`; Firefox shipped 2024 | DOMPurify `RETURN_TRUSTED_TYPE` quirks, default-policy clobbering |
| **SameSite cookies** | `Lax` by default since Chrome 80 (2020) | GET-based CSRF, top-level POST via form |
| **CHIPS** | Partitioned cookies enforced where 3p blocked (Chrome rolled back full deprecation July 2024) | Cross-context confusion: same cookie name, partitioned vs not |
| **COOP/COEP/CORP** | Required for `SharedArrayBuffer`, high-res `performance.now()` | Missing COOP enables `window.opener` Spectre/XS-leaks |
| **Permissions Policy** | Replaces Feature Policy; iframe-scoped | Attackers bypass parent restrictions via nested iframes |
| **SRI** | <8% adoption on script tags (HTTP Archive 2024) | CDN compromise without SRI = supply chain RCE |
| **Service Workers** | ~25% of top sites | Scope hijacking, persistent cache poisoning |
| **WASM** | 1.7B+ users execute WASM weekly (Cloudflare) | Memory unsafety preserved, JS↔WASM type confusion |
| **Web Push** | Chrome+Firefox+Safari (Safari 16+) | Delayed payload to compromised SW |
| **Storage** | IndexedDB now primary for SPA state | XSS → IndexedDB exfil = persistent token theft |

### 2. CSP bypass playbook (ranked by hit rate)

#### Tier 1 — high frequency (Fortune-500)

1. **JSONP allowlist abuse** — `script-src` allows `*.googleapis.com`, `*.cloudflare.com`. Maintain corpus (Kotowicz "Reining in the Web's Inconsistencies").
2. **AngularJS/Vue gadget** — vulnerable AngularJS 1.x in allowlist + `unsafe-eval`: `<div ng-app ng-csp>{{constructor.constructor('alert(1)')()}}</div>`. AngularJS hit EOL Jan 2022 but everywhere.
3. **Missing `base-uri`** — `<base href="//attacker">` redirects every relative `<script src="/foo.js">`. Wordpress Gutenberg, Trello, Twitter all used this. CSP3 fixes but missing on ~60% of CSPs.
4. **`'unsafe-inline'` masquerading via nonce** — `script-src 'nonce-abc' 'unsafe-inline'` — pre-CSP2 browsers ignore nonce.
5. **`strict-dynamic` with reflected XSS in `<script>`** — strict-dynamic trusts scripts loaded by trusted scripts; injecting into nonced `<script>` inherits trust.

#### Tier 2 — situational

6. **DOM clobbering on Trusted Types default policy** — `<form id=defaultPolicy>` overrides global access. Bentkowski's research at Securitum (2023-2024) is canonical.
7. **SRI bypass via cache** — SW lies in `respondWith()` with forged response matching previous-version hash.
8. **`report-only` confusion** — bug bounty triage frequently dismisses `Content-Security-Policy-Report-Only` violations. Flag as "false confidence" finding.
9. **Bypass via meta tag injection** — HTML injection (not full XSS) before any `<meta http-equiv=Content-Security-Policy>`.
10. **CDN takeover in allowlist** — allowlisted `cdn.acme.com` points at expired S3 → arbitrary script.

#### Tier 3 — esoteric

11. **Service worker scope = CSP bypass for that scope** — once you control SW, you control all responses including CSP header
12. **`form-action` missing** — `<form action="javascript:alert(1)">`
13. **iframe sandbox bypass via `allow-top-navigation`** — sandboxed iframe with that flag can navigate top frame to `javascript:` URL in older browsers

### 3. DOM-based attack catalog (gotchas)

**Sources beyond textbook:**
- `document.referrer` — survives navigation; chained nav-XSS where you control prior page
- `window.name` — persists across navigations AND origins. Attacker sets in their origin, navigates victim to target, target reads as trusted
- `document.cookie` — reads of cookies set by JS-readable subdomains
- `history.state` — JSON-decoded by app, attacker controls via `history.pushState` from any frame they control
- BroadcastChannel — same-origin only, but XSS in one tab pollutes all tabs

**Sinks defenders forget:**
- `iframe.srcdoc`, `iframe.src` with `javascript:`
- `Element.setAttribute('on*', ...)` — bypasses parser-path sanitizers
- `<svg><animate attributeName=href values="javascript:..."`
- `<script type="text/javascript+something">` — exotic types still execute in some runtimes

**Mutation XSS (mXSS) — underrated bug class.** DOMPurify uses HTML parser, output re-serialized then re-parsed by consumer. Differences in serialization vs parsing produce executable HTML from "safe" output. **Masato Kinugawa is the dominant researcher**. Recent CVEs: CVE-2024-45801, CVE-2024-47875. **Vanguard should fingerprint DOMPurify version** and cross-reference known mXSS CVEs.

**Prototype pollution → DOM XSS chain.** Lodash `_.merge`, jQuery `extend(true, ...)`, recursive `Object.assign`. Pollute `Object.prototype.src` then any `$('<img>').attr({})` reads it. Lodash 4.17.21 still ships in millions of bundles.

**Trusted Types bypass surface:**
- `defaultPolicy` clobbering
- `policy.createHTML` calling DOMPurify with `RETURN_TRUSTED_TYPE: true` — bad regex passes user input straight through
- Sink coverage gaps: covers `innerHTML`, `script.src`, but NOT `Element.outerHTML` setter as of Firefox 2024 (Chrome covers it)

### 4. postMessage attacks (still juicy)

1. **No origin validation** — `addEventListener('message', e => eval(e.data))`. Still common in OAuth popups and embedded SDKs
2. **String prefix check instead of `===`** — `e.origin.startsWith('https://example.com')` → `https://example.com.attacker.com` bypasses
3. **`indexOf` check** — `e.origin.indexOf('example.com') > -1`
4. **Reflected postMessage to opener** — victim sends sensitive data to `window.opener.postMessage(token, '*')`. Attacker is opener. The `'*'` target is the bug
5. **Sender confusion** — apps validate `origin` but trust `source` (Window ref) as reply target → attacker forwards via same-origin iframe; reply goes to attacker
6. **OAuth iframe chain** — OAuth provider posts code to embedder; if embedder doesn't validate origin === provider, attacker iframe posts forged code

**Vanguard heuristics:**
- Static: grep for `addEventListener\(['"]message`, check next 20 lines for `e.origin` comparison + comparator
- Dynamic: instrument `window.postMessage` via DevTools protocol, catalog every listener, send from `null` origin (sandboxed iframe with `allow-scripts` and no `allow-same-origin` produces `origin: 'null'`)

### 5. Service worker attacks

**Scope hijack pattern.** Same origin upload + `Content-Type: application/javascript` + `Service-Worker-Allowed` header → registerable as SW. Two things must align: upload endpoint that lets attacker control body+MIME (or auto-detects `.js`), AND a way to call `navigator.serviceWorker.register(...)` (typically requires XSS).

**Cache poisoning by SW.** Malicious SW can `caches.put(request, attackerResponse)` for any same-origin URL. **Persists across reloads, survives original XSS payload.** Convert one-shot reflected XSS into persistent one.

**Push notification → JS execution.** Chrome 2024 required notification display on every push (no silent push), but SW JS still runs before notification displays — including arbitrary fetches and IndexedDB writes. **Delayed exfil fully viable.**

**Background sync abuse.** `registration.sync.register('exfil')` queues work. When victim regains connectivity, sync fires → fetch to attacker exfil. **Briefly available XSS converts to persistent exfil.**

### 6. WebAssembly attack surface

- **Memory safety preserved** — C/C++/Rust unsafe lib compiled to WASM ships UAF/OOB into browser. Heap is linear memory; corruption can't escape sandbox into JS but can corrupt application state, leak secrets WASM holds (private keys, ML weights, license tokens), forge function results
- **JS↔WASM bridge confusion** — typed imports/exports; if JS passes wrong type, behavior implementation-defined. `wasm-bindgen` boundary bugs in Rust→JS produced real CVEs
- **Side-channel leaks** — WASM `i64` arithmetic, SIMD ops have data-dependent timing. Combined with `SharedArrayBuffer` (re-enabled with COOP/COEP) → high-res timers → Spectre v1 PoCs still work
- **Unsigned WASM from CDN** — same SRI gap as JS. CSP `script-src` doesn't cover `wasm-src` — separate `wasm-unsafe-eval` directive. Many CSPs don't restrict WASM source

**Vanguard's WASM playbook:** `wasm-objdump` on every `.wasm`, fingerprint against known-vulnerable libs (older `wasm-pack`, old `emscripten`, vulnerable `libsodium-wasm`), check imports for `env.__wbindgen_*` (rust signatures), check CSP for `wasm-src` / `'wasm-unsafe-eval'`.

### 7. Cookie ecosystem 2025

Quick reference:
- **3p cookie deprecation**: Chrome reversed full removal July 2024. Now opt-in user choice
- **CHIPS partitioned**: `Set-Cookie: ...; Partitioned; Secure; SameSite=None`. Different cookie jar per top-level site. Bug class: same cookie name partitioned vs unpartitioned races
- **`__Host-` prefix**: requires `Secure`, no `Domain`, `Path=/`. Strongest. **`__Secure-`** requires only `Secure`. **Adoption: <5%** per Mozilla telemetry
- **`SameSite=None` without `Secure`**: rejected by Chrome since Feb 2020 — but Vanguard sees on stale Set-Cookie headers
- **`SameSite=Lax` + GET-mutation**: classic. Find any state-changing GET endpoint, build CSRF via top-level navigation
- **Domain scope abuse**: `Domain=.example.com` cookie reachable from `evil.example.com` — combined with subdomain takeover → full session theft
- **Path scope NOT a security boundary** — browser exposes cookies to all paths via JS

### 8. New 2024-2025 client-side research

- **PortSwigger Top 10 2024**: "Listen to the Whispers: Web Timing Attacks That Actually Work" (James Kettle) — single-packet timing attacks for OAuth code/state correlation
- **iframe sandbox interplay refresh**: `allow-scripts allow-same-origin` is the dangerous combo (iframe can `parent.removeAttribute('sandbox')` then reload itself unsandboxed)
- **Browser-Powered Desync (Kettle, refreshed BH USA 2024)**: browser sends desynced request → next-user response leaks
- **Web cache deception for SPA**: SPA routes resolve to `index.html`; appending `/foo.css` makes CDN cache personalized HTML as CSS asset (Omer Gil 2017 → updated for SPAs by Assetnote 2023)
- **GraphQL over GET CSRF**: GraphQL endpoints accepting GET enable CSRF; SameSite=Lax doesn't save you
- **`fetch()` credentials**: `same-origin` default good, but apps explicitly setting `credentials: 'include'` against third-party with `Access-Control-Allow-Origin: *` *still don't send credentials* — apps work around by reflecting origin → CORS bypass

### 9. Tooling matrix

| Tool | Best for | Vanguard integration |
|---|---|---|
| **Burp + DOM Invader** | Source/sink tracing in real apps; postMessage interception | Headless via Burp REST API |
| **Caido** | Modern Burp alternative; Lua scripting; cleaner postMessage | First-class CLI; better for CI |
| **csper.io** | CSP scoring + JSONP detection. **Their JSONP-in-CDN database is unique** | License or replicate |
| **Trusted Types CSP report** | First-party violation telemetry | Vanguard parses CSP reports if exposed |
| **`wasm-decompile` / `wabt`** | WASM module inspection | Bundle into worker |
| **`retire.js`** | JS lib version fingerprinting | Wire into vuln-browser to flag mXSS / proto-poll versions |
| **`XSStrike`, `dalfox`** | Reflected XSS payload generation | Already in vuln-xss likely |

**Recommendation**: Caido for runtime DOM/postMessage instrumentation, csper-style JSONP corpus, retire.js + custom mXSS-CVE list.

### 10. Cookbook restructure recommendation

**Don't split XSS** into reflected/stored/DOM. Triples maintenance for ~20% unique content.

**Add new `vuln-browser.txt`** for everything not strictly XSS:
- CSP analysis + bypass attempts
- DOM clobbering
- postMessage handler analysis
- Service worker scope/cache audit
- WebAssembly fingerprint + audit
- Cookie hardening checks (CHIPS, prefixes, SameSite)
- Trusted Types audit
- iframe sandbox configuration
- COOP/COEP/CORP header audit
- SRI coverage
- Web cache deception for SPAs

**Structure:**
```
vuln-xss.txt           # reflected + stored + DOM XSS, payload corpus
vuln-browser.txt       # NEW — everything else (CSP, SW, WASM, postMessage, headers)
exploit-xss.txt        # already exists — keep
```

`vuln-browser` calls out to `vuln-xss` when finding bypass primitive (CSP weakened) so chain corpus picks it up. **Internal contract**: vuln-browser produces *primitives*, vuln-xss produces *payloads*, exploit-xss produces *PoC chains*.

Second-tier later: `vuln-client-storage.txt` for IndexedDB/localStorage/Cache API exfil patterns. Don't build yet — fold into vuln-browser §Storage.

### 11. New chain patterns (10 to add)

1. **DOM clobber → Trusted Types default policy override → DOM XSS → admin session**
2. **postMessage misuse → cross-origin token exfil via OAuth popup**
3. **Subdomain takeover → SW install on sibling subdomain via shared cookie domain → cross-subdomain persistent XSS**
4. **Open redirect + web cache deception → CSP-bypass-via-cached-redirect**
5. **SW scope hijack on logout endpoint → session resurrection** (user believes logged out, attacker continues)
6. **CHIPS partitioned cookie confusion → CSRF on first-party that loads attacker iframe**
7. **Prototype pollution in build-time bundler config → supply chain XSS** (bridges supply chain into client-side)
8. **WASM crypto module forged via CDN takeover → forged signatures accepted by app**
9. **Service Worker + Background Sync → exfil after victim closes tab**
10. **Permissions Policy gap on nested iframe → camera/mic in unintended frame**

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| **Add `vuln-browser.txt` (don't split XSS)** | Triples maintenance for 20% unique content | New peer cookbook agent |
| **Internal contract: primitives → payloads → chains** | Clean handoff between vuln-browser, vuln-xss, exploit-xss | Encode in cookbook prompts |
| **Ship JSONP-in-CDN-allowlist corpus** | Single highest ROI quick win | New data asset |
| **DOMPurify-version-to-mXSS-CVE map** | High-leverage detection | New `mxss-cves.yaml` |
| **WASM fingerprinting** (`wasm-objdump` + import sigs) | Underexplored attack surface | New tooling |
| **postMessage instrumentation via DevTools protocol** | Static + dynamic analysis | Playwright-stealth hook |
| **CSP report parsing** | When exposed, free violation telemetry | Optional integration |
| **Caido headless** for runtime instrumentation | Better than Burp for CI | Replace Burp dependency |
| **10 new chain patterns** | Real disclosure-driven gaps | Append to chain-patterns.yaml tagged `client-side` |

---

## Open questions

1. **Trusted Types coverage testing** — how to systematically test sink coverage gaps cross-browser?
2. **WASM symbolic execution** — should Vanguard ship a WASM symbolic executor or just fingerprint?
3. **Service worker scope brute force** — how to systematically test SW registration without XSS prerequisite?
4. **DOMPurify version detection** — works for unminified bundles but most production code is minified
5. **postMessage listener static analysis** — JS bundlers tree-shake heavily; how to get reliable static traces?

---

## Sources

### Researchers
- Krzysztof Kotowicz — Google Security Blog + Black Hat ("Reining in the Web's Inconsistencies")
- Sebastián Lekies — "Cross-Site Pollution," Black Hat USA 2018
- Masato Kinugawa — mXSS series, Cure53 / personal blog
- Cure53 — DOMPurify audits 2.x and 3.x
- Michał Bentkowski (Securitum) — DOM Clobbering, Trusted Types bypass research
- Frans Rosén (Detectify) — postMessage / OAuth disclosures
- James Kettle (PortSwigger) — Browser-Powered Desync (BH USA 2022, refresh 2024), "Listen to the Whispers" (2024)
- Trail of Bits — "Ramping Up Fuzzing for WASM" (2023)

### Reports
- PortSwigger Top 10 Web Hacking Techniques 2023, 2024
- HTTP Archive 2024 Web Almanac, Security chapter
- Tencent Xuanwu — "Bad Service Workers," Black Hat Asia 2019
- Google V8 / Chrome Security — "Spectre @ 5 Years"
- HackerOne disclosed: PayPal #1148022 (base-uri); Slack JSONP CSP bypass; Microsoft/Facebook OAuth postMessage
- Assetnote 2023 cache deception SPA research
- Cloudflare WASM usage telemetry 2024

### Specs
- W3C Trusted Types spec, CSP3 spec
- web.dev/articles/coop-coep, CHIPS explainer (Chrome team)
- Mozilla telemetry on `__Host-`/`__Secure-` adoption

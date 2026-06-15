# Task 016: Browser-Side Attack Agent

**Phase**: Phase 4
**Wave**: Wave 1 — parallel with xss-vuln
**Depends on**: Phase 3 complete (recon deliverable)
**Labels**: phase4, agent

## Why This Matters

Modern web apps have a second attack surface that traditional scanners miss entirely:
the browser execution environment. CSP headers, postMessage handlers, Service Workers,
and prototype pollution all live client-side. Burp Suite and nuclei don't execute
JavaScript — they can't find these.

The `browser-side` agent runs a real browser via Playwright, instruments JavaScript,
and finds vulnerabilities that only exist when the page actually runs.

**High-value findings this covers:**
- CSP bypass via JSONP callback endpoint — attacker can XSS despite "Content-Security-Policy: default-src 'none'"
- postMessage without origin check — iframe on attacker domain sends message, app processes it
- Service Worker cache poisoning — attacker caches malicious response for offline use
- Prototype pollution — `__proto__` injection causes downstream logic corruption

## What to Build

### Agent: `browser-side`

**Agent definition**:
```typescript
'browser-side': {
  prerequisites: ['recon'],
  promptTemplate: 'browser-side',
  deliverableFilename: 'browser_side_deliverable.md',
  modelTier: 'medium',
  required_mode: 'validated',
},
```

**Prompt file**: `apps/worker/prompts/browser-side.txt`

---

### CSP Analysis

```
1. Fetch Content-Security-Policy header
2. Parse directives: default-src, script-src, connect-src, img-src
3. Find bypass vectors:
   a. unsafe-inline in script-src → XSS possible despite CSP
   b. unsafe-eval → eval()-based XSS possible
   c. JSONP: any whitelisted CDN that has a ?callback= endpoint
      - ajax.googleapis.com → has JSONP
      - cdnjs.cloudflare.com → has JSONP
   d. CDN wildcard: *.cloudfront.net → attacker can serve JS from CloudFront
4. Report: "CSP allows script from *.cloudfront.net — attacker can host malicious JS there"
```

---

### PostMessage Analysis

```
1. Load page in Playwright, inject window.__postMessageListeners = []
2. Override addEventListener to capture all 'message' event registrations
3. Enumerate: handler source code, registered on which element
4. For each handler:
   a. Check if origin validated: event.origin === 'https://trusted.com'
   b. If no origin check → vulnerable
5. Craft test payload:
   window.postMessage({ action: 'navigate', url: 'evil.com' }, '*')
6. If app processes payload without checking origin → finding: postMessage injection
```

---

### Service Worker Analysis

```
1. Check navigator.serviceWorker.getRegistrations()
2. For each registered SW:
   - Fetch SW source via URL
   - Look for dynamic cache on POST/non-idempotent requests
   - Look for fetch interception without proper cache-busting
3. Test cache poisoning:
   - Find SW that caches based on URL only
   - Request with poison header → SW caches poisoned response
   - Later request gets poisoned response from cache
```

---

### Prototype Pollution

```
1. Load target JS bundles in Node.js sandbox (via Playwright evaluate)
2. Inject: JSON.parse('{"__proto__": {"polluted": true}}')
3. Check: {}.polluted === true → prototype polluted
4. Test downstream impact:
   - Does pollution affect lodash _.merge? (CVE-2018-3721 pattern)
   - Does pollution bypass auth checks? (polluted.isAdmin = true)
5. Report gadget chain if found
```

---

### DOM Clobbering

```
1. Find HTML injection points (even if XSS-filtered — `<a id=x>` might be allowed)
2. Test if named HTML elements (id/name attrs) shadow global variables:
   - <a id="config" href="javascript:alert(1)"> → window.config becomes the element
   - If app does: document.getElementById('config').href → attacker controls href
3. Find patterns in JS where document[variable] or window[variable] is accessed
```

## Files to Create/Change

- `apps/worker/prompts/browser-side.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity wrapper
- `apps/worker/src/temporal/workflows.ts` — add to Wave 1 parallel group

## Acceptance Criteria

- [ ] Correctly parses CSP header and identifies unsafe-inline/unsafe-eval
- [ ] Detects JSONP endpoint in CSP allowlist as bypass vector
- [ ] Finds postMessage handler with no origin check via Playwright instrumentation
- [ ] Reports finding with PoC payload for confirmed postMessage bypass
- [ ] Runs parallel to xss-vuln in Wave 1
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/17-browser-side-attack-surface.md`
- Uses Playwright for browser automation (already in the container)
- CSP parser: write a minimal parser or use `content-security-policy` npm package
- PostMessage injection can be chained with xss-vuln findings → Chain Hunter should detect this
- Prototype pollution: only report if there's a usable gadget downstream, not just pollution

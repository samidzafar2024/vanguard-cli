# Plan: Phase 2 — Intelligence Layer

**Status**: Draft
**Date**: 2026-04-28
**Spec ref**: `.waypoint/specs/phase2-intelligence.md`
**Tasks**: task-008, task-009, task-027

---

## Architecture Overview

Phase 2 adds two agents that slot into the pipeline **before** any vuln agent runs.
Both are purely additive — zero existing code changes required except workflow wave ordering.

```
Temporal Workflow
  │
  ├── [existing] Phase 1 safety layer (EngagementConfig, preflight, vanguardFetch)
  │
  ▼
═══════════════════════════════════════
WAVE 0 (NEW)
  │
  ├── [C1] waf-fingerprint agent
  │         apps/worker/prompts/waf-fingerprint.txt   (NEW)
  │         Output → waf_fingerprint_deliverable.md
  │         Output → injected as <brain_hints> into ALL subsequent agents
  │
═══════════════════════════════════════
  │
  ▼
═══════════════════════════════════════
WAVE 1 (NEW — parallel with profiling)
  │
  ├── [C2] secrets-detection agent
  │         apps/worker/prompts/secrets-detection.txt  (NEW)
  │         Output → secrets_detection_deliverable.md
  │
═══════════════════════════════════════
  │
  ▼
[existing] profiling → pre-recon → sast → recon → ...
```

---

## Component Designs

### C1 — WAF Fingerprint Agent

**Files**:
- `apps/worker/prompts/waf-fingerprint.txt` — NEW prompt
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS + AgentName
- `apps/worker/src/temporal/activities.ts` — add `runWafFingerprintAgent` activity
- `apps/worker/src/temporal/workflows.ts` — run in Wave 0 before profiling

**Agent definition** (session-manager.ts):
```typescript
'waf-fingerprint': {
  name: 'waf-fingerprint',
  displayName: 'WAF Fingerprint + Bypass agent',
  prerequisites: [],
  promptTemplate: 'waf-fingerprint',
  deliverableFilename: 'waf_fingerprint_deliverable.md',
  modelTier: 'medium',
  required_mode: 'passive',
}
```

**Prompt responsibilities** (`waf-fingerprint.txt`):
- Send 3 probe requests via `vanguardFetch` to target homepage
- Analyse response headers + status code for WAF signatures:
  ```
  Cloudflare  → cf-ray header | __cfduid cookie | "Attention Required" body
  AWS WAF     → x-amzn-requestid | "Request blocked" 403 body
  Akamai      → aka-debug header | "Access Denied" akamai-style
  Imperva     → x-iinfo header | "incident" in body
  Vercel      → x-vercel-id header
  Cloudfront  → x-amz-cf-id header
  Fastly      → x-served-by with cache node pattern
  None        → no WAF signatures found
  ```
- Generate bypass strategy JSON:
  ```json
  {
    "waf_detected": "cloudflare",
    "confidence": 0.95,
    "bypass_strategy": {
      "rate_limit_rps": 1,
      "tamper_scripts": ["space2comment", "between", "charunicodeescape"],
      "ua_bundle": "safari18_mac",
      "encoding": "unicode_escape",
      "fragmentation": true
    }
  }
  ```
- Save deliverable to `waf_fingerprint_deliverable.md`

**Brain hints injection** — workflow reads deliverable and prepends to all subsequent agent prompts:
```
<brain_hints>
WAF: Cloudflare (confidence: 95%)
Bypass: rate 1 RPS, ua safari18_mac, tamper space2comment+between
Apply these settings to ALL vanguardFetch calls in this session.
</brain_hints>
```

**Workflow placement** (`workflows.ts`):
```typescript
// === Wave 0: WAF Fingerprint (before profiling) ===
await runSequentialPhase('waf-fingerprint', 'waf-fingerprint', a.runWafFingerprintAgent);

// Load WAF hints for all subsequent agents
const wafHints = await a.loadWafHints(activityInput);
// wafHints injected into activityInput.brainHints for downstream agents

// === Phase 0: Target Profiling (existing) ===
await runSequentialPhase('profiling', 'profiling', a.runProfilingAgent);
```

---

### C2 — Secrets Detection Agent

**Files**:
- `apps/worker/prompts/secrets-detection.txt` — NEW prompt
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS + AgentName
- `apps/worker/src/temporal/activities.ts` — add `runSecretsDetectionAgent` activity
- `apps/worker/src/temporal/workflows.ts` — run in Wave 1 parallel with profiling

**Agent definition** (session-manager.ts):
```typescript
'secrets-detection': {
  name: 'secrets-detection',
  displayName: 'Secrets Detection agent',
  prerequisites: ['waf-fingerprint'],
  promptTemplate: 'secrets-detection',
  deliverableFilename: 'secrets_detection_deliverable.md',
  modelTier: 'medium',
  required_mode: 'passive',
}
```

**Prompt responsibilities** (`secrets-detection.txt`):

Step 1 — Fetch live JS bundles:
```
- Load target homepage via vanguardFetch
- Extract all <script src="..."> tags
- Fetch each JS bundle (up to 10 bundles, max 10MB total)
- Scan each bundle for secret patterns
```

Step 2 — Check exposed files:
```
For each path in [/.env, /.env.local, /.env.production, /.git/config,
                  /.git/HEAD, /config.json, /docker-compose.yml,
                  /package.json, /.aws/credentials]:
  vanguardFetch(path) → if status 200 → flag as finding
```

Step 3 — Detect patterns:
```
AWS key:      /AKIA[0-9A-Z]{16}/
Stripe live:  /sk_live_[0-9a-zA-Z]{24}/
GitHub token: /ghp_[a-zA-Z0-9]{36}/
JWT:          /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/
Private key:  /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/
Google API:   /AIza[0-9A-Za-z\-_]{35}/
Slack:        /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/
Generic:      /(?:password|api_key|secret|token)\s*=\s*["'][^"']{8,}/
```

Step 4 — Output finding:
```json
{
  "type": "aws_access_key",
  "value_redacted": "AKIA****EXAMPLE",
  "location": "https://target.com/static/js/main.chunk.js:1:45231",
  "severity": "critical",
  "confidence": 0.95,
  "evidence_safe": "AWS Access Key ID pattern found in JS bundle"
}
```

**CRITICAL redaction rule**: `value_redacted` always shows first 4 chars + `****` only.
Full secret value NEVER appears in deliverable, logs, or audit trail.

**Workflow placement** (`workflows.ts`):
```typescript
// === Wave 1: Parallel with profiling ===
await Promise.allSettled([
  runSequentialPhase('profiling', 'profiling', a.runProfilingAgent),
  runSequentialPhase('secrets-detection', 'secrets-detection', a.runSecretsDetectionAgent),
]);
```

---

### C3 — Profiling Agent (Tech Stack + Cloud + LLM)

**Task**: task-027

**Scope**: The existing `profiling` agent covers basic surface mapping. Task-027 enhances
it (or creates it if it's a stub) to detect the specific signals Phase 4 agents need:
cloud provider (AWS/GCP/Azure), LLM endpoints (/api/chat, streaming responses),
and precise framework versions for Brain Planner CVE matching.

**Key output** (`profiling_deliverable.md`):
```typescript
{
  tech_stack: ["Express:4.17.1", "React:18.2.0", "AWS"],
  cloud_provider: "aws" | "gcp" | "azure" | null,
  llm_endpoints: [{ url: "/api/chat", provider_hint: "openai", confidence: 0.9 }],
  framework: "Express",
  framework_version: "4.17.1",
}
```

**Workflow placement**: Wave 1 parallel with secrets-detection (already in workflow diagram above).

---

## ALL_AGENTS Update

**File**: `apps/worker/src/types/agents.ts`

```typescript
export const ALL_AGENTS = [
  'waf-fingerprint',    // NEW — Wave 0
  'profiling',          // ENHANCED — task-027 (cloud + LLM detection)
  'secrets-detection',  // NEW — Wave 1 (parallel with profiling)
  'pre-recon',
  'sast',
  'recon',
  // ... rest unchanged
] as const;
```

---

## Dependencies Between Components

```
C1 (waf-fingerprint)
  └─► All subsequent agents receive WAF bypass via brain_hints
  └─► C2 (secrets-detection uses WAF bypass settings for JS bundle fetches)

Phase 1 Foundation (must be complete first):
  └─► C1 needs vanguardFetch (task-003)
  └─► C1 needs EngagementConfig (task-001) for rate limits + ua_bundle
  └─► C2 needs vanguardFetch + blast-radius tracker
```

**Build order**: Phase 1 complete → C1 (waf-fingerprint) → C2 (secrets-detection)

---

## Integration Points (existing files to modify)

| File | Change |
|---|---|
| `apps/worker/src/types/agents.ts` | Add `waf-fingerprint`, `secrets-detection` to ALL_AGENTS |
| `apps/worker/src/session-manager.ts` | Add agent definitions for both new agents |
| `apps/worker/src/temporal/activities.ts` | Add `runWafFingerprintAgent`, `runSecretsDetectionAgent`, `loadWafHints` |
| `apps/worker/src/temporal/workflows.ts` | Wave 0 + Wave 1 ordering, WAF hints propagation |
| `apps/worker/src/types/activity-logger.ts` | No change |

---

## Open Questions (resolved)

1. **WAF hints propagation — how?** → `activityInput` extended with optional `brainHints: string` field. Workflow reads deliverable, builds hint string, passes in ActivityInput for all downstream agents.
2. **Parallel Wave 1 — what if secrets-detection fails?** → `Promise.allSettled` — profiling continues even if secrets-detection errors. Failure logged, not fatal.
3. **JS bundle size limit?** → 10 bundles max, 10MB total across all bundles. Largest bundles first.
4. **secrets-detection in passive mode?** → Yes. Fetching publicly accessible JS bundles is read-only observation, not active exploitation.

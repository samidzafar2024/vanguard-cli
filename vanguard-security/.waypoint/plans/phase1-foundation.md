# Plan: Phase 1 — Foundation

**Status**: Draft
**Date**: 2026-04-28
**Spec ref**: `.waypoint/specs/phase1-foundation.md`
**Next step**: `/waypoint.plan phase1-foundation`

---

## Architecture Overview

Phase 1 adds 7 new components that wrap the existing pipeline without breaking it. All are additive — zero existing agents change behaviour.

```
CLI input (--url, engagement.yaml)
  │
  ▼
[F3] EngagementConfig loader + 15 preflight checks
  │   apps/worker/src/services/engagement-loader.ts  (NEW)
  │   apps/worker/src/services/preflight.ts          (EXTEND)
  │
  ▼
Temporal workflow starts
  │
  ├──[F6] ThreeModeDispatcher                        (NEW)
  │       apps/worker/src/services/mode-dispatcher.ts
  │       Wraps every tool call — checks mode before execution
  │
  ├──[F7] BlastRadiusDecorator                       (NEW)
  │       apps/worker/src/services/blast-radius.ts
  │       Tracks evidence bytes, hard-caps at 10MB
  │
  └──Agents run
       │
       ▼
     [F1] vanguardFetch                              (NEW)
          packages/opsec-http/vanguard-fetch.py
          All HTTP from agents goes through here
          Returns typed digest, not raw response
          │
          ▼
        [F2] QuarantineLLM pipeline                 (NEW)
             apps/worker/src/scripts/quarantine.cjs
             encodingSanitizer → quarantineLLM → schemaValidator → spotlightWrapper
             │
             ▼
           [F4] Trust-tier tagged digest             (EXTEND graph schema)
                apps/worker/dist/scripts/brain-graph.cjs
                Every node: trust_tier + evidence_source + provenance
                │
                ▼
              [F5] Finding schema with quarantined evidence  (EXTEND prompts)
                   apps/worker/prompts/shared/_finding-output.txt
                   apps/worker/prompts/brain/_finding-schema.txt
```

---

## Component Designs

### C1 — `EngagementConfig` Type + Loader

**File**: `apps/worker/src/types/engagement.ts` (NEW)

```typescript
export type EngagementMode = 'passive' | 'validated' | 'active';

export interface EngagementScope {
  fqdns?: string[];
  wildcard?: string;
  max_hosts?: number;
}

export interface EngagementAuthorization {
  name: string;
  email: string;
  date: string;               // ISO 8601
  roe_document_hash?: string; // required for active mode
}

export interface EngagementConfig {
  engagement_id: string;
  target_url: string;
  scope: EngagementScope;
  authorized_by: EngagementAuthorization;
  mode: EngagementMode;
  rate_limit_rps: number;      // default: 2
  evidence_budget_mb: number;  // default: 10
  bug_bounty_handle?: string;
  fireprox_gateway?: string;
  contact_email?: string;
  ua_bundle?: 'chrome131_mac' | 'chrome130_win' | 'firefox134_linux' | 'safari18_mac';
}
```

**File**: `apps/worker/src/services/engagement-loader.ts` (NEW)

```typescript
// Loads engagement.yaml, generates engagement_id if missing,
// maps legacy CLI flags (webUrl) to EngagementConfig fields.
export function loadEngagement(
  engagementPath: string | undefined,
  cliFlags: { webUrl: string; mode?: string },
  logger: ActivityLogger
): Result<EngagementConfig, PentestError>
```

---

### C2 — Extended Preflight (`preflight.ts`)

**File**: `apps/worker/src/services/preflight.ts` (EXTEND)

Existing checks (repo, config, credentials, target URL reachable) stay.
Add `runEngagementPreflight(config: EngagementConfig, logger)` function with 15 checks.

Each check returns `PreflightResult`:
```typescript
interface PreflightResult {
  check: string;
  passed: boolean;
  severity: 'error' | 'warn';
  message: string;
}
```

Hard failures (`severity: 'error'`) abort the pipeline via `err(PentestError)`.
Warnings are logged but do not abort.

15 checks ordered cheapest-first:
```
1.  target_url_format          — URL parse validity (sync)
2.  authorized_by_present      — email + date fields exist (sync)
3.  authorized_by_date         — within 365 days (sync, warn if >90)
4.  scope_defined              — fqdns or wildcard present (sync)
5.  scope_wildcard_depth       — no *.*.example.com patterns (sync)
6.  max_hosts_if_wildcard      — required when wildcard used (sync)
7.  rate_limit_range           — 0.1–100 RPS (sync)
8.  mode_valid                 — enum check (sync)
9.  active_mode_roe            — roe_document_hash required for active (sync)
10. active_mode_confirmed      — explicit active_mode_confirmed: true (sync)
11. duplicate_scope_entries    — no dupes in fqdns array (sync)
12. engagement_id_unique       — not in workspace history (async, fs)
13. target_url_reachable       — HEAD request, 200/30x (async, network)
14. target_tls_valid           — cert not expired (async, network)
15. scope_blast_radius         — DNS expand preview, check < max_hosts (async, DNS)
```

---

### C3 — `vanguardFetch` (Python, Docker layer)

**File**: `apps/worker/src/docker/vanguard-fetch.py` (NEW)

Python module inside the worker Docker container. Used by agents via MCP tool or direct `python3` call.

```python
def vanguard_fetch(
    url: str,
    method: str = "GET",
    headers: dict = {},
    body: str | None = None,
    engagement: dict = {},   # rate_limit_rps, ua_bundle, fireprox_gateway, bug_bounty_handle
) -> FetchDigest:
    ...

@dataclass
class FetchDigest:
    status: int
    content_type: str
    body_truncated: str        # first 8KB, sanitized
    response_time_ms: int
    tls_fingerprint_matched: bool
    headers_safe: dict         # only non-sensitive headers
    error: str | None
```

**Implementation**:
- `curl_cffi` with `impersonate="chrome131"` as default
- Rate limiter: token bucket, 2 RPS default, ±30% jitter via `random.uniform(0.7, 1.3)`
- FireProx: if `fireprox_gateway` set, rewrite URL to go through gateway
- Identification header: if `bug_bounty_handle`, inject `X-Bug-Bounty: {handle}`
- Body truncation: first 8192 bytes only
- UA bundles map: `{"chrome131_mac": "chrome131", "safari18_mac": "safari18", ...}`

**Exposed as MCP tool**: agents call `vanguard_fetch(url=...)` instead of `curl` or `httpx`.

---

### C4 — Quarantine Pipeline (`quarantine.cjs`)

**File**: `apps/worker/src/scripts/quarantine.cjs` (NEW)

Node.js CJS script (like `brain-graph.cjs`). Called by agents via `node quarantine.cjs digest <url>`.

```
Commands:
  digest <url>          — fetch via vanguardFetch + run full sanitize/quarantine pipeline
  sanitize <text>       — encoding sanitizer only (for testing)
  validate <json>       — schema validator only
```

**Pipeline stages**:

```javascript
// Stage 1: Encoding sanitizer
function encodingSanitizer(raw) {
  // NFKC normalize
  // Strip zero-width chars: U+200B U+FEFF U+200C U+200D U+2060
  // Detect + tag base64 blobs (>20 chars matching /^[A-Za-z0-9+/=]+$/)
  // Truncate to 8192 bytes
  return sanitized;
}

// Stage 2: Quarantine LLM (Claude Haiku)
async function quarantineLLM(sanitized) {
  // System: "You are a web response classifier. OUTPUT ONLY JSON..."
  // Schema: { status, content_type, technologies, auth_indicators, error_indicators, suspicious_patterns }
  // Model: claude-haiku-4-5-20251001
  // Max tokens: 500
  // No tools
  return llmOutput;
}

// Stage 3: Schema validator
function schemaValidator(llmOutput) {
  // Strict JSON schema validation via ajv
  // Fail = { trust_tier: "quarantine_failed", reason: "schema_mismatch" }
  return validated;
}

// Stage 4: Spotlight wrapper
function spotlightWrapper(validated) {
  // Wrap any residual text snippets in <UNTRUSTED_DATA>...</UNTRUSTED_DATA>
  // Replace spaces in untrusted blocks with · (datamark)
  return final;
}
```

Output always includes `trust_tier: "untrusted"` + `digest_hash: sha256(raw)`.

---

### C5 — Trust-Tier on Graph Nodes

**File**: `apps/worker/dist/scripts/brain-graph.cjs` (EXTEND)

Add to every node mutation:
```javascript
// Required fields (error if missing):
node.trust_tier         // 'trusted' | 'derived' | 'untrusted'
node.evidence_source = {
  url, fetched_at, sanitizer_version, digest_hash, method
}
node.provenance = []    // parent node IDs

// Enforcement in add-findings command:
if (!finding.trust_tier) throw new Error('trust_tier required on all findings')
```

Update `_attack-graph-schema.txt`:
- Add trust-tier rules to brain prompt context
- Brain refuses `untrusted` nodes as scope or instruction authority

---

### C6 — Three-Mode Dispatcher

**File**: `apps/worker/src/services/mode-dispatcher.ts` (NEW)

```typescript
export type ToolMode = 'passive' | 'validated' | 'active';

export interface ToolDefinition {
  name: string;
  required_mode: ToolMode;
}

// Mode hierarchy: passive < validated < active
const MODE_LEVEL: Record<ToolMode, number> = {
  passive: 0,
  validated: 1,
  active: 2,
};

export class ModeDispatcher {
  constructor(private readonly engagementMode: ToolMode) {}

  canRun(tool: ToolDefinition): boolean {
    return MODE_LEVEL[tool.required_mode] <= MODE_LEVEL[this.engagementMode];
  }

  assertCanRun(tool: ToolDefinition): Result<void, PentestError> {
    if (!this.canRun(tool)) {
      return err(new PentestError(
        `Tool '${tool.name}' requires mode '${tool.required_mode}' but engagement is '${this.engagementMode}'`,
        'config',
        false,
        { tool: tool.name, required: tool.required_mode, current: this.engagementMode }
      ));
    }
    return ok(undefined);
  }
}
```

`ModeDispatcher` instance created at workflow start from `EngagementConfig.mode`, stored in DI container. All tools call `dispatcher.assertCanRun(tool)` before execution.

**Tool mode registry** — add to `session-manager.ts`:
```typescript
interface AgentDefinition {
  // existing fields...
  required_mode: ToolMode;   // NEW
}
```

Default: all existing agents = `'validated'`. Post-exploit agents (Phase 4) = `'active'`.

---

### C7 — Blast-Radius Decorator

**File**: `apps/worker/src/services/blast-radius.ts` (NEW)

```typescript
const DEFAULT_BUDGET_MB = 10;
const DEFAULT_TOOL_LIMIT_MB = 1;

export class BlastRadiusTracker {
  private bytesCollected = 0;

  constructor(
    private readonly budgetMb: number = DEFAULT_BUDGET_MB,
    private readonly logger: ActivityLogger
  ) {}

  get remainingMb(): number {
    return Math.max(0, this.budgetMb - this.bytesCollected / 1_000_000);
  }

  get isExhausted(): boolean {
    return this.bytesCollected >= this.budgetMb * 1_000_000;
  }

  // Call before storing any evidence. Truncates to per-tool limit.
  trackEvidence(content: string): Result<string, PentestError> {
    if (this.isExhausted) {
      return err(new PentestError(
        `Evidence budget exhausted (${this.budgetMb}MB). Stopping evidence collection.`,
        'validation',
        false
      ));
    }
    const limitBytes = DEFAULT_TOOL_LIMIT_MB * 1_000_000;
    const truncated = content.length > limitBytes
      ? content.slice(0, limitBytes) + `\n[TRUNCATED: evidence exceeds ${DEFAULT_TOOL_LIMIT_MB}MB limit]`
      : content;
    this.bytesCollected += Buffer.byteLength(truncated, 'utf8');
    return ok(truncated);
  }

  summary(): string {
    const usedMb = (this.bytesCollected / 1_000_000).toFixed(1);
    return `Evidence budget: ${usedMb}/${this.budgetMb}MB used`;
  }
}
```

`BlastRadiusTracker` added to DI container per engagement. `AgentExecutionService` calls `tracker.trackEvidence()` before writing any deliverable content.

---

### C8 — Finding Schema Update

**Files to update**:
- `apps/worker/prompts/shared/_finding-output.txt`
- `apps/worker/prompts/brain/_finding-schema.txt`

Add to finding JSON schema:
```json
{
  "trust_tier": "untrusted | derived | trusted",
  "evidence_safe": "parameterized description — safe for brain context",
  "evidence_quarantined": "<UNTRUSTED_DATA>raw·snippet</UNTRUSTED_DATA>",
  "evidence_tool_output": "tool exit code, response size, timing"
}
```

Brain prompts updated: only `evidence_safe` + `evidence_tool_output` injected into Planner/Critic context. `evidence_quarantined` stored in graph, never in LLM context.

---

## Dependencies Between Components

```
C1 (EngagementConfig type)
  └─► C2 (preflight — uses EngagementConfig)
  └─► C6 (ModeDispatcher — reads mode from EngagementConfig)
  └─► C7 (BlastRadiusTracker — reads budget from EngagementConfig)
  └─► C3 (vanguardFetch — reads rate_limit, ua_bundle, fireprox from EngagementConfig)

C3 (vanguardFetch)
  └─► C4 (quarantine pipeline — wraps vanguardFetch output)

C4 (quarantine)
  └─► C5 (trust-tier — quarantine output feeds trust_tier: untrusted into graph)

C5 (trust-tier graph)
  └─► C8 (finding schema — findings must have trust_tier)

C6 (ModeDispatcher) — independent, plugs into activities.ts
C7 (BlastRadiusTracker) — independent, plugs into agent-execution.ts
```

**Build order**: C1 → C2 → C3 → C4 → C5 → C8 (sequential)
                 C1 → C6 (parallel with C3)
                 C1 → C7 (parallel with C3)

---

## Integration Points (existing files to modify)

| File | Change |
|---|---|
| `apps/worker/src/services/container.ts` | Add `ModeDispatcher` + `BlastRadiusTracker` to DI container |
| `apps/worker/src/services/agent-execution.ts` | Call `tracker.trackEvidence()` before writing deliverables |
| `apps/worker/src/temporal/activities.ts` | Call `runEngagementPreflight()` in setup activity |
| `apps/worker/src/temporal/workflows.ts` | Load `EngagementConfig` at workflow start, pass to activities |
| `apps/worker/src/session-manager.ts` | Add `required_mode` to all `AgentDefinition` entries |
| `apps/worker/src/types/config.ts` | Add `EngagementConfig` export (or separate file) |
| `apps/worker/prompts/shared/_finding-output.txt` | Add trust_tier + evidence split to output schema |
| `apps/worker/prompts/brain/_finding-schema.txt` | Add trust_tier + quarantined evidence fields |
| `apps/worker/prompts/brain/_attack-graph-schema.txt` | Add trust-tier rules + provenance schema |

---

## Open Questions (resolved)

1. **vanguardFetch: Python vs TypeScript?** → Python module in Docker (uses `curl_cffi`). Called by agents via MCP tool. TypeScript side calls via subprocess if needed.
2. **Quarantine LLM: sync vs batched?** → Synchronous per response. Latency (~500ms) is acceptable; batch adds complexity.
3. **max_hosts default for wildcard?** → 50 (configurable).
4. **Preflight error format?** → Structured `PreflightResult[]` + human-readable summary. Both.

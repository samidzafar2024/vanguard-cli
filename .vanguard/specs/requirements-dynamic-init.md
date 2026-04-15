# Requirements Assessment: Dynamic Init Options

**Status**: complete
**Date**: 2026-03-20
**Scope**: CLI changes needed to replace hardcoded init prompts with server-driven schema
**Prerequisite**: [discovery-init-options.md](./discovery-init-options.md)

---

## Objective

Replace the 953-line hardcoded init flow (`src/presentation/cli/commands/init.ts`) with a dynamic prompt system driven by the `GET /api/agent-framework/init-schema` endpoint. The server becomes the single source of truth for available options, and the CLI sends raw `selections` (groupSlug → choiceSlug) instead of building `vanguardConfig` locally.

---

## Current State Summary

### init.ts — 9 Phases (Lines 192-953)

| Phase | Lines | What It Does | Registry Used |
|-------|-------|-------------|---------------|
| 1. Project basics | 221-284 | name, type, track | None (hardcoded) |
| 2. Stack selection | 306-362 | language → stack | `stackRegistry` (1,077 lines) |
| 3. Database & ORM | 364-426 | ORM → database | `selectedStack.compatibleOrms` |
| 4. Auth strategy | 428-458 | auth selection | `selectedStack.compatibleAuths` |
| 4.5. Frontend | 460-494 | frontend framework | `selectedStack.frontendOptions` |
| 5. Architecture | 496-525 | architecture pattern | `architectureRegistry` (953 lines) |
| 6. Testing | 527-618 | unit, linter, formatter, e2e | `testingRegistry` (431 lines) |
| 7. Deployment | 620-647 | deploy target | Hardcoded array |
| 8. Confirmation | 649-685 | Summary display | None |
| 9. Create & register | 687-953 | Project.create, register, bundle, MCP, hooks, memory | None |

### Registration Payload (Current)

```typescript
// src/application/services/project-registration.service.ts:10-18
interface ProjectRegistrationPayload {
  name: string
  type: 'greenfield' | 'brownfield'
  track: 'solo' | 'team' | 'enterprise'
  projectPath: string
  gitRemoteUrl?: string
  defaultBranch?: string
  vanguardConfig: Record<string, unknown>  // ← built locally by Project.toConfig()
}
```

### Server API Response Shape

```typescript
// GET /api/agent-framework/init-schema
{
  categories: Record<string, Array<{
    slug: string              // e.g., "language", "stack", "orm"
    name: string              // e.g., "Primary Language"
    description: string | null
    selectorType: string      // currently always "select"
    required: boolean
    dependsOnGroupSlug: string | null  // conditional display
    choices: Array<{
      slug: string            // e.g., "typescript", "nextjs-app-router"
      label: string           // display name
      description: string | null
      icon: string | null
      sequence: number
      compatibleWithSlugs: string[]  // filter against ALL selected slugs
      metadata: Record<string, unknown> | null
      orgId: string | null
      isBuiltIn: boolean
    }>
  }>>
}
```

---

## Required Changes

### 1. New Service: InitSchemaService

**Location**: `src/application/services/init-schema.service.ts`

**Responsibility**: Fetch init schema from server and return typed response.

**Interface**:
```typescript
interface InitSchemaGroup {
  slug: string
  name: string
  description: string | null
  selectorType: string
  required: boolean
  dependsOnGroupSlug: string | null
  choices: InitSchemaChoice[]
}

interface InitSchemaChoice {
  slug: string
  label: string
  description: string | null
  icon: string | null
  sequence: number
  compatibleWithSlugs: string[]
  metadata: Record<string, unknown> | null
  orgId: string | null
  isBuiltIn: boolean
}

interface InitSchema {
  categories: Record<string, InitSchemaGroup[]>
}

class InitSchemaService {
  constructor(apiEndpoint: string, accessToken: string, clientVersion: string)
  async fetch(): Promise<InitSchema>
}
```

**Infrastructure adapter**: `src/infrastructure/api/init-schema.adapter.ts`

**Notes**:
- Calls `GET /api/agent-framework/init-schema` with Bearer token
- Throws on non-200 responses with clear error message
- No caching needed (init runs once per project)

### 2. New Component: DynamicPromptRenderer

**Location**: `src/presentation/cli/prompts/dynamic-prompt-renderer.ts`

**Responsibility**: Iterate schema groups, evaluate dependencies, filter choices, render @clack/prompts.

**Algorithm**:
```
Input: InitSchema, smartDefaults: SmartDefaults, options (CLI flags)
Output: Record<string, string>  // selections map (groupSlug → choiceSlug)

1. Flatten categories into ordered group list
   - Category order: basics, stack, database, auth, architecture, testing, deployment
   - Within category: groups already ordered by sequence from server

2. For each group:
   a. Check dependsOnGroupSlug — if parent group not in selections, skip
   b. Filter choices by compatibleWithSlugs:
      - If choice.compatibleWithSlugs is [] → always include
      - If ANY selected slug appears in compatibleWithSlugs → include
      - Otherwise → exclude
   c. If no compatible choices remain → skip group with warning
   d. If -y flag:
      - Check smartDefaults for matching slug
      - If no match → select first compatible choice
      - Skip optional (required=false) groups entirely
   e. If not -y:
      - Render p.select() with filtered choices
      - Use smartDefault as initialValue if match found
   f. Store result in selections map

3. Return selections map
```

**Critical details**:
- Only `selectorType: "select"` is supported — skip unknown types with `p.log.warn()`
- Category ordering is currently alphabetical (no server metadata for order)
  - **Hardcode category order for now**: `['basics', 'stack', 'database', 'auth', 'architecture', 'testing', 'deployment']`
  - C1 from discovery doc (add ordering metadata to API) is a future vanguard-web enhancement
- Handle `p.isCancel()` for each prompt → call `canceled()`

### 3. Modified: ProjectRegistrationService

**Location**: `src/application/services/project-registration.service.ts`

**Change**: Add optional `selections` field to payload.

```typescript
interface ProjectRegistrationPayload {
  name: string
  type: 'greenfield' | 'brownfield'
  track: 'solo' | 'team' | 'enterprise'
  projectPath: string
  gitRemoteUrl?: string
  defaultBranch?: string
  vanguardConfig: Record<string, unknown>
  selections?: Record<string, string>  // NEW: groupSlug → choiceSlug
}
```

**Notes**:
- Send `selections` only — server derives `vanguardConfig` via `buildVanguardConfigFromSelections()` (see C14)
- Make `vanguardConfig` optional in the payload for backward compat with old CLI versions
- Old CLIs still send `vanguardConfig` → server handles both paths

### 4. Modified: init.ts

**What changes**:
- **New step before prompts**: Fetch init schema from server
- **Replace phases 1-7** with `DynamicPromptRenderer.render(schema, smartDefaults, options)`
- **Keep phase 8** (confirmation summary) — adapt to use selections + schema labels
- **Keep phase 9** (Project.create, register, bundle, etc.) — adapt to pass selections
- **Keep brownfield detection** — runs before dynamic prompts, provides smartDefaults

**New flow**:
```
Auth check → Fetch init schema → Name prompt (hardcoded p.text) →
  Smart detect (brownfield, runs even with -y per C8) →
  Dynamic prompts (server-driven, flags pre-populate per C13) →
  Confirm → Register with selections-only (C14) →
  Fetch bundle → Write local config → MCP → Hooks → Memory
```

**What stays the same**:
- Banner + intro
- Brownfield detection (ProjectDetector) — now runs even with `-y` (C8 fix)
- Bundle fetch, MCP wiring, hook wiring, memory init
- CLI flags: -n, -t, --track, -s, -a, -y, --dev (flags map to selections per C13)

**What's removed**:
- `Project.create()` call (replaced by server-side config derivation, C11/C14)
- Local registry lookups (replaced by server schema)
- Client-side `vanguardConfig` building for registration payload

**Schema fetch failure**: Fail with clear error. No local fallback (C7).

### 5. Modified: getSmartDefaults() + ProjectDetector slug alignment

**Current problem**: `ProjectDetector` returns stackIds like `nextjs-typescript`, `express-typescript`, `fastapi-python`. The server uses slugs like `nextjs-app-router`, `express-typescript`, `fastapi`.

**Slug mismatch table**:

| Detector Returns | Server Choice Slug | Match? |
|-----------------|-------------------|--------|
| `nextjs-typescript` | `nextjs-app-router` | NO |
| `nestjs-typescript` | (not seeded?) | NO |
| `express-typescript` | `express-typescript` | YES |
| `fastapi-python` | `fastapi` | NO |
| `django-python` | `django` | NO |
| `aspnet-csharp` | `aspnet-webapi` | NO |
| `plain-typescript` | `plain-typescript` | YES |
| `plain-python` | `plain-python` | YES |
| `plain-csharp` | `plain-csharp` | YES |

**Options**:
1. **Add slug mapping in CLI** — Map detector slugs to server slugs at detection time
2. **Update seed data** — Change server slugs to match detector (breaking change for web UI)
3. **Add aliases in server** — OptionChoice gains `aliases: string[]` field

**Recommended**: Option 1 — slug mapping in `getSmartDefaults()`. Cheapest, no server changes, maintains backward compat. The mapping is small and static.

```typescript
const DETECTOR_TO_SERVER_SLUG: Record<string, string> = {
  'nextjs-typescript': 'nextjs-app-router',
  'nestjs-typescript': 'nestjs',  // if seeded
  'fastapi-python': 'fastapi',
  'django-python': 'django',
  'flask-python': 'flask',
  'aspnet-csharp': 'aspnet-webapi',
}
```

### 6. Domain Layer: Project.create() Adaptation

**Current**: `Project.create()` takes full typed objects (Stack, OrmConfig, Architecture, etc.) and runs 5 compatibility checks.

**Challenge**: Server-driven flow produces `selections` (string slugs), not typed domain objects. The CLI no longer has local registries to look up full objects.

**Options**:
1. **Keep Project.create() as-is** — Build domain objects from selections + schema metadata. Requires extracting enough info from schema choices to construct Stack, OrmConfig, etc.
2. **Simplify Project.create()** — Accept a lighter "dynamic project" shape that works with slugs instead of full entities.
3. **Skip Project.create() validation** — Trust the server's compatibility filtering entirely. Send selections to server, let server validate.

**Recommended**: Option 3 — skip `Project.create()` entirely (see C11, C14). The server handles config derivation, and the CLI only needs a lightweight client-side config builder for writing `config.yaml` locally.

**What replaces `Project.create()`**:
- Registration payload: sends `selections` only, server builds config (C14)
- Local `config.yaml`: client-side `buildConfigFromSelections()` — minimal port of server's mapping logic
- `generateLocalFiles()`: refactor to accept config object instead of `Project` entity
- Methodology bundle: unaffected (uses `projectId` + `rootPath`, never needed `Project`)
- MCP/hooks/memory: unaffected (use `projectId` and `rootPath`)

**5 compatibility checks dropped**: Server's `compatibleWithSlugs` filtering prevents incompatible selections at prompt time. `Project.create()` safety net is no longer needed.

### 7. Files to Remove (After Stabilization)

| File | Lines | Purpose |
|------|-------|---------|
| `src/presentation/data/stacks/index.ts` | 1,077 | Stack registry |
| `src/presentation/data/architectures/index.ts` | 953 | Architecture registry |
| `src/presentation/data/testing/index.ts` | 431 | Testing framework registry |
| **Total** | **2,461** | Local option registries |

These become dead code once the dynamic flow is stable. Remove in a follow-up PR after the dynamic init has been validated.

---

## Server-Side Prerequisites (vanguard-web)

These are vanguard-web changes needed before or alongside CLI work:

### P1: Fix sourceScope Hardcoding (Bug)
**File**: `src/app/api/projects/register/route.ts` ~line 204
**Problem**: All ProjectSelection rows get `sourceScope: 'system'` and `sourceOrgId: null`, even for org-scoped choices.
**Fix**: Look up the choice's orgId and derive scope from it.

### P2: Category Ordering Metadata (Enhancement, Deferred)
**File**: `src/app/api/agent-framework/init-schema/route.ts`
**Problem**: Categories are alphabetical in JSON keys. No ordering metadata.
**Current workaround**: CLI hardcodes category order.
**Future fix**: Add `categorySequence` or return categories as ordered array instead of Record.

---

## Dependency & Compatibility Concerns

### Backward Compatibility
- Old CLIs send `vanguardConfig` only → Server handles this (existing path)
- New CLIs send `vanguardConfig` + `selections` → Server uses `vanguardConfig`, stores `selections`
- Future CLIs send `selections` only → Server derives config via `buildVanguardConfigFromSelections()`

### Version Skew
- CLI must handle older servers that don't have `/api/agent-framework/init-schema`
  - Detect via 404 response → fail with "Server update required" message
  - This is consistent with C7 (require server connectivity)

### Config Immutability
- Server's register endpoint: existing projects return existing config without overwriting
- No risk of init re-running and corrupting existing project state

---

## Summary: What to Build

| # | Component | Type | Complexity | Dependencies |
|---|-----------|------|-----------|-------------|
| 1 | `InitSchemaService` | New service | Low | Server API |
| 2 | `InitSchemaAdapter` | New infra adapter | Low | HTTP/auth |
| 3 | `DynamicPromptRenderer` | New presentation component | Medium | @clack/prompts, schema types |
| 4 | `ProjectRegistrationPayload` update | Modify interface | Low | None |
| 5 | `init.ts` refactor | Major rewrite of phases 1-8 | High | Items 1-4 |
| 6 | Smart defaults slug mapping | Modify `getSmartDefaults()` | Low | Server slug alignment |
| 7 | `buildConfigFromSelections()` | New client-side mapper | Low | Minimal port from server |
| 8 | Refactor `generateLocalFiles()` | Modify generator service | Low | Accept config instead of Project |
| 9 | Fix `-y` smart detection bug (C8) | Bug fix in init.ts | Low | Part of item 5 |
| 10 | Fix `--architecture` flag bug (C9) | Bug fix in init.ts | Low | Part of item 5 |
| 11 | Fix sourceScope bug (vanguard-web) | Server-side fix | Low | None |
| 12 | Remove local registries | Cleanup | Low | After stabilization |

**Estimated new code**: ~350-450 lines (service + adapter + renderer + types + config mapper)
**Estimated removed code**: ~700 lines from init.ts (phases 1-7 + Project.create path), ~2,461 lines registries (deferred)
**Net effect**: Significant reduction in CLI codebase, single source of truth for options, two bug fixes included

---

## Clarifications (Resolved 2026-03-20)

### C8: `-y` Flag Must Run Smart Detection — Fix Existing Bug
**Ambiguity**: The current code at `init.ts:288` has `projectBasics.type === 'brownfield' && !options.yes`, meaning `-y` **skips** brownfield smart detection entirely. A Python project with `-y` would be configured as TypeScript. This contradicts C5 (discovery doc) which says "use brownfield smart detection first."

**Resolution**: **Fix this.** Run `ProjectDetector` even when `-y` is set. Use detected values as selections, fall back to first compatible choice when no detection match. The `-y` flag means "don't prompt, auto-select" — not "ignore what's on disk."

**Impact**: Changes brownfield detection guard from `&& !options.yes` to just checking `projectBasics.type === 'brownfield'`. Smart defaults become the basis for auto-selection with `-y`.

### C9: `--architecture` Flag Bug — Fix in This PR
**Ambiguity**: The `--architecture` flag at `init.ts:507-509` checks truthiness but ignores the actual value. Code: `(options.architecture ?? options.yes) ? compatibleArchitectures[0]?.id.toString() : ...` — the user's passed arch ID is discarded, always selecting the first compatible architecture.

**Resolution**: **Fix in this PR.** Since we're rewriting the prompt flow, fix the flag to actually match the passed value against server choice slugs. If the slug doesn't exist in the schema, warn and fall through to prompting.

### C10: Project Name — Hardcoded CLI Prompt
**Ambiguity**: Project name is a free-text input (`p.text()`). No "project-name" group exists in the server seed data. The schema only supports `selectorType: "select"`. Text input support is explicitly deferred in the vanguard-web spec.

**Resolution**: **Keep name as a hardcoded `p.text()` prompt in init.ts.** Name is prompted before the dynamic loop starts. The flow becomes:
```
Auth → Fetch schema → Name prompt (hardcoded) → Dynamic groups (server-driven) → Confirm → Register
```
Project-type and track ARE available as server groups (seeded in `basics` category) and should be rendered dynamically.

### C11: Local Fallback — Client-Side Config Building
**Ambiguity**: `generateLocalFiles()` needs a full `Project` entity (for `toConfig()` and `getVanguardPath()`). The dynamic flow only produces selection slugs. The server bundle replaces local generation when available.

**Resolution**: **Port `buildVanguardConfigFromSelections()` mapping logic to CLI.** Use it to build a lightweight config for local `config.yaml` file writing. Skip `Project.create()` entirely — the server's `compatibleWithSlugs` filtering replaces the domain entity's 5 compatibility checks.

**What this means for the codebase**:
- `Project.create()` is NOT called in the dynamic flow
- `project.toConfig()` is replaced by client-side `buildConfigFromSelections()`
- `generateLocalFiles()` needs refactoring to accept a config object instead of a `Project` entity
- Methodology install (`methodologyService.install(projectId, rootPath)`) is unaffected — it never needed `Project`
- MCP wiring, hook wiring, memory init are also unaffected — they use `projectId` and `rootPath`, not `Project`

### C12: 'None' Choices — Treat Equally
**Ambiguity**: Several groups (ORM, auth, frontend) have `none` as a choice. When `-y` auto-selects the first compatible choice, should `none` be skipped?

**Resolution**: **Treat `none` equally.** If it's the first compatible choice (by sequence), select it. The server controls choice ordering via `sequence` numbers. If the server wants a non-none default, it can sequence `none` last. No special-casing in the CLI.

### C13: CLI Flags — Map to Selections
**Ambiguity**: `--stack` and `--architecture` flags currently do registry lookups. In the dynamic flow, there are no registries to look up from.

**Resolution**: **Map flags to pre-populated selections.** If `--stack=nextjs-app-router` is passed:
1. Validate the slug exists in the fetched schema's choices
2. If valid → `selections['stack'] = 'nextjs-app-router'`, skip that group's prompt
3. If invalid → warn and fall through to interactive prompt

Same logic for `--architecture`. This preserves the CLI interface contract while working with server slugs.

### C14: Registration Payload — Selections-Only
**Ambiguity**: Requirements doc said send both `vanguardConfig` + `selections`. But building `vanguardConfig` client-side requires porting `buildVanguardConfigFromSelections()`.

**Resolution**: **Send `selections` only.** The server already has `buildVanguardConfigFromSelections()` to derive the config. No need to duplicate that mapping logic in the CLI. Cleaner separation of concerns.

**What this changes**:
- `ProjectRegistrationPayload.vanguardConfig` becomes optional (not required)
- New CLI sends: `{ name, type, track, projectPath, gitRemoteUrl?, defaultBranch?, selections }`
- Server derives `vanguardConfig` from `selections` via its existing bridge function
- Old CLIs still send `vanguardConfig` → server handles both paths already

### C14 Implication for C11
Since we're sending selections-only to the server (C14), the client-side config building from C11 is only needed for writing the local `config.yaml` file. This is a minimal mapping — just enough for the manifest and config generators.

---

### Clarification Summary Table

| # | Ambiguity | Resolution | Impact |
|---|-----------|-----------|--------|
| C8 | `-y` skips smart detection | Fix: always run detector for brownfield | Bug fix, smarter `-y` defaults |
| C9 | `--architecture` flag ignores value | Fix: match against server choice slugs | Bug fix in this PR |
| C10 | Project name not a server group | Keep as hardcoded `p.text()` prompt | Name before dynamic loop |
| C11 | Local gen needs full Project entity | Port config builder, skip Project.create() | Refactor generators |
| C12 | 'none' choice handling with `-y` | Treat equally, server controls sequence | No special-casing |
| C13 | CLI flags with no local registries | Map flags to pre-populated selections | Validates against schema |
| C14 | Registration payload content | Send selections-only, server builds config | Simpler payload, no duplication |

---

_Requirements assessment completed by Analyst agent. Clarifications C8-C14 resolved. Ready for specification phase (`/vanguard.specify`)._

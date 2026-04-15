# Technical Plan: Dynamic Init Options

**Status**: draft
**Date**: 2026-03-20
**Specification**: [dynamic-init-options.md](../specs/dynamic-init-options.md)
**Requirements**: [requirements-dynamic-init.md](../specs/requirements-dynamic-init.md)

## Architecture Alignment

This plan follows **MVC with Interactors** principles (adapted to this codebase's UseCase convention):

1. Controllers are thin — delegate to use cases / services
2. Each use case handles one operation
3. Services are stateless and composed via constructor injection of ports
4. Models contain data and validation
5. Views (presentation layer) are presentational only

**Composition root**: `init.ts` (presentation layer) instantiates infrastructure adapters and passes them to application services/use cases. No DI container.

---

## File Structure

```
src/
├── application/
│   ├── ports/
│   │   └── init-schema-api-client.ts          # NEW: port interface
│   └── services/
│       ├── init-schema.service.ts             # NEW: orchestrates schema fetch
│       ├── project-registration.service.ts    # MODIFIED: selections field
│       ├── vanguard-generator.service.ts      # MODIFIED: accept config object
│       └── manifest-generator.service.ts      # MODIFIED: accept config object
├── infrastructure/
│   └── api/
│       └── init-schema.adapter.ts             # NEW: HTTP adapter
├── presentation/
│   ├── cli/
│   │   ├── commands/
│   │   │   └── init.ts                        # MAJOR REWRITE
│   │   └── prompts/
│   │       └── dynamic-prompt-renderer.ts     # NEW: schema → prompts
│   └── data/
│       ├── stacks/index.ts                    # UNCHANGED (deferred removal)
│       ├── architectures/index.ts             # UNCHANGED (deferred removal)
│       └── testing/index.ts                   # UNCHANGED (deferred removal)
└── domain/
    └── (no changes)
```

---

## Component Design

### 1. InitSchemaApiClient (Port Interface)

**Layer**: Application (Port)
**File**: `src/application/ports/init-schema-api-client.ts`
**Responsibility**: Define the contract for fetching the init option schema from the server.

```typescript
// --- Data types ---

export interface InitSchemaChoice {
  readonly slug: string
  readonly label: string
  readonly description: string | null
  readonly icon: string | null
  readonly sequence: number
  readonly compatibleWithSlugs: readonly string[]
  readonly metadata: Record<string, unknown> | null
  readonly orgId: string | null
  readonly isBuiltIn: boolean
}

export interface InitSchemaGroup {
  readonly slug: string
  readonly name: string
  readonly description: string | null
  readonly selectorType: string
  readonly required: boolean
  readonly dependsOnGroupSlug: string | null
  readonly choices: readonly InitSchemaChoice[]
}

export interface InitSchema {
  readonly categories: Readonly<Record<string, readonly InitSchemaGroup[]>>
}

// --- Port interface ---

export interface InitSchemaApiClient {
  fetch(): Promise<InitSchema>
}
```

**Design decisions**:
- Types use `readonly` throughout (immutable data from server)
- `compatibleWithSlugs` is `readonly string[]` not `string[]`
- No category ordering metadata — categories are Record keys (C1: deferred)

---

### 2. InitSchemaAdapter (Infrastructure)

**Layer**: Infrastructure
**File**: `src/infrastructure/api/init-schema.adapter.ts`
**Responsibility**: HTTP implementation of `InitSchemaApiClient`.
**Pattern**: Follows `MethodologyBundleAdapter` exactly.

```typescript
import { authRepository } from '../repositories/auth.repository.js'
import type { InitSchema, InitSchemaApiClient } from '../../application/ports/init-schema-api-client.js'

export class InitSchemaApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message)
    this.name = 'InitSchemaApiError'
  }
}

export class InitSchemaAdapter implements InitSchemaApiClient {
  private readonly clientVersion: string

  constructor(clientVersion = '0.1.0') {
    this.clientVersion = clientVersion
  }

  async fetch(): Promise<InitSchema> {
    const { endpoint, token } = await this.getAuthContext()

    const response = await fetch(`${endpoint}/api/agent-framework/init-schema`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `vanguard-cli/${this.clientVersion}`,
      },
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new InitSchemaApiError(
        data.errorDescription || data.error || `Failed to fetch init schema (${response.status})`,
        response.status,
      )
    }

    const data = await response.json()
    return data as InitSchema
  }

  private async getAuthContext(): Promise<{ endpoint: string; token: string }> {
    const token = await authRepository.getAccessToken()
    const endpoint = await authRepository.getApiEndpoint()
    if (!token || !endpoint) {
      throw new InitSchemaApiError('Not authenticated. Run `vanguard login` first.')
    }
    return { endpoint: endpoint.replace(/\/$/, ''), token }
  }
}
```

**Design decisions**:
- Custom error class with `statusCode` (matches existing pattern)
- Auth via singleton `authRepository` (matches existing pattern)
- No response transformation — server shape matches `InitSchema` directly
- No caching (init runs once per project)

---

### 3. InitSchemaService (Application Service)

**Layer**: Application
**File**: `src/application/services/init-schema.service.ts`
**Responsibility**: Fetch schema and provide helper methods. Thin wrapper for now — room to grow.

```typescript
import type { InitSchema, InitSchemaApiClient, InitSchemaGroup } from '../ports/init-schema-api-client.js'

/** Canonical category display order (C1: hardcoded until server provides ordering) */
const CATEGORY_ORDER = ['basics', 'stack', 'database', 'auth', 'architecture', 'testing', 'deployment']

export class InitSchemaService {
  constructor(private readonly apiClient: InitSchemaApiClient) {}

  async fetch(): Promise<InitSchema> {
    return this.apiClient.fetch()
  }

  /**
   * Flatten categories into an ordered group list.
   * Categories follow CATEGORY_ORDER; unknown categories are appended alphabetically.
   * Within each category, groups are already ordered by sequence from the server.
   */
  getOrderedGroups(schema: InitSchema): readonly InitSchemaGroup[] {
    const groups: InitSchemaGroup[] = []
    const seen = new Set<string>()

    // Known categories in order
    for (const category of CATEGORY_ORDER) {
      if (schema.categories[category]) {
        groups.push(...schema.categories[category])
        seen.add(category)
      }
    }

    // Unknown categories appended alphabetically
    for (const category of Object.keys(schema.categories).sort()) {
      if (!seen.has(category)) {
        groups.push(...schema.categories[category])
      }
    }

    return groups
  }
}
```

**Design decisions**:
- Constructor injection of port (matches existing pattern)
- `CATEGORY_ORDER` is a module-level constant, not configurable (C1)
- `getOrderedGroups()` handles unknown categories gracefully (forward-compat)
- Service is thin — no business logic beyond ordering

---

### 4. DynamicPromptRenderer (Presentation)

**Layer**: Presentation
**File**: `src/presentation/cli/prompts/dynamic-prompt-renderer.ts`
**Responsibility**: Core algorithm — iterate schema groups, evaluate deps, filter choices, render @clack/prompts or auto-select.

```typescript
import * as p from '@clack/prompts'
import type { InitSchemaChoice, InitSchemaGroup } from '../../../application/ports/init-schema-api-client.js'

export interface SmartDefaults {
  readonly [groupSlug: string]: string  // groupSlug → detected choice slug
}

export interface PromptOptions {
  readonly yes: boolean           // -y flag
  readonly flagOverrides: Readonly<Record<string, string>>  // --stack, --architecture, etc.
}

export interface SelectionEntry {
  readonly groupSlug: string
  readonly choiceSlug: string
  readonly groupName: string      // for confirmation display
  readonly choiceLabel: string    // for confirmation display
}

export interface PromptResult {
  readonly selections: Readonly<Record<string, string>>  // groupSlug → choiceSlug
  readonly entries: readonly SelectionEntry[]             // ordered, with display labels
}

export class DynamicPromptRenderer {
  /**
   * Render dynamic prompts for the given ordered groups.
   *
   * Algorithm (per group):
   * 1. Check dependsOnGroupSlug — skip if parent not selected
   * 2. Filter choices by compatibleWithSlugs against all selected slugs
   * 3. Skip group if zero compatible choices or unknown selectorType
   * 4. If flag override exists and is valid → use it
   * 5. If -y → auto-select (smart default or first compatible)
   * 6. Otherwise → render p.select()
   */
  async render(
    groups: readonly InitSchemaGroup[],
    smartDefaults: SmartDefaults,
    options: PromptOptions,
    onCancel: () => never,
  ): Promise<PromptResult> {
    // ... implementation
  }
}
```

**Design decisions**:
- Returns `PromptResult` with both the selections map AND ordered entries with labels (for confirmation display — avoids re-traversing the schema)
- `SmartDefaults` is a generic `Record<string, string>` keyed by groupSlug (not the current `SmartDefaults` interface which is field-specific)
- `onCancel` callback injected (matches existing `canceled()` pattern in init.ts)
- Pure presentation — no domain dependencies, no infrastructure imports
- No state — a new instance per init run

**Filtering algorithm**:

```
getCompatibleChoices(group, allSelectedSlugs):
  allSelected = Set of all previously selected choice slugs

  return group.choices.filter(choice =>
    choice.compatibleWithSlugs.length === 0     // empty = always compatible
    || choice.compatibleWithSlugs.some(s => allSelected.has(s))
  )
```

**Auto-selection algorithm (-y)**:

```
autoSelect(group, compatibleChoices, smartDefaults):
  if group.required === false → skip (return null)
  if smartDefaults[group.slug] matches a compatible choice → select it
  else → select compatibleChoices[0]
```

---

### 5. ProjectRegistrationService (Modified)

**Layer**: Application
**File**: `src/application/services/project-registration.service.ts`
**Change**: Add optional `selections` field, make `vanguardConfig` optional.

```typescript
export interface ProjectRegistrationPayload {
  name: string
  type: 'greenfield' | 'brownfield'
  track: 'solo' | 'team' | 'enterprise'
  projectPath: string
  gitRemoteUrl?: string | undefined
  defaultBranch?: string | undefined
  vanguardConfig?: Record<string, unknown>       // CHANGED: now optional
  selections?: Record<string, string> | undefined // NEW
}
```

**Design decisions**:
- `vanguardConfig` becomes optional (was required). New CLI sends `selections` only (C14)
- Old callers still pass `vanguardConfig` — no breaking change to the interface
- `register()` method body is unchanged — it just serializes the payload to JSON

---

### 6. VanguardGeneratorService & ManifestGeneratorService (Modified)

**Layer**: Application
**File**: `src/application/services/vanguard-generator.service.ts`, `manifest-generator.service.ts`
**Change**: Add overloads that accept a lightweight config instead of a full `Project` entity.

```typescript
// New interface for the lightweight config path
export interface ProjectSummary {
  readonly name: string
  readonly type: 'greenfield' | 'brownfield'
  readonly track: 'solo' | 'team' | 'enterprise'
  readonly rootPath: string
  readonly selections: Readonly<Record<string, string>>
}

// ConfigGeneratorService: new method
generateFromSelections(summary: ProjectSummary): GeneratedFile {
  // Build a minimal config.yaml from selections
  // Uses a client-side buildConfigFromSelections() function
}

// ManifestGeneratorService: new method
generateFromSummary(summary: ProjectSummary): GeneratedFile {
  // Only needs name, type, track, rootPath — same as before
}

// VanguardGeneratorService: new method
generateLocalFilesFromSelections(summary: ProjectSummary): GeneratedFile[] {
  return [
    this.manifestGenerator.generateFromSummary(summary),
    this.configGenerator.generateFromSelections(summary),
  ]
}
```

**Design decisions**:
- Existing `generate(project: Project)` methods are PRESERVED (backward compat)
- New overloads accept `ProjectSummary` — a plain data object, not a domain entity
- `buildConfigFromSelections()` is a standalone function (not a service method) that maps selection slugs to a config YAML shape. This is a minimal port of the server's `buildVanguardConfigFromSelections()`.

---

### 7. init.ts (Major Rewrite)

**Layer**: Presentation (Controller)
**File**: `src/presentation/cli/commands/init.ts`
**Change**: Replace phases 1-7 with dynamic flow, keep phases 8-9 adapted.

**New composition**:

```typescript
// New imports
import { InitSchemaService } from '../../../application/services/init-schema.service.js'
import { InitSchemaAdapter } from '../../../infrastructure/api/init-schema.adapter.js'
import { DynamicPromptRenderer } from '../prompts/dynamic-prompt-renderer.js'

// Inside .action():

// 1. Fetch schema (NEW)
const schemaService = new InitSchemaService(new InitSchemaAdapter(cliVersion))
const schema = await schemaService.fetch()  // throws on failure (FR-012)
const orderedGroups = schemaService.getOrderedGroups(schema)

// 2. Project name (KEPT — hardcoded p.text(), C10)
const projectName = options.yes ? (options.name ?? defaultProjectName) : await p.text({...})

// 3. Smart detection (FIXED — runs even with -y, C8)
let smartDefaults: SmartDefaults = {}
if (detectedProjectType === 'brownfield') {  // removed: && !options.yes
  const detector = new ProjectDetector()
  const detected = detector.detect(rootPath)
  smartDefaults = mapDetectedToServerSlugs(detected)
}

// 4. Dynamic prompts (NEW — replaces phases 1-7)
const flagOverrides = buildFlagOverrides(options)  // maps --stack, --architecture to slugs
const renderer = new DynamicPromptRenderer()
const promptResult = await renderer.render(orderedGroups, smartDefaults, {
  yes: !!options.yes,
  flagOverrides,
}, canceled)

// 5. Confirmation (ADAPTED — uses promptResult.entries for labels)
const summaryLines = promptResult.entries.map(e => `${pc.bold(e.groupName)}: ${e.choiceLabel}`)
p.note([`${pc.bold('Project')}: ${projectName}`, ...summaryLines].join('\n'), 'Configuration')

// 6. Register (ADAPTED — sends selections-only, C14)
const result = await registrationService.register({
  name: projectName,
  type: promptResult.selections['project-type'] as ProjectType,
  track: promptResult.selections['track'] as Track,
  projectPath: rootPath,
  gitRemoteUrl: gitService.getRemoteUrl(),
  defaultBranch: gitService.getDefaultBranch(),
  selections: promptResult.selections,  // NEW: selections-only
})

// 7. Bundle fetch (REQUIRED — no fallback, C17)
//    On failure → error message + exit non-zero
// 8. Generate local files only (generateLocalFilesFromSelections)
// 9. MCP, hooks, memory (UNCHANGED)
```

**What's removed from init.ts**:
- All registry imports and usage (`stackRegistry`, `architectureRegistry`, `testingRegistry`)
- `SmartDefaults` interface (replaced by generic `Record<string, string>`)
- `getSmartDefaults()` function (replaced by `mapDetectedToServerSlugs()`)
- Phases 1-7 inline prompts (~450 lines)
- `Project.create()` call and all domain entity construction
- `project.toConfig()` for registration payload
- `if (authStatus.authenticated)` guard around registration (C15 — `requireAuth()` guarantees auth)
- `generateAll(project)` fallback path (C17 — bundle is now required)

**What's added**:
- Schema fetch + error handling (~15 lines)
- Composition of new services (~10 lines)
- `mapDetectedToServerSlugs()` helper function (~20 lines)
- `buildFlagOverrides()` helper function (~10 lines)

---

## Data Model

No new domain entities or value objects. This feature works entirely with:
- **Port types**: `InitSchema`, `InitSchemaGroup`, `InitSchemaChoice` (read-only DTOs from server)
- **Presentation types**: `PromptResult`, `SelectionEntry`, `SmartDefaults` (renderer I/O)
- **Application types**: `ProjectSummary` (lightweight config for generators)

**Rationale**: The server owns the data model (OptionGroup, OptionChoice, etc.). The CLI consumes it as DTOs through the port interface. No need to create domain entities for data we don't own or mutate.

---

## API Contracts

### Consumed: GET /api/agent-framework/init-schema

- **Existing endpoint** — no changes needed
- **Request**: `Authorization: Bearer {token}`
- **Response**: `{ categories: Record<string, InitSchemaGroup[]> }`
- **Error cases**: 401 (unauthenticated), 404 (old server), 500 (server error)

### Consumed: POST /api/projects/register

- **Existing endpoint** — already accepts `selections` field
- **Change in CLI usage**: Send `selections` instead of `vanguardConfig`
- **Request body change**:
  ```diff
  {
    name, type, track, projectPath, gitRemoteUrl?, defaultBranch?,
  - vanguardConfig: { ... }
  + selections: { "language": "typescript", "stack": "nextjs-app-router", ... }
  }
  ```

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Port/adapter for schema API | `InitSchemaApiClient` port + `InitSchemaAdapter` | Follows existing `MethodologyBundleApiClient` pattern exactly |
| Prompt renderer in presentation layer | `DynamicPromptRenderer` in `src/presentation/cli/prompts/` | @clack/prompts is a presentation concern. Keeps algorithm testable (inject mock prompts) |
| No DI container | Manual composition in init.ts | Matches existing codebase pattern. Only 3 new instances to wire |
| Lightweight config builder | `buildConfigFromSelections()` standalone function | Minimal port of server logic for local config.yaml only. Not a service |
| Skip Project.create() | Trust server compatibility + send selections | C11/C14: server validates and derives config. CLI doesn't need full domain entities |
| Preserve existing methods | Add new overloads to generators, don't modify existing | Other code paths may still use `generate(project: Project)` |
| Require methodology bundle | Fail init if bundle fetch fails (C17) | Server is already required for schema. No value in local-only generation without methodology |
| Remove auth guard redundancy | Drop `if (authStatus.authenticated)` around registration (C15) | `requireAuth()` at top of action already guarantees auth. Simplifies flow |
| Replicate server config builder exactly | Match `buildVanguardConfigFromSelections()` including frontend 'none' skip (C20) | Ensures local config.yaml matches server-derived config |

---

## Implementation Phases

### Phase 1: Foundation (Port + Adapter + Service)
- [ ] Create `InitSchemaApiClient` port interface with types
- [ ] Create `InitSchemaAdapter` infrastructure adapter
- [ ] Create `InitSchemaService` with `getOrderedGroups()`
- [ ] Add port to `src/application/ports/index.ts` barrel export
- [ ] Unit test: `InitSchemaService.getOrderedGroups()` ordering logic

### Phase 2: Dynamic Prompt Renderer
- [ ] Create `DynamicPromptRenderer` class
- [ ] Implement dependency evaluation (`dependsOnGroupSlug` check)
- [ ] Implement compatibility filtering (`compatibleWithSlugs` check)
- [ ] Implement auto-selection algorithm (-y flag + smart defaults)
- [ ] Implement flag override handling (--stack, --architecture)
- [ ] Implement unknown selectorType skip with warning
- [ ] Implement zero-compatible-choices skip
- [ ] Unit test: dependency evaluation
- [ ] Unit test: compatibility filtering (empty array, matching, no match)
- [ ] Unit test: auto-selection with and without smart defaults
- [ ] Unit test: flag overrides (valid slug, invalid slug)

### Phase 3: Registration + Generator Updates
- [ ] Modify `ProjectRegistrationPayload`: `vanguardConfig` optional, add `selections`
- [ ] Create `ProjectSummary` interface
- [ ] Create `buildConfigFromSelections()` function
- [ ] Add `generateFromSelections()` to `ConfigGeneratorService`
- [ ] Add `generateFromSummary()` to `ManifestGeneratorService`
- [ ] Add `generateLocalFilesFromSelections()` to `VanguardGeneratorService`
- [ ] Unit test: `buildConfigFromSelections()` mapping

### Phase 4: init.ts Rewrite
- [ ] Add schema fetch step with error handling
- [ ] Create `mapDetectedToServerSlugs()` helper
- [ ] Create `buildFlagOverrides()` helper
- [ ] Fix brownfield detection guard (remove `&& !options.yes` — C8)
- [ ] Fix `--architecture` flag to use actual value (C9)
- [ ] Replace phases 1-7 with `DynamicPromptRenderer.render()`
- [ ] Adapt confirmation summary to use `PromptResult.entries`
- [ ] Remove `if (authStatus.authenticated)` guard; compose registrationService at top level (C15/C16)
- [ ] Adapt registration call to send `selections` only
- [ ] Make methodology bundle fetch required; fail with error if unavailable (C17)
- [ ] Remove `generateAll(project)` fallback path (C17)
- [ ] Adapt local file generation to use `generateLocalFilesFromSelections()`
- [ ] Remove unused imports (domain entities, registries) — but keep registry files
- [ ] Integration test: full init flow with mocked schema API

### Phase 5: Cleanup (Follow-up PR)
- [ ] Remove `src/presentation/data/stacks/index.ts` (1,077 lines)
- [ ] Remove `src/presentation/data/architectures/index.ts` (953 lines)
- [ ] Remove `src/presentation/data/testing/index.ts` (431 lines)
- [ ] Remove unused domain entity imports from init.ts
- [ ] Remove old `SmartDefaults` interface and `getSmartDefaults()` function

---

## Testing Strategy

### Unit Tests

| Component | What to Test |
|-----------|-------------|
| `InitSchemaService.getOrderedGroups()` | Known categories in order, unknown categories appended, empty schema |
| `DynamicPromptRenderer` (core algorithm) | Dependency skip, compatibility filter (empty/match/no-match), -y auto-select with/without defaults, flag overrides valid/invalid, unknown selectorType skip, zero choices skip, required vs optional with -y |
| `buildConfigFromSelections()` | Each group mapping (language, stack, orm, database, auth, testing, deployment, architecture, frontend), missing keys, edge cases |
| `mapDetectedToServerSlugs()` | Each known mapping, unknown detector values pass through, null/undefined handling |

### Integration Tests

| Scenario | What to Test |
|----------|-------------|
| Full init with mock schema API | Schema fetch → prompts → register → bundle → files |
| Init with -y and brownfield detection | Smart detection runs, correct auto-selections |
| Init with --stack flag | Flag pre-populates, downstream filtering works |
| Schema fetch failure | Error message displayed, exit code 1 |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Server schema shape changes | CLI breaks on unexpected response | Pin to known shape via port types. Adapter validates minimally. Version header allows server to respond appropriately |
| Slug mapping table drifts | Brownfield detection suggests wrong values | Log a warning when a detected slug has no server match. Mapping is small and auditable |
| Removing Project.create() loses validation | Incompatible selections reach the server | Server's `compatibleWithSlugs` filtering prevents this at prompt time. Server also validates during registration |
| Local config.yaml format drifts from server's | Methodology bundle expects different config shape | Local config is only used for `vanguard.manifest.yaml` and `.vanguard/config.yaml` — not for bundle rendering. Drift risk is low |
| Registry removal breaks unknown consumers | Build breaks | Phase 5 deferred. Grep confirms only init.ts imports registries |
| Methodology bundle unavailable after successful schema fetch | Init cannot complete (C17) | Fail with clear error message directing user to check server status. Registration already succeeded so project exists server-side; user can retry init |
| `buildConfigFromSelections()` mapping tables drift from server | Local config.yaml diverges from server-derived config | Mapping tables are a snapshot of server's `build-vanguard-config-from-selections.ts`. Document source version. Low-frequency change |

---

## ADR: Drop Project.create() from Dynamic Init

**Context**: `Project.create()` constructs a full domain aggregate from typed entities (Stack, Architecture, etc.) and runs 5 compatibility checks. In the dynamic flow, the CLI has selection slugs, not full entities.

**Decision**: Skip `Project.create()` in the dynamic flow. Send selections to the server. Use `ProjectSummary` (plain data object) for local file generation.

**Rationale**:
1. Server's `compatibleWithSlugs` filtering prevents incompatible selections at prompt time
2. Server's `buildVanguardConfigFromSelections()` derives the full config
3. Reconstructing full domain entities from slugs would require either keeping local registries or adding a "hydrate from schema" step — both add complexity without value
4. `Project.create()` and the full entity remain available for any future use case that needs them

**Consequences**:
- Local `config.yaml` will have a simpler structure (selections-based, not entity-based)
- The 5 compatibility checks no longer run client-side (server handles this)
- `generateAgentContext()` and `getFewShotExamples()` methods on `Project` are not used in this flow (they're only relevant for local-only generation, which the methodology bundle replaces)

---

_Technical plan completed by Architect agent._
_Architecture: MVC with Interactors (UseCase convention)_
_Generated by Vanguard for vanguard-cli_

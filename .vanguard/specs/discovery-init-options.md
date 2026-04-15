# Discovery: Init Options Feature (vanguard-web) & CLI Integration

**Status**: complete
**Date**: 2026-03-20
**Scope**: Cross-repository analysis — vanguard-web feature discovery + vanguard-cli impact assessment

---

## Executive Summary

The vanguard-web codebase has a **fully implemented** "Init Options" feature that replaces the CLI's hardcoded init prompts with a server-driven, configurable question/answer system. The feature is built as a sub-module of the Agent Framework and introduces 4 new database models, a management UI, an API endpoint for the CLI, and enhanced project registration. **The CLI has not yet been updated to consume this feature.**

---

## What Was Built in vanguard-web

### Data Model (4 entities)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **OptionGroup** | Defines a question (e.g., "Language", "Stack") | slug, name, category, selectorType, required, dependsOnGroupSlug, orgId, isBuiltIn |
| **OptionChoice** | Defines an answer option (e.g., "TypeScript", "Next.js") | slug, label, description, icon, compatibleWithSlugs, metadata, orgId, isBuiltIn |
| **OptionContentBlock** | Template fragment injected into generated files | target, section, content, sequence |
| **ProjectSelection** | Records a project's init choices | projectId, groupSlug, choiceSlug, sourceScope |

### Entity Hierarchy

```
OptionGroup (question)
  └── OptionChoice (answer)
       └── OptionContentBlock (content injection)

ProjectSelection (records what was chosen per project)
```

### Content Block Targets

Each choice can inject template content into 5 rendering targets:

| Target | Description | Example Sections |
|--------|-------------|-----------------|
| `constitution` | Project constitution document | technical-stack, quality-standards, code-quality, security, governance |
| `claude-md` | CLAUDE.md context file | commands, project-context, important-files |
| `agent` | Agent definition files | responsibilities, focus, avoids |
| `action-skill` | Action/skill definitions | instructions, context |
| `scaffold-config` | Project scaffold configuration | config, structure |

Content blocks support **Liquid template syntax** with variables like `{{ language }}`, `{{ stack }}`, `{{ orm }}`, `{{ database }}`.

### Scoping Model (3-tier)

| Scope | orgId | Who Can Manage | Visibility |
|-------|-------|---------------|------------|
| **System** | null | Super admins | All organizations |
| **Org** | set | Org admins (AGENT_FRAMEWORK_EDIT) | Same org only |
| **Project** | N/A | Not supported for init options | — |

Queries always return `system + matching org` entries. Built-in items cannot be deleted.

### Dependency System

Groups can declare `dependsOnGroupSlug` creating conditional display chains:

```
project-type → (no dependency)
track → (no dependency)
language → (no dependency)
stack → depends on "language"
orm → depends on "language"
database → depends on "orm"
auth-strategy → depends on "stack"
architecture → depends on "stack"
unit-test → depends on "language"
linter → depends on "language"
formatter → depends on "language"
e2e-test → depends on "language"
frontend → depends on "stack"
```

Circular dependency detection is enforced server-side.

### Compatibility Filtering

Choices declare `compatibleWithSlugs` to filter based on ALL previously-selected slugs across any group:

- `prisma` ORM → compatible with `["typescript"]`
- `nextjs-app-router` stack → compatible with `["typescript"]`
- `fastapi` stack → compatible with `["python"]`
- `vitest` unit-test → compatible with `["typescript"]`

---

## Seeded Data (14 groups)

The seed script (`scripts/seed-option-groups.ts`, 985 lines) pre-populates all system-level groups:

| Category | Groups |
|----------|--------|
| **basics** | project-type, track |
| **stack** | language, stack |
| **database** | orm, database |
| **auth** | auth-strategy |
| **architecture** | architecture, frontend |
| **testing** | unit-test, linter, formatter, e2e-test |
| **deployment** | deploy-target |

Languages: TypeScript, Python, C#, Ruby
Stacks: Next.js, Express, FastAPI, Django, ASP.NET, Rails, Plain variants
ORMs: Prisma, Drizzle, TypeORM, SQLAlchemy, Tortoise, Django ORM, EF Core, Dapper, Active Record
Databases: PostgreSQL, MySQL, MongoDB, SQLite, SQL Server, Redis, DynamoDB

---

## API Endpoints

### GET /api/agent-framework/init-schema

Returns the complete option tree organized by category. CLI authenticates with its token, receives all system + org-scoped groups with their choices. Response shape:

```json
{
  "categories": {
    "basics": [
      {
        "slug": "project-type",
        "name": "Project Type",
        "selectorType": "select",
        "required": true,
        "dependsOnGroupSlug": null,
        "choices": [
          { "slug": "greenfield", "label": "Greenfield", "description": "...", "compatibleWithSlugs": [] }
        ]
      }
    ],
    "stack": [...],
    "database": [...],
    "auth": [...],
    "testing": [...],
    "deployment": [...]
  }
}
```

### POST /api/projects/register (enhanced)

Now accepts an optional `selections` field alongside legacy `vanguardConfig`:

```typescript
{
  name: string;
  type: 'greenfield' | 'brownfield';
  track: 'solo' | 'team' | 'enterprise';
  projectPath: string;
  selections?: Record<string, string>;  // NEW: groupSlug → choiceSlug
  vanguardConfig?: Record<string, unknown>;  // LEGACY: still supported
}
```

Processing logic:
1. If `vanguardConfig` is provided, use it directly (legacy path)
2. If only `selections` provided, call `buildVanguardConfigFromSelections()` to derive config
3. Create `ProjectSelection` rows to track individual choices
4. Store resolved config on project record

---

## Web UI Implementation

### Management Pages

- **List page**: `/agent-framework/init-options/` — Card grid organized by category with scope badges, choice counts, and dependency indicators
- **Detail page**: `/agent-framework/init-options/[slug]` — Full CRUD for a single group: edit metadata, manage choices, manage content blocks per choice

### Components (6 total)

| Component | Purpose |
|-----------|---------|
| `InitOptionsTab` | Main list view with category filtering |
| `OptionGroupDetailView` | Detail view for single group management |
| `OptionGroupFormDialog` | Create/edit group dialog with cycle detection |
| `OptionChoiceFormDialog` | Create/edit choice with compatibility & metadata editors |
| `ContentBlockFormDialog` | Create/edit content blocks with Liquid template preview |
| UI types in `data.ts` | `OptionGroupUi`, `OptionChoiceUi`, `ContentBlockUi` + mappers |

### Server Actions (3 files)

| File | Functions |
|------|-----------|
| `option-groups.ts` | getOptionGroups, getOptionGroupBySlug, getOptionGroupCount, createOptionGroup, updateOptionGroup, deleteOptionGroup |
| `option-choices.ts` | getChoicesForGroup, createOptionChoice, updateOptionChoice, deleteOptionChoice |
| `option-content-blocks.ts` | getContentBlocksForChoice, createContentBlock, updateContentBlock, deleteContentBlock |

All actions include auth checks, scope permission validation, and cache revalidation.

---

## Current CLI Init Architecture (953 lines)

The CLI init command at `src/presentation/cli/commands/init.ts` currently:

1. **Hardcodes all prompts** — Language, stack, ORM, database, auth, testing, frontend, deployment, architecture selections are all defined in-line
2. **Uses local registries** — `stackRegistry` (1,077 lines), `architectureRegistry` (953 lines), `testingRegistry` (431 lines) — ~2,461 lines total
3. **Has smart brownfield detection** — `ProjectDetector` auto-detects language, stack, ORM, database, test framework
4. **Validates selections domain-side** — `Project.create()` enforces compatibility rules
5. **Registers with server AFTER prompts** — Sends `vanguardConfig` JSON to `/api/projects/register`
6. **Fetches methodology bundle** — Downloads pre-rendered files from server
7. **Falls back to local generation** — If server unavailable, generates files locally

### Init Flow Today

```
Auth check → Smart detect (brownfield) → 9-step prompts (hardcoded) →
  Confirm → Register project → Fetch bundle → Write files →
  Wire MCP → Wire hooks → Init memory
```

---

## Gap Analysis: What the CLI Needs

### Phase 1: Fetch Init Schema (New)

The CLI needs a new step **before prompting** to fetch the init schema:

```
Auth check → Fetch init schema → Smart detect → Dynamic prompts →
  Confirm → Register with selections → Fetch bundle → Write files → ...
```

New service needed: `InitSchemaService` or similar that calls `GET /api/agent-framework/init-schema` and returns the categorized option tree.

### Phase 2: Dynamic Prompt Rendering (Replace Hardcoded Prompts)

Replace the 9 hardcoded prompt steps with a dynamic renderer that:

1. Iterates categories in order (basics → stack → database → auth → testing → deployment)
2. For each group, evaluates `dependsOnGroupSlug` — skip if parent not yet answered
3. Filters choices by `compatibleWithSlugs` against already-selected values
4. Renders the appropriate prompt type based on `selectorType` (select, multi-select, text, confirm)
5. Stores answer as `groupSlug → choiceSlug` in a selections map
6. Handles `required` vs optional groups
7. Integrates brownfield smart defaults (match detected values to choice slugs)

### Phase 3: Send Selections During Registration

Instead of building `vanguardConfig` client-side, send raw `selections` map:

```typescript
// Current
{ vanguardConfig: { type: 'greenfield', language: 'typescript', stackId: 'nextjs-app-router', ... } }

// New
{ selections: { 'project-type': 'greenfield', 'language': 'typescript', 'stack': 'nextjs-app-router', ... } }
```

The server will derive `vanguardConfig` from selections via `buildVanguardConfigFromSelections()`.

### Phase 4: Require Server Connectivity

Init requires server connectivity (see C7). If the init-schema endpoint is unreachable, fail with a clear error directing the user to check auth and network. Init already requires authentication, so this is consistent. The local registries (~2.5K lines total) may be kept as a minimal fallback if the cost-benefit warrants it, but the primary flow is server-driven.

### Phase 5: Remove Local Registries

Once the server-driven flow is stable, the local registries (`stackRegistry` 1,077 lines, `architectureRegistry` 953 lines, `testingRegistry` 431 lines — ~2,461 lines total) can be removed. The server becomes the single source of truth for available options.

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Groups/Choices/ContentBlocks (not flat options) | Hierarchical model supports dependency chains, compatibility filtering, and content injection — all impossible with a flat key-value approach |
| `dependsOnGroupSlug` (not `dependsOnChoiceSlug`) | Simpler dependency model — a group either shows or doesn't. Choice-level filtering handled by `compatibleWithSlugs` on individual choices |
| Content blocks as separate entities | Decouples choice definition from content injection. Same choice can contribute to multiple targets (constitution, CLAUDE.md, agents, etc.) |
| `buildVanguardConfigFromSelections()` bridge function | Backward compatibility — existing bundle rendering expects specific config shapes. Bridge translates selections to legacy format |
| `ProjectSelection` rows alongside `vanguardConfig` JSON | Selections provide granular tracking (which group, which choice, which scope). Config JSON provides backward-compatible rendering input |
| System + org scoping (no project scope) | Init options define what projects can choose FROM, not project-level settings. Org scope allows customization without project-level complexity |

---

## Risks & Considerations for CLI Integration

1. **Brownfield Detection Integration**: Smart defaults from `ProjectDetector` need to map to server-side choice slugs. Current detection uses local IDs — these must align with server slugs.

2. **CLI Version Skew**: Old CLIs will send `vanguardConfig`, new CLIs will send `selections`. The server already handles both — but the CLI needs to detect which mode to use.

3. **Content Blocks Not Consumed by CLI**: Content blocks are a server-side rendering concern. The CLI doesn't need to fetch or process them — they're applied during bundle rendering. But the CLI should be aware they exist for debugging/understanding.

4. **Metadata Handling**: Some choices carry metadata (e.g., ORM migration commands). The CLI currently uses this metadata from local registries. In the server-driven flow, metadata comes from the choice's `metadata` JSON field — the CLI may need this for display purposes.

5. **`sourceScope` Hardcoding Bug (vanguard-web)**: The register route at `route.ts:204` hardcodes `sourceScope: 'system'` and `sourceOrgId: null` for all ProjectSelection rows. When org-scoped choices are used, selections will be incorrectly recorded as system-scoped. This is a server-side defect to address in vanguard-web.

---

## File Reference Table

### vanguard-web files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` (lines 1627-1706) | OptionGroup, OptionChoice, OptionContentBlock, ProjectSelection models |
| `prisma/migrations/20260320000001_add_option_groups/migration.sql` | Database migration |
| `scripts/seed-option-groups.ts` | 985-line seed script for built-in options |
| `src/app/api/agent-framework/init-schema/route.ts` | GET endpoint returning schema for CLI |
| `src/app/api/projects/register/route.ts` | Enhanced POST endpoint accepting selections |
| `src/lib/agent-framework/build-vanguard-config-from-selections.ts` | Bridge: selections → vanguardConfig |
| `src/server/actions/option-groups.ts` | CRUD server actions for groups |
| `src/server/actions/option-choices.ts` | CRUD server actions for choices |
| `src/server/actions/option-content-blocks.ts` | CRUD server actions for content blocks |
| `src/components/agent-framework/InitOptionsTab.tsx` | Main list UI component |
| `src/components/agent-framework/OptionGroupDetailView.tsx` | Detail/edit UI |
| `src/components/agent-framework/OptionGroupFormDialog.tsx` | Group create/edit form |
| `src/components/agent-framework/OptionChoiceFormDialog.tsx` | Choice create/edit form |
| `src/components/agent-framework/ContentBlockFormDialog.tsx` | Content block form with Liquid preview |
| `src/components/agent-framework/data.ts` (lines 160-461) | UI types and DB→UI mappers |
| `src/app/(workspaces)/agent-framework/init-options/page.tsx` | List page |
| `src/app/(workspaces)/agent-framework/init-options/[slug]/page.tsx` | Detail page |
| `.vanguard/specs/configurable-init-options.md` | Feature specification |

### vanguard-cli files (to be modified)

| File | Current Role | Required Change |
|------|-------------|----------------|
| `src/presentation/cli/commands/init.ts` | 953-line hardcoded init flow | Replace steps 1-8 with dynamic schema-driven prompts |
| `src/presentation/data/stacks/index.ts` | 1,077-line stack registry | Eventually removable (server becomes source of truth) |
| `src/presentation/data/architectures/index.ts` | 953-line architecture registry | Eventually removable |
| `src/presentation/data/testing/index.ts` | 431-line testing framework registry | Eventually removable |
| `src/application/services/project-registration.service.ts` | Sends vanguardConfig | Add selections field to registration payload |
| `src/infrastructure/project-detector.ts` | Brownfield detection | Map detected values to server choice slugs |

---

## Recommended Next Steps

1. **Create CLI integration spec** — Define the exact changes needed in `init.ts` and supporting services
2. **Add `InitSchemaService`** — New application service to fetch and cache the init schema from the server
3. **Build dynamic prompt renderer** — Generic engine that iterates schema groups, evaluates dependencies, filters choices, renders @clack/prompts
4. **Enhance registration payload** — Send `selections` map alongside or instead of `vanguardConfig`
5. **Verify slug alignment** — Ensure CLI's brownfield detection IDs match server choice slugs
6. **Add category ordering to API** — Modify `GET /api/agent-framework/init-schema` in vanguard-web to include category sequence metadata (C1)
7. **Fix sourceScope hardcoding** — Update register route in vanguard-web to derive scope from the actual option group's orgId

---

## Clarifications (Resolved 2026-03-20)

The following ambiguities were identified during discovery review and resolved before specification:

### C1: Category Ordering — Add to API Response
**Ambiguity**: The init-schema API returns categories as a JSON Record with no guaranteed order. The web UI hardcodes order in `InitOptionsTab.tsx`. CLI has no way to discover intended display order.

**Resolution**: **Modify the vanguard-web API** to include category ordering metadata in the response. This keeps the server as the single source of truth and avoids hardcoding order in the CLI. Requires a server-side change to the `GET /api/agent-framework/init-schema` endpoint.

### C2: Architecture Group — Already Exists ~~Add to Seed Data~~
**Ambiguity**: The initial discovery incorrectly stated no "architecture" OptionGroup existed in the server seed data.

**Resolution**: **No action needed.** QA review confirmed the seed script already contains an `architecture` group (line 523) with choices: `ddd` (Domain-Driven Design), `clean` (Clean Architecture), `mvc-interactors` (MVC with Interactors), `layered` (Simple Layered). The group depends on `stack` and choices use `compatibleWithSlugs` for stack-based filtering. The 953-line local `architectureRegistry` can be removed once the CLI consumes the server schema.

### C3: Project.create() Validation — Keep as Safety Net
**Ambiguity**: `Project.create()` performs 5 compatibility checks. With server-driven schema, `compatibleWithSlugs` already enforces compatibility at the choice level. Dual validation could conflict.

**Resolution**: **Keep `Project.create()` validation as a fail-fast safety net.** If server data is inconsistent, the CLI will throw immediately rather than producing a broken project. The server's compatibility filtering reduces the chance of conflicts, but domain validation provides defense in depth.

### C4: Compatibility Filtering — All Selected Slugs
**Ambiguity**: Does `compatibleWithSlugs` check against the parent group's selection only, or against ALL previously-selected choice slugs across all groups?

**Resolution**: **Check against ALL previously-selected slugs from any group.** This matches the seed data patterns where `postgresql` (database group) checks compatibility against ORM slugs (a different group). The algorithm:
```
For each choice in a group:
  if choice.compatibleWithSlugs is empty [] → always show
  if ANY of the user's selected slugs (from any group) appears in compatibleWithSlugs → show
  otherwise → hide
```

### C5: `-y` Flag — First Choice + Smart Detection
**Ambiguity**: How should `-y` (accept defaults) work with server-driven schema?

**Resolution**: **Use brownfield smart detection first, fall back to first choice.** When `-y` is set:
1. Run brownfield `ProjectDetector` to detect language, stack, ORM, etc.
2. For each group, if a detected value matches a choice slug → select it
3. If no detection match → select the first compatible choice in the group
4. Skip optional (`required: false`) groups entirely

### C6: Selector Types — Select Only, Skip Unknown
**Ambiguity**: Only `selectorType: "select"` is implemented in the web UI. Other types (multi-select, text, confirm) are theoretically possible but don't exist yet.

**Resolution**: **Implement "select" only.** If the server returns a group with an unknown selectorType, skip that group with a warning log. This is forward-compatible — new types can be added later without breaking existing CLI versions.

### C7: Fallback Strategy — Require Server
**Ambiguity**: If the init-schema endpoint is unreachable, should the CLI fall back to local registries (~2,461 lines)?

**Resolution**: **Require server connectivity for init.** If the endpoint is unreachable, fail with a clear error message directing the user to check authentication and network. This allows removing the local registries (stacks 1,077 lines, architectures 953 lines, testing 431 lines) once the server-driven flow is stable. Init already requires auth, so requiring server connectivity is consistent. Note: the registries are smaller than initially estimated (~2.5K lines, not 55K), so keeping a minimal local fallback remains a low-cost option if reconsidered later.

---

### Clarification Summary Table

| # | Ambiguity | Resolution | Impact |
|---|-----------|-----------|--------|
| C1 | Category ordering | Add ordering metadata to API response | Requires vanguard-web API change |
| C2 | ~~Architecture group missing~~ | Already exists in seed data — no action needed | None (QA-corrected) |
| C3 | Domain validation | Keep Project.create() as safety net | No change to domain layer |
| C4 | Compatibility filtering scope | Check ALL selected slugs, not just parent | CLI filtering algorithm defined |
| C5 | `-y` flag behavior | Smart detect first, then first choice | Brownfield detection stays relevant |
| C6 | Selector types | Implement "select" only, skip unknown | Forward-compatible, minimal scope |
| C7 | Fallback strategy | Require server, no local fallback | Enables removing ~2.5K lines of registries |

---

_Discovery completed by Analyst agent. Clarifications resolved. Ready for specification phase._

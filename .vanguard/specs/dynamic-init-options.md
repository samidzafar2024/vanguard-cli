# Specification: Dynamic Init Options

**Status**: draft
**Date**: 2026-03-20
**Prerequisites**: [discovery-init-options.md](./discovery-init-options.md), [requirements-dynamic-init.md](./requirements-dynamic-init.md)

## Overview

### Problem Statement

The `vanguard init` command uses a 953-line hardcoded prompt flow with ~2,461 lines of local registry data (stacks, architectures, testing frameworks). When options change on the server (new stacks, new ORMs, org-customized choices), every CLI user must upgrade to see them. This creates a maintenance bottleneck and prevents organizations from customizing their init experience.

The vanguard-web server now has a fully implemented Init Options feature (4 database models, management UI, API endpoint) that serves a dynamic option schema. The CLI needs to consume this schema instead of using hardcoded prompts.

### Business Value

- **Single source of truth**: Options managed on the server, reflected immediately in CLI without upgrades
- **Org customization**: Organizations can add custom stacks, architectures, and testing frameworks visible only to their members
- **Reduced maintenance**: ~3,400 lines of hardcoded registry data removable from CLI
- **Consistency**: Web UI and CLI offer the same options from the same data source

### Success Metrics

- [ ] Init completes successfully using server-driven prompts for all 14 option groups
- [ ] `--yes` flag produces correct selections for brownfield projects (smart detection works)
- [ ] CLI flags (`--stack`, `--architecture`) work with server choice slugs
- [ ] Org-scoped choices appear for authenticated org members
- [ ] Init fails gracefully with clear error when server is unreachable
- [ ] No regression in init completion time (< 2s excluding network)

---

## User Personas

### P1: Alex — Solo Developer
- **Role**: Full-stack developer starting a new side project
- **Technical proficiency**: High (comfortable with CLI tools)
- **Goals**: Get a project scaffolded quickly with sensible defaults
- **Pain points**: Too many prompts, wants `-y` to just work
- **Usage frequency**: Runs init 2-3 times per month
- **Key behavior**: Uses `-y` flag, occasionally `--stack` to skip prompts

### P2: Jordan — Team Lead
- **Role**: Leads a team of 5, sets up new microservices regularly
- **Technical proficiency**: High
- **Goals**: Consistent project setup across the team, wants to answer each prompt thoughtfully
- **Pain points**: Current prompts don't reflect the team's agreed-upon tooling choices
- **Usage frequency**: Runs init weekly
- **Key behavior**: Goes through interactive prompts, reviews confirmation summary carefully

### P3: Morgan — Platform Engineer (Org Admin)
- **Role**: Manages Vanguard for the organization, customizes available options
- **Technical proficiency**: Expert
- **Goals**: Ensure developers see org-approved stacks and architectures in the CLI
- **Pain points**: Org-customized options only show in web UI, not in CLI
- **Usage frequency**: Runs init for testing after changing server options
- **Key behavior**: Adds org-scoped choices via web UI, tests they appear in CLI

### P4: Riley — Developer on Existing Project
- **Role**: Joining an existing brownfield project, running init for the first time
- **Technical proficiency**: Medium
- **Goals**: Init should detect existing stack and pre-select matching options
- **Pain points**: Doesn't know which ORM/database/testing framework the project uses
- **Usage frequency**: Runs init once when joining a project
- **Key behavior**: Relies on brownfield smart detection to suggest correct options

---

## User Scenarios

### S1: Interactive Greenfield Init (Jordan)

**Given** Jordan is authenticated and the server is reachable
**When** Jordan runs `vanguard init`
**Then** the CLI:
1. Fetches the init schema from the server
2. Prompts for project name (free-text input)
3. Presents each server-defined group as a `p.select()` prompt in category order
4. For groups with `dependsOnGroupSlug`, only shows the prompt after the parent group is answered
5. Filters each group's choices by `compatibleWithSlugs` against all previously selected slugs
6. Shows a confirmation summary with human-readable labels from the schema
7. On confirm, sends `selections` map to the register endpoint
8. Fetches methodology bundle and writes project files

### S2: Auto-Accept with Smart Detection (Alex, Brownfield)

**Given** Alex is in a directory with `package.json` containing Next.js + Prisma + PostgreSQL
**When** Alex runs `vanguard init -y`
**Then** the CLI:
1. Fetches the init schema
2. Runs `ProjectDetector` to detect: language=typescript, framework=next, orm=prisma, database=postgresql
3. Maps detected values to server choice slugs (e.g., `nextjs-typescript` → `nextjs-app-router`)
4. For each group, selects the matching detected value or falls back to the first compatible choice
5. Skips optional groups (e.g., e2e-test where `required: false`)
6. Displays the auto-selected configuration summary
7. Registers and completes without any interactive prompts

### S3: CLI Flag Override (Alex)

**Given** Alex wants to force a specific stack
**When** Alex runs `vanguard init --stack express-typescript`
**Then** the CLI:
1. Fetches the init schema
2. Validates `express-typescript` exists as a choice slug in the schema's `stack` group
3. Pre-populates `selections['stack'] = 'express-typescript'`
4. Skips the stack group prompt, continues with remaining groups
5. Filters downstream groups (ORM, auth, frontend, etc.) based on express-typescript's compatibility

### S4: Org-Scoped Custom Choice (Morgan)

**Given** Morgan has added an org-scoped "Internal Framework" stack choice via the web UI
**When** a developer in Morgan's org runs `vanguard init`
**Then** the developer sees "Internal Framework" alongside the built-in stacks in the stack selection prompt, because the init-schema API returns both system and org-scoped choices.

### S5: Server Unreachable (Jordan)

**Given** Jordan is authenticated but the server is down
**When** Jordan runs `vanguard init`
**Then** the CLI:
1. Attempts to fetch the init schema
2. Receives a network error or timeout
3. Displays a clear error: "Could not reach Vanguard server. Check your network connection and authentication with `vanguard auth status`."
4. Exits with non-zero code
5. Does NOT fall back to hardcoded prompts

### S6: Unknown Selector Type (Forward Compatibility)

**Given** the server has been updated with a new group using `selectorType: "multi-select"`
**When** a developer with an older CLI runs `vanguard init`
**Then** the CLI:
1. Encounters the group with unknown selectorType
2. Logs a warning: "Skipping group 'X' (unsupported selector type 'multi-select'). Update your CLI for full support."
3. Continues with the remaining groups
4. Init completes successfully (the skipped group is not in the selections map)

### S7: Invalid CLI Flag (Alex)

**Given** Alex passes a flag with a slug that doesn't exist in the schema
**When** Alex runs `vanguard init --stack nonexistent-stack`
**Then** the CLI:
1. Fetches the init schema
2. Checks for `nonexistent-stack` in the stack group's choices
3. Finds no match
4. Logs a warning: "Stack 'nonexistent-stack' not found in available options. Prompting for selection."
5. Falls through to the interactive stack prompt

### S8: All Choices Filtered Out (Edge Case)

**Given** a group exists but all its choices are filtered out by `compatibleWithSlugs` based on prior selections
**When** the dynamic renderer reaches that group
**Then** the CLI:
1. Detects zero compatible choices remain
2. Logs a note: "Skipping group 'X' — no compatible options for your selections."
3. Continues to the next group
4. The skipped group is not included in the selections map

---

## Functional Requirements

### MUST Have

| ID | Requirement | Scenario | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-001 | Fetch init schema from server before prompting | S1, S2, S3 | CLI calls `GET /api/agent-framework/init-schema` with Bearer token and receives categorized option groups |
| FR-002 | Render dynamic prompts from schema groups | S1 | Each group with `selectorType: "select"` renders as a `p.select()` prompt with the group's choices |
| FR-003 | Evaluate group dependencies before rendering | S1 | Groups with `dependsOnGroupSlug` are only shown if the parent group has a selection in the selections map |
| FR-004 | Filter choices by compatibility | S1 | Choices where `compatibleWithSlugs` is non-empty are only shown if ANY of the user's selected slugs (from any group) appear in the array. Empty array = always show |
| FR-005 | Process categories in defined order | S1 | Groups are processed in category order: basics, stack, database, auth, architecture, testing, deployment. Within each category, groups are ordered by server-provided sequence |
| FR-006 | Keep project name as hardcoded text prompt | S1, S2 | Name is prompted via `p.text()` before the dynamic loop, with validation (lowercase alphanumeric + hyphens) |
| FR-007 | Send selections-only to register endpoint | S1, S2 | Registration payload includes `selections: Record<string, string>` mapping groupSlug → choiceSlug. Does NOT include `vanguardConfig` |
| FR-008 | Run smart detection for brownfield even with -y | S2 | `ProjectDetector` runs when type is brownfield regardless of the -y flag |
| FR-009 | Map detected values to server choice slugs | S2 | A mapping table converts detector-returned slugs (e.g., `nextjs-typescript`) to server choice slugs (e.g., `nextjs-app-router`) |
| FR-010 | Auto-select with -y flag | S2 | When -y is set: use smart-detected value if available, else first compatible choice. Skip optional groups (required=false) |
| FR-011 | Map CLI flags to pre-populated selections | S3 | `--stack` and `--architecture` flags validate against schema choice slugs and pre-populate the selections map, skipping those group prompts |
| FR-012 | Fail on server unreachable | S5 | If init-schema fetch fails, display actionable error message and exit non-zero. No local fallback |
| FR-013 | Display confirmation summary using schema labels | S1, S2 | Before registration, show human-readable summary using group `name` and choice `label` from the schema |
| FR-014 | Fix --architecture flag bug | S3 | The flag value is actually used to look up the choice slug, not ignored (fixes existing bug where truthiness check discards the value) |

### SHOULD Have

| ID | Requirement | Scenario | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-015 | Skip groups with unknown selectorType | S6 | Groups with unrecognized selectorType are skipped with a warning log. Init continues |
| FR-016 | Handle invalid CLI flag slugs gracefully | S7 | If --stack or --architecture slug not found in schema, warn and fall through to interactive prompt |
| FR-017 | Handle zero-compatible-choices groups | S8 | Groups where all choices are filtered out are skipped with a note. Init continues |
| FR-018 | Show org-scoped choices alongside system choices | S4 | Choices from the user's org (identified by `orgId`) appear in prompts alongside built-in choices |
| FR-019 | Build lightweight local config from selections | S1, S2 | Port minimal mapping logic (selections → config) for writing local `config.yaml` and `vanguard.manifest.yaml` |

### COULD Have

| ID | Requirement | Scenario | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-020 | Treat 'none' choices equally with -y | S2 | When auto-selecting, 'none' is not special-cased. Server sequence controls default order |
| FR-021 | Show choice descriptions as hints | S1 | If a choice has a non-null `description`, display it as a hint in `p.select()` |
| FR-022 | Display choice icons | S1 | If a choice has a non-null `icon`, display it in the prompt label |

### WON'T (Out of Scope)

| ID | What | Why |
|----|------|-----|
| FR-X01 | Multi-select selectorType | No groups currently use it. Forward-compat via FR-015 (skip with warning) |
| FR-X02 | Text input selectorType | Explicitly deferred in vanguard-web spec. Only "project name" would need it |
| FR-X03 | Local fallback prompts | C7 decided: require server. No local registry fallback |
| FR-X04 | Category ordering from server | C1 deferred: hardcode order in CLI for now. Server enhancement later |
| FR-X05 | Remove local registries | Deferred to follow-up PR after dynamic flow is validated |
| FR-X06 | Content block processing in CLI | Content blocks are a server-side rendering concern. CLI doesn't process them |

---

## Non-Functional Requirements

| ID | Requirement | Target | Rationale |
|----|-------------|--------|-----------|
| NFR-001 | Schema fetch latency | < 1s on typical broadband | Init should not feel slow. Single GET request, small payload (~5KB for 14 groups) |
| NFR-002 | Schema fetch timeout | 5s, then fail | Don't hang indefinitely on bad connections |
| NFR-003 | No secrets in schema transport | Bearer token in Authorization header only | Constitution: never commit secrets. Token already managed by auth module |
| NFR-004 | Graceful degradation for new selectorTypes | Skip with warning, continue init | CLI version N should not break when server adds features for version N+1 |
| NFR-005 | No regression in init time | Total init < 15s including network, < 2s excluding | Current init is ~1-2s (all local). Network adds latency but should not double total time |
| NFR-006 | Backward-compatible registration | Old CLIs still work with current server | Server already handles `vanguardConfig`-only payloads. New CLI sends `selections`-only. Both paths coexist |
| NFR-007 | Error messages are actionable | Every error includes a next step for the user | e.g., "Check your network" or "Run `vanguard auth status`" |
| NFR-008 | Test coverage for dynamic renderer | Unit tests for dependency evaluation, compatibility filtering, -y auto-selection | Core algorithm must be tested independently of network and prompts |

---

## Dependencies

### Server-Side (vanguard-web)

| Dependency | Status | Blocking? |
|-----------|--------|-----------|
| `GET /api/agent-framework/init-schema` endpoint | Implemented | No |
| `POST /api/projects/register` accepts `selections` field | Implemented | No |
| `buildVanguardConfigFromSelections()` bridge function | Implemented | No |
| Fix sourceScope hardcoding bug (P1 in requirements) | Not started | No (data tracking issue, not functional) |
| Category ordering metadata (P2 in requirements) | Not started | No (CLI hardcodes order as workaround) |

### CLI-Side

| Dependency | Status | Blocking? |
|-----------|--------|-----------|
| Authentication module (`requireAuth`, `authRepository`) | Existing | No |
| @clack/prompts library | Existing | No |
| ProjectDetector for brownfield | Existing | No |
| Methodology bundle fetch | Existing | No |

---

## Data Flow

```
                          ┌─────────────┐
                          │  vanguard   │
                          │    web      │
                          └──────┬──────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
    GET /init-schema    POST /register      GET /methodology
              │                  │                   │
              ▼                  ▼                   ▼
    ┌─────────────────┐  ┌─────────────┐  ┌──────────────────┐
    │ InitSchema      │  │ selections  │  │ Bundle files     │
    │ {categories}    │  │ {grp: slug} │  │ (rendered)       │
    └────────┬────────┘  └──────┬──────┘  └────────┬─────────┘
             │                  │                   │
             ▼                  │                   │
    ┌─────────────────┐         │                   │
    │ DynamicPrompt   │─────────┘                   │
    │ Renderer        │                             │
    │ (CLI prompts)   │                             │
    └────────┬────────┘                             │
             │                                      │
             ▼                                      ▼
    ┌─────────────────┐                   ┌──────────────────┐
    │ selections map  │                   │ Write project    │
    │ {grp → choice}  │                   │ files to disk    │
    └─────────────────┘                   └──────────────────┘
```

---

## Clarification Index

All design decisions are traced to clarifications resolved during discovery and requirements review:

| Ref | Decision | Document |
|-----|---------|----------|
| C1 | Category ordering hardcoded in CLI | discovery-init-options.md |
| C2 | Architecture group already exists in seed | discovery-init-options.md |
| C3 | Project.create() as safety net → dropped per C11 | discovery-init-options.md |
| C4 | Filter against ALL selected slugs globally | discovery-init-options.md |
| C5 | -y: smart detect first, then first choice | discovery-init-options.md |
| C6 | Implement "select" only, skip unknown | discovery-init-options.md |
| C7 | Require server, no local fallback | discovery-init-options.md |
| C8 | Fix -y to run smart detection | requirements-dynamic-init.md |
| C9 | Fix --architecture flag bug | requirements-dynamic-init.md |
| C10 | Project name stays hardcoded p.text() | requirements-dynamic-init.md |
| C11 | Skip Project.create(), port config builder | requirements-dynamic-init.md |
| C12 | 'none' treated equally, server controls order | requirements-dynamic-init.md |
| C13 | CLI flags map to pre-populated selections | requirements-dynamic-init.md |
| C14 | Send selections-only, server builds config | requirements-dynamic-init.md |
| C15 | Remove redundant `authStatus.authenticated` guard — `requireAuth()` guarantees auth | dynamic-init-options.md |
| C16 | Compose `registrationService` at top level since auth is guaranteed | dynamic-init-options.md |
| C17 | If methodology bundle fails: fail init with error message, don't fall back to local generation | dynamic-init-options.md |
| C18 | Standardize on `p.spinner()` (clack) for new spinners | dynamic-init-options.md |
| C19 | `contentBlocks` in server choices intentionally ignored — methodology bundle renders them server-side | dynamic-init-options.md |
| C20 | `buildConfigFromSelections()` must replicate server's `frontend !== 'none'` skip exactly | dynamic-init-options.md |

---

## Open Questions

All questions have been resolved through clarification rounds C1-C20. No open questions remain.

---

_Specification completed by Product Manager agent._
_Architecture: MVC with Interactors_
_Generated by Vanguard for vanguard-cli_

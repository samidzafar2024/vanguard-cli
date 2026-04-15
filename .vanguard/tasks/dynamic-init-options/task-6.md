# Task 6: Rewrite init.ts to Use Dynamic Flow

**Status**: complete
**Phase**: 4 — init.ts Rewrite

## Context

**Spec**: `.vanguard/specs/dynamic-init-options.md` (FR-001 through FR-014)
**Plan**: `.vanguard/plans/dynamic-init-options.md` (Component 7)
**Feature**: Dynamic Init Options

## Objective

Rewrite the init command to fetch the server schema, render dynamic prompts, and register with selections instead of vanguardConfig. Fix the -y detection bug (C8) and --architecture flag bug (C9).

## Acceptance Criteria

- [x] Schema fetched from server before any prompts (FR-001)
- [x] On schema fetch failure: clear error message with next steps, exit non-zero (FR-012)
- [x] Project name remains a hardcoded `p.text()` prompt (C10, FR-006)
- [x] Brownfield smart detection runs even when `-y` is set (C8 bug fix, FR-008)
- [x] `mapDetectedToServerSlugs()` helper converts detector slugs to server slugs (FR-009)
- [x] `buildFlagOverrides()` helper maps `--stack` and `--architecture` options to selections (FR-011, C13)
- [x] `--architecture` flag value is actually used (not just truthiness check) (C9 bug fix, FR-014)
- [x] `DynamicPromptRenderer.render()` replaces all inline prompt phases 1-7 (FR-002 through FR-005)
- [x] Confirmation summary uses `PromptResult.entries` for display labels (FR-013)
- [x] Registration sends `selections` map, NOT `vanguardConfig` (FR-007, C14)
- [x] Local file generation uses `generateLocalFilesFromSelections()` with `ProjectSummary`
- [x] `Project.create()` is NOT called
- [x] All registry imports removed (`stackRegistry`, `architectureRegistry`, `testingRegistry`)
- [x] All unused domain entity imports removed
- [x] `if (authStatus.authenticated)` guard around registration REMOVED — `requireAuth()` guarantees auth (C15)
- [x] `registrationService` composed at top level with `authRepository` calls (C16)
- [x] If methodology bundle fetch fails: display error and exit non-zero. No fallback to `generateAll()` (C17)
- [x] Use `p.spinner()` (clack) for schema fetch spinner, not `ora` (C18)
- [x] MCP wiring, hook wiring, memory init remain unchanged
- [x] Lint passes

## Implementation Notes

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/presentation/cli/commands/init.ts` | Major rewrite | Replace phases 1-7 with dynamic flow |

### Architecture Guidance

**Layer**: Presentation (Controller / Composition Root)

**New flow** (replaces lines 192-953):

```
1. requireAuth()
2. showBanner(), p.intro()
3. Compose services at top level (C15/C16):
     const cliVersion = getCliVersion()
     const accessToken = await authRepository.getAccessToken()
     const apiEndpoint = await authRepository.getApiEndpoint()
     const gitService = new GitService(rootPath)
     const registrationService = new ProjectRegistrationService(apiEndpoint!, accessToken!, cliVersion)
     // Note: requireAuth() guarantees these are non-null
4. Fetch schema:
     const schemaService = new InitSchemaService(new InitSchemaAdapter(cliVersion))
     const schema = await schemaService.fetch()  // on error → clear message, exit
     const orderedGroups = schemaService.getOrderedGroups(schema)
5. Project name prompt (hardcoded p.text):
     const projectName = options.yes
       ? (options.name ?? defaultProjectName)
       : await p.text({...})
6. Smart detection (C8 fix — removed !options.yes guard):
     let smartDefaults: SmartDefaults = {}
     if (detectedProjectType === 'brownfield') {
       const detected = new ProjectDetector().detect(rootPath)
       smartDefaults = mapDetectedToServerSlugs(detected)
       // Show detection note (only if not -y)
       if (!options.yes && Object.keys(smartDefaults).length > 0) {
         p.note(...)
       }
     }
7. Dynamic prompts:
     const renderer = new DynamicPromptRenderer()
     const promptResult = await renderer.render(
       orderedGroups, smartDefaults,
       { yes: !!options.yes, flagOverrides: buildFlagOverrides(options) },
       canceled,
     )
8. Confirmation (adapted):
     const summaryLines = [
       `${pc.bold('Project')}: ${projectName}`,
       ...promptResult.entries.map(e => `${pc.bold(e.groupName)}: ${e.choiceLabel}`),
     ]
     p.note(summaryLines.join('\n'), 'Configuration')
     if (!options.yes) { const confirmed = await p.confirm({...}) }
9. Register (selections-only):
     const result = await registrationService.register({
       name: projectName,
       type: promptResult.selections['project-type'],
       track: promptResult.selections['track'],
       projectPath: rootPath,
       gitRemoteUrl: gitService.getRemoteUrl(),
       defaultBranch: gitService.getDefaultBranch(),
       selections: promptResult.selections,
     })
10. Bundle fetch (REQUIRED — fail if unavailable, C17):
     const methodologyService = new MethodologyService(...)
     methodologyResult = await methodologyService.install(projectId, rootPath)
     // On failure → display error message, exit non-zero
     // No fallback to generateAll() — server methodology is required
11. Generate local files only:
     const summary: ProjectSummary = {
       name: projectName, type: promptResult.selections['project-type'],
       track: promptResult.selections['track'], rootPath,
       selections: promptResult.selections,
     }
     const localFiles = generator.generateLocalFilesFromSelections(summary)
12. MCP wiring → hook wiring → memory init (unchanged)
```

**`mapDetectedToServerSlugs()` helper**:
```typescript
const DETECTOR_TO_SERVER_SLUG: Record<string, string> = {
  'nextjs-typescript': 'nextjs-app-router',
  'nestjs-typescript': 'nestjs',
  'fastapi-python': 'fastapi',
  'django-python': 'django',
  'flask-python': 'flask',
  'aspnet-csharp': 'aspnet-webapi',
}

function mapDetectedToServerSlugs(detected: DetectedProject): SmartDefaults {
  const defaults: Record<string, string> = {}
  if (detected.language) defaults.language = detected.language
  if (detected.stackId) {
    defaults.stack = DETECTOR_TO_SERVER_SLUG[detected.stackId] ?? detected.stackId
  }
  if (detected.orm) defaults.orm = detected.orm
  if (detected.database) defaults.database = detected.database
  if (detected.testFramework) defaults['unit-test'] = detected.testFramework
  return defaults
}
```

**`buildFlagOverrides()` helper**:
```typescript
function buildFlagOverrides(options: Record<string, unknown>): Record<string, string> {
  const overrides: Record<string, string> = {}
  if (typeof options.stack === 'string') overrides.stack = options.stack
  if (typeof options.architecture === 'string') overrides.architecture = options.architecture
  if (typeof options.type === 'string') overrides['project-type'] = options.type
  if (typeof options.track === 'string') overrides.track = options.track
  return overrides
}
```

## Dependencies

- [ ] Depends on: Task 1 (port + adapter), Task 2 (service), Task 3 (renderer), Task 4 (payload), Task 5 (generators)
- [ ] Blocks: Task 7

## Testing Requirements

- [ ] Integration test with mocked schema API covered by Task 7
- [ ] Manual test: `vanguard init` with live server
- [ ] Manual test: `vanguard init -y` on brownfield project
- [ ] Manual test: `vanguard init --stack express-typescript`

---
_Generated by Vanguard for vanguard-cli_

# Task 3: Create DynamicPromptRenderer

**Status**: todo
**Phase**: 2 — Dynamic Prompt Renderer

## Context

**Spec**: `.vanguard/specs/dynamic-init-options.md` (FR-002 through FR-006, FR-010, FR-011, FR-015 through FR-017, FR-020 through FR-022)
**Plan**: `.vanguard/plans/dynamic-init-options.md` (Component 4)
**Feature**: Dynamic Init Options

## Objective

Create the core presentation component that iterates schema groups, evaluates dependencies, filters choices by compatibility, and renders @clack/prompts or auto-selects for the -y flag.

## Acceptance Criteria

- [ ] `DynamicPromptRenderer` class in `src/presentation/cli/prompts/dynamic-prompt-renderer.ts`
- [ ] Exported types: `SmartDefaults`, `PromptOptions`, `SelectionEntry`, `PromptResult`
- [ ] `render()` method accepts ordered groups, smart defaults, options, and onCancel callback
- [ ] Dependency evaluation: groups with `dependsOnGroupSlug` skipped if parent not in selections
- [ ] Compatibility filtering: choices with empty `compatibleWithSlugs` always shown; otherwise requires ANY selected slug to appear in the array
- [ ] Groups with zero compatible choices after filtering: skipped with `p.log.warn()` message
- [ ] Groups with unknown `selectorType` (not "select"): skipped with `p.log.warn()` message
- [ ] `-y` auto-selection: check smart defaults first, then first compatible choice. Skip optional groups (`required: false`)
- [ ] Flag overrides: if `flagOverrides[group.slug]` matches a compatible choice slug, use it. If no match, log warning and fall through to prompt
- [ ] `p.select()` rendered for interactive groups with choice labels and descriptions as hints
- [ ] `p.isCancel()` check on each prompt result → calls `onCancel()`
- [ ] Smart defaults used as `initialValue` for interactive prompts when a match exists
- [ ] `PromptResult` contains both `selections` map and ordered `entries` with display labels
- [ ] 'none' choices treated equally — no special-casing (C12)
- [ ] Unit tests pass for all algorithm paths
- [ ] Lint passes

## Implementation Notes

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/presentation/cli/prompts/dynamic-prompt-renderer.ts` | Create | Core renderer class |

### Architecture Guidance

**Layer**: Presentation

**Pattern**: Stateless class, no infrastructure imports, no domain imports. Only depends on port types (for `InitSchemaGroup`, `InitSchemaChoice`) and @clack/prompts.

**Key algorithm — filtering**:
```typescript
function getCompatibleChoices(
  choices: readonly InitSchemaChoice[],
  allSelectedSlugs: ReadonlySet<string>,
): InitSchemaChoice[] {
  return choices.filter(choice =>
    choice.compatibleWithSlugs.length === 0
    || choice.compatibleWithSlugs.some(s => allSelectedSlugs.has(s))
  )
}
```

**Key algorithm — auto-select**:
```typescript
function autoSelect(
  group: InitSchemaGroup,
  compatible: InitSchemaChoice[],
  smartDefaults: SmartDefaults,
): string | null {
  if (!group.required) return null  // skip optional groups with -y
  const defaultSlug = smartDefaults[group.slug]
  if (defaultSlug) {
    const match = compatible.find(c => c.slug === defaultSlug)
    if (match) return match.slug
  }
  return compatible[0]?.slug ?? null
}
```

**Key algorithm — flag overrides**:
```typescript
function applyFlagOverride(
  group: InitSchemaGroup,
  compatible: InitSchemaChoice[],
  flagOverrides: Record<string, string>,
): string | null {
  const override = flagOverrides[group.slug]
  if (!override) return null
  const match = compatible.find(c => c.slug === override)
  if (match) return match.slug
  // No match → warn and return null (fall through to prompt)
  p.log.warn(`${group.name}: '${override}' not found in available options. Prompting for selection.`)
  return null
}
```

**Interfaces**:
```typescript
export interface SmartDefaults {
  readonly [groupSlug: string]: string
}

export interface PromptOptions {
  readonly yes: boolean
  readonly flagOverrides: Readonly<Record<string, string>>
}

export interface SelectionEntry {
  readonly groupSlug: string
  readonly choiceSlug: string
  readonly groupName: string
  readonly choiceLabel: string
}

export interface PromptResult {
  readonly selections: Readonly<Record<string, string>>
  readonly entries: readonly SelectionEntry[]
}
```

## Dependencies

- [ ] Depends on: Task 1 (port types for `InitSchemaGroup`, `InitSchemaChoice`)
- [ ] Blocks: Task 6

## Testing Requirements

- [ ] Unit test: group with no dependency is always rendered
- [ ] Unit test: group with `dependsOnGroupSlug` skipped when parent not selected
- [ ] Unit test: group with `dependsOnGroupSlug` rendered when parent is selected
- [ ] Unit test: choice with empty `compatibleWithSlugs` always included
- [ ] Unit test: choice with matching `compatibleWithSlugs` included
- [ ] Unit test: choice with non-matching `compatibleWithSlugs` excluded
- [ ] Unit test: group skipped when all choices filtered out (zero compatible)
- [ ] Unit test: group skipped when `selectorType` is unknown (e.g., "multi-select")
- [ ] Unit test: `-y` selects smart default when available
- [ ] Unit test: `-y` selects first compatible when no smart default
- [ ] Unit test: `-y` skips optional group (`required: false`)
- [ ] Unit test: flag override selects matching choice
- [ ] Unit test: flag override with invalid slug logs warning, returns null
- [ ] Unit test: `PromptResult.entries` contains correct groupName and choiceLabel

---
_Generated by Vanguard for vanguard-cli_

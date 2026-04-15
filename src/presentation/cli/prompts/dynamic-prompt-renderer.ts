/**
 * Dynamic Prompt Renderer.
 *
 * Core presentation component that iterates server-defined schema groups,
 * evaluates dependencies, filters choices by compatibility, and renders
 * @clack/prompts or auto-selects for the -y flag.
 *
 * Pure presentation — no domain dependencies, no infrastructure imports.
 */

import * as p from '@clack/prompts'
import type {
	InitSchemaChoice,
	InitSchemaGroup,
} from '../../../application/ports/init-schema-api-client.js'

export interface SmartDefaults {
	readonly [groupSlug: string]: string // groupSlug → detected choice slug
}

export interface PromptOptions {
	readonly yes: boolean // -y flag
	readonly flagOverrides: Readonly<Record<string, string>> // --stack, --architecture, etc.
}

export interface SelectionEntry {
	readonly groupSlug: string
	readonly choiceSlug: string
	readonly groupName: string // for confirmation display
	readonly choiceLabel: string // for confirmation display
}

export interface PromptResult {
	readonly selections: Readonly<Record<string, string>> // groupSlug → choiceSlug
	readonly entries: readonly SelectionEntry[] // ordered, with display labels
}

/**
 * Filter choices to only those compatible with all previously selected slugs.
 * Choices with empty compatibleWithSlugs are always included (no filtering).
 */
function getCompatibleChoices(
	choices: readonly InitSchemaChoice[],
	allSelectedSlugs: ReadonlySet<string>,
): InitSchemaChoice[] {
	return choices.filter(
		(choice) =>
			choice.compatibleWithSlugs.length === 0 ||
			choice.compatibleWithSlugs.some((s) => allSelectedSlugs.has(s)),
	)
}

/**
 * Auto-select a choice for -y mode.
 * Uses smart default if available, otherwise first compatible choice.
 * Returns null for optional groups (required=false) — skipped with -y.
 */
function autoSelect(
	group: InitSchemaGroup,
	compatible: InitSchemaChoice[],
	smartDefaults: SmartDefaults,
): string | null {
	if (!group.required) return null // skip optional groups with -y

	const defaultSlug = smartDefaults[group.slug]
	if (defaultSlug) {
		const match = compatible.find((c) => c.slug === defaultSlug)
		if (match) return match.slug
	}

	return compatible[0]?.slug ?? null
}

/**
 * Check if a flag override matches a compatible choice.
 * Returns the slug if matched, null if no override or no match.
 * Logs a warning when the override slug doesn't match any choice.
 */
function applyFlagOverride(
	group: InitSchemaGroup,
	compatible: InitSchemaChoice[],
	flagOverrides: Readonly<Record<string, string>>,
): string | null {
	const override = flagOverrides[group.slug]
	if (!override) return null

	const match = compatible.find((c) => c.slug === override)
	if (match) return match.slug

	// No match → warn and return null (fall through to prompt)
	p.log.warn(
		`${group.name}: '${override}' not found in available options. Prompting for selection.`,
	)
	return null
}

/**
 * Resolve the selected slug for a group using flag override, -y auto-select, or interactive prompt.
 * Returns the slug string, or null if the group should be skipped (optional + -y).
 */
async function resolveSelection(
	group: InitSchemaGroup,
	compatible: InitSchemaChoice[],
	smartDefaults: SmartDefaults,
	options: PromptOptions,
	onCancel: () => never,
): Promise<string | null> {
	// Try flag override first
	const overrideSlug = applyFlagOverride(group, compatible, options.flagOverrides)
	if (overrideSlug !== null) return overrideSlug

	// If no override, try -y auto-select
	if (options.yes) {
		return autoSelect(group, compatible, smartDefaults)
	}

	// Interactive prompt
	const defaultSlug = smartDefaults[group.slug]
	const initialValue = defaultSlug
		? compatible.find((c) => c.slug === defaultSlug)?.slug
		: undefined

	const result = await p.select({
		message: group.name,
		options: compatible.map((c) => ({
			value: c.slug,
			label: c.icon ? `${c.icon} ${c.label}` : c.label,
			...(c.description ? { hint: c.description } : {}),
		})),
		initialValue,
	})

	if (p.isCancel(result)) {
		onCancel()
	}

	return result as string
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
		const selections: Record<string, string> = {}
		const entries: SelectionEntry[] = []
		const allSelectedSlugs = new Set<string>()

		for (const group of groups) {
			// 1. Check dependency — skip if parent not selected
			if (group.dependsOnGroupSlug && !(group.dependsOnGroupSlug in selections)) {
				continue
			}

			// 2. Skip unknown selector types (FR-015)
			if (group.selectorType !== 'select') {
				p.log.warn(
					`Skipping group '${group.name}' (unsupported selector type '${group.selectorType}'). Update your CLI for full support.`,
				)
				continue
			}

			// 3. Filter choices by compatibility
			const compatible = getCompatibleChoices(group.choices, allSelectedSlugs)

			// 4. Skip if zero compatible choices (FR-017)
			if (compatible.length === 0) {
				p.log.info(`Skipping '${group.name}' — no compatible options for your selections.`)
				continue
			}

			// 5. Resolve selection via override, auto-select, or prompt
			const selectedSlug = await resolveSelection(
				group,
				compatible,
				smartDefaults,
				options,
				onCancel,
			)
			if (selectedSlug === null) continue // optional group skipped with -y

			// 6. Record selection
			const selectedChoice = compatible.find((c) => c.slug === selectedSlug) ?? compatible[0]
			selections[group.slug] = selectedSlug
			allSelectedSlugs.add(selectedSlug)

			entries.push({
				groupSlug: group.slug,
				choiceSlug: selectedSlug,
				groupName: group.name,
				choiceLabel: selectedChoice?.label ?? selectedSlug,
			})
		}

		return { selections, entries }
	}
}

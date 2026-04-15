import { describe, expect, it, vi } from 'vitest'
import type {
	InitSchemaChoice,
	InitSchemaGroup,
} from '../../../../../src/application/ports/init-schema-api-client.js'
import { DynamicPromptRenderer } from '../../../../../src/presentation/cli/prompts/dynamic-prompt-renderer.js'

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
	select: vi.fn(),
	isCancel: vi.fn(() => false),
	log: { warn: vi.fn(), info: vi.fn() },
}))

// Re-import after mock
const clack = await import('@clack/prompts')

// ============================================================================
// Test Fixtures
// ============================================================================

function makeChoice(slug: string, overrides?: Partial<InitSchemaChoice>): InitSchemaChoice {
	return {
		slug,
		label: slug.charAt(0).toUpperCase() + slug.slice(1),
		description: null,
		icon: null,
		sequence: 1,
		compatibleWithSlugs: [],
		metadata: null,
		orgId: null,
		isBuiltIn: true,
		...overrides,
	}
}

function makeGroup(
	slug: string,
	choices: InitSchemaChoice[],
	overrides?: Partial<InitSchemaGroup>,
): InitSchemaGroup {
	return {
		slug,
		name: slug.charAt(0).toUpperCase() + slug.slice(1),
		description: null,
		selectorType: 'select',
		required: true,
		dependsOnGroupSlug: null,
		choices,
		...overrides,
	}
}

const onCancel = (): never => {
	throw new Error('Cancelled')
}

// ============================================================================
// Tests
// ============================================================================

describe('DynamicPromptRenderer', () => {
	const renderer = new DynamicPromptRenderer()

	describe('auto-select with -y flag', () => {
		it('should auto-select first choice when -y is set', async () => {
			const groups = [makeGroup('stack', [makeChoice('nextjs'), makeChoice('express')])]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.selections.stack).toBe('nextjs')
			expect(result.entries).toHaveLength(1)
		})

		it('should prefer smart default over first choice', async () => {
			const groups = [makeGroup('stack', [makeChoice('nextjs'), makeChoice('express')])]
			const smartDefaults = { stack: 'express' }

			const result = await renderer.render(
				groups,
				smartDefaults,
				{ yes: true, flagOverrides: {} },
				onCancel,
			)

			expect(result.selections.stack).toBe('express')
		})

		it('should skip optional groups with -y', async () => {
			const groups = [makeGroup('frontend', [makeChoice('react')], { required: false })]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.selections.frontend).toBeUndefined()
			expect(result.entries).toHaveLength(0)
		})
	})

	describe('flag overrides', () => {
		it('should use flag override when matching choice exists', async () => {
			const groups = [makeGroup('stack', [makeChoice('nextjs'), makeChoice('express')])]

			const result = await renderer.render(
				groups,
				{},
				{ yes: false, flagOverrides: { stack: 'express' } },
				onCancel,
			)

			expect(result.selections.stack).toBe('express')
		})

		it('should warn and prompt when flag override does not match', async () => {
			vi.mocked(clack.select).mockResolvedValueOnce('nextjs')
			const groups = [makeGroup('stack', [makeChoice('nextjs'), makeChoice('express')])]

			const result = await renderer.render(
				groups,
				{},
				{ yes: false, flagOverrides: { stack: 'nonexistent' } },
				onCancel,
			)

			expect(clack.log.warn).toHaveBeenCalled()
			expect(result.selections.stack).toBe('nextjs')
		})
	})

	describe('dependency filtering', () => {
		it('should skip groups whose dependency is not selected', async () => {
			const groups = [makeGroup('orm', [makeChoice('prisma')], { dependsOnGroupSlug: 'database' })]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.selections.orm).toBeUndefined()
			expect(result.entries).toHaveLength(0)
		})

		it('should include groups whose dependency was selected', async () => {
			const groups = [
				makeGroup('database', [makeChoice('postgresql')]),
				makeGroup('orm', [makeChoice('prisma')], { dependsOnGroupSlug: 'database' }),
			]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.selections.database).toBe('postgresql')
			expect(result.selections.orm).toBe('prisma')
		})
	})

	describe('compatibility filtering', () => {
		it('should filter choices by compatibleWithSlugs', async () => {
			const groups = [
				makeGroup('language', [makeChoice('typescript')]),
				makeGroup('stack', [
					makeChoice('nextjs', { compatibleWithSlugs: ['typescript'] }),
					makeChoice('django', { compatibleWithSlugs: ['python'] }),
				]),
			]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.selections.stack).toBe('nextjs')
		})

		it('should skip group when zero choices are compatible', async () => {
			const groups = [
				makeGroup('language', [makeChoice('ruby')]),
				makeGroup('stack', [
					makeChoice('nextjs', { compatibleWithSlugs: ['typescript'] }),
					makeChoice('django', { compatibleWithSlugs: ['python'] }),
				]),
			]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.selections.language).toBe('ruby')
			expect(result.selections.stack).toBeUndefined()
		})
	})

	describe('unsupported selector types', () => {
		it('should skip groups with unknown selectorType', async () => {
			const groups = [makeGroup('multi', [makeChoice('a')], { selectorType: 'multi-select' })]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.entries).toHaveLength(0)
			expect(clack.log.warn).toHaveBeenCalled()
		})
	})

	describe('interactive prompt', () => {
		it('should call p.select when not using -y or overrides', async () => {
			vi.mocked(clack.select).mockResolvedValueOnce('express')
			const groups = [makeGroup('stack', [makeChoice('nextjs'), makeChoice('express')])]

			const result = await renderer.render(groups, {}, { yes: false, flagOverrides: {} }, onCancel)

			expect(clack.select).toHaveBeenCalled()
			expect(result.selections.stack).toBe('express')
		})

		it('should pass smart default as initialValue', async () => {
			vi.mocked(clack.select).mockResolvedValueOnce('express')
			const groups = [makeGroup('stack', [makeChoice('nextjs'), makeChoice('express')])]

			await renderer.render(
				groups,
				{ stack: 'express' },
				{ yes: false, flagOverrides: {} },
				onCancel,
			)

			expect(clack.select).toHaveBeenCalledWith(
				expect.objectContaining({ initialValue: 'express' }),
			)
		})
	})

	describe('selection entries', () => {
		it('should include display labels in entries', async () => {
			const groups = [
				makeGroup('stack', [makeChoice('nextjs', { label: 'Next.js' })], {
					name: 'Stack',
				}),
			]

			const result = await renderer.render(groups, {}, { yes: true, flagOverrides: {} }, onCancel)

			expect(result.entries[0]).toEqual({
				groupSlug: 'stack',
				choiceSlug: 'nextjs',
				groupName: 'Stack',
				choiceLabel: 'Next.js',
			})
		})
	})
})

import { describe, expect, it } from 'vitest'
import type {
	InitSchema,
	InitSchemaGroup,
} from '../../../../src/application/ports/init-schema-api-client.js'
import { InitSchemaService } from '../../../../src/application/services/init-schema.service.js'

// ============================================================================
// Test Fixtures
// ============================================================================

function makeGroup(slug: string, name: string): InitSchemaGroup {
	return {
		slug,
		name,
		description: null,
		selectorType: 'select',
		required: true,
		dependsOnGroupSlug: null,
		choices: [],
	}
}

function makeSchema(categories: Record<string, InitSchemaGroup[]>): InitSchema {
	return { categories }
}

const stubClient = {
	async fetch(): Promise<InitSchema> {
		return makeSchema({
			basics: [makeGroup('project-type', 'Project Type')],
		})
	},
}

// ============================================================================
// Tests
// ============================================================================

describe('InitSchemaService', () => {
	describe('fetch', () => {
		it('should delegate to the API client', async () => {
			const service = new InitSchemaService(stubClient)
			const schema = await service.fetch()

			expect(schema.categories).toBeDefined()
			expect(schema.categories.basics).toHaveLength(1)
		})
	})

	describe('getOrderedGroups', () => {
		it('should order known categories according to CATEGORY_ORDER', () => {
			const service = new InitSchemaService(stubClient)
			const schema = makeSchema({
				testing: [makeGroup('unit-test', 'Unit Test')],
				basics: [makeGroup('project-type', 'Project Type')],
				stack: [makeGroup('stack', 'Stack')],
			})

			const groups = service.getOrderedGroups(schema)

			expect(groups.map((g) => g.slug)).toEqual(['project-type', 'stack', 'unit-test'])
		})

		it('should append unknown categories alphabetically after known ones', () => {
			const service = new InitSchemaService(stubClient)
			const schema = makeSchema({
				basics: [makeGroup('project-type', 'Project Type')],
				zebra: [makeGroup('zebra-option', 'Zebra')],
				alpha: [makeGroup('alpha-option', 'Alpha')],
			})

			const groups = service.getOrderedGroups(schema)

			expect(groups.map((g) => g.slug)).toEqual(['project-type', 'alpha-option', 'zebra-option'])
		})

		it('should handle empty categories gracefully', () => {
			const service = new InitSchemaService(stubClient)
			const schema = makeSchema({})

			const groups = service.getOrderedGroups(schema)

			expect(groups).toEqual([])
		})

		it('should preserve group order within a single category', () => {
			const service = new InitSchemaService(stubClient)
			const schema = makeSchema({
				basics: [
					makeGroup('project-type', 'Project Type'),
					makeGroup('track', 'Track'),
					makeGroup('language', 'Language'),
				],
			})

			const groups = service.getOrderedGroups(schema)

			expect(groups.map((g) => g.slug)).toEqual(['project-type', 'track', 'language'])
		})

		it('should skip missing known categories without error', () => {
			const service = new InitSchemaService(stubClient)
			// Only 'deployment' from known categories, the rest are absent
			const schema = makeSchema({
				deployment: [makeGroup('deploy-target', 'Deploy Target')],
			})

			const groups = service.getOrderedGroups(schema)

			expect(groups).toHaveLength(1)
			expect(groups[0]?.slug).toBe('deploy-target')
		})
	})
})

/**
 * Init Schema Service.
 *
 * Wraps the init schema port and provides group ordering logic.
 * Thin service — room to grow as the dynamic init flow evolves.
 */

import type {
	InitSchema,
	InitSchemaApiClient,
	InitSchemaGroup,
} from '../ports/init-schema-api-client.js'

/** Canonical category display order (C1: hardcoded until server provides ordering) */
const CATEGORY_ORDER = [
	'basics',
	'stack',
	'database',
	'auth',
	'architecture',
	'testing',
	'deployment',
]

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
			const categoryGroups = schema.categories[category]
			if (categoryGroups) {
				groups.push(...categoryGroups)
				seen.add(category)
			}
		}

		// Unknown categories appended alphabetically
		for (const category of Object.keys(schema.categories).sort()) {
			if (!seen.has(category)) {
				const categoryGroups = schema.categories[category]
				if (categoryGroups) {
					groups.push(...categoryGroups)
				}
			}
		}

		return groups
	}
}

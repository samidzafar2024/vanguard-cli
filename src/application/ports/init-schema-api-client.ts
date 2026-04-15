/**
 * Init Schema API Client Port.
 *
 * Fowler: "Separated Interface" — the port lives in the application layer,
 * the adapter lives in infrastructure. Dependency flows inward.
 *
 * Abstracts communication with vanguard-web's /api/agent-framework/init-schema
 * endpoint for fetching the dynamic option schema at init time.
 */

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

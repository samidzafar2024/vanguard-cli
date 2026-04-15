import { Identifier } from '../value-objects/identifier.js'
import { Version } from '../value-objects/version.js'
import type { FrontendOption } from './frontend-config.js'

/**
 * Supported programming languages/runtimes.
 */
export type Language = 'typescript' | 'python' | 'csharp' | 'go' | 'rust' | 'java' | 'ruby'

/**
 * Stack category - determines which phase of selection this stack appears in.
 */
export type StackCategory = 'frontend' | 'backend' | 'fullstack' | 'database'

/**
 * Database type for ORM compatibility.
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'sqlserver'

/**
 * ORM configuration - stack-aware.
 */
export interface OrmConfig {
	readonly id: Identifier
	readonly name: string
	readonly language: Language
	readonly supportedDatabases: readonly DatabaseType[]
	readonly migrationTool: string
}

/**
 * Authentication strategy configuration.
 */
export interface AuthConfig {
	readonly strategy: 'session' | 'jwt' | 'oauth2' | 'none'
	readonly provider?: string
	readonly patterns: readonly string[]
}

/**
 * Layer configuration within a stack.
 */
export interface StackLayer {
	readonly framework: string
	readonly version: Version
	readonly dependencies: readonly string[]
}

/**
 * Code example for few-shot prompting.
 */
export interface CodeExample {
	readonly name: string
	readonly description: string
	readonly filename: string
	readonly code: string
}

/**
 * Stack Entity - represents a complete technology stack configuration.
 * This is an aggregate containing layer configurations, ORM settings, and examples.
 */
export class Stack {
	private constructor(
		public readonly id: Identifier,
		public readonly name: string,
		public readonly category: StackCategory,
		public readonly language: Language,
		public readonly version: Version,
		public readonly layers: ReadonlyMap<string, StackLayer>,
		public readonly compatibleOrms: readonly OrmConfig[],
		public readonly compatibleAuths: readonly AuthConfig[],
		public readonly frontendOptions: readonly FrontendOption[],
		public readonly fileStructure: string,
		public readonly examples: readonly CodeExample[],
		public readonly description: string,
	) {}

	static create(params: {
		id: string
		name: string
		category: StackCategory
		language: Language
		version: string
		layers: Record<string, StackLayer>
		compatibleOrms: readonly OrmConfig[]
		compatibleAuths: readonly AuthConfig[]
		frontendOptions?: readonly FrontendOption[]
		fileStructure: string
		examples: readonly CodeExample[]
		description: string
	}): Stack {
		return new Stack(
			Identifier.create(params.id),
			params.name,
			params.category,
			params.language,
			Version.create(params.version),
			new Map(Object.entries(params.layers)),
			params.compatibleOrms,
			params.compatibleAuths,
			params.frontendOptions ?? [],
			params.fileStructure,
			params.examples,
			params.description,
		)
	}

	/**
	 * Check if an ORM is compatible with this stack.
	 */
	isOrmCompatible(ormId: Identifier): boolean {
		return this.compatibleOrms.some((orm) => orm.id.equals(ormId))
	}

	/**
	 * Check if a database type is supported by this stack's ORMs.
	 */
	supportsDatabaseType(dbType: DatabaseType): boolean {
		return this.compatibleOrms.some((orm) => orm.supportedDatabases.includes(dbType))
	}

	/**
	 * Get the default ORM for this stack.
	 */
	getDefaultOrm(): OrmConfig | undefined {
		return this.compatibleOrms[0]
	}

	/**
	 * Get the default auth configuration.
	 */
	getDefaultAuth(): AuthConfig | undefined {
		return this.compatibleAuths[0]
	}

	/**
	 * Get examples filtered by name pattern.
	 */
	getExamplesByPattern(pattern: string): readonly CodeExample[] {
		const regex = new RegExp(pattern, 'i')
		return this.examples.filter((ex) => regex.test(ex.name))
	}

	/**
	 * Check if this stack is frontend-capable.
	 */
	hasFrontend(): boolean {
		return this.category === 'frontend' || this.category === 'fullstack'
	}

	/**
	 * Check if this stack is backend-capable.
	 */
	hasBackend(): boolean {
		return this.category === 'backend' || this.category === 'fullstack'
	}

	/**
	 * Check if this stack requires frontend selection.
	 */
	requiresFrontendSelection(): boolean {
		return this.frontendOptions.length > 0
	}

	/**
	 * Get the default frontend option.
	 */
	getDefaultFrontend(): FrontendOption | undefined {
		return this.frontendOptions[0]
	}
}

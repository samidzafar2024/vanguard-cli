import { ConfigurationError, IncompatibleSelectionError } from '../errors/domain-error.js'
import { FilePath } from '../value-objects/file-path.js'
import { Identifier } from '../value-objects/identifier.js'
import type { Architecture, ArchitectureModule } from './architecture.js'
import type { DeploymentConfig } from './deployment-config.js'
import type { FrontendConfig } from './frontend-config.js'
import type { AuthConfig, DatabaseType, OrmConfig, Stack } from './stack.js'
import type { TestingConfig } from './testing-config.js'

/**
 * Project type - greenfield (new) or brownfield (existing codebase).
 */
export type ProjectType = 'greenfield' | 'brownfield'

/**
 * Development track - determines workflow depth and governance level.
 *
 * - **solo**: 1 developer, quick iteration, minimal documentation
 * - **team**: 2-8 developers, standard workflows, balanced documentation
 * - **enterprise**: Large org, full governance, compliance artifacts, detailed ADRs
 */
export type Track = 'solo' | 'team' | 'enterprise'

/**
 * Project Entity - the aggregate root for a Vanguard project.
 * Contains all configuration selections and validates compatibility.
 */
export class Project {
	private constructor(
		public readonly id: Identifier,
		public readonly name: string,
		public readonly type: ProjectType,
		public readonly track: Track,
		public readonly rootPath: FilePath,
		public readonly stack: Stack,
		public readonly orm: OrmConfig | undefined,
		public readonly database: DatabaseType | undefined,
		public readonly auth: AuthConfig,
		public readonly frontend: FrontendConfig | undefined,
		public readonly architecture: Architecture,
		public readonly modules: readonly ArchitectureModule[],
		public readonly testing: TestingConfig,
		public readonly deployment: DeploymentConfig,
		public readonly createdAt: Date,
	) {}

	static create(params: {
		name: string
		type: ProjectType
		track: Track
		rootPath: string
		stack: Stack
		orm?: OrmConfig
		database?: DatabaseType
		auth: AuthConfig
		frontend?: FrontendConfig
		architecture: Architecture
		modules: readonly ArchitectureModule[]
		testing: TestingConfig
		deployment: DeploymentConfig
	}): Project {
		// Validate ORM compatibility with stack (if ORM selected)
		if (params.orm && !params.stack.isOrmCompatible(params.orm.id)) {
			throw new IncompatibleSelectionError(
				params.orm.name,
				params.stack.name,
				`ORM ${params.orm.name} is not compatible with ${params.stack.name}`,
			)
		}

		// Validate database compatibility with ORM (if both selected)
		if (params.orm && params.database && !params.orm.supportedDatabases.includes(params.database)) {
			throw new IncompatibleSelectionError(
				params.database,
				params.orm.name,
				`Database ${params.database} is not supported by ${params.orm.name}`,
			)
		}

		// Validate architecture has implementation for stack
		if (!params.architecture.hasImplementationFor(params.stack.id)) {
			throw new IncompatibleSelectionError(
				params.architecture.name,
				params.stack.name,
				`No implementation of ${params.architecture.name} available for ${params.stack.name}`,
			)
		}

		// Validate modules are compatible with architecture
		for (const module of params.modules) {
			if (!module.isCompatibleWith(params.architecture.id)) {
				throw new IncompatibleSelectionError(
					module.name,
					params.architecture.name,
					`Module ${module.name} is not compatible with ${params.architecture.name}`,
				)
			}
		}

		// Validate testing config matches stack language
		if (params.testing.language !== params.stack.language) {
			throw new ConfigurationError(
				`Testing config language (${params.testing.language}) must match stack language (${params.stack.language})`,
			)
		}

		return new Project(
			Identifier.fromString(params.name),
			params.name,
			params.type,
			params.track,
			FilePath.create(params.rootPath),
			params.stack,
			params.orm,
			params.database,
			params.auth,
			params.frontend,
			params.architecture,
			params.modules,
			params.testing,
			params.deployment,
			new Date(),
		)
	}

	/**
	 * Get the .vanguard directory path.
	 */
	getVanguardPath(): FilePath {
		return this.rootPath.join('.vanguard')
	}

	/**
	 * Get the constitution file path.
	 */
	getConstitutionPath(): FilePath {
		return this.getVanguardPath().join('constitution.md')
	}

	/**
	 * Get the config file path.
	 */
	getConfigPath(): FilePath {
		return this.getVanguardPath().join('config.yaml')
	}

	/**
	 * Generate the complete prompt context for agents.
	 */
	generateAgentContext(): string {
		const implementation = this.architecture.getImplementation(this.stack.id)

		const sections = [
			'## Project Configuration',
			'',
			`**Project**: ${this.name}`,
			`**Type**: ${this.type}`,
			`**Track**: ${this.track}`,
			'',
			'## Tech Stack',
			'',
			`**Stack**: ${this.stack.name} (${this.stack.language})`,
		]

		if (this.database && this.orm) {
			sections.push(`**Database**: ${this.database}`)
			sections.push(`**ORM**: ${this.orm.name} (migrations: ${this.orm.migrationTool})`)
		}

		sections.push(
			`**Auth**: ${this.auth.strategy}${this.auth.provider ? ` (${this.auth.provider})` : ''}`,
		)

		if (this.frontend) {
			sections.push(
				`**Frontend**: ${this.frontend.framework}${this.frontend.uiLibrary ? ` + ${this.frontend.uiLibrary}` : ''}`,
			)
		}

		sections.push(
			'',
			'## Architecture',
			'',
			`**Pattern**: ${this.architecture.name} (${this.architecture.abbreviation})`,
			`**Complexity**: ${this.architecture.complexity}`,
			'',
			'### Principles',
			this.architecture.getPrinciplesForPrompt(),
			'',
			'### Layer Rules',
			this.architecture.getLayerRulesForPrompt(),
			'',
			'### Anti-Patterns to AVOID',
			this.architecture.getAntiPatternsForPrompt(),
			'',
		)

		if (implementation) {
			sections.push('### File Structure')
			sections.push('```')
			sections.push(implementation.structure)
			sections.push('```')
			sections.push('')
		}

		if (this.modules.length > 0) {
			sections.push('### Active Modules')
			for (const module of this.modules) {
				sections.push(`- **${module.name}**: ${module.description}`)
			}
			sections.push('')
		}

		sections.push(this.testing.toPromptContext())

		// Add deployment configuration
		if (this.deployment.primary !== 'none') {
			sections.push('')
			sections.push('## Deployment')
			sections.push('')
			sections.push(`**Primary Target**: ${this.deployment.primary}`)
			if (this.deployment.targets.length > 1) {
				sections.push(`**Available Targets**: ${this.deployment.targets.join(', ')}`)
			}
			sections.push(`**Environments**: ${this.deployment.environments.join(', ')}`)
		}

		sections.push('')
		sections.push('## Governance')
		sections.push(`All work must respect principles in: ${this.getConstitutionPath().toString()}`)

		return sections.join('\n')
	}

	/**
	 * Get few-shot examples for the current stack and architecture.
	 */
	getFewShotExamples(): readonly string[] {
		const examples: string[] = []

		// Add stack examples
		for (const example of this.stack.examples) {
			examples.push(`### ${example.name}\n\`\`\`\n${example.code}\n\`\`\``)
		}

		// Add architecture implementation examples
		const impl = this.architecture.getImplementation(this.stack.id)
		if (impl) {
			for (const [name, code] of impl.examples) {
				examples.push(`### ${name}\n\`\`\`\n${code}\n\`\`\``)
			}
		}

		// Add module examples
		for (const module of this.modules) {
			for (const [name, code] of module.examples) {
				examples.push(`### ${module.name}: ${name}\n\`\`\`\n${code}\n\`\`\``)
			}
		}

		return examples
	}

	/**
	 * Serialize to config YAML structure.
	 */
	toConfig(): ProjectConfig {
		const authConfig: ProjectConfig['stack']['auth'] = {
			strategy: this.auth.strategy,
		}
		if (this.auth.provider !== undefined) {
			authConfig.provider = this.auth.provider
		}

		const testingConfig: ProjectConfig['testing'] = {
			unit: this.testing.unitFramework.id.toString(),
			linter: this.testing.linter.id.toString(),
			formatter: this.testing.formatter.id.toString(),
		}
		if (this.testing.e2eFramework !== undefined) {
			testingConfig.e2e = this.testing.e2eFramework.id.toString()
		}
		if (this.testing.typeChecker !== undefined) {
			testingConfig.typeChecker = this.testing.typeChecker.id.toString()
		}

		const stackConfig: ProjectConfig['stack'] = {
			id: this.stack.id.toString(),
			language: this.stack.language,
			auth: authConfig,
		}

		if (this.orm && this.database) {
			stackConfig.database = {
				type: this.database,
				orm: this.orm.id.toString(),
				migrations: this.orm.migrationTool,
			}
		}

		if (this.frontend) {
			stackConfig.frontend = {
				framework: this.frontend.framework,
				...(this.frontend.uiLibrary && { uiLibrary: this.frontend.uiLibrary }),
				...(this.frontend.styling && { styling: this.frontend.styling }),
			}
		}

		return {
			project: {
				name: this.name,
				type: this.type,
				track: this.track,
				created: this.createdAt.toISOString(),
			},
			stack: stackConfig,
			architecture: {
				primary: this.architecture.id.toString(),
				modules: this.modules.map((m) => m.id.toString()),
			},
			deployment: {
				targets: [...this.deployment.targets],
				primary: this.deployment.primary,
				environments: [...this.deployment.environments],
			},
			testing: testingConfig,
		}
	}
}

/**
 * Serializable project configuration structure.
 */
export interface ProjectConfig {
	project: {
		name: string
		type: ProjectType
		track: Track
		created: string
	}
	stack: {
		id: string
		language: string
		database?: {
			type: DatabaseType
			orm: string
			migrations: string
		}
		auth: {
			strategy: string
			provider?: string
		}
		frontend?: {
			framework: string
			uiLibrary?: string
			styling?: string
		}
	}
	architecture: {
		primary: string
		modules: readonly string[]
	}
	deployment: {
		targets: readonly string[]
		primary: string
		environments: readonly string[]
	}
	testing: {
		unit: string
		e2e?: string
		linter: string
		formatter: string
		typeChecker?: string
	}
}

/**
 * Initialize Project Use Case.
 *
 * Creates a new Vanguard project with selected configuration
 * and generates all project artifacts.
 */

import type { Architecture, ArchitectureModule } from '../../../domain/entities/architecture.js'
import type { DeploymentConfig } from '../../../domain/entities/deployment-config.js'
import type { FrontendConfig } from '../../../domain/entities/frontend-config.js'
import { Project, type ProjectType, type Track } from '../../../domain/entities/project.js'
import type { AuthConfig, DatabaseType, OrmConfig, Stack } from '../../../domain/entities/stack.js'
import type { TestingConfig } from '../../../domain/entities/testing-config.js'

/**
 * Input for initializing a project.
 */
export interface InitializeProjectInput {
	readonly name: string
	readonly type: ProjectType
	readonly track: Track
	readonly rootPath: string
	readonly stack: Stack
	readonly orm?: OrmConfig | undefined
	readonly database?: DatabaseType | undefined
	readonly auth: AuthConfig
	readonly frontend?: FrontendConfig | undefined
	readonly architecture: Architecture
	readonly modules?: readonly ArchitectureModule[] | undefined
	readonly testing: TestingConfig
	readonly deployment: DeploymentConfig
}

/**
 * Output from initializing a project.
 */
export interface InitializeProjectOutput {
	readonly project: Project
	readonly filesGenerated: number
	readonly errors: readonly string[]
}

/**
 * File writer port for writing generated files.
 */
export interface ProjectFileWriter {
	writeAll(
		files: readonly { path: string; content: string }[],
	): Promise<readonly { path: string; success: boolean; error?: string | undefined }[]>
}

/**
 * Project generator port for generating artifacts.
 */
export interface ProjectGenerator {
	generateAll(project: Project): readonly { path: { toString(): string }; content: string }[]
}

/**
 * Use case for initializing a new Vanguard project.
 *
 * Responsibilities:
 * - Validates project configuration compatibility
 * - Creates Project entity
 * - Generates all project artifacts
 * - Writes files to disk
 */
export class InitializeProjectUseCase {
	constructor(
		private readonly generator: ProjectGenerator,
		private readonly fileWriter: ProjectFileWriter,
	) {}

	async execute(input: InitializeProjectInput): Promise<InitializeProjectOutput> {
		// Create project entity (validation happens in factory method)
		const projectParams: Parameters<typeof Project.create>[0] = {
			name: input.name,
			type: input.type,
			track: input.track,
			rootPath: input.rootPath,
			stack: input.stack,
			auth: input.auth,
			architecture: input.architecture,
			modules: input.modules ?? [],
			testing: input.testing,
			deployment: input.deployment,
		}

		if (input.orm !== undefined) {
			projectParams.orm = input.orm
		}
		if (input.database !== undefined) {
			projectParams.database = input.database
		}
		if (input.frontend !== undefined) {
			projectParams.frontend = input.frontend
		}

		const project = Project.create(projectParams)

		// Generate all artifacts
		const files = this.generator.generateAll(project)

		// Write files
		const results = await this.fileWriter.writeAll(
			files.map((f) => ({
				path: f.path.toString(),
				content: f.content,
			})),
		)

		const successful = results.filter((r) => r.success).length
		const errors = results.filter((r) => !r.success).map((r) => `${r.path}: ${r.error}`)

		return {
			project,
			filesGenerated: successful,
			errors,
		}
	}
}

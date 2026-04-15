/**
 * Load Project Use Case.
 *
 * Loads an existing Vanguard project from its configuration files.
 */

import type { Project, ProjectConfig } from '../../../domain/entities/project.js'

/**
 * Project loader port for reading project configuration.
 */
export interface ProjectLoaderPort {
	/**
	 * Check if a Vanguard project exists at the given path.
	 */
	exists(rootPath: string): boolean

	/**
	 * Read the project configuration.
	 */
	readConfig(rootPath: string): ProjectConfig | undefined

	/**
	 * Reconstruct a Project entity from configuration.
	 */
	reconstructProject(rootPath: string, config: ProjectConfig): Project
}

/**
 * Output from loading a project.
 */
export interface LoadProjectOutput {
	readonly project: Project | undefined
	readonly exists: boolean
	readonly error?: string | undefined
}

/**
 * Use case for loading an existing Vanguard project.
 *
 * Responsibilities:
 * - Checks if project exists at path
 * - Reads configuration files
 * - Reconstructs Project entity
 */
export class LoadProjectUseCase {
	constructor(private readonly loader: ProjectLoaderPort) {}

	execute(rootPath: string): LoadProjectOutput {
		// Check if project exists
		if (!this.loader.exists(rootPath)) {
			return {
				project: undefined,
				exists: false,
			}
		}

		// Read configuration
		const config = this.loader.readConfig(rootPath)
		if (!config) {
			return {
				project: undefined,
				exists: true,
				error: 'Failed to read project configuration',
			}
		}

		try {
			const project = this.loader.reconstructProject(rootPath, config)
			return {
				project,
				exists: true,
			}
		} catch (error) {
			return {
				project: undefined,
				exists: true,
				error: error instanceof Error ? error.message : 'Unknown error loading project',
			}
		}
	}
}

/**
 * Check Project Exists Use Case.
 *
 * Simple use case to check if a Vanguard project exists.
 */
export class CheckProjectExistsUseCase {
	constructor(private readonly loader: ProjectLoaderPort) {}

	execute(rootPath: string): boolean {
		return this.loader.exists(rootPath)
	}
}

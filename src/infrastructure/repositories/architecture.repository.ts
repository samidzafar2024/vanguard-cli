/**
 * Architecture Repository Implementation.
 *
 * Provides access to architecture definitions from:
 * - Built-in definitions (compiled into the app)
 * - Project-local YAML files (.vanguard/architectures/)
 * - User-level YAML files (~/.vanguard/architectures/)
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ArchitectureRepository } from '../../application/ports/repositories.js'
import type { Architecture } from '../../domain/entities/architecture.js'
import { Identifier } from '../../domain/value-objects/identifier.js'
import { architectureLoader } from '../loaders/architecture-loader.js'

/**
 * Source of built-in architectures.
 */
export interface BuiltInArchitectureSource {
	getAll(): Architecture[]
	get(id: string): Architecture | undefined
}

/**
 * Extensible architecture repository that combines multiple sources.
 */
export class ExtensibleArchitectureRepository implements ArchitectureRepository {
	private readonly builtIn: BuiltInArchitectureSource
	private readonly projectDir: string
	private readonly userDir: string
	private readonly customArchitectures: Map<string, Architecture> = new Map()
	private initialized = false

	constructor(builtIn: BuiltInArchitectureSource, projectDir: string = process.cwd()) {
		this.builtIn = builtIn
		this.projectDir = join(projectDir, '.vanguard', 'architectures')
		this.userDir = join(homedir(), '.vanguard', 'architectures')
	}

	/**
	 * Ensure custom architectures are loaded.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return

		// Load project-local architectures
		const projectResults = architectureLoader.loadFromDirectory(this.projectDir)
		for (const result of projectResults) {
			if (result.success && result.architecture) {
				this.customArchitectures.set(result.architecture.id.toString(), result.architecture)
			}
		}

		// Load user-level architectures
		const userResults = architectureLoader.loadFromDirectory(this.userDir)
		for (const result of userResults) {
			if (result.success && result.architecture) {
				// Don't override project-local
				const id = result.architecture.id.toString()
				if (!this.customArchitectures.has(id)) {
					this.customArchitectures.set(id, result.architecture)
				}
			}
		}

		this.initialized = true
	}

	async findById(id: string): Promise<Architecture | undefined> {
		await this.ensureInitialized()

		// Check custom first (project-local overrides built-in)
		const custom = this.customArchitectures.get(id)
		if (custom) return custom

		// Fall back to built-in
		return this.builtIn.get(id)
	}

	async findAll(): Promise<readonly Architecture[]> {
		await this.ensureInitialized()

		// Merge built-in with custom (custom overrides)
		const all = new Map<string, Architecture>()

		// Add built-in first
		for (const arch of this.builtIn.getAll()) {
			all.set(arch.id.toString(), arch)
		}

		// Override with custom
		for (const [id, arch] of this.customArchitectures) {
			all.set(id, arch)
		}

		return Array.from(all.values())
	}

	async findByStack(stackId: string): Promise<readonly Architecture[]> {
		const all = await this.findAll()
		const id = Identifier.fromString(stackId)
		return all.filter((arch) => arch.hasImplementationFor(id))
	}

	async register(architecture: Architecture): Promise<void> {
		await this.ensureInitialized()
		this.customArchitectures.set(architecture.id.toString(), architecture)
	}

	/**
	 * Get load errors from custom architectures.
	 */
	getLoadErrors(): readonly string[] {
		const errors: string[] = []

		const projectResults = architectureLoader.loadFromDirectory(this.projectDir)
		for (const result of projectResults) {
			if (!result.success && result.error) {
				errors.push(`Project: ${result.error}`)
			}
		}

		const userResults = architectureLoader.loadFromDirectory(this.userDir)
		for (const result of userResults) {
			if (!result.success && result.error) {
				errors.push(`User: ${result.error}`)
			}
		}

		return errors
	}
}

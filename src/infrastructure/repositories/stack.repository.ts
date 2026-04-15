/**
 * Stack Repository Implementation.
 *
 * Provides access to stack definitions from:
 * - Built-in definitions (compiled into the app)
 * - Project-local YAML files (.vanguard/stacks/)
 * - User-level YAML files (~/.vanguard/stacks/)
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import type { StackRepository } from '../../application/ports/repositories.js'
import type { Stack } from '../../domain/entities/stack.js'
import { stackLoader } from '../loaders/stack-loader.js'

/**
 * Source of built-in stacks.
 */
export interface BuiltInStackSource {
	getAll(): Stack[]
	get(id: string): Stack | undefined
}

/**
 * Extensible stack repository that combines multiple sources.
 */
export class ExtensibleStackRepository implements StackRepository {
	private readonly builtIn: BuiltInStackSource
	private readonly projectDir: string
	private readonly userDir: string
	private readonly customStacks: Map<string, Stack> = new Map()
	private initialized = false

	constructor(builtIn: BuiltInStackSource, projectDir: string = process.cwd()) {
		this.builtIn = builtIn
		this.projectDir = join(projectDir, '.vanguard', 'stacks')
		this.userDir = join(homedir(), '.vanguard', 'stacks')
	}

	/**
	 * Ensure custom stacks are loaded.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return

		// Load project-local stacks
		const projectResults = stackLoader.loadFromDirectory(this.projectDir)
		for (const result of projectResults) {
			if (result.success && result.stack) {
				this.customStacks.set(result.stack.id.toString(), result.stack)
			}
		}

		// Load user-level stacks
		const userResults = stackLoader.loadFromDirectory(this.userDir)
		for (const result of userResults) {
			if (result.success && result.stack) {
				// Don't override project-local
				const id = result.stack.id.toString()
				if (!this.customStacks.has(id)) {
					this.customStacks.set(id, result.stack)
				}
			}
		}

		this.initialized = true
	}

	async findById(id: string): Promise<Stack | undefined> {
		await this.ensureInitialized()

		// Check custom first (project-local overrides built-in)
		const custom = this.customStacks.get(id)
		if (custom) return custom

		// Fall back to built-in
		return this.builtIn.get(id)
	}

	async findAll(): Promise<readonly Stack[]> {
		await this.ensureInitialized()

		// Merge built-in with custom (custom overrides)
		const all = new Map<string, Stack>()

		// Add built-in first
		for (const stack of this.builtIn.getAll()) {
			all.set(stack.id.toString(), stack)
		}

		// Override with custom
		for (const [id, stack] of this.customStacks) {
			all.set(id, stack)
		}

		return Array.from(all.values())
	}

	async findByLanguage(language: string): Promise<readonly Stack[]> {
		const all = await this.findAll()
		return all.filter((stack) => stack.language === language)
	}

	async register(stack: Stack): Promise<void> {
		await this.ensureInitialized()
		this.customStacks.set(stack.id.toString(), stack)
	}

	/**
	 * Get load errors from custom stacks.
	 */
	getLoadErrors(): readonly string[] {
		const errors: string[] = []

		const projectResults = stackLoader.loadFromDirectory(this.projectDir)
		for (const result of projectResults) {
			if (!result.success && result.error) {
				errors.push(`Project: ${result.error}`)
			}
		}

		const userResults = stackLoader.loadFromDirectory(this.userDir)
		for (const result of userResults) {
			if (!result.success && result.error) {
				errors.push(`User: ${result.error}`)
			}
		}

		return errors
	}
}

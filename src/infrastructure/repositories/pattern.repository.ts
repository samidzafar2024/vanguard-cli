/**
 * Pattern Repository Implementation.
 *
 * Provides access to tech pattern definitions from:
 * - Built-in patterns (compiled into the app)
 * - Project-local YAML files (.vanguard/patterns/)
 * - User-level YAML files (~/.vanguard/patterns/)
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
	PatternRepository,
	TechPattern as TechPatternInterface,
} from '../../application/ports/repositories.js'
import type { TechPattern } from '../../domain/entities/tech-pattern.js'
import { patternLoader } from '../loaders/pattern-loader.js'

/**
 * Source of built-in patterns.
 */
export interface BuiltInPatternSource {
	getAll(): TechPattern[]
	get(id: string): TechPattern | undefined
}

/**
 * Adapter to convert domain TechPattern to repository interface.
 */
function toPatternInterface(pattern: TechPattern): TechPatternInterface {
	return {
		id: pattern.id.toString(),
		name: pattern.name,
		description: pattern.description,
		applicableStacks: pattern.applicableStacks,
		applicableArchitectures: pattern.applicableArchitectures,
		principles: pattern.principles.map((p) => p.description),
		antiPatterns: pattern.antiPatterns.map((ap) => ap.description),
	}
}

/**
 * Extensible pattern repository that combines multiple sources.
 */
export class ExtensiblePatternRepository implements PatternRepository {
	private readonly builtIn: BuiltInPatternSource | undefined
	private readonly projectDir: string
	private readonly userDir: string
	private readonly customPatterns: Map<string, TechPattern> = new Map()
	private initialized = false

	constructor(builtIn?: BuiltInPatternSource | undefined, projectDir: string = process.cwd()) {
		this.builtIn = builtIn
		this.projectDir = join(projectDir, '.vanguard', 'patterns')
		this.userDir = join(homedir(), '.vanguard', 'patterns')
	}

	/**
	 * Ensure custom patterns are loaded.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return

		// Load project-local patterns
		const projectResults = patternLoader.loadFromDirectory(this.projectDir)
		for (const result of projectResults) {
			if (result.success && result.pattern) {
				this.customPatterns.set(result.pattern.id.toString(), result.pattern)
			}
		}

		// Load user-level patterns
		const userResults = patternLoader.loadFromDirectory(this.userDir)
		for (const result of userResults) {
			if (result.success && result.pattern) {
				// Don't override project-local
				const id = result.pattern.id.toString()
				if (!this.customPatterns.has(id)) {
					this.customPatterns.set(id, result.pattern)
				}
			}
		}

		this.initialized = true
	}

	async findById(id: string): Promise<TechPatternInterface | undefined> {
		await this.ensureInitialized()

		// Check custom first
		const custom = this.customPatterns.get(id)
		if (custom) return toPatternInterface(custom)

		// Fall back to built-in
		const builtIn = this.builtIn?.get(id)
		if (builtIn) return toPatternInterface(builtIn)

		return undefined
	}

	async findAll(): Promise<readonly TechPatternInterface[]> {
		await this.ensureInitialized()

		const all = new Map<string, TechPattern>()

		// Add built-in first
		if (this.builtIn) {
			for (const pattern of this.builtIn.getAll()) {
				all.set(pattern.id.toString(), pattern)
			}
		}

		// Override with custom
		for (const [id, pattern] of this.customPatterns) {
			all.set(id, pattern)
		}

		return Array.from(all.values()).map(toPatternInterface)
	}

	async findByStack(stackId: string): Promise<readonly TechPatternInterface[]> {
		const all = await this.findAllDomain()
		return all.filter((p) => p.appliesToStack(stackId)).map(toPatternInterface)
	}

	async findByArchitecture(architectureId: string): Promise<readonly TechPatternInterface[]> {
		const all = await this.findAllDomain()
		return all.filter((p) => p.appliesToArchitecture(architectureId)).map(toPatternInterface)
	}

	async register(_pattern: TechPatternInterface): Promise<void> {
		// This registers the interface, but we need the domain object
		// For external registration, we'd need to convert back
		throw new Error('Use registerDomain() to register TechPattern entities')
	}

	/**
	 * Register a domain TechPattern directly.
	 */
	async registerDomain(pattern: TechPattern): Promise<void> {
		await this.ensureInitialized()
		this.customPatterns.set(pattern.id.toString(), pattern)
	}

	/**
	 * Get domain TechPattern by ID.
	 */
	async findDomainById(id: string): Promise<TechPattern | undefined> {
		await this.ensureInitialized()
		return this.customPatterns.get(id) ?? this.builtIn?.get(id)
	}

	/**
	 * Get all domain TechPatterns.
	 */
	async findAllDomain(): Promise<readonly TechPattern[]> {
		await this.ensureInitialized()

		const all = new Map<string, TechPattern>()

		if (this.builtIn) {
			for (const pattern of this.builtIn.getAll()) {
				all.set(pattern.id.toString(), pattern)
			}
		}

		for (const [id, pattern] of this.customPatterns) {
			all.set(id, pattern)
		}

		return Array.from(all.values())
	}

	/**
	 * Find patterns applicable to a stack/architecture combination.
	 */
	async findApplicable(stackId: string, architectureId: string): Promise<readonly TechPattern[]> {
		const all = await this.findAllDomain()
		return all.filter((p) => p.appliesTo(stackId, architectureId))
	}

	/**
	 * Get load errors from custom patterns.
	 */
	getLoadErrors(): readonly string[] {
		const errors: string[] = []

		const projectResults = patternLoader.loadFromDirectory(this.projectDir)
		for (const result of projectResults) {
			if (!result.success && result.error) {
				errors.push(`Project: ${result.error}`)
			}
		}

		const userResults = patternLoader.loadFromDirectory(this.userDir)
		for (const result of userResults) {
			if (!result.success && result.error) {
				errors.push(`User: ${result.error}`)
			}
		}

		return errors
	}
}

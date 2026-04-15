import type { Architecture, ArchitectureModule, ComplexityLevel } from '../entities/architecture.js'
import type { Identifier } from '../value-objects/identifier.js'

/**
 * Repository interface for Architecture entities.
 */
export interface ArchitectureRepository {
	/**
	 * Find an architecture by its identifier.
	 */
	findById(id: Identifier): Promise<Architecture | undefined>

	/**
	 * Find all architectures.
	 */
	findAll(): Promise<readonly Architecture[]>

	/**
	 * Find architectures by complexity level.
	 */
	findByComplexity(complexity: ComplexityLevel): Promise<readonly Architecture[]>

	/**
	 * Find architectures that have implementations for a given stack.
	 */
	findByStackId(stackId: Identifier): Promise<readonly Architecture[]>

	/**
	 * Check if an architecture exists.
	 */
	exists(id: Identifier): Promise<boolean>
}

/**
 * Repository interface for ArchitectureModule entities.
 */
export interface ArchitectureModuleRepository {
	/**
	 * Find a module by its identifier.
	 */
	findById(id: Identifier): Promise<ArchitectureModule | undefined>

	/**
	 * Find all modules.
	 */
	findAll(): Promise<readonly ArchitectureModule[]>

	/**
	 * Find modules compatible with a given architecture.
	 */
	findByArchitectureId(architectureId: Identifier): Promise<readonly ArchitectureModule[]>

	/**
	 * Check if a module exists.
	 */
	exists(id: Identifier): Promise<boolean>
}

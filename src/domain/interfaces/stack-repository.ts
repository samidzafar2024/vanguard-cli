import type { Language, Stack, StackCategory } from '../entities/stack.js'
import type { Identifier } from '../value-objects/identifier.js'

/**
 * Repository interface for Stack entities.
 * Follows repository pattern - infrastructure implements this interface.
 */
export interface StackRepository {
	/**
	 * Find a stack by its identifier.
	 */
	findById(id: Identifier): Promise<Stack | undefined>

	/**
	 * Find all stacks for a given language.
	 */
	findByLanguage(language: Language): Promise<readonly Stack[]>

	/**
	 * Find all stacks for a given category.
	 */
	findByCategory(category: StackCategory): Promise<readonly Stack[]>

	/**
	 * Find all stacks that support a specific language and category.
	 */
	findByLanguageAndCategory(language: Language, category: StackCategory): Promise<readonly Stack[]>

	/**
	 * Get all available stacks.
	 */
	findAll(): Promise<readonly Stack[]>

	/**
	 * Get all unique languages with available stacks.
	 */
	getAvailableLanguages(): Promise<readonly Language[]>

	/**
	 * Check if a stack exists.
	 */
	exists(id: Identifier): Promise<boolean>
}

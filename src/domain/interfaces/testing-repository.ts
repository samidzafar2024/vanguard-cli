import type { Language } from '../entities/stack.js'
import type {
	LintCategory,
	LintTool,
	TestCategory,
	TestFramework,
} from '../entities/testing-config.js'
import type { Identifier } from '../value-objects/identifier.js'

/**
 * Repository interface for TestFramework entities.
 */
export interface TestFrameworkRepository {
	/**
	 * Find a test framework by its identifier.
	 */
	findById(id: Identifier): Promise<TestFramework | undefined>

	/**
	 * Find all test frameworks for a language.
	 */
	findByLanguage(language: Language): Promise<readonly TestFramework[]>

	/**
	 * Find all test frameworks for a language and category.
	 */
	findByLanguageAndCategory(
		language: Language,
		category: TestCategory,
	): Promise<readonly TestFramework[]>

	/**
	 * Get the recommended framework for a language and category.
	 */
	getRecommended(language: Language, category: TestCategory): Promise<TestFramework | undefined>
}

/**
 * Repository interface for LintTool entities.
 */
export interface LintToolRepository {
	/**
	 * Find a lint tool by its identifier.
	 */
	findById(id: Identifier): Promise<LintTool | undefined>

	/**
	 * Find all lint tools for a language.
	 */
	findByLanguage(language: Language): Promise<readonly LintTool[]>

	/**
	 * Find all lint tools for a language and category.
	 */
	findByLanguageAndCategory(
		language: Language,
		category: LintCategory,
	): Promise<readonly LintTool[]>

	/**
	 * Get the recommended tool for a language and category.
	 */
	getRecommended(language: Language, category: LintCategory): Promise<LintTool | undefined>
}

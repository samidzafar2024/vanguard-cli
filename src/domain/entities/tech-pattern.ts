/**
 * TechPattern Entity.
 *
 * Represents a stack-specific or architecture-specific coding pattern
 * or convention (e.g., "Tao of React", "SOLID principles").
 *
 * TechPatterns provide:
 * - Principles for code organization and style
 * - Anti-patterns to avoid
 * - Code examples for few-shot prompting
 * - Applicability rules for stacks and architectures
 */

import { Identifier } from '../value-objects/identifier.js'

/**
 * Code example for few-shot prompting within a pattern.
 */
export interface PatternExample {
	readonly name: string
	readonly description: string
	readonly code: string
	readonly filename?: string | undefined
}

/**
 * Anti-pattern definition within a tech pattern.
 */
export interface PatternAntiPattern {
	readonly name: string
	readonly description: string
	readonly badExample?: string | undefined
	readonly goodExample?: string | undefined
	readonly fix: string
}

/**
 * Principle within a tech pattern.
 */
export interface PatternPrinciple {
	readonly name: string
	readonly description: string
	readonly rationale?: string | undefined
}

/**
 * TechPattern Entity - defines coding conventions and patterns
 * for specific stacks or architectures.
 */
export class TechPattern {
	private constructor(
		public readonly id: Identifier,
		public readonly name: string,
		public readonly description: string,
		public readonly source: string,
		public readonly applicableStacks: readonly string[],
		public readonly applicableArchitectures: readonly string[],
		public readonly principles: readonly PatternPrinciple[],
		public readonly antiPatterns: readonly PatternAntiPattern[],
		public readonly examples: readonly PatternExample[],
		public readonly fileOrganization?: string | undefined,
		public readonly namingConventions?: Readonly<Record<string, string>> | undefined,
	) {}

	static create(params: {
		id: string
		name: string
		description: string
		source?: string | undefined
		applicableStacks?: readonly string[] | undefined
		applicableArchitectures?: readonly string[] | undefined
		principles: readonly PatternPrinciple[]
		antiPatterns?: readonly PatternAntiPattern[] | undefined
		examples?: readonly PatternExample[] | undefined
		fileOrganization?: string | undefined
		namingConventions?: Record<string, string> | undefined
	}): TechPattern {
		return new TechPattern(
			Identifier.create(params.id),
			params.name,
			params.description,
			params.source ?? '',
			params.applicableStacks ?? [],
			params.applicableArchitectures ?? [],
			params.principles,
			params.antiPatterns ?? [],
			params.examples ?? [],
			params.fileOrganization,
			params.namingConventions,
		)
	}

	/**
	 * Check if this pattern applies to a given stack.
	 */
	appliesToStack(stackId: string): boolean {
		// Empty list means applies to all
		if (this.applicableStacks.length === 0) return true
		return this.applicableStacks.includes(stackId)
	}

	/**
	 * Check if this pattern applies to a given architecture.
	 */
	appliesToArchitecture(architectureId: string): boolean {
		// Empty list means applies to all
		if (this.applicableArchitectures.length === 0) return true
		return this.applicableArchitectures.includes(architectureId)
	}

	/**
	 * Check if this pattern applies to a stack/architecture combination.
	 */
	appliesTo(stackId: string, architectureId: string): boolean {
		return this.appliesToStack(stackId) && this.appliesToArchitecture(architectureId)
	}

	/**
	 * Get principles formatted for prompt injection.
	 */
	getPrinciplesForPrompt(): string {
		return this.principles
			.map((p, i) => {
				let text = `${i + 1}. **${p.name}**: ${p.description}`
				if (p.rationale) {
					text += `\n   _Rationale: ${p.rationale}_`
				}
				return text
			})
			.join('\n')
	}

	/**
	 * Get anti-patterns formatted for prompt injection.
	 */
	getAntiPatternsForPrompt(): string {
		return this.antiPatterns
			.map((ap) => {
				let text = `- **${ap.name}**: ${ap.description}`
				text += `\n  _Fix: ${ap.fix}_`
				return text
			})
			.join('\n')
	}

	/**
	 * Get examples formatted for few-shot prompting.
	 */
	getExamplesForPrompt(): string {
		return this.examples
			.map((ex) => {
				let text = `### ${ex.name}\n${ex.description}\n`
				if (ex.filename) {
					text += `\`\`\`${this.guessLanguage(ex.filename)}\n// ${ex.filename}\n${ex.code}\n\`\`\``
				} else {
					text += `\`\`\`\n${ex.code}\n\`\`\``
				}
				return text
			})
			.join('\n\n')
	}

	/**
	 * Get naming conventions formatted for prompt.
	 */
	getNamingConventionsForPrompt(): string {
		if (!this.namingConventions) return ''
		return Object.entries(this.namingConventions)
			.map(([key, value]) => `- **${key}**: ${value}`)
			.join('\n')
	}

	/**
	 * Generate full context for agent prompts.
	 */
	toPromptContext(): string {
		const sections: string[] = [`## ${this.name}`, '', this.description]

		if (this.source) {
			sections.push('', `_Source: ${this.source}_`)
		}

		sections.push('', '### Principles', '', this.getPrinciplesForPrompt())

		if (this.antiPatterns.length > 0) {
			sections.push('', '### Anti-Patterns to Avoid', '', this.getAntiPatternsForPrompt())
		}

		if (this.fileOrganization) {
			sections.push('', '### File Organization', '', '```', this.fileOrganization, '```')
		}

		if (this.namingConventions) {
			sections.push('', '### Naming Conventions', '', this.getNamingConventionsForPrompt())
		}

		if (this.examples.length > 0) {
			sections.push('', '### Examples', '', this.getExamplesForPrompt())
		}

		return sections.join('\n')
	}

	private guessLanguage(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase()
		const langMap: Record<string, string> = {
			ts: 'typescript',
			tsx: 'tsx',
			js: 'javascript',
			jsx: 'jsx',
			py: 'python',
			cs: 'csharp',
			go: 'go',
			rs: 'rust',
			java: 'java',
		}
		return langMap[ext ?? ''] ?? ''
	}
}

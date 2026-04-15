import { Identifier } from '../value-objects/identifier.js'

/**
 * Complexity level for architecture patterns.
 */
export type ComplexityLevel = 'low' | 'medium' | 'high'

/**
 * Layer definition within an architecture pattern.
 */
export interface ArchitectureLayer {
	readonly name: string
	readonly description: string
	readonly contains: readonly string[]
	readonly rules: readonly string[]
}

/**
 * Anti-pattern to avoid.
 */
export interface AntiPattern {
	readonly name: string
	readonly description: string
	readonly fix: string
}

/**
 * Stack-specific implementation of an architecture pattern.
 */
export interface StackImplementation {
	readonly stackId: Identifier
	readonly structure: string
	readonly examples: ReadonlyMap<string, string>
}

/**
 * Architecture Entity - represents an architectural pattern (DDD, Clean, MVC, etc.)
 * Contains principles, layer definitions, and stack-specific implementations.
 */
export class Architecture {
	private constructor(
		public readonly id: Identifier,
		public readonly name: string,
		public readonly abbreviation: string,
		public readonly complexity: ComplexityLevel,
		public readonly bestFor: readonly string[],
		public readonly principles: readonly string[],
		public readonly layers: readonly ArchitectureLayer[],
		public readonly antiPatterns: readonly AntiPattern[],
		public readonly implementations: ReadonlyMap<string, StackImplementation>,
		public readonly description: string,
	) {}

	static create(params: {
		id: string
		name: string
		abbreviation: string
		complexity: ComplexityLevel
		bestFor: readonly string[]
		principles: readonly string[]
		layers: readonly ArchitectureLayer[]
		antiPatterns: readonly AntiPattern[]
		implementations: Record<string, StackImplementation>
		description: string
	}): Architecture {
		return new Architecture(
			Identifier.create(params.id),
			params.name,
			params.abbreviation,
			params.complexity,
			params.bestFor,
			params.principles,
			params.layers,
			params.antiPatterns,
			new Map(Object.entries(params.implementations)),
			params.description,
		)
	}

	/**
	 * Check if this architecture has an implementation for a given stack.
	 */
	hasImplementationFor(stackId: Identifier): boolean {
		return this.implementations.has(stackId.toString())
	}

	/**
	 * Get the implementation for a specific stack.
	 */
	getImplementation(stackId: Identifier): StackImplementation | undefined {
		return this.implementations.get(stackId.toString())
	}

	/**
	 * Get all principles formatted for prompt injection.
	 */
	getPrinciplesForPrompt(): string {
		return this.principles.map((p, i) => `${i + 1}. ${p}`).join('\n')
	}

	/**
	 * Get layer rules formatted for prompt injection.
	 */
	getLayerRulesForPrompt(): string {
		return this.layers
			.map((layer) => {
				const rules = layer.rules.map((r) => `  - ${r}`).join('\n')
				return `### ${layer.name}\n${layer.description}\n**Rules:**\n${rules}`
			})
			.join('\n\n')
	}

	/**
	 * Get anti-patterns formatted for prompt injection.
	 */
	getAntiPatternsForPrompt(): string {
		return this.antiPatterns
			.map((ap) => `**${ap.name}**: ${ap.description}\n  Fix: ${ap.fix}`)
			.join('\n\n')
	}

	/**
	 * Check if this architecture is suitable for a given use case.
	 */
	isSuitableFor(useCase: string): boolean {
		const lowerUseCase = useCase.toLowerCase()
		return this.bestFor.some((bf) => bf.toLowerCase().includes(lowerUseCase))
	}
}

/**
 * Optional architecture module (CQRS, Event Sourcing, etc.)
 */
export class ArchitectureModule {
	private constructor(
		public readonly id: Identifier,
		public readonly name: string,
		public readonly description: string,
		public readonly principles: readonly string[],
		public readonly compatibleArchitectures: readonly Identifier[],
		public readonly examples: ReadonlyMap<string, string>,
	) {}

	static create(params: {
		id: string
		name: string
		description: string
		principles: readonly string[]
		compatibleArchitectures: readonly string[]
		examples: Record<string, string>
	}): ArchitectureModule {
		return new ArchitectureModule(
			Identifier.create(params.id),
			params.name,
			params.description,
			params.principles,
			params.compatibleArchitectures.map((id) => Identifier.create(id)),
			new Map(Object.entries(params.examples)),
		)
	}

	/**
	 * Check if this module is compatible with a given architecture.
	 */
	isCompatibleWith(architectureId: Identifier): boolean {
		return this.compatibleArchitectures.some((id) => id.equals(architectureId))
	}
}

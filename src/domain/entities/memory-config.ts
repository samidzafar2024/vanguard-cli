import { InvalidMemoryConfigError } from '../errors/memory-errors.js'
import type { ConfidenceLevel } from '../value-objects/confidence.js'

/**
 * Embedding model configuration.
 */
export interface EmbeddingConfig {
	readonly model: string
	readonly dimensions: number
}

/**
 * Auto-capture extraction settings.
 */
export interface AutoCaptureExtractConfig {
	readonly patterns: boolean
	readonly decisions: boolean
	readonly errorSolutions: boolean
	readonly conventions: boolean
}

/**
 * Auto-capture configuration.
 */
export interface AutoCaptureConfig {
	readonly enabled: boolean
	readonly confidenceThreshold: ConfidenceLevel
	readonly requireReview: boolean
	readonly extract: AutoCaptureExtractConfig
	readonly excludePaths: readonly string[]
}

/**
 * Search configuration.
 */
export interface SearchConfig {
	readonly defaultLimit: number
	readonly similarityThreshold: number
	readonly includeRelations: boolean
	readonly maxRelationDepth: number
}

/**
 * Hook configuration.
 */
export interface HookConfig {
	readonly preTask: { readonly enabled: boolean; readonly timeout: number }
	readonly postTask: { readonly enabled: boolean; readonly timeout: number }
}

/**
 * Parameters for creating a MemoryConfig.
 */
export interface MemoryConfigParams {
	readonly version: number
	readonly project: string
	readonly groupId?: string
	readonly embeddings: EmbeddingConfig
	readonly autoCapture: AutoCaptureConfig
	readonly search: SearchConfig
	readonly hooks: HookConfig
}

/**
 * MemoryConfig entity - configuration for memory behavior.
 */
export class MemoryConfig {
	private constructor(
		public readonly version: number,
		public readonly project: string,
		public readonly groupId: string | undefined,
		public readonly embeddings: EmbeddingConfig,
		public readonly autoCapture: AutoCaptureConfig,
		public readonly search: SearchConfig,
		public readonly hooks: HookConfig,
	) {}

	/**
	 * Default configuration values.
	 */
	static readonly DEFAULT: MemoryConfig = new MemoryConfig(
		1,
		'',
		undefined,
		{
			model: 'text-embedding-3-large',
			dimensions: 1536,
		},
		{
			enabled: true,
			confidenceThreshold: 'medium',
			requireReview: true,
			extract: {
				patterns: true,
				decisions: true,
				errorSolutions: true,
				conventions: false,
			},
			excludePaths: ['node_modules/**', '*.test.ts', '*.spec.ts', 'dist/**'],
		},
		{
			defaultLimit: 5,
			similarityThreshold: 0.6,
			includeRelations: true,
			maxRelationDepth: 2,
		},
		{
			preTask: { enabled: true, timeout: 5000 },
			postTask: { enabled: true, timeout: 10000 },
		},
	)

	/**
	 * Create a MemoryConfig with custom values.
	 */
	static create(params: Partial<MemoryConfigParams> & { project: string }): MemoryConfig {
		const defaults = MemoryConfig.DEFAULT

		if (!params.project?.trim()) {
			throw new InvalidMemoryConfigError('Project name is required')
		}

		const embeddings = MemoryConfig.mergeEmbeddings(defaults.embeddings, params.embeddings)
		const autoCapture = MemoryConfig.mergeAutoCapture(defaults.autoCapture, params.autoCapture)
		const search = MemoryConfig.mergeSearch(defaults.search, params.search)
		const hooks = MemoryConfig.mergeHooks(defaults.hooks, params.hooks)

		return new MemoryConfig(
			params.version ?? defaults.version,
			params.project.trim(),
			params.groupId ?? defaults.groupId,
			embeddings,
			autoCapture,
			search,
			hooks,
		)
	}

	private static mergeEmbeddings(
		defaults: EmbeddingConfig,
		override?: Partial<EmbeddingConfig>,
	): EmbeddingConfig {
		const result = override ? { ...defaults, ...override } : defaults
		if (result.dimensions <= 0) {
			throw new InvalidMemoryConfigError('Embedding dimensions must be positive')
		}
		return result
	}

	private static mergeAutoCapture(
		defaults: AutoCaptureConfig,
		override?: Partial<AutoCaptureConfig>,
	): AutoCaptureConfig {
		if (!override) return defaults
		return {
			...defaults,
			...override,
			extract: override.extract ? { ...defaults.extract, ...override.extract } : defaults.extract,
		}
	}

	private static mergeSearch(
		defaults: SearchConfig,
		override?: Partial<SearchConfig>,
	): SearchConfig {
		const result = override ? { ...defaults, ...override } : defaults
		if (result.defaultLimit <= 0) {
			throw new InvalidMemoryConfigError('Search default limit must be positive')
		}
		if (result.similarityThreshold < 0 || result.similarityThreshold > 1) {
			throw new InvalidMemoryConfigError('Search similarity threshold must be between 0 and 1')
		}
		if (result.maxRelationDepth < 0) {
			throw new InvalidMemoryConfigError('Max relation depth must be non-negative')
		}
		return result
	}

	private static mergeHooks(defaults: HookConfig, override?: Partial<HookConfig>): HookConfig {
		if (!override) return defaults
		const result = {
			preTask: override.preTask ? { ...defaults.preTask, ...override.preTask } : defaults.preTask,
			postTask: override.postTask
				? { ...defaults.postTask, ...override.postTask }
				: defaults.postTask,
		}
		if (result.preTask.timeout <= 0 || result.postTask.timeout <= 0) {
			throw new InvalidMemoryConfigError('Hook timeouts must be positive')
		}
		return result
	}

	/**
	 * Merge this config with overrides.
	 */
	merge(overrides: Partial<MemoryConfigParams>): MemoryConfig {
		const mergedGroupId = overrides.groupId ?? this.groupId
		return MemoryConfig.create({
			version: overrides.version ?? this.version,
			project: overrides.project ?? this.project,
			...(mergedGroupId !== undefined && { groupId: mergedGroupId }),
			embeddings: overrides.embeddings
				? { ...this.embeddings, ...overrides.embeddings }
				: this.embeddings,
			autoCapture: overrides.autoCapture
				? {
						...this.autoCapture,
						...overrides.autoCapture,
						extract: overrides.autoCapture.extract
							? { ...this.autoCapture.extract, ...overrides.autoCapture.extract }
							: this.autoCapture.extract,
					}
				: this.autoCapture,
			search: overrides.search ? { ...this.search, ...overrides.search } : this.search,
			hooks: overrides.hooks
				? {
						preTask: overrides.hooks.preTask
							? { ...this.hooks.preTask, ...overrides.hooks.preTask }
							: this.hooks.preTask,
						postTask: overrides.hooks.postTask
							? { ...this.hooks.postTask, ...overrides.hooks.postTask }
							: this.hooks.postTask,
					}
				: this.hooks,
		})
	}

	/**
	 * Convert to a plain object for serialization.
	 */
	toObject(): MemoryConfigParams {
		return {
			version: this.version,
			project: this.project,
			...(this.groupId && { groupId: this.groupId }),
			embeddings: { ...this.embeddings },
			autoCapture: {
				...this.autoCapture,
				extract: { ...this.autoCapture.extract },
				excludePaths: [...this.autoCapture.excludePaths],
			},
			search: { ...this.search },
			hooks: {
				preTask: { ...this.hooks.preTask },
				postTask: { ...this.hooks.postTask },
			},
		}
	}

	/**
	 * Check if auto-capture is enabled for a given extraction type.
	 */
	isExtractionEnabled(type: keyof AutoCaptureExtractConfig): boolean {
		return this.autoCapture.enabled && this.autoCapture.extract[type]
	}

	/**
	 * Check if a path should be excluded from auto-capture.
	 */
	isPathExcluded(path: string): boolean {
		return this.autoCapture.excludePaths.some((pattern) => {
			// Use placeholder to prevent ** from being corrupted by * replacement
			const regexPattern = pattern
				.replace(/\./g, '\\.')
				.replace(/\*\*/g, '\0DOUBLESTAR\0')
				.replace(/\*/g, '[^/]*')
				.replace(/\0DOUBLESTAR\0/g, '.*')
			return new RegExp(`^${regexPattern}$`).test(path)
		})
	}
}

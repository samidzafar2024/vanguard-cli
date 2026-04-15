/**
 * File-based Memory Config Repository Implementation.
 *
 * Stores memory configuration as a YAML file at
 * .vanguard/memory/config.yaml
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { z } from 'zod'
import type { MemoryConfigRepository } from '../../application/ports/memory-repository.js'
import { MemoryConfig } from '../../domain/entities/memory-config.js'

/**
 * Zod schema for memory config YAML.
 */
const MemoryConfigYamlSchema = z.object({
	version: z.number().optional(),
	project: z.string(),
	group_id: z.string().optional(),
	embeddings: z
		.object({
			model: z.string().optional(),
			dimensions: z.number().optional(),
		})
		.optional(),
	auto_capture: z
		.object({
			enabled: z.boolean().optional(),
			confidence_threshold: z.enum(['low', 'medium', 'high']).optional(),
			require_review: z.boolean().optional(),
			extract: z
				.object({
					patterns: z.boolean().optional(),
					decisions: z.boolean().optional(),
					error_solutions: z.boolean().optional(),
					conventions: z.boolean().optional(),
				})
				.optional(),
			exclude_paths: z.array(z.string()).optional(),
		})
		.optional(),
	search: z
		.object({
			default_limit: z.number().optional(),
			similarity_threshold: z.number().optional(),
			include_relations: z.boolean().optional(),
			max_relation_depth: z.number().optional(),
		})
		.optional(),
	hooks: z
		.object({
			pre_task: z
				.object({
					enabled: z.boolean().optional(),
					timeout: z.number().optional(),
				})
				.optional(),
			post_task: z
				.object({
					enabled: z.boolean().optional(),
					timeout: z.number().optional(),
				})
				.optional(),
		})
		.optional(),
})

type MemoryConfigYaml = z.infer<typeof MemoryConfigYamlSchema>

/**
 * File-based implementation of MemoryConfigRepository.
 */
export class FileMemoryConfigRepository implements MemoryConfigRepository {
	private readonly configPath: string
	private readonly memoryDir: string

	constructor(cwd: string = process.cwd()) {
		this.memoryDir = join(cwd, '.vanguard', 'memory')
		this.configPath = join(this.memoryDir, 'config.yaml')
	}

	async load(): Promise<MemoryConfig | undefined> {
		if (!existsSync(this.configPath)) {
			return undefined
		}

		try {
			const content = readFileSync(this.configPath, 'utf-8')
			const data = parse(content)
			const validated = MemoryConfigYamlSchema.parse(data)

			return this.yamlToConfig(validated)
		} catch {
			return undefined
		}
	}

	async save(config: MemoryConfig): Promise<void> {
		// Ensure directory exists
		if (!existsSync(this.memoryDir)) {
			mkdirSync(this.memoryDir, { recursive: true })
		}

		// Also create the items directory
		const itemsDir = join(this.memoryDir, 'items')
		if (!existsSync(itemsDir)) {
			mkdirSync(itemsDir, { recursive: true })
		}

		const yaml = this.configToYaml(config)
		const content = stringify(yaml, {
			indent: 2,
			lineWidth: 0,
		})

		writeFileSync(this.configPath, content, 'utf-8')
	}

	async isInitialized(): Promise<boolean> {
		return existsSync(this.configPath)
	}

	/**
	 * Convert YAML data to MemoryConfig.
	 */
	private yamlToConfig(yaml: MemoryConfigYaml): MemoryConfig {
		return MemoryConfig.create({
			project: yaml.project,
			...(yaml.group_id && { groupId: yaml.group_id }),
			...(yaml.version !== undefined && { version: yaml.version }),
			...(yaml.embeddings && {
				embeddings: {
					model: yaml.embeddings.model ?? 'text-embedding-3-large',
					dimensions: yaml.embeddings.dimensions ?? 1536,
				},
			}),
			...(yaml.auto_capture && {
				autoCapture: {
					enabled: yaml.auto_capture.enabled ?? true,
					confidenceThreshold: yaml.auto_capture.confidence_threshold ?? 'medium',
					requireReview: yaml.auto_capture.require_review ?? true,
					extract: {
						patterns: yaml.auto_capture.extract?.patterns ?? true,
						decisions: yaml.auto_capture.extract?.decisions ?? true,
						errorSolutions: yaml.auto_capture.extract?.error_solutions ?? true,
						conventions: yaml.auto_capture.extract?.conventions ?? false,
					},
					excludePaths: yaml.auto_capture.exclude_paths ?? [
						'node_modules/**',
						'*.test.ts',
						'*.spec.ts',
						'dist/**',
					],
				},
			}),
			...(yaml.search && {
				search: {
					defaultLimit: yaml.search.default_limit ?? 5,
					similarityThreshold: yaml.search.similarity_threshold ?? 0.6,
					includeRelations: yaml.search.include_relations ?? true,
					maxRelationDepth: yaml.search.max_relation_depth ?? 2,
				},
			}),
			...(yaml.hooks && {
				hooks: {
					preTask: {
						enabled: yaml.hooks.pre_task?.enabled ?? true,
						timeout: yaml.hooks.pre_task?.timeout ?? 5000,
					},
					postTask: {
						enabled: yaml.hooks.post_task?.enabled ?? true,
						timeout: yaml.hooks.post_task?.timeout ?? 10000,
					},
				},
			}),
		})
	}

	/**
	 * Convert MemoryConfig to YAML format.
	 */
	private configToYaml(config: MemoryConfig): MemoryConfigYaml {
		return {
			version: config.version,
			project: config.project,
			...(config.groupId && { group_id: config.groupId }),
			embeddings: {
				model: config.embeddings.model,
				dimensions: config.embeddings.dimensions,
			},
			auto_capture: {
				enabled: config.autoCapture.enabled,
				confidence_threshold: config.autoCapture.confidenceThreshold,
				require_review: config.autoCapture.requireReview,
				extract: {
					patterns: config.autoCapture.extract.patterns,
					decisions: config.autoCapture.extract.decisions,
					error_solutions: config.autoCapture.extract.errorSolutions,
					conventions: config.autoCapture.extract.conventions,
				},
				exclude_paths: [...config.autoCapture.excludePaths],
			},
			search: {
				default_limit: config.search.defaultLimit,
				similarity_threshold: config.search.similarityThreshold,
				include_relations: config.search.includeRelations,
				max_relation_depth: config.search.maxRelationDepth,
			},
			hooks: {
				pre_task: {
					enabled: config.hooks.preTask.enabled,
					timeout: config.hooks.preTask.timeout,
				},
				post_task: {
					enabled: config.hooks.postTask.enabled,
					timeout: config.hooks.postTask.timeout,
				},
			},
		}
	}
}

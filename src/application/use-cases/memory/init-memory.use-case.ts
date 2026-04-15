/**
 * Initialize Memory Use Case.
 *
 * Initializes the .vanguard/memory/ directory structure
 * and creates the default configuration.
 */

import { MemoryConfig } from '../../../domain/entities/memory-config.js'
import { MemoryInitializationError } from '../../../domain/errors/memory-errors.js'
import type { MemoryConfigRepository } from '../../ports/memory-repository.js'

/**
 * Input for initializing memory.
 */
export interface InitMemoryInput {
	readonly projectName: string
	readonly orgSlug?: string
	readonly force?: boolean
}

/**
 * Output from initializing memory.
 */
export interface InitMemoryOutput {
	readonly config: MemoryConfig
	readonly created: boolean
	readonly message: string
}

/**
 * Use case for initializing the memory system.
 *
 * Responsibilities:
 * - Creates .vanguard/memory/ directory structure
 * - Creates default _config.yaml
 * - Handles re-initialization with force flag
 */
export class InitMemoryUseCase {
	constructor(private readonly configRepository: MemoryConfigRepository) {}

	async execute(input: InitMemoryInput): Promise<InitMemoryOutput> {
		if (!input.projectName.trim()) {
			throw new MemoryInitializationError('Project name is required')
		}

		const isInitialized = await this.configRepository.isInitialized()

		if (isInitialized && !input.force) {
			const existingConfig = await this.configRepository.load()
			if (existingConfig) {
				return {
					config: existingConfig,
					created: false,
					message: 'Memory already initialized. Use --force to reinitialize.',
				}
			}
		}

		const groupId = input.orgSlug ? `${input.orgSlug}--${input.projectName.trim()}` : undefined

		const config = MemoryConfig.create({
			project: input.projectName.trim(),
			...(groupId !== undefined && { groupId }),
		})

		await this.configRepository.save(config)

		return {
			config,
			created: true,
			message: `Memory initialized for project "${input.projectName}"`,
		}
	}
}

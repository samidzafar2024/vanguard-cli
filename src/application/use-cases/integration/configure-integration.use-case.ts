/**
 * Configure Integration Use Case.
 *
 * Adds or updates a PM tool integration configuration.
 */

import type { IntegrationConfig } from '../../../domain/entities/integration.js'
import type { IntegrationRepository } from '../../ports/repositories.js'

/**
 * Input for configuring an integration.
 */
export interface ConfigureIntegrationInput {
	readonly name: string
	readonly type: 'clickup' | 'jira' | 'linear' | 'github'
	readonly apiToken: string
	readonly projectId: string
	readonly workspaceId: string
	readonly enabled?: boolean | undefined
	readonly statusMapping?: Record<string, string> | undefined
}

/**
 * Output from configuring an integration.
 */
export interface ConfigureIntegrationOutput {
	readonly success: boolean
	readonly config?: IntegrationConfig | undefined
	readonly error?: string | undefined
}

/**
 * Integration provider port for testing connections.
 */
export interface IntegrationProviderPort {
	testConnection(config: IntegrationConfig): Promise<boolean>
	supports(type: string): boolean
}

/**
 * Use case for configuring a PM tool integration.
 *
 * Responsibilities:
 * - Validates integration type is supported
 * - Tests connection before saving
 * - Saves configuration to repository
 */
export class ConfigureIntegrationUseCase {
	constructor(
		private readonly integrationRepository: IntegrationRepository,
		private readonly providerPort: IntegrationProviderPort,
	) {}

	async execute(input: ConfigureIntegrationInput): Promise<ConfigureIntegrationOutput> {
		// Validate integration type
		if (!this.providerPort.supports(input.type)) {
			return {
				success: false,
				error: `Unsupported integration type: ${input.type}`,
			}
		}

		// Build configuration with default status mapping
		const defaultStatusMapping = {
			'to do': 'todo' as const,
			'in progress': 'in-progress' as const,
			'in review': 'in-review' as const,
			done: 'done' as const,
			backlog: 'backlog' as const,
		}

		const config: IntegrationConfig = {
			name: input.name,
			type: input.type,
			apiToken: input.apiToken,
			projectId: input.projectId,
			workspaceId: input.workspaceId,
			statusMapping:
				(input.statusMapping as IntegrationConfig['statusMapping']) ?? defaultStatusMapping,
			enabled: input.enabled ?? true,
		}

		// Test connection
		const connected = await this.providerPort.testConnection(config)
		if (!connected) {
			return {
				success: false,
				error: `Failed to connect to ${input.type}. Please check your credentials.`,
			}
		}

		// Save configuration
		await this.integrationRepository.save(config)

		return {
			success: true,
			config,
		}
	}
}

/**
 * Remove Integration Use Case.
 *
 * Removes an existing PM tool integration.
 */
export class RemoveIntegrationUseCase {
	constructor(private readonly integrationRepository: IntegrationRepository) {}

	async execute(name: string): Promise<{ success: boolean; error?: string | undefined }> {
		const existing = await this.integrationRepository.findByName(name)
		if (!existing) {
			return {
				success: false,
				error: `Integration not found: ${name}`,
			}
		}

		await this.integrationRepository.delete(name)
		return { success: true }
	}
}

/**
 * List Integrations Use Case.
 *
 * Lists all configured integrations.
 */
export class ListIntegrationsUseCase {
	constructor(private readonly integrationRepository: IntegrationRepository) {}

	async execute(): Promise<{
		integrations: readonly IntegrationConfig[]
		defaultIntegration?: IntegrationConfig | undefined
	}> {
		const integrations = await this.integrationRepository.findAll()
		const defaultIntegration = await this.integrationRepository.findDefault()

		return {
			integrations,
			defaultIntegration,
		}
	}
}

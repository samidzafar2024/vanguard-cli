import type { IntegrationConfig } from '../../domain/entities/integration.js'
import type {
	IntegrationProvider,
	IntegrationProviderFactory,
} from '../../domain/interfaces/integration-provider.js'
import { ClickUpProvider } from './clickup-provider.js'

/**
 * Supported integration types.
 */
const SUPPORTED_TYPES = ['clickup'] as const

/**
 * Factory for creating integration providers.
 *
 * Supports:
 * - ClickUp (clickup)
 *
 * Future:
 * - Jira (jira)
 * - Linear (linear)
 * - Azure DevOps (azure-devops)
 * - GitHub Issues (github)
 * - Asana (asana)
 */
export class DefaultIntegrationProviderFactory implements IntegrationProviderFactory {
	create(type: string, config: IntegrationConfig): IntegrationProvider {
		switch (type) {
			case 'clickup': {
				const provider = new ClickUpProvider()
				provider.initialize(config)
				return provider
			}
			default:
				throw new Error(`Unsupported integration type: ${type}`)
		}
	}

	supports(type: string): boolean {
		return SUPPORTED_TYPES.includes(type as (typeof SUPPORTED_TYPES)[number])
	}

	getSupportedTypes(): readonly string[] {
		return SUPPORTED_TYPES
	}
}

export { ClickUpProvider } from './clickup-provider.js'

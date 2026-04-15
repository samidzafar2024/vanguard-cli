/**
 * Init Schema Adapter (Infrastructure).
 *
 * Fowler: "Gateway" — encapsulates access to an external system.
 *
 * Fetches the dynamic option schema from vanguard-web's
 * GET /api/agent-framework/init-schema endpoint. The server returns
 * categorized option groups with choices for the init flow.
 */

import type {
	InitSchema,
	InitSchemaApiClient,
} from '../../application/ports/init-schema-api-client.js'
import { authRepository } from '../repositories/auth.repository.js'

/**
 * Error thrown when init schema API operations fail.
 */
export class InitSchemaApiError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
	) {
		super(message)
		this.name = 'InitSchemaApiError'
	}
}

/**
 * HTTP client that fetches the init option schema from vanguard-web.
 */
export class InitSchemaAdapter implements InitSchemaApiClient {
	private readonly clientVersion: string

	constructor(clientVersion = '0.1.0') {
		this.clientVersion = clientVersion
	}

	async fetch(): Promise<InitSchema> {
		const { endpoint, token } = await this.getAuthContext()

		const response = await fetch(`${endpoint}/api/agent-framework/init-schema`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
			},
		})

		if (!response.ok) {
			const data = (await response.json().catch(() => ({}))) as {
				error?: string
				errorDescription?: string
			}
			throw new InitSchemaApiError(
				data.errorDescription || data.error || `Failed to fetch init schema (${response.status})`,
				response.status,
			)
		}

		const data: unknown = await response.json()
		return data as InitSchema
	}

	/**
	 * Get authentication context (endpoint and token).
	 */
	private async getAuthContext(): Promise<{ endpoint: string; token: string }> {
		const token = await authRepository.getAccessToken()
		const endpoint = await authRepository.getApiEndpoint()

		if (!token || !endpoint) {
			throw new InitSchemaApiError('Not authenticated. Run `vanguard login` first.')
		}

		return { endpoint: endpoint.replace(/\/$/, ''), token }
	}
}

/**
 * Context API Client Adapter (Infrastructure).
 *
 * Fowler: "Gateway" — encapsulates access to vanguard-web's
 * POST /api/memory/graph/context endpoint for fetching
 * persona-aware assembled context blocks.
 */

import type {
	ContextApiClient,
	ProjectContextRequest,
	ProjectContextResponse,
} from '../../application/ports/context-api-client.js'
import { authRepository } from '../repositories/auth.repository.js'

/**
 * Error thrown when context API operations fail.
 */
export class ContextApiError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
	) {
		super(message)
		this.name = 'ContextApiError'
	}
}

/**
 * HTTP client that fetches assembled context from vanguard-web.
 */
export class ContextAdapter implements ContextApiClient {
	private readonly clientVersion: string

	constructor(clientVersion = '0.1.0') {
		this.clientVersion = clientVersion
	}

	async getProjectContext(request: ProjectContextRequest): Promise<ProjectContextResponse> {
		const { endpoint, token } = await this.getAuthContext()
		const url = `${endpoint}/api/memory/graph/context`

		const body: Record<string, unknown> = {
			query: request.query,
			projectId: request.projectId,
		}
		if (request.persona !== undefined) {
			body.persona = request.persona
		}
		if (request.tokenBudget !== undefined) {
			body.tokenBudget = request.tokenBudget
		}

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
			},
			body: JSON.stringify(body),
		})

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as { message?: string }
			throw new ContextApiError(
				errorData.message ?? `Context fetch failed: ${response.status}`,
				response.status,
			)
		}

		const data = (await response.json()) as {
			context?: string
			tokenEstimate?: number
			searchTimeMs?: number
		}

		return {
			context: data.context ?? '',
			tokenEstimate: data.tokenEstimate ?? 0,
			searchTimeMs: data.searchTimeMs ?? 0,
		}
	}

	/**
	 * Get authentication context (endpoint and token).
	 */
	private async getAuthContext(): Promise<{ endpoint: string; token: string }> {
		const token = await authRepository.getAccessToken()
		const endpoint = await authRepository.getApiEndpoint()

		if (!token || !endpoint) {
			throw new ContextApiError('Not authenticated. Run "vanguard login" first.')
		}

		return { endpoint, token }
	}
}

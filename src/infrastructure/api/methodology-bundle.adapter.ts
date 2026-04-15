/**
 * Methodology Bundle Adapter (Infrastructure).
 *
 * Fowler: "Gateway" — encapsulates access to an external system.
 *
 * Fetches pre-rendered methodology files from vanguard-web's
 * GET /api/methodology/bundle endpoint. The server handles all
 * rendering; the CLI receives RenderedFile[] ready to write to disk.
 */

import type { MethodologyBundleApiClient } from '../../application/ports/methodology-bundle-api-client.js'
import type { MethodologyBundle } from '../../domain/entities/methodology-bundle.js'
import { parseMethodologyBundle } from '../../domain/entities/methodology-bundle.js'
import { authRepository } from '../repositories/auth.repository.js'

/**
 * Error thrown when methodology bundle API operations fail.
 */
export class MethodologyBundleApiError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
	) {
		super(message)
		this.name = 'MethodologyBundleApiError'
	}
}

/**
 * HTTP client that fetches the methodology bundle from vanguard-web.
 */
export class MethodologyBundleAdapter implements MethodologyBundleApiClient {
	private readonly clientVersion: string

	constructor(clientVersion = '0.1.0') {
		this.clientVersion = clientVersion
	}

	async fetch(projectId: string): Promise<MethodologyBundle> {
		const { endpoint, token } = await this.getAuthContext()
		const url = `${endpoint}/api/methodology/bundle?project_id=${encodeURIComponent(projectId)}`

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
			},
		})

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as { message?: string }
			throw new MethodologyBundleApiError(
				errorData.message ?? `Methodology bundle fetch failed: ${response.status}`,
				response.status,
			)
		}

		const data: unknown = await response.json()
		return parseMethodologyBundle(data)
	}

	async fetchIfChanged(projectId: string, lastHash: string): Promise<MethodologyBundle | null> {
		const { endpoint, token } = await this.getAuthContext()
		const url = `${endpoint}/api/methodology/bundle?project_id=${encodeURIComponent(projectId)}`

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
				'If-None-Match': lastHash,
			},
		})

		if (response.status === 304) {
			return null
		}

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as { message?: string }
			throw new MethodologyBundleApiError(
				errorData.message ?? `Methodology bundle fetch failed: ${response.status}`,
				response.status,
			)
		}

		const data: unknown = await response.json()
		return parseMethodologyBundle(data)
	}

	/**
	 * Get authentication context (endpoint and token).
	 */
	private async getAuthContext(): Promise<{ endpoint: string; token: string }> {
		const token = await authRepository.getAccessToken()
		const endpoint = await authRepository.getApiEndpoint()

		if (!token || !endpoint) {
			throw new MethodologyBundleApiError('Not authenticated. Run "vanguard login" first.')
		}

		return { endpoint, token }
	}
}

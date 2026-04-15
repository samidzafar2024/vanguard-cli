/**
 * Graphiti Write Adapter (Infrastructure).
 *
 * Fowler: "Gateway" — encapsulates access to vanguard-web's
 * POST /api/memory/graph/episodes endpoint for writing
 * knowledge episodes to the Graphiti knowledge graph.
 */

import type {
	AddEpisodeInput,
	AddEpisodeResult,
	GraphitiWritePort,
} from '../../application/ports/graphiti-write.port.js'
import { authRepository } from '../repositories/auth.repository.js'

/**
 * HTTP client that writes episodes to Graphiti via vanguard-web proxy.
 */
export class GraphitiWriteAdapter implements GraphitiWritePort {
	private readonly clientVersion: string

	constructor(clientVersion = '0.1.0') {
		this.clientVersion = clientVersion
	}

	async addEpisode(input: AddEpisodeInput): Promise<AddEpisodeResult> {
		const { endpoint, token } = await this.getAuthContext()
		const url = `${endpoint}/api/memory/graph/episodes`

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
			},
			body: JSON.stringify({
				name: input.name,
				episode_body: input.episodeBody,
				group_id: input.groupId,
				source_description: input.sourceDescription,
			}),
			signal: AbortSignal.timeout(10000),
		})

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as {
				errorDescription?: string
			}
			return {
				success: false,
				error: errorData.errorDescription ?? `HTTP ${response.status}`,
			}
		}

		return { success: true }
	}

	private async getAuthContext(): Promise<{ endpoint: string; token: string }> {
		const token = await authRepository.getAccessToken()
		const endpoint = await authRepository.getApiEndpoint()

		if (!token || !endpoint) {
			return { endpoint: '', token: '' }
		}

		return { endpoint, token }
	}
}

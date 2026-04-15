/**
 * Vanguard Embedding Service Implementation.
 *
 * Generates text embeddings by calling the vanguard-web API,
 * which proxies to OpenAI or other embedding providers.
 */

import type { EmbeddingService } from '../../application/ports/embedding-service.js'
import { authRepository } from '../repositories/auth.repository.js'

/**
 * API response for embedding generation.
 */
interface EmbeddingResponse {
	embedding: number[]
	model: string
	dimensions: number
}

interface BatchEmbeddingResponse {
	embeddings: number[][]
	model: string
	dimensions: number
}

/**
 * Error thrown when embedding generation fails.
 */
export class EmbeddingError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly cause?: unknown,
	) {
		super(message)
		this.name = 'EmbeddingError'
	}
}

/**
 * Vanguard embedding service implementation.
 *
 * Uses the vanguard-web API to generate embeddings, which allows
 * the CLI to work without requiring direct OpenAI credentials.
 */
export class VanguardEmbeddingService implements EmbeddingService {
	readonly model: string
	readonly dimensions: number
	private readonly clientVersion: string

	constructor(model = 'text-embedding-3-large', dimensions = 1536, clientVersion = '0.1.0') {
		this.model = model
		this.dimensions = dimensions
		this.clientVersion = clientVersion
	}

	async generateEmbedding(text: string): Promise<readonly number[]> {
		const { endpoint, token } = await this.getAuthContext()

		const response = await this.request<EmbeddingResponse>(
			`${endpoint}/api/memory/embeddings`,
			token,
			{
				text,
				model: this.model,
				dimensions: this.dimensions,
			},
		)

		return response.embedding
	}

	async batchEmbeddings(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
		if (texts.length === 0) {
			return []
		}

		// For small batches, use parallel single requests
		// For larger batches, use the batch endpoint
		if (texts.length <= 3) {
			return Promise.all(texts.map((text) => this.generateEmbedding(text)))
		}

		const { endpoint, token } = await this.getAuthContext()

		const response = await this.request<BatchEmbeddingResponse>(
			`${endpoint}/api/memory/embeddings/batch`,
			token,
			{
				texts: [...texts],
				model: this.model,
				dimensions: this.dimensions,
			},
		)

		return response.embeddings
	}

	/**
	 * Get authentication context.
	 */
	private async getAuthContext(): Promise<{ endpoint: string; token: string }> {
		const token = await authRepository.getAccessToken()
		const endpoint = await authRepository.getApiEndpoint()

		if (!token || !endpoint) {
			throw new EmbeddingError('Not authenticated. Run "vanguard login" first.')
		}

		return { endpoint, token }
	}

	/**
	 * Make an authenticated API request.
	 */
	private async request<T>(url: string, token: string, body: unknown): Promise<T> {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as { message?: string }
			throw new EmbeddingError(
				errorData.message ?? `Embedding request failed: ${response.status}`,
				response.status,
			)
		}

		return (await response.json()) as T
	}
}

/**
 * Auth Client - Handles device authorization flow
 *
 * Includes retry logic with exponential backoff to handle
 * Vercel serverless cold start failures (empty 500 responses).
 */

import { createHash } from 'node:crypto'
import os from 'node:os'
import type {
	DeviceCodeResponse,
	StoredCredentials,
	TokenResponse,
} from '../../domain/entities/auth.js'

export interface AuthClientOptions {
	apiEndpoint: string
	clientVersion: string
}

/** Default timeout for API requests (15s to accommodate cold starts) */
const REQUEST_TIMEOUT_MS = 15_000

/** Max retries for transient failures (500s, network errors) */
const MAX_RETRIES = 2

/** Base delay between retries in ms (doubles each attempt) */
const RETRY_BASE_DELAY_MS = 1_000

export class AuthClient {
	private apiEndpoint: string
	private clientVersion: string
	private machineId: string

	constructor(options: AuthClientOptions) {
		this.apiEndpoint = options.apiEndpoint.replace(/\/$/, '') // Remove trailing slash
		this.clientVersion = options.clientVersion
		this.machineId = this.generateMachineId()
	}

	/**
	 * Initiate device authorization flow
	 */
	async requestDeviceCode(): Promise<DeviceCodeResponse> {
		const response = await this.fetchWithRetry(`${this.apiEndpoint}/api/auth/cli/device`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
			},
			body: JSON.stringify({
				clientId: 'vanguard-cli',
				clientVersion: this.clientVersion,
				machineId: this.machineId,
			}),
		})

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as { errorDescription?: string }
			throw new Error(errorData.errorDescription || 'Failed to request device code')
		}

		return (await response.json()) as DeviceCodeResponse
	}

	/**
	 * Poll for token (after user authorizes in browser)
	 */
	async pollForToken(
		deviceCode: string,
		initialInterval: number,
		expiresIn: number,
		onPoll?: () => void,
	): Promise<TokenResponse> {
		const deadline = Date.now() + expiresIn * 1000
		let interval = initialInterval

		while (Date.now() < deadline) {
			if (onPoll) onPoll()

			// Token polling uses a single attempt (no retry) since we'll
			// retry on the next poll interval anyway
			const response = await this.fetchWithTimeout(`${this.apiEndpoint}/api/auth/cli/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': `vanguard-cli/${this.clientVersion}`,
				},
				body: JSON.stringify({
					deviceCode,
					clientId: 'vanguard-cli',
				}),
			})

			const data = (await response.json()) as TokenResponse

			// Check for success
			if (data.accessToken) {
				return data
			}

			// Check for terminal errors
			if (data.error) {
				if (data.error === 'authorization_pending') {
					// Keep polling
				} else if (data.error === 'slow_down') {
					// Increase interval
					interval = Math.min(interval + 5, 30)
				} else {
					// Terminal error
					throw new Error(data.errorDescription || data.error)
				}
			}

			// Wait before polling again
			await this.sleep(interval * 1000)
		}

		throw new Error('Authorization timed out')
	}

	/**
	 * Build stored credentials from token response
	 */
	buildCredentials(
		tokenResponse: TokenResponse,
		apiEndpoint: string,
	): Omit<StoredCredentials, 'userId' | 'userEmail' | 'userName'> {
		const result: Omit<StoredCredentials, 'userId' | 'userEmail' | 'userName'> = {
			accessToken: tokenResponse.accessToken ?? '',
			apiEndpoint,
			authenticatedAt: new Date().toISOString(),
		}

		if (tokenResponse.expiresIn) {
			result.expiresAt = new Date(Date.now() + tokenResponse.expiresIn * 1000).toISOString()
		}
		if (tokenResponse.refreshToken) {
			result.refreshToken = tokenResponse.refreshToken
		}

		return result
	}

	/**
	 * Get user info using the access token
	 */
	async getUserInfo(accessToken: string): Promise<{
		id: string
		email: string
		name?: string
	}> {
		const response = await this.fetchWithRetry(`${this.apiEndpoint}/api/auth/cli/me`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'User-Agent': `vanguard-cli/${this.clientVersion}`,
			},
		})

		if (!response.ok) {
			throw new Error('Failed to get user info')
		}

		return (await response.json()) as { id: string; email: string; name?: string }
	}

	/**
	 * Test if a token is valid
	 */
	async validateToken(accessToken: string): Promise<boolean> {
		try {
			await this.getUserInfo(accessToken)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Fetch with a timeout (no retries).
	 * Used for polling where the caller already has its own retry loop.
	 */
	private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

		try {
			return await fetch(url, { ...init, signal: controller.signal })
		} finally {
			clearTimeout(timeout)
		}
	}

	/**
	 * Fetch with timeout + retry on transient failures.
	 * Retries on: 500/502/503/504, network errors, timeouts.
	 * Uses exponential backoff (1s, 2s).
	 */
	private async fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
		let lastError: Error | undefined

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				const response = await this.fetchWithTimeout(url, init)

				// Retry on server errors (cold start pattern: 500 with empty body)
				if (response.status >= 500 && attempt < MAX_RETRIES) {
					await this.sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
					continue
				}

				return response
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))

				// Don't retry on abort/timeout if we've exhausted retries
				if (attempt >= MAX_RETRIES) break

				await this.sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
			}
		}

		throw lastError ?? new Error('Request failed after retries')
	}

	/**
	 * Generate a stable machine identifier
	 */
	private generateMachineId(): string {
		const info = [os.hostname(), os.platform(), os.arch(), os.userInfo().username].join(':')

		return createHash('sha256').update(info).digest('hex').substring(0, 16)
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}

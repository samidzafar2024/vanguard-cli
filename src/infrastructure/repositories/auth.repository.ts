/**
 * Auth Repository - File-based credential storage
 *
 * Stores credentials in ~/.vanguard/auth.json
 * Similar to how gh stores credentials in ~/.config/gh/hosts.yml
 */

import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import type { AuthStatus, StoredCredentials } from '../../domain/entities/auth.js'

const AUTH_DIR = path.join(os.homedir(), '.vanguard')
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json')

export class AuthRepository {
	/**
	 * Get stored credentials
	 */
	async getCredentials(): Promise<StoredCredentials | null> {
		try {
			if (!(await fs.pathExists(AUTH_FILE))) {
				return null
			}

			const content = await fs.readFile(AUTH_FILE, 'utf-8')
			const credentials: StoredCredentials = JSON.parse(content)

			// Check if expired
			if (credentials.expiresAt && new Date(credentials.expiresAt) < new Date()) {
				return null
			}

			return credentials
		} catch {
			return null
		}
	}

	/**
	 * Save credentials
	 */
	async saveCredentials(credentials: StoredCredentials): Promise<void> {
		await fs.ensureDir(AUTH_DIR)

		// Set restrictive permissions on the directory
		await fs.chmod(AUTH_DIR, 0o700)

		await fs.writeFile(AUTH_FILE, JSON.stringify(credentials, null, 2), {
			mode: 0o600, // Read/write for owner only
		})
	}

	/**
	 * Clear credentials (logout)
	 */
	async clearCredentials(): Promise<void> {
		if (await fs.pathExists(AUTH_FILE)) {
			await fs.remove(AUTH_FILE)
		}
	}

	/**
	 * Get auth status for display
	 */
	async getStatus(): Promise<AuthStatus> {
		const credentials = await this.getCredentials()

		if (!credentials) {
			return { authenticated: false }
		}

		const user: { id: string; email: string; name?: string } = {
			id: credentials.userId,
			email: credentials.userEmail,
		}
		if (credentials.userName) {
			user.name = credentials.userName
		}

		const status: AuthStatus = {
			authenticated: true,
			user,
			endpoint: credentials.apiEndpoint,
			tokenPrefix: credentials.accessToken.substring(0, 11), // "wp_" + 8 chars
		}
		if (credentials.expiresAt) {
			status.expiresAt = new Date(credentials.expiresAt)
		}

		return status
	}

	/**
	 * Get access token for API calls
	 */
	async getAccessToken(): Promise<string | null> {
		const credentials = await this.getCredentials()
		return credentials?.accessToken || null
	}

	/**
	 * Get API endpoint
	 */
	async getApiEndpoint(): Promise<string | null> {
		const credentials = await this.getCredentials()
		return credentials?.apiEndpoint || null
	}

	/**
	 * Check if authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		const credentials = await this.getCredentials()
		return credentials !== null
	}
}

// Singleton instance
export const authRepository = new AuthRepository()

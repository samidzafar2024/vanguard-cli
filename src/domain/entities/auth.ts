/**
 * CLI Authentication Domain Entities
 */

/**
 * Stored credentials in local config
 */
export interface StoredCredentials {
	accessToken: string
	refreshToken?: string
	expiresAt?: string // ISO 8601
	userId: string
	userEmail: string
	userName?: string
	apiEndpoint: string
	authenticatedAt: string // ISO 8601
}

/**
 * Device code response from web API
 */
export interface DeviceCodeResponse {
	deviceCode: string
	userCode: string
	verificationUri: string
	verificationUriComplete?: string
	expiresIn: number
	interval: number
}

/**
 * Token response from web API
 */
export interface TokenResponse {
	accessToken?: string
	tokenType?: 'Bearer'
	expiresIn?: number
	refreshToken?: string
	error?: TokenErrorCode
	errorDescription?: string
}

export type TokenErrorCode =
	| 'authorization_pending'
	| 'slow_down'
	| 'expired_token'
	| 'access_denied'
	| 'invalid_grant'

/**
 * Auth status for display
 */
export interface AuthStatus {
	authenticated: boolean
	user?: {
		id: string
		email: string
		name?: string
	}
	endpoint?: string
	expiresAt?: Date
	tokenPrefix?: string
}

/**
 * Default API endpoint
 */
export const DEFAULT_API_ENDPOINT = 'http://localhost:3000'

/**
 * Development API endpoint
 */
export const DEV_API_ENDPOINT = 'http://localhost:3000'

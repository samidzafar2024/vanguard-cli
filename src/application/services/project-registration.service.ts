/**
 * Project Registration Service - Registers projects with Vanguard web app
 *
 * Handles:
 * - Project registration during init
 * - Project updates during sync
 * - Offline queue for failed registrations
 */

export interface ProjectRegistrationPayload {
	name: string
	type: 'greenfield' | 'brownfield'
	track: 'solo' | 'team' | 'enterprise'
	projectPath: string
	gitRemoteUrl?: string | undefined
	defaultBranch?: string | undefined
	vanguardConfig?: Record<string, unknown>
	selections?: Record<string, string> | undefined
}

export interface ProjectRegistrationResult {
	success: boolean
	projectId?: string | undefined
	orgSlug?: string | undefined
	isNew?: boolean | undefined
	error?: string | undefined
}

export class ProjectRegistrationService {
	private readonly apiEndpoint: string
	private readonly accessToken: string
	private readonly clientVersion: string

	constructor(apiEndpoint: string, accessToken: string, clientVersion: string) {
		this.apiEndpoint = apiEndpoint.replace(/\/$/, '') // Remove trailing slash
		this.accessToken = accessToken
		this.clientVersion = clientVersion
	}

	/**
	 * Register a project with the Vanguard web app.
	 *
	 * This is idempotent - if the project already exists (by gitRemoteUrl or name),
	 * it will update the existing record instead of creating a duplicate.
	 */
	async register(payload: ProjectRegistrationPayload): Promise<ProjectRegistrationResult> {
		try {
			const response = await fetch(`${this.apiEndpoint}/api/projects/register`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.accessToken}`,
					'User-Agent': `vanguard-cli/${this.clientVersion}`,
				},
				body: JSON.stringify(payload),
			})

			const data = (await response.json()) as {
				success?: boolean
				projectId?: string
				orgSlug?: string
				isNew?: boolean
				error?: string
				errorDescription?: string
			}

			if (!response.ok) {
				return {
					success: false,
					error: data.errorDescription || data.error || `Registration failed (${response.status})`,
				}
			}

			return {
				success: true,
				projectId: data.projectId,
				orgSlug: data.orgSlug,
				isNew: data.isNew,
			}
		} catch (error) {
			// Network error or other fetch failure
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Network error',
			}
		}
	}
}

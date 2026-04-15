/**
 * Authentication guard for CLI commands.
 * All commands except login/logout require authentication.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { authRepository } from '../../../infrastructure/repositories/auth.repository.js'
import { runLogin } from '../commands/login.js'

/**
 * Check if user is authenticated. If not, automatically redirect to login flow.
 * Call this at the start of every command that requires authentication.
 */
export async function requireAuth(options?: { dev?: boolean }): Promise<void> {
	const status = await authRepository.getStatus()

	if (!status.authenticated || !status.user) {
		console.log()
		p.log.warn('Authentication required')
		console.log()
		console.log(`  ${pc.dim('This command requires authentication.')}`)
		console.log(`  ${pc.dim("Let's log you in to Vanguard...")}`)
		console.log()

		// Automatically run login flow (pass --dev through if set)
		await runLogin({ dev: options?.dev ?? false, skipAlreadyLoggedInCheck: true })

		// Verify authentication succeeded
		const newStatus = await authRepository.getStatus()
		if (!newStatus.authenticated) {
			// Login was canceled or failed
			console.log()
			p.log.error('Authentication required to continue')
			process.exit(1)
		}

		console.log()
		p.log.success('Successfully authenticated! Continuing...')
		console.log()
	}
}

/**
 * Login Command - Authenticate CLI with Vanguard web app
 *
 * Uses OAuth 2.0 Device Authorization Flow, similar to:
 * - GitHub CLI: gh auth login
 * - Heroku CLI: heroku login
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import open from 'open'
import ora from 'ora'
import pc from 'picocolors'
import { McpWiringService } from '../../../application/services/mcp-wiring.service.js'
import {
	DEFAULT_API_ENDPOINT,
	DEV_API_ENDPOINT,
	type StoredCredentials,
} from '../../../domain/entities/auth.js'
import { AuthClient } from '../../../infrastructure/auth/auth-client.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { authRepository } from '../../../infrastructure/repositories/auth.repository.js'

// Get version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
const packagePath = join(__dirname, '..', '..', '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as { version: string }
const CLI_VERSION = pkg.version

export function createLoginCommand(): Command {
	const command = new Command('login')
		.description('Authenticate with Vanguard')
		.option('--dev', 'Use development server (localhost:3000)')
		.option('--endpoint <url>', 'Custom API endpoint')
		.option('--no-browser', "Don't open browser automatically")
		.action(async (options) => {
			await runLogin(options)
		})

	return command
}

export function createLogoutCommand(): Command {
	const command = new Command('logout').description('Log out from Vanguard').action(async () => {
		await runLogout()
	})

	return command
}

export function createAuthStatusCommand(): Command {
	const command = new Command('status')
		.description('Show authentication status')
		.action(async () => {
			await showStatus()
		})

	return command
}

export async function runLogin(options: {
	dev?: boolean
	endpoint?: string
	browser?: boolean
	skipAlreadyLoggedInCheck?: boolean
}) {
	console.log()
	p.intro(pc.bgCyan(pc.black(' Vanguard Login ')))

	// Check if already logged in (skip if called from auto-redirect)
	if (!options.skipAlreadyLoggedInCheck) {
		const existingStatus = await authRepository.getStatus()
		if (existingStatus.authenticated) {
			const shouldContinue = await p.confirm({
				message: `Already logged in as ${pc.cyan(existingStatus.user?.email)}. Log in again?`,
			})

			if (p.isCancel(shouldContinue) || !shouldContinue) {
				p.outro('Login cancelled')
				return
			}
		}
	}

	// Determine API endpoint
	// Priority: --endpoint flag > --dev flag > VANGUARD_API_URL env > VANGUARD_DEV env > default
	let apiEndpoint = DEFAULT_API_ENDPOINT
	if (options.endpoint) {
		apiEndpoint = options.endpoint
	} else if (
		options.dev ||
		process.env.VANGUARD_DEV === '1' ||
		process.env.VANGUARD_DEV === 'true'
	) {
		apiEndpoint = DEV_API_ENDPOINT
	} else if (process.env.VANGUARD_API_URL) {
		apiEndpoint = process.env.VANGUARD_API_URL
	}

	p.log.info(`Connecting to ${pc.dim(apiEndpoint)}`)

	const client = new AuthClient({
		apiEndpoint,
		clientVersion: CLI_VERSION,
	})

	// Request device code
	const deviceSpinner = ora('Requesting authorization code...').start()
	let deviceCode: Awaited<ReturnType<typeof client.requestDeviceCode>>

	try {
		deviceCode = await client.requestDeviceCode()
		deviceSpinner.succeed('Authorization code received')
	} catch (error) {
		deviceSpinner.fail('Failed to get authorization code')
		p.log.error(error instanceof Error ? error.message : 'Unknown error')
		process.exit(1)
	}

	// Display the code (as fallback if browser doesn't open)
	console.log()
	console.log(pc.bold('  Your authorization code:'))
	console.log()
	console.log(pc.bgWhite(pc.black(pc.bold(`    ${deviceCode.userCode}    `))))
	console.log()

	// Open browser with code pre-filled
	const browserUrl = deviceCode.verificationUriComplete ?? deviceCode.verificationUri
	if (options.browser !== false) {
		const openSpinner = ora('Opening browser...').start()
		try {
			await open(browserUrl)
			openSpinner.succeed('Browser opened — confirm authorization there')
		} catch {
			console.log(pc.dim(`  Open this URL manually: ${browserUrl}`))
			openSpinner.info('Could not open browser automatically. Please visit the URL above.')
		}
	} else {
		console.log(pc.dim(`  Verification URL: ${browserUrl}`))
		p.log.info('Please visit the URL above to authorize')
	}

	// Poll for token
	console.log()
	const pollSpinner = ora('Waiting for authorization...').start()

	let pollCount = 0
	try {
		const tokenResponse = await client.pollForToken(
			deviceCode.deviceCode,
			deviceCode.interval,
			deviceCode.expiresIn,
			() => {
				pollCount++
				pollSpinner.text = `Waiting for authorization... ${pc.dim(`(${pollCount})`)}`
			},
		)

		pollSpinner.succeed('Authorization received')

		// Get user info
		const userSpinner = ora('Getting user info...').start()

		try {
			const userInfo = await client.getUserInfo(tokenResponse.accessToken!)

			// Build and save credentials
			const baseCredentials = client.buildCredentials(tokenResponse, apiEndpoint)
			const credentials: StoredCredentials = {
				...baseCredentials,
				userId: userInfo.id,
				userEmail: userInfo.email,
			}
			if (userInfo.name) {
				credentials.userName = userInfo.name
			}
			await authRepository.saveCredentials(credentials)

			userSpinner.succeed('Logged in successfully')

			// Sync token to current project's .claude/settings.local.json if applicable
			await syncTokenToProject(credentials.accessToken, apiEndpoint, p.log)

			console.log()
			p.outro(pc.green(`Logged in as ${pc.bold(userInfo.email)}`))
		} catch (_error) {
			userSpinner.fail('Failed to get user info')
			// Still save what we have
			const baseCredentials = client.buildCredentials(tokenResponse, apiEndpoint)
			await authRepository.saveCredentials({
				...baseCredentials,
				userId: 'unknown',
				userEmail: 'unknown',
			})

			console.log()
			p.outro(pc.yellow('Logged in (user info unavailable)'))
		}
	} catch (error) {
		pollSpinner.fail(error instanceof Error ? error.message : 'Authorization failed')
		process.exit(1)
	}
}

async function runLogout() {
	console.log()
	p.intro(pc.bgCyan(pc.black(' Vanguard Logout ')))

	const status = await authRepository.getStatus()

	if (!status.authenticated) {
		p.log.info('Not currently logged in')
		p.outro('Nothing to do')
		return
	}

	const shouldLogout = await p.confirm({
		message: `Log out from ${pc.cyan(status.user?.email)}?`,
	})

	if (p.isCancel(shouldLogout) || !shouldLogout) {
		p.outro('Logout cancelled')
		return
	}

	await authRepository.clearCredentials()

	p.outro(pc.green('Logged out successfully'))
}

async function showStatus() {
	console.log()
	p.intro(pc.bgCyan(pc.black(' Vanguard Auth Status ')))

	const status = await authRepository.getStatus()

	if (!status.authenticated) {
		p.log.warn('Not logged in')
		console.log()
		console.log(pc.dim('  Run `vanguard login` to authenticate'))
		console.log()
		return
	}

	console.log()
	console.log(`  ${pc.bold('Email:')}    ${status.user?.email}`)
	if (status.user?.name) {
		console.log(`  ${pc.bold('Name:')}     ${status.user.name}`)
	}
	console.log(`  ${pc.bold('Endpoint:')} ${pc.dim(status.endpoint)}`)
	console.log(`  ${pc.bold('Token:')}    ${pc.dim(`${status.tokenPrefix}...`)}`)

	if (status.expiresAt) {
		const daysUntilExpiry = Math.ceil(
			(status.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		)
		const expiryText = daysUntilExpiry > 0 ? `in ${daysUntilExpiry} days` : pc.red('expired')
		console.log(`  ${pc.bold('Expires:')}  ${expiryText}`)
	}

	console.log()
	p.outro(pc.green('Authenticated'))
}

async function syncTokenToProject(
	token: string,
	apiEndpoint: string,
	log: typeof p.log,
): Promise<void> {
	const cwd = process.cwd()
	const mcpJsonPath = join(cwd, '.mcp.json')

	if (!existsSync(mcpJsonPath)) return

	try {
		const mcpWiring = new McpWiringService(new FsFileWriter(), new FsFileReader())
		const result = await mcpWiring.wire({
			projectRoot: cwd,
			token,
			mcpUrl: `${apiEndpoint}/api/mcp`,
		})
		if (result.settingsWritten) {
			log.info('Updated .claude/settings.local.json with new token')
		}
	} catch {
		// Non-fatal — login succeeded even if project sync fails
	}
}

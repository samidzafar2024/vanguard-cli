/**
 * Pull command - Sync auth token and ensure MCP configuration.
 *
 * In the new content delivery architecture, flat files (personas, commands,
 * constitution) are generated at init time and updated via `vanguard refresh`.
 *
 * Pull is now a lightweight command for team members who clone an existing
 * repo: sync their auth token and backfill .mcp.json if missing.
 *
 * Usage: vanguard pull [--dry-run]
 */

import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { McpWiringService } from '../../../application/services/mcp-wiring.service.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { authRepository } from '../../../infrastructure/repositories/auth.repository.js'
import { requireAuth } from '../utils/require-auth.js'

export const pullCommand = new Command('pull')
	.description('Sync auth token and ensure MCP configuration')
	.option('--dry-run', 'Show what would change without writing')
	.action(async (options) => {
		await requireAuth()

		console.log()
		p.intro(pc.bgCyan(pc.black(' vanguard pull ')))

		const cwd = process.cwd()

		// 1. Refresh auth token
		const spinner = p.spinner()
		spinner.start('Refreshing authentication')

		let token: string | null = null
		let apiEndpoint: string | null = null

		try {
			token = await authRepository.getAccessToken()
			apiEndpoint = await authRepository.getApiEndpoint()

			if (!token || !apiEndpoint) {
				spinner.stop('Not authenticated')
				p.log.error('Run `vanguard login` first.')
				process.exit(1)
			}

			spinner.stop('Token refreshed')
		} catch (error) {
			spinner.stop('Authentication failed')
			p.log.error(error instanceof Error ? error.message : 'Unknown error')
			process.exit(1)
		}

		// 2. Wire MCP configuration (backfill if missing)
		const mcpSpinner = p.spinner()
		mcpSpinner.start('Configuring MCP')

		try {
			if (options.dryRun) {
				mcpSpinner.stop('MCP configuration check (dry run)')
				p.log.info(pc.dim('Would write .mcp.json and .claude/settings.local.json'))
			} else {
				const writer = new FsFileWriter()
				const mcpWiring = new McpWiringService(writer, new FsFileReader())
				const mcpResult = await mcpWiring.wire({
					projectRoot: cwd,
					token: token as string,
					mcpUrl: `${apiEndpoint}/api/mcp`,
				})

				const parts: string[] = []
				if (mcpResult.mcpJsonWritten) parts.push('.mcp.json')
				if (mcpResult.settingsWritten) parts.push('settings.local.json')
				if (mcpResult.gitignoreUpdated) parts.push('.gitignore updated')

				if (mcpResult.connectivityOk) {
					mcpSpinner.stop(`MCP configured (${parts.join(', ')})`)
				} else if (mcpResult.connectivityOk === false) {
					mcpSpinner.stop(`MCP configured locally (${parts.join(', ')}) — server unreachable`)
					p.log.warn(
						pc.dim('MCP connectivity check failed. Server may be down or token may be invalid.'),
					)
				} else {
					mcpSpinner.stop(`MCP configured (${parts.join(', ')})`)
				}
			}
		} catch (error) {
			mcpSpinner.stop('MCP configuration failed')
			p.log.warn(error instanceof Error ? error.message : 'Unknown error')
		}

		// 3. Summary
		console.log()
		p.log.info(
			`Flat files are managed by ${pc.cyan('vanguard init')} and ${pc.cyan('vanguard refresh')}.`,
		)
		p.log.info(`Run ${pc.cyan('vanguard refresh')} to pick up the latest methodology updates.`)

		if (options.dryRun) {
			p.outro(pc.yellow('Dry run complete — no files were written.'))
		} else {
			p.outro(pc.green('Pull complete.'))
		}
	})

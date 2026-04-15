/**
 * Refresh command — Update methodology files from the server bundle.
 *
 * Uses ETag-based conditional requests to detect changes.
 * Shows diffs and confirms before writing.
 *
 * Usage:
 *   vanguard refresh              # Refresh methodology files
 *   vanguard refresh --dry-run    # Preview changes without writing
 *   vanguard refresh -y           # Apply without confirmation
 */

import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { HookWiringService } from '../../../application/services/hook-wiring.service.js'
import {
	type MethodologyRefreshResult,
	MethodologyService,
} from '../../../application/services/methodology.service.js'
import { MethodologyBundleAdapter } from '../../../infrastructure/api/methodology-bundle.adapter.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { requireAuth } from '../utils/require-auth.js'

function colorizeDiffLine(line: string): string {
	if (line.startsWith('+++') || line.startsWith('---')) return pc.bold(line)
	if (line.startsWith('+')) return pc.green(line)
	if (line.startsWith('-')) return pc.red(line)
	if (line.startsWith('@@')) return pc.cyan(line)
	return pc.dim(line)
}

function displayChanges(result: MethodologyRefreshResult): void {
	for (const change of result.changes) {
		if (change.status === 'unchanged') {
			p.log.info(`${pc.dim('○')} ${change.relativePath} ${pc.dim('(unchanged)')}`)
			continue
		}

		const icon = change.status === 'new' ? pc.green('+') : pc.yellow('~')
		const label = change.status === 'new' ? pc.green('new') : pc.yellow('modified')

		p.log.message(`${icon} ${change.relativePath} ${pc.dim(`(${label})`)}`)

		if (change.diff) {
			console.log(change.diff.split('\n').map(colorizeDiffLine).join('\n'))
			console.log()
		}
	}
}

async function applyChanges(result: MethodologyRefreshResult, cwd: string): Promise<void> {
	const writeSpinner = p.spinner()
	writeSpinner.start('Writing changes')

	try {
		const writer = new FsFileWriter()
		const reader = new FsFileReader()
		const methodologyService = new MethodologyService(
			new MethodologyBundleAdapter(),
			writer,
			reader,
		)
		const written = await methodologyService.applyRefresh(result, cwd)
		writeSpinner.stop(`${written} file(s) updated`)

		if (result.hookConfig) {
			try {
				const hookWiring = new HookWiringService(writer, reader)
				await hookWiring.wire({
					projectRoot: cwd,
					hookConfig: result.hookConfig,
					executableFiles: result.executableFiles,
				})
			} catch {
				// Hook wiring is non-critical
			}
		}
	} catch (error) {
		writeSpinner.stop('Failed to write changes')
		p.log.error(error instanceof Error ? error.message : 'Unknown error')
		process.exit(1)
	}
}

export const refreshCommand = new Command('refresh')
	.description('Update methodology files from server')
	.option('--dry-run', 'Show changes without writing')
	.option('-y, --yes', 'Apply changes without confirmation')
	.action(async (options) => {
		await requireAuth()

		console.log()
		p.intro(pc.bgCyan(pc.black(' vanguard refresh ')))

		const cwd = process.cwd()

		// 1. Check for changes
		const spinner = p.spinner()
		spinner.start('Checking for methodology updates')

		let result: MethodologyRefreshResult
		try {
			const methodologyService = new MethodologyService(
				new MethodologyBundleAdapter(),
				new FsFileWriter(),
				new FsFileReader(),
			)
			result = await methodologyService.refresh(cwd)
		} catch (error) {
			spinner.stop('Refresh failed')
			p.log.error(error instanceof Error ? error.message : 'Unknown error')
			process.exit(1)
		}

		if (!result.hasChanges) {
			spinner.stop('No changes detected')
			p.outro(pc.green('Methodology is up to date.'))
			return
		}

		const modified = result.changes.filter((c) => c.status === 'modified').length
		const newFiles = result.changes.filter((c) => c.status === 'new').length
		const unchanged = result.changes.filter((c) => c.status === 'unchanged').length

		spinner.stop(`${modified} modified, ${newFiles} new, ${unchanged} unchanged`)

		// 2. Show changes
		displayChanges(result)

		// 3. Confirm + write (unless dry-run)
		if (options.dryRun) {
			p.outro(pc.yellow('Dry run complete — no files were written.'))
			return
		}

		if (!options.yes) {
			const confirmed = await p.confirm({
				message: `Apply ${result.changes.filter((c) => c.status !== 'unchanged').length} change(s)?`,
				initialValue: true,
			})

			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel('Refresh canceled.')
				return
			}
		}

		await applyChanges(result, cwd)

		p.outro(pc.green('Methodology refreshed. Review and commit when ready.'))
	})

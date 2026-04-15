/**
 * Sync Command - Sync telemetry data to Vanguard
 *
 * Collects git commits and Claude session data and sends to the web API.
 */

import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import cliProgress from 'cli-progress'
import { Command } from 'commander'
import ora from 'ora'
import pc from 'picocolors'
import { parse as parseYaml } from 'yaml'
import { TelemetryService } from '../../../application/services/telemetry.service.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import { CliGitService } from '../../../infrastructure/git-service.js'
import { authRepository } from '../../../infrastructure/repositories/auth.repository.js'

// Get version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
const packagePath = join(__dirname, '..', '..', '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as { version: string }
const CLI_VERSION = pkg.version

export const syncCommand = new Command('sync')
	.description('Sync telemetry data to Vanguard')
	.option('--dry-run', "Collect events but don't send them")
	.option('--verbose', 'Show detailed output')
	.action(async (options) => {
		await runSync(options)
	})

/**
 * Get project name from vanguard.manifest.yaml or fall back to directory name
 */
function getProjectName(projectPath: string): string {
	try {
		const manifestPath = join(projectPath, 'vanguard.manifest.yaml')
		if (existsSync(manifestPath)) {
			const content = readFileSync(manifestPath, 'utf-8')
			const manifest = parseYaml(content) as { project?: { name?: string } }
			if (manifest?.project?.name) {
				return manifest.project.name
			}
		}
	} catch {
		// Fall through to default
	}
	return basename(projectPath)
}

async function runSync(options: { dryRun?: boolean; verbose?: boolean }) {
	console.log()
	p.intro(pc.bgCyan(pc.black(' Vanguard Telemetry Sync ')))

	// Check authentication
	const status = await authRepository.getStatus()
	if (!status.authenticated) {
		p.log.error('Not authenticated. Run `vanguard login` first.')
		process.exit(1)
	}

	p.log.info(`Syncing as ${pc.cyan(status.user?.email)}`)
	p.log.info(`Endpoint: ${pc.dim(status.endpoint)}`)

	// Determine project path and name
	const projectPath = process.cwd()
	const projectName = getProjectName(projectPath)
	p.log.info(`Project: ${pc.cyan(projectName)} ${pc.dim(`(${projectPath})`)}`)

	console.log()

	const service = new TelemetryService(
		projectPath,
		CLI_VERSION,
		new FsFileReader(),
		new CliGitService(projectPath),
	)

	// Collect events with progress
	const collectSpinner = ora('Collecting git commits...').start()

	let events: Awaited<ReturnType<typeof service.collectAll>>
	try {
		events = await service.collectAll({
			onProgress: (phase, current, total) => {
				if (phase === 'git') {
					collectSpinner.text = 'Collecting git commits...'
				} else if (phase === 'sessions') {
					collectSpinner.text = `Reading Claude sessions... (${current}/${total} files)`
				} else if (phase === 'claude') {
					collectSpinner.text = 'Processing Claude sessions...'
				}
			},
		})
		collectSpinner.succeed(`Collected ${pc.bold(events.length)} events`)
	} catch (error) {
		collectSpinner.fail('Failed to collect telemetry')
		p.log.error(error instanceof Error ? error.message : 'Unknown error')
		process.exit(1)
	}

	if (events.length === 0) {
		p.log.info('No telemetry data to sync')
		p.outro('Nothing to do')
		return
	}

	// Show breakdown
	const commits = events.filter((e: { eventType: string }) => e.eventType === 'commit')
	const messages = events.filter((e: { eventType: string }) => e.eventType === 'message')

	console.log()
	console.log(`  ${pc.bold('Git commits:')}     ${commits.length}`)
	console.log(`  ${pc.bold('Claude messages:')} ${messages.length}`)

	// Show phase distribution
	const phases = events.filter((e: { phase?: string }) => e.phase)
	if (phases.length > 0) {
		const phaseCount: Record<string, number> = {}
		for (const e of phases) {
			phaseCount[e.phase!] = (phaseCount[e.phase!] || 0) + 1
		}
		console.log()
		console.log(`  ${pc.bold('Vanguard phases detected:')}`)
		for (const [phase, count] of Object.entries(phaseCount).sort((a, b) => b[1] - a[1])) {
			console.log(`    ${phase}: ${count}`)
		}
	}

	console.log()

	if (options.dryRun) {
		p.log.warn('Dry run - not sending data')
		p.outro('Done (dry run)')
		return
	}

	// Send to API with progress bar
	const progressBar = new cliProgress.SingleBar(
		{
			format: `  Syncing │${pc.cyan('{bar}')}│ {percentage}% │ {value}/{total} events │ ETA: {eta_formatted}`,
			barCompleteChar: '█',
			barIncompleteChar: '░',
			hideCursor: true,
			etaBuffer: 10,
		},
		cliProgress.Presets.shades_classic,
	)

	progressBar.start(events.length, 0)

	try {
		const result = await service.sync({
			onBatchProgress: (sent, total) => {
				progressBar.update(Math.min(sent, total))
			},
		})

		progressBar.stop()

		if (result.success) {
			p.log.success('Telemetry synced successfully')
			console.log()
			console.log(
				`  ${pc.bold('Events inserted:')}     ${pc.green(result.eventsInserted.toString())}`,
			)
			console.log(
				`  ${pc.bold('Events deduplicated:')} ${pc.dim(result.eventsDeduplicated.toString())}`,
			)

			if (result.errors.length > 0) {
				console.log()
				p.log.warn(`${result.errors.length} events had errors:`)
				for (const error of result.errors.slice(0, 5)) {
					console.log(`  ${pc.dim('-')} ${error}`)
				}
				if (result.errors.length > 5) {
					console.log(`  ${pc.dim(`... and ${result.errors.length - 5} more`)}`)
				}
			}
		} else {
			p.log.error('Sync failed')
			for (const error of result.errors) {
				p.log.error(error)
			}
			process.exit(1)
		}
	} catch (error) {
		progressBar.stop()
		p.log.error('Sync failed')
		p.log.error(error instanceof Error ? error.message : 'Unknown error')
		process.exit(1)
	}

	console.log()
	p.outro(pc.green('Telemetry synced!'))
}

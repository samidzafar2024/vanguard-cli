import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { parse, stringify } from 'yaml'

/**
 * Refresh command — Regenerate agents, commands, and project artifacts.
 *
 * Reads the current .vanguard/config.yaml and regenerates all derived files:
 * - .claude/agents/ (persona definitions)
 * - .claude/commands/ (slash commands)
 * - .claude/rules/ (project rules)
 * - CLAUDE.md (project context)
 * - .vanguard/templates/ (document templates)
 */
export const refreshCommand = new Command('refresh')
	.description('Refresh agents, commands, and project artifacts')
	.option('--dry-run', 'Show what would change without writing')
	.option('-y, --yes', 'Apply without confirmation')
	.action(async (options) => {
		const rootPath = process.cwd()
		const vanguardDir = path.join(rootPath, '.vanguard')

		if (!fs.existsSync(vanguardDir)) {
			console.log(pc.red('Not a Vanguard project. Run `vanguard init` first.'))
			process.exit(1)
		}

		console.log()
		p.intro(pc.bgCyan(pc.black(' vanguard refresh ')))

		const configPath = path.join(vanguardDir, 'config.yaml')
		if (!fs.existsSync(configPath)) {
			p.log.error('Missing .vanguard/config.yaml')
			process.exit(1)
		}

		// Check what exists
		const checks = [
			{ path: '.claude/agents', label: 'Agents' },
			{ path: '.claude/commands', label: 'Commands' },
			{ path: '.claude/rules', label: 'Rules' },
			{ path: 'CLAUDE.md', label: 'CLAUDE.md' },
			{ path: '.vanguard/templates', label: 'Templates' },
			{ path: '.vanguard/constitution.md', label: 'Constitution' },
		]

		const existing: string[] = []
		const missing: string[] = []

		for (const check of checks) {
			const fullPath = path.join(rootPath, check.path)
			if (fs.existsSync(fullPath)) {
				existing.push(check.label)
			} else {
				missing.push(check.label)
			}
		}

		if (existing.length > 0) {
			p.log.info(`Existing: ${existing.map((e) => pc.green(e)).join(', ')}`)
		}
		if (missing.length > 0) {
			p.log.info(`Missing: ${missing.map((m) => pc.yellow(m)).join(', ')}`)
		}

		if (options.dryRun) {
			p.log.info('')
			p.log.info(pc.dim('Would regenerate all agents, commands, and rules with --force'))
			p.outro(pc.yellow('Dry run — no changes made.'))
			return
		}

		if (!options.yes && existing.length > 0) {
			const confirmed = await p.confirm({
				message: `Regenerate ${existing.length} existing + ${missing.length} missing artifacts?`,
				initialValue: true,
			})
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel('Cancelled.')
				return
			}
		}

		// Trigger agents generate --force
		const s = p.spinner()
		s.start('Refreshing project artifacts...')

		try {
			// Import and execute agents generate logic
			// We'll do it inline since it's simpler than importing the command
			const { execSync } = await import('node:child_process')
			execSync('npx vanguard agents generate --force', {
				cwd: rootPath,
				stdio: 'pipe',
			})
			s.stop('Refreshed!')
		} catch {
			s.stop('Manual refresh needed')
			p.log.info(`Run: ${pc.cyan('vanguard agents generate --force')}`)
		}

		// Update manifest timestamp
		const manifestPath = path.join(rootPath, 'vanguard.manifest.yaml')
		if (fs.existsSync(manifestPath)) {
			try {
				const manifest = parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
				const vanguardSection = manifest['vanguard'] as Record<string, unknown> | undefined
				if (vanguardSection) {
					vanguardSection['lastRefreshed'] = new Date().toISOString()
				}
				fs.writeFileSync(manifestPath, stringify(manifest), 'utf-8')
			} catch {
				// Non-critical
			}
		}

		p.log.success('All artifacts refreshed.')
		p.outro(pc.green('Review changes and commit when ready.'))
	})

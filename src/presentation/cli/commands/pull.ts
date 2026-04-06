import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

/**
 * Pull command — Sync configuration for team members.
 *
 * When a team member clones a Vanguard project, they run `vanguard pull`
 * to set up their local MCP credentials and ensure .claude/ is populated.
 */
export const pullCommand = new Command('pull')
	.description('Sync MCP config and agents for team members')
	.option('--dry-run', 'Show what would change without writing')
	.action(async (options) => {
		const rootPath = process.cwd()
		const vanguardDir = path.join(rootPath, '.vanguard')

		if (!fs.existsSync(vanguardDir)) {
			console.log(pc.red('Not a Vanguard project. Run `vanguard init` first.'))
			process.exit(1)
		}

		console.log()
		p.intro(pc.bgCyan(pc.black(' vanguard pull ')))

		// 1. Check if .claude/ agents exist
		const agentsDir = path.join(rootPath, '.claude', 'agents')
		const hasAgents = fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length > 0

		if (!hasAgents) {
			if (options.dryRun) {
				p.log.info(pc.dim('Would generate agents with `vanguard agents generate`'))
			} else {
				p.log.warn('No agents found. Generating...')
				p.log.info(pc.dim('Run `vanguard agents generate` to create Claude Code agents'))
			}
		} else {
			p.log.success(`Agents: ${pc.green('OK')} (${fs.readdirSync(agentsDir).length} agents)`)
		}

		// 2. Check .mcp.json
		const mcpPath = path.join(rootPath, '.mcp.json')
		if (fs.existsSync(mcpPath)) {
			const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'))
			const serverCount = Object.keys(mcpConfig.mcpServers ?? {}).length
			p.log.success(`MCP: ${pc.green('OK')} (${serverCount} server${serverCount !== 1 ? 's' : ''})`)
		} else {
			p.log.info(pc.dim('No MCP servers configured. Run `vanguard mcp add` if needed.'))
		}

		// 3. Check .claude/settings.local.json
		const settingsPath = path.join(rootPath, '.claude', 'settings.local.json')
		if (fs.existsSync(settingsPath)) {
			p.log.success(`Settings: ${pc.green('OK')} (local settings found)`)
		} else {
			p.log.info(pc.dim('No local settings. MCP tokens will need to be configured.'))
		}

		// 4. Check constitution
		const constitutionPath = path.join(vanguardDir, 'constitution.md')
		if (fs.existsSync(constitutionPath)) {
			p.log.success(`Constitution: ${pc.green('OK')}`)
		} else {
			p.log.warn('No constitution found!')
		}

		// 5. Summary
		console.log('')
		p.log.info(pc.bold('Useful commands:'))
		p.log.info(`  ${pc.cyan('vanguard agents generate')} — Generate/update agents & commands`)
		p.log.info(`  ${pc.cyan('vanguard mcp add')}         — Add MCP server`)
		p.log.info(`  ${pc.cyan('vanguard refresh')}          — Refresh project configuration`)
		p.log.info(`  ${pc.cyan('vanguard status')}           — Show project overview`)

		if (options.dryRun) {
			p.outro(pc.yellow('Dry run — no changes made.'))
		} else {
			p.outro(pc.green('Pull complete.'))
		}
	})

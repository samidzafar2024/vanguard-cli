#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import gradient from 'gradient-string'
import { agentsCommand } from './commands/agents.js'
import { hooksCommand } from './commands/hooks.js'
import { initCommand } from './commands/init.js'
import { integrationsCommand } from './commands/integrations.js'
import { mcpCommand } from './commands/mcp.js'
import { memoryCommand } from './commands/memory.js'
import { planCommand } from './commands/plan.js'
import { pullCommand } from './commands/pull.js'
import { refreshCommand } from './commands/refresh.js'
import { specCommand } from './commands/spec.js'
import { statusCommand } from './commands/status.js'
import { taskCommand } from './commands/task.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packagePath = join(__dirname, '..', '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
	version: string
	description: string
}

const vanguardGradient = gradient(['#00d4ff', '#10b981', '#7c3aed'])

const banner = `
██╗   ██╗ █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
██║   ██║██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
██║   ██║███████║██╔██╗ ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║
╚██╗ ██╔╝██╔══██║██║╚██╗██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
 ╚████╔╝ ██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝`

const program = new Command()

program
	.name('vanguard')
	.version(pkg.version)
	.description(`${vanguardGradient.multiline(banner)}\n\n${pkg.description}`)
	.hook('preAction', () => {
		if (process.argv.length <= 2) {
			console.log(vanguardGradient.multiline(banner))
			console.log()
		}
	})

// Core commands
program.addCommand(initCommand)
program.addCommand(statusCommand)

// Development workflow
program.addCommand(specCommand)
program.addCommand(planCommand)
program.addCommand(taskCommand)
program.addCommand(memoryCommand)
program.addCommand(integrationsCommand)

// Claude Code integration
program.addCommand(agentsCommand)
program.addCommand(mcpCommand)
program.addCommand(hooksCommand)

// Sync & maintenance
program.addCommand(pullCommand)
program.addCommand(refreshCommand)

program.parse()

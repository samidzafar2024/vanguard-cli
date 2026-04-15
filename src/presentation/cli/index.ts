#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import gradient from 'gradient-string'
import { authCommand, loginCommand, logoutCommand } from './commands/auth.js'
import { extendCommand } from './commands/extend.js'
import { initCommand } from './commands/init.js'
import { integrationsCommand } from './commands/integrations.js'
import { memoryCommand } from './commands/memory.js'
import { pullCommand } from './commands/pull.js'
import { refreshCommand } from './commands/refresh.js'
import { taskCommand } from './commands/task.js'

// Load package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
const packagePath = join(__dirname, '..', '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
	version: string
	description: string
}

// Custom Vanguard gradient (cyan to purple)
const vanguardGradient = gradient(['#00d4ff', '#7c3aed', '#c026d3'])

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
		// Show banner before commands
		if (process.argv.length <= 2) {
			console.log(vanguardGradient.multiline(banner))
			console.log()
		}
	})

program.addCommand(initCommand)
program.addCommand(extendCommand)
program.addCommand(integrationsCommand)
program.addCommand(taskCommand)
program.addCommand(memoryCommand) // `vanguard memory` for knowledge management
program.addCommand(authCommand)
program.addCommand(loginCommand) // Convenience: `vanguard login` as alias for `vanguard auth login`
program.addCommand(logoutCommand) // Convenience: `vanguard logout` as alias for `vanguard auth logout`
// syncCommand mothballed — telemetry sync deferred pending schema redesign
program.addCommand(pullCommand) // `vanguard pull` to sync auth token + MCP config
program.addCommand(refreshCommand) // `vanguard refresh` to update methodology files from server

program.parse()

#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import gradient from 'gradient-string'
import { initCommand } from './commands/init.js'
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

program.addCommand(initCommand)
program.addCommand(statusCommand)
program.addCommand(taskCommand)

program.parse()

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

interface McpServerConfig {
	type: string
	url?: string
	headers?: Record<string, string>
	command?: string
	args?: string[]
	env?: Record<string, string>
}

interface McpJson {
	mcpServers: Record<string, McpServerConfig>
}

interface ClaudeSettings {
	env?: Record<string, string>
	permissions?: { allow?: string[] }
	enableAllProjectMcpServers?: boolean
	enabledMcpjsonServers?: string[]
	allowedTools?: string[]
}

function getProjectRoot(): string {
	return process.cwd()
}

function getVanguardDir(): string {
	const dir = path.join(getProjectRoot(), '.vanguard')
	if (!fs.existsSync(dir)) {
		console.log(pc.red('Not a Vanguard project. Run `vanguard init` first.'))
		process.exit(1)
	}
	return dir
}

function loadMcpJson(): McpJson {
	const mcpPath = path.join(getProjectRoot(), '.mcp.json')
	if (fs.existsSync(mcpPath)) {
		try {
			return JSON.parse(fs.readFileSync(mcpPath, 'utf-8')) as McpJson
		} catch {
			return { mcpServers: {} }
		}
	}
	return { mcpServers: {} }
}

function saveMcpJson(config: McpJson): void {
	const mcpPath = path.join(getProjectRoot(), '.mcp.json')
	fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

function loadSettingsLocal(): ClaudeSettings {
	const settingsPath = path.join(getProjectRoot(), '.claude', 'settings.local.json')
	if (fs.existsSync(settingsPath)) {
		try {
			return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as ClaudeSettings
		} catch {
			return {}
		}
	}
	return {}
}

function saveSettingsLocal(settings: ClaudeSettings): void {
	const settingsPath = path.join(getProjectRoot(), '.claude', 'settings.local.json')
	fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}

function ensureGitignore(entry: string): void {
	const gitignorePath = path.join(getProjectRoot(), '.gitignore')
	const content = fs.existsSync(gitignorePath)
		? fs.readFileSync(gitignorePath, 'utf-8')
		: ''

	if (content.split('\n').some((line) => line.trim() === entry)) return

	const separator = content.endsWith('\n') || content === '' ? '' : '\n'
	fs.writeFileSync(gitignorePath, `${content}${separator}${entry}\n`, 'utf-8')
}

export const mcpCommand = new Command('mcp')
	.description('Configure MCP (Model Context Protocol) servers for Claude Code')

// vanguard mcp add
mcpCommand
	.command('add')
	.description('Add an MCP server configuration')
	.action(async () => {
		getVanguardDir() // ensure project

		p.intro(pc.bgCyan(pc.black(' vanguard mcp add ')))

		const serverType = await p.select({
			message: 'MCP server type?',
			options: [
				{ value: 'http', label: 'HTTP Server', hint: 'Remote MCP server via URL' },
				{ value: 'stdio', label: 'Stdio Server', hint: 'Local MCP server via command' },
				{ value: 'vanguard-memory', label: 'Vanguard Memory', hint: 'Local knowledge graph (auto-configure)' },
			],
		})
		if (p.isCancel(serverType)) { p.cancel('Cancelled.'); return }

		const name = await p.text({
			message: 'Server name? (identifier)',
			initialValue: serverType === 'vanguard-memory' ? 'vanguard-memory' : '',
			validate: (v) => {
				if (!v.trim()) return 'Name is required'
				if (!/^[a-z][a-z0-9-]*$/.test(v)) return 'Lowercase alphanumeric with hyphens'
				return undefined
			},
		})
		if (p.isCancel(name)) { p.cancel('Cancelled.'); return }

		const mcpConfig = loadMcpJson()
		const settings = loadSettingsLocal()

		if (serverType === 'vanguard-memory') {
			// Auto-configure vanguard memory MCP server
			mcpConfig.mcpServers[name as string] = {
				type: 'http',
				url: 'http://localhost:8000/mcp/',
			}

			// Pre-approve memory tools
			const memoryTools = [
				`mcp__${name}__add_memory`,
				`mcp__${name}__search_memory_facts`,
				`mcp__${name}__search_nodes`,
				`mcp__${name}__get_episodes`,
				`mcp__${name}__get_status`,
			]

			settings.permissions = settings.permissions ?? { allow: [] }
			const existingAllow = settings.permissions.allow ?? []
			settings.permissions.allow = [
				...existingAllow,
				...memoryTools.filter((t) => !existingAllow.includes(t)),
			]
			const existingTools = settings.allowedTools ?? []
			settings.allowedTools = [
				...existingTools,
				...memoryTools.filter((t) => !existingTools.includes(t)),
			]

		} else if (serverType === 'http') {
			const url = await p.text({
				message: 'Server URL?',
				placeholder: 'https://example.com/api/mcp',
				validate: (v) => {
					if (!v.trim()) return 'URL is required'
					if (!v.startsWith('http')) return 'Must start with http:// or https://'
					return undefined
				},
			})
			if (p.isCancel(url)) { p.cancel('Cancelled.'); return }

			const needsAuth = await p.confirm({
				message: 'Requires authentication?',
				initialValue: false,
			})
			if (p.isCancel(needsAuth)) { p.cancel('Cancelled.'); return }

			const headers: Record<string, string> = {}
			if (needsAuth) {
				const token = await p.password({
					message: 'Bearer token?',
				})
				if (p.isCancel(token)) { p.cancel('Cancelled.'); return }

				const envVar = `${(name as string).toUpperCase().replace(/-/g, '_')}_TOKEN`
				headers['Authorization'] = `Bearer \${${envVar}}`

				// Store actual token in settings.local.json
				settings.env = settings.env ?? {}
				settings.env[envVar] = token
			}

			mcpConfig.mcpServers[name as string] = {
				type: 'http',
				url: url as string,
				...(Object.keys(headers).length > 0 ? { headers } : {}),
			}

		} else if (serverType === 'stdio') {
			const command = await p.text({
				message: 'Command to run?',
				placeholder: 'npx -y @modelcontextprotocol/server-filesystem',
				validate: (v) => {
					if (!v.trim()) return 'Command is required'
					return undefined
				},
			})
			if (p.isCancel(command)) { p.cancel('Cancelled.'); return }

			const argsInput = await p.text({
				message: 'Arguments? (space-separated, optional)',
				initialValue: '',
			})
			if (p.isCancel(argsInput)) { p.cancel('Cancelled.'); return }

			const args = String(argsInput).split(' ').filter(Boolean)
			const parts = String(command).split(' ')
			const cmd = parts[0] as string
			const cmdArgs = [...parts.slice(1), ...args]

			mcpConfig.mcpServers[name as string] = {
				type: 'stdio',
				command: cmd,
				args: cmdArgs,
			}
		}

		// Enable the server
		settings.enableAllProjectMcpServers = true
		settings.enabledMcpjsonServers = [
			...new Set([...(settings.enabledMcpjsonServers ?? []), name as string]),
		]

		// Save
		saveMcpJson(mcpConfig)
		saveSettingsLocal(settings)
		ensureGitignore('.claude/settings.local.json')

		p.log.success(`Added MCP server: ${pc.cyan(name as string)}`)
		p.log.info('')
		p.log.info(pc.bold('Files updated:'))
		p.log.info(`  ${pc.cyan('.mcp.json')}                    — MCP server config (committed)`)
		p.log.info(`  ${pc.cyan('.claude/settings.local.json')}  — Secrets & permissions (gitignored)`)
		p.log.info('')
		p.outro(pc.dim('Claude Code will auto-detect the MCP server on next session.'))
	})

// vanguard mcp list
mcpCommand
	.command('list')
	.description('List configured MCP servers')
	.action(() => {
		const mcpConfig = loadMcpJson()
		const servers = Object.entries(mcpConfig.mcpServers)

		if (servers.length === 0) {
			console.log(pc.dim('\n  No MCP servers configured. Run `vanguard mcp add`.\n'))
			return
		}

		console.log('')
		console.log(pc.bold(`  MCP Servers (${servers.length})`))
		console.log(pc.dim('  ─────────────────────────────────────'))

		for (const [serverName, config] of servers) {
			console.log(`  ${pc.green('●')} ${pc.bold(serverName)} (${config.type})`)
			if (config.url) console.log(pc.dim(`    URL: ${config.url}`))
			if (config.command) console.log(pc.dim(`    Command: ${config.command} ${config.args?.join(' ') ?? ''}`))
			if (config.headers) {
				const hasAuth = Object.keys(config.headers).some((k) => k.toLowerCase() === 'authorization')
				if (hasAuth) console.log(pc.dim('    Auth: Bearer token (from settings.local.json)'))
			}
		}
		console.log('')
	})

// vanguard mcp remove
mcpCommand
	.command('remove <name>')
	.description('Remove an MCP server')
	.action((serverName: string) => {
		const mcpConfig = loadMcpJson()

		if (!mcpConfig.mcpServers[serverName]) {
			console.log(pc.red(`\n  MCP server "${serverName}" not found.\n`))
			return
		}

		delete mcpConfig.mcpServers[serverName]
		saveMcpJson(mcpConfig)

		// Remove from settings.local.json
		const settings = loadSettingsLocal()
		settings.enabledMcpjsonServers = (settings.enabledMcpjsonServers ?? []).filter((s) => s !== serverName)
		settings.allowedTools = (settings.allowedTools ?? []).filter((t) => !t.startsWith(`mcp__${serverName}__`))
		if (settings.permissions?.allow) {
			settings.permissions.allow = settings.permissions.allow.filter((t) => !t.startsWith(`mcp__${serverName}__`))
		}

		// Remove env var
		const envVar = `${serverName.toUpperCase().replace(/-/g, '_')}_TOKEN`
		if (settings.env?.[envVar]) {
			delete settings.env[envVar]
		}

		saveSettingsLocal(settings)

		console.log(pc.green(`\n  Removed MCP server: ${serverName}\n`))
	})

// vanguard mcp status
mcpCommand
	.command('status')
	.description('Check MCP server connectivity')
	.action(async () => {
		const mcpConfig = loadMcpJson()
		const servers = Object.entries(mcpConfig.mcpServers)

		if (servers.length === 0) {
			console.log(pc.dim('\n  No MCP servers configured.\n'))
			return
		}

		console.log('')
		console.log(pc.bold('  MCP Server Status'))
		console.log(pc.dim('  ─────────────────────────────────────'))

		for (const [serverName, config] of servers) {
			if (config.type === 'http' && config.url) {
				try {
					const settings = loadSettingsLocal()
					let url = config.url

					// Resolve env vars in URL
					const envVarMatch = url.match(/\$\{(\w+)\}/)
					if (envVarMatch?.[1] && settings.env?.[envVarMatch[1]]) {
						url = url.replace(`\${${envVarMatch[1]}}`, settings.env[envVarMatch[1]] as string)
					}

					const controller = new AbortController()
					const timeout = setTimeout(() => controller.abort(), 3000)

					const headers: Record<string, string> = {}
					if (config.headers?.['Authorization'] && settings.env) {
						let authHeader = config.headers['Authorization']
						for (const [key, val] of Object.entries(settings.env)) {
							authHeader = authHeader.replace(`\${${key}}`, val)
						}
						headers['Authorization'] = authHeader
					}

					const response = await fetch(url, {
						method: 'GET',
						headers,
						signal: controller.signal,
					})
					clearTimeout(timeout)

					const ok = response.ok || response.status === 405
					console.log(`  ${ok ? pc.green('●') : pc.red('●')} ${serverName} — ${ok ? pc.green('online') : pc.red(`${response.status}`)}`)
				} catch {
					console.log(`  ${pc.red('●')} ${serverName} — ${pc.red('unreachable')}`)
				}
			} else if (config.type === 'stdio') {
				console.log(`  ${pc.yellow('●')} ${serverName} — ${pc.dim('stdio (starts on demand)')}`)
			}
		}
		console.log('')
	})

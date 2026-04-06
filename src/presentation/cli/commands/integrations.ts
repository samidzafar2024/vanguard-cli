import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { parse, stringify } from 'yaml'

type IntegrationType = 'jira' | 'clickup' | 'linear' | 'github'
type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done' | 'blocked'

interface IntegrationConfig {
	type: IntegrationType
	name: string
	baseUrl: string
	email: string
	apiToken: string
	projectKey: string
	statusMapping: Record<string, TaskStatus>
	enabled: boolean
	lastSyncAt?: string
}

interface JiraIssue {
	key: string
	fields: {
		summary: string
		description?: string
		status: { name: string }
		priority?: { name: string }
		assignee?: { displayName: string; emailAddress: string }
		labels?: string[]
		issuetype: { name: string }
		created: string
		updated: string
		duedate?: string
	}
}

interface JiraProject {
	id: string
	key: string
	name: string
}

function getVanguardDir(): string {
	const rootPath = process.cwd()
	const vanguardDir = path.join(rootPath, '.vanguard')
	if (!fs.existsSync(vanguardDir)) {
		console.log(pc.red('Not a Vanguard project. Run `vanguard init` first.'))
		process.exit(1)
	}
	return vanguardDir
}

function getIntegrationsDir(): string {
	const dir = path.join(getVanguardDir(), 'integrations')
	fs.mkdirSync(dir, { recursive: true })
	return dir
}

function saveIntegration(config: IntegrationConfig): void {
	const filePath = path.join(getIntegrationsDir(), `${config.name}.yaml`)
	fs.writeFileSync(filePath, stringify(config), 'utf-8')
}

function loadAllIntegrations(): IntegrationConfig[] {
	const dir = getIntegrationsDir()
	if (!fs.existsSync(dir)) return []
	return fs.readdirSync(dir)
		.filter((f) => f.endsWith('.yaml'))
		.map((f) => parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as IntegrationConfig)
}

async function jiraFetch(
	baseUrl: string,
	email: string,
	apiToken: string,
	endpoint: string,
): Promise<Response> {
	const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')
	return fetch(`${baseUrl}/rest/api/3${endpoint}`, {
		headers: {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
	})
}

export const integrationsCommand = new Command('integrations')
	.description('Manage PM tool integrations')

// vanguard integrations add
integrationsCommand
	.command('add')
	.description('Add a new PM tool integration')
	.action(async () => {
		p.intro(pc.bgCyan(pc.black(' vanguard integrations add ')))

		const type = await p.select({
			message: 'Which PM tool?',
			options: [
				{ value: 'jira', label: 'Jira', hint: 'Atlassian Jira Cloud' },
				{ value: 'clickup', label: 'ClickUp', hint: 'Coming soon' },
				{ value: 'linear', label: 'Linear', hint: 'Coming soon' },
				{ value: 'github', label: 'GitHub Issues', hint: 'Coming soon' },
			],
		})
		if (p.isCancel(type)) { p.cancel('Cancelled.'); return }

		if (type !== 'jira') {
			p.log.warn(`${type} integration is coming soon. Only Jira is supported currently.`)
			return
		}

		const name = await p.text({
			message: 'Integration name? (for reference)',
			initialValue: 'jira',
			validate: (v) => {
				if (!v.trim()) return 'Name is required'
				return undefined
			},
		})
		if (p.isCancel(name)) { p.cancel('Cancelled.'); return }

		const baseUrl = await p.text({
			message: 'Jira base URL?',
			placeholder: 'https://your-org.atlassian.net',
			validate: (v) => {
				if (!v.trim()) return 'URL is required'
				if (!v.startsWith('https://')) return 'Must start with https://'
				return undefined
			},
		})
		if (p.isCancel(baseUrl)) { p.cancel('Cancelled.'); return }

		const email = await p.text({
			message: 'Your Jira email?',
			validate: (v) => {
				if (!v.trim()) return 'Email is required'
				if (!v.includes('@')) return 'Invalid email'
				return undefined
			},
		})
		if (p.isCancel(email)) { p.cancel('Cancelled.'); return }

		const apiToken = await p.password({
			message: 'API Token? (from https://id.atlassian.net/manage-profile/security/api-tokens)',
		})
		if (p.isCancel(apiToken)) { p.cancel('Cancelled.'); return }

		// Test connection
		const s = p.spinner()
		s.start('Testing connection...')

		try {
			const response = await jiraFetch(baseUrl as string, email as string, apiToken, '/myself')
			if (!response.ok) {
				s.stop('Connection failed')
				p.log.error(`Authentication failed: ${response.status} ${response.statusText}`)
				return
			}

			const user = await response.json() as { displayName: string }
			s.stop(`Connected as ${pc.green(user.displayName)}`)
		} catch (err) {
			s.stop('Connection failed')
			p.log.error(`Could not connect: ${err}`)
			return
		}

		// List projects
		s.start('Fetching projects...')
		let projects: JiraProject[] = []
		try {
			const response = await jiraFetch(baseUrl as string, email as string, apiToken, '/project')
			if (response.ok) {
				projects = await response.json() as JiraProject[]
			}
			s.stop(`Found ${projects.length} projects`)
		} catch {
			s.stop('Could not fetch projects')
		}

		let projectKey = ''
		if (projects.length > 0) {
			const selected = await p.select({
				message: 'Select project',
				options: projects.map((proj) => ({
					value: proj.key,
					label: `${proj.key} — ${proj.name}`,
				})),
			})
			if (p.isCancel(selected)) { p.cancel('Cancelled.'); return }
			projectKey = selected as string
		} else {
			const key = await p.text({
				message: 'Project key? (e.g., PROJ)',
				validate: (v) => {
					if (!v.trim()) return 'Project key is required'
					return undefined
				},
			})
			if (p.isCancel(key)) { p.cancel('Cancelled.'); return }
			projectKey = key as string
		}

		// Default status mapping
		const config: IntegrationConfig = {
			type: 'jira',
			name: name as string,
			baseUrl: (baseUrl as string).replace(/\/$/, ''),
			email: email as string,
			apiToken,
			projectKey,
			statusMapping: {
				'To Do': 'todo',
				'In Progress': 'in-progress',
				'In Review': 'in-review',
				'Done': 'done',
				'Blocked': 'blocked',
				'Backlog': 'backlog',
			},
			enabled: true,
		}

		saveIntegration(config)

		p.log.success(`Integration saved: ${pc.cyan(name as string)}`)
		p.log.info('')
		p.log.info(pc.bold('Next steps:'))
		p.log.info(`  ${pc.dim('List tasks:')}    vanguard integrations tasks`)
		p.log.info(`  ${pc.dim('Sync tasks:')}    vanguard integrations sync`)
		p.log.info('')
		p.outro(pc.bgGreen(pc.black(' Jira connected! ')))
	})

// vanguard integrations list
integrationsCommand
	.command('list')
	.description('List configured integrations')
	.action(() => {
		const integrations = loadAllIntegrations()

		if (integrations.length === 0) {
			console.log(pc.dim('\n  No integrations configured. Run `vanguard integrations add`.\n'))
			return
		}

		console.log('')
		console.log(pc.bold(`  Integrations (${integrations.length})`))
		console.log(pc.dim('  ─────────────────────────────────────'))

		for (const int of integrations) {
			const status = int.enabled ? pc.green('●') : pc.red('○')
			console.log(`  ${status} ${pc.bold(int.name)} (${int.type})`)
			console.log(pc.dim(`    URL: ${int.baseUrl}`))
			console.log(pc.dim(`    Project: ${int.projectKey}`))
			if (int.lastSyncAt) console.log(pc.dim(`    Last sync: ${int.lastSyncAt}`))
		}
		console.log('')
	})

// vanguard integrations tasks
integrationsCommand
	.command('tasks')
	.description('List tasks from Jira')
	.option('-n, --name <name>', 'Integration name')
	.option('-s, --status <status>', 'Filter by Jira status')
	.option('-l, --limit <limit>', 'Max results', '20')
	.action(async (options) => {
		const integrations = loadAllIntegrations()
		let config: IntegrationConfig | undefined

		if (options.name) {
			config = integrations.find((i) => i.name === options.name)
		} else if (integrations.length === 1) {
			config = integrations[0]
		} else if (integrations.length > 1) {
			const selected = await p.select({
				message: 'Which integration?',
				options: integrations.map((i) => ({ value: i.name, label: `${i.name} (${i.type})` })),
			})
			if (p.isCancel(selected)) return
			config = integrations.find((i) => i.name === selected)
		}

		if (!config) {
			console.log(pc.red('\n  No integration found. Run `vanguard integrations add`.\n'))
			return
		}

		if (config.type !== 'jira') {
			console.log(pc.red(`\n  ${config.type} task listing not yet supported.\n`))
			return
		}

		const s = p.spinner()
		s.start('Fetching tasks from Jira...')

		try {
			let jql = `project = ${config.projectKey} ORDER BY updated DESC`
			if (options.status) {
				jql = `project = ${config.projectKey} AND status = "${options.status}" ORDER BY updated DESC`
			}

			const response = await jiraFetch(
				config.baseUrl,
				config.email,
				config.apiToken,
				`/search?jql=${encodeURIComponent(jql)}&maxResults=${options.limit}&fields=summary,status,priority,assignee,labels,issuetype,duedate`,
			)

			if (!response.ok) {
				s.stop('Failed')
				p.log.error(`Jira API error: ${response.status}`)
				return
			}

			const data = await response.json() as { issues: JiraIssue[]; total: number }
			s.stop(`Found ${data.total} issues (showing ${data.issues.length})`)

			console.log('')
			for (const issue of data.issues) {
				const f = issue.fields
				const statusColor = f.status.name.toLowerCase().includes('done') ? pc.green :
					f.status.name.toLowerCase().includes('progress') ? pc.yellow :
					f.status.name.toLowerCase().includes('review') ? pc.blue : pc.dim

				const priority = f.priority?.name === 'Highest' ? pc.red('!!!') :
					f.priority?.name === 'High' ? pc.yellow('!!') :
					f.priority?.name === 'Medium' ? pc.blue('!') : pc.dim('-')

				console.log(`  ${priority} ${pc.bold(issue.key)} ${f.summary} [${statusColor(f.status.name)}]`)
				if (f.assignee) console.log(pc.dim(`    → ${f.assignee.displayName}`))
			}
			console.log('')
		} catch (err) {
			s.stop('Error')
			p.log.error(`${err}`)
		}
	})

// vanguard integrations sync
integrationsCommand
	.command('sync')
	.description('Sync tasks from Jira to local .vanguard/tasks/')
	.option('-n, --name <name>', 'Integration name')
	.action(async (options) => {
		const integrations = loadAllIntegrations()
		let config: IntegrationConfig | undefined

		if (options.name) {
			config = integrations.find((i) => i.name === options.name)
		} else if (integrations.length === 1) {
			config = integrations[0]
		} else {
			console.log(pc.red('\n  Specify integration with --name\n'))
			return
		}

		if (!config || config.type !== 'jira') {
			console.log(pc.red('\n  No Jira integration found.\n'))
			return
		}

		const s = p.spinner()
		s.start('Syncing from Jira...')

		try {
			const jql = `project = ${config.projectKey} AND status != Done ORDER BY priority DESC, updated DESC`
			const response = await jiraFetch(
				config.baseUrl,
				config.email,
				config.apiToken,
				`/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,priority,assignee,description,duedate`,
			)

			if (!response.ok) {
				s.stop('Failed')
				p.log.error(`Jira API error: ${response.status}`)
				return
			}

			const data = await response.json() as { issues: JiraIssue[] }
			const tasksDir = path.join(getVanguardDir(), 'tasks', 'jira-sync')
			fs.mkdirSync(tasksDir, { recursive: true })

			let created = 0
			let updated = 0

			for (let i = 0; i < data.issues.length; i++) {
				const issue = data.issues[i] as JiraIssue
				const f = issue.fields
				const filename = `${issue.key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`
				const filePath = path.join(tasksDir, filename)

				const mappedStatus = config.statusMapping[f.status.name] ?? 'todo'
				const priority = f.priority?.name === 'Highest' ? 'critical' :
					f.priority?.name === 'High' ? 'high' :
					f.priority?.name === 'Low' ? 'low' : 'medium'

				const today = new Date().toISOString().split('T')[0]
				const frontmatter = {
					title: f.summary,
					status: mappedStatus,
					sequence: i + 1,
					created: today,
					priority,
					jiraKey: issue.key,
					jiraStatus: f.status.name,
					...(f.assignee ? { assignee: f.assignee.displayName } : {}),
					...(f.duedate ? { dueDate: f.duedate } : {}),
				}

				const content = `---\n${stringify(frontmatter)}---\n\n# ${issue.key}: ${f.summary}\n\n${f.description ?? 'No description.'}\n`

				if (fs.existsSync(filePath)) {
					updated++
				} else {
					created++
				}
				fs.writeFileSync(filePath, content, 'utf-8')
			}

			// Update last sync timestamp
			config.lastSyncAt = new Date().toISOString()
			saveIntegration(config)

			s.stop(`Synced ${data.issues.length} issues`)
			console.log(pc.green(`  Created: ${created} | Updated: ${updated}`))
			console.log(pc.dim(`  Tasks saved to .vanguard/tasks/jira-sync/`))
			console.log('')
		} catch (err) {
			s.stop('Error')
			p.log.error(`${err}`)
		}
	})

// vanguard integrations remove
integrationsCommand
	.command('remove <name>')
	.description('Remove an integration')
	.action((name: string) => {
		const filePath = path.join(getIntegrationsDir(), `${name}.yaml`)
		if (!fs.existsSync(filePath)) {
			console.log(pc.red(`\n  Integration "${name}" not found.\n`))
			return
		}
		fs.unlinkSync(filePath)
		console.log(pc.green(`\n  Removed integration: ${name}\n`))
	})

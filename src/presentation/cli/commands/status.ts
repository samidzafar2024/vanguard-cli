import * as fs from 'node:fs'
import * as path from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import { parse } from 'yaml'

interface VanguardConfig {
	project: {
		name: string
		type: string
		track: string
	}
	stack: {
		id: string
		language: string
	}
	database: {
		type: string
		orm?: string
	}
	architecture: {
		primary: string
	}
	testing: {
		unit?: string
	}
}

interface TaskFrontmatter {
	title: string
	status: string
	sequence?: number
}

function countFiles(dir: string, ext: string): number {
	if (!fs.existsSync(dir)) return 0
	return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).length
}

function loadTasks(tasksDir: string): TaskFrontmatter[] {
	if (!fs.existsSync(tasksDir)) return []

	const tasks: TaskFrontmatter[] = []
	const files = fs.readdirSync(tasksDir, { recursive: true }) as string[]

	for (const file of files) {
		if (!String(file).endsWith('.md')) continue
		const filePath = path.join(tasksDir, String(file))
		const stat = fs.statSync(filePath)
		if (!stat.isFile()) continue

		const content = fs.readFileSync(filePath, 'utf-8')
		const match = content.match(/^---\n([\s\S]*?)\n---/)
		if (match?.[1]) {
			try {
				const frontmatter = parse(match[1]) as TaskFrontmatter
				tasks.push(frontmatter)
			} catch {
				// Skip invalid frontmatter
			}
		}
	}

	return tasks
}

export const statusCommand = new Command('status')
	.description('Show project status overview')
	.action(() => {
		const rootPath = process.cwd()
		const vanguardDir = path.join(rootPath, '.vanguard')

		if (!fs.existsSync(vanguardDir)) {
			console.log(pc.red('Not a Vanguard project. Run `vanguard init` first.'))
			process.exit(1)
		}

		// Load config
		const configPath = path.join(vanguardDir, 'config.yaml')
		if (!fs.existsSync(configPath)) {
			console.log(pc.red('Missing .vanguard/config.yaml'))
			process.exit(1)
		}

		const config = parse(fs.readFileSync(configPath, 'utf-8')) as VanguardConfig

		// Count artifacts
		const specCount = countFiles(path.join(vanguardDir, 'specs'), '.md')
		const planCount = countFiles(path.join(vanguardDir, 'plans'), '.md')
		const tasks = loadTasks(path.join(vanguardDir, 'tasks'))

		const todo = tasks.filter((t) => t.status === 'todo').length
		const inProgress = tasks.filter((t) => t.status === 'in-progress').length
		const done = tasks.filter((t) => t.status === 'done' || t.status === 'completed').length
		const totalTasks = tasks.length

		// Check integrations
		const integrationsDir = path.join(vanguardDir, 'integrations')
		const integrations = fs.existsSync(integrationsDir)
			? fs.readdirSync(integrationsDir).filter((f) => f.endsWith('.yaml')).length
			: 0

		// Check memory items
		const memoryDir = path.join(vanguardDir, 'memory', 'items')
		let memoryCount = 0
		if (fs.existsSync(memoryDir)) {
			const countRecursive = (dir: string): number => {
				let count = 0
				for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
					if (entry.isDirectory()) count += countRecursive(path.join(dir, entry.name))
					else if (entry.name.endsWith('.md')) count++
				}
				return count
			}
			memoryCount = countRecursive(memoryDir)
		}

		// Display
		console.log('')
		console.log(pc.bold(pc.cyan(`  ${config.project.name}`)) + pc.dim(` (${config.project.type}, ${config.project.track})`))
		console.log(pc.dim('  ─────────────────────────────────────'))
		console.log('')

		console.log(pc.bold('  Stack'))
		console.log(`  ${pc.dim('Language:')}    ${config.stack.language}`)
		console.log(`  ${pc.dim('Framework:')}   ${config.stack.id}`)
		console.log(`  ${pc.dim('Architecture:')}${config.architecture.primary}`)
		console.log(`  ${pc.dim('Database:')}    ${config.database.type}${config.database.orm ? ` (${config.database.orm})` : ''}`)
		if (config.testing.unit) console.log(`  ${pc.dim('Testing:')}     ${config.testing.unit}`)
		console.log('')

		console.log(pc.bold('  Artifacts'))
		console.log(`  ${pc.dim('Specs:')}       ${specCount}`)
		console.log(`  ${pc.dim('Plans:')}       ${planCount}`)
		console.log(`  ${pc.dim('Memory:')}      ${memoryCount} items`)
		console.log(`  ${pc.dim('Integrations:')}${integrations}`)
		console.log('')

		if (totalTasks > 0) {
			console.log(pc.bold('  Tasks'))

			const bar = (count: number, total: number, color: (s: string) => string): string => {
				const width = 20
				const filled = Math.round((count / total) * width)
				return color('█'.repeat(filled)) + pc.dim('░'.repeat(width - filled))
			}

			console.log(`  ${pc.red('●')} Todo:        ${todo}  ${bar(todo, totalTasks, pc.red)}`)
			console.log(`  ${pc.yellow('●')} In Progress: ${inProgress}  ${bar(inProgress, totalTasks, pc.yellow)}`)
			console.log(`  ${pc.green('●')} Done:        ${done}  ${bar(done, totalTasks, pc.green)}`)
			console.log(`  ${pc.dim('  Total:')}      ${totalTasks}`)

			if (totalTasks > 0) {
				const percent = Math.round((done / totalTasks) * 100)
				console.log('')
				console.log(`  ${pc.bold('Progress:')} ${percent}% complete`)
			}
		} else {
			console.log(pc.dim('  No tasks yet. Run `vanguard task create` to add tasks.'))
		}

		console.log('')
	})

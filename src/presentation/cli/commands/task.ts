import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { parse, stringify } from 'yaml'

type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done' | 'blocked'

interface TaskFrontmatter {
	title: string
	plan?: string
	status: TaskStatus
	sequence: number
	created: string
	assignee?: string
	priority?: 'low' | 'medium' | 'high' | 'critical'
}

interface TaskFile {
	path: string
	filename: string
	frontmatter: TaskFrontmatter
	body: string
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

function getTasksDir(): string {
	const tasksDir = path.join(getVanguardDir(), 'tasks')
	fs.mkdirSync(tasksDir, { recursive: true })
	return tasksDir
}

function parseTaskFile(filePath: string): TaskFile | null {
	const content = fs.readFileSync(filePath, 'utf-8')
	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
	if (!match?.[1]) return null

	try {
		const frontmatter = parse(match[1]) as TaskFrontmatter
		return {
			path: filePath,
			filename: path.basename(filePath),
			frontmatter,
			body: match[2] ?? '',
		}
	} catch {
		return null
	}
}

function loadAllTasks(tasksDir: string): TaskFile[] {
	const tasks: TaskFile[] = []

	function scanDir(dir: string): void {
		if (!fs.existsSync(dir)) return
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				scanDir(fullPath)
			} else if (entry.name.endsWith('.md')) {
				const task = parseTaskFile(fullPath)
				if (task) tasks.push(task)
			}
		}
	}

	scanDir(tasksDir)
	return tasks.sort((a, b) => a.frontmatter.sequence - b.frontmatter.sequence)
}

function updateTaskStatus(filePath: string, newStatus: TaskStatus): void {
	const content = fs.readFileSync(filePath, 'utf-8')
	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
	if (!match?.[1]) return

	const frontmatter = parse(match[1]) as TaskFrontmatter
	frontmatter.status = newStatus

	const updated = `---\n${stringify(frontmatter)}---\n${match[2] ?? ''}`
	fs.writeFileSync(filePath, updated, 'utf-8')
}

function statusIcon(status: TaskStatus): string {
	switch (status) {
		case 'todo': return pc.red('○')
		case 'in-progress': return pc.yellow('◐')
		case 'in-review': return pc.blue('◑')
		case 'done': return pc.green('●')
		case 'blocked': return pc.red('✕')
		default: return pc.dim('?')
	}
}

function statusColor(status: TaskStatus): (s: string) => string {
	switch (status) {
		case 'todo': return pc.red
		case 'in-progress': return pc.yellow
		case 'in-review': return pc.blue
		case 'done': return pc.green
		case 'blocked': return pc.red
		default: return pc.dim
	}
}

// Main task command group
export const taskCommand = new Command('task')
	.description('Manage project tasks')

// vanguard task list
taskCommand
	.command('list')
	.description('List all tasks')
	.option('-s, --status <status>', 'Filter by status (todo, in-progress, in-review, done, blocked)')
	.option('-g, --group', 'Group by plan/folder')
	.action((options) => {
		const tasksDir = getTasksDir()
		let tasks = loadAllTasks(tasksDir)

		if (options.status) {
			tasks = tasks.filter((t) => t.frontmatter.status === options.status)
		}

		if (tasks.length === 0) {
			console.log(pc.dim('\n  No tasks found. Run `vanguard task create` to add tasks.\n'))
			return
		}

		console.log('')
		console.log(pc.bold(`  Tasks (${tasks.length})`))
		console.log(pc.dim('  ─────────────────────────────────────'))

		for (const task of tasks) {
			const fm = task.frontmatter
			const icon = statusIcon(fm.status)
			const color = statusColor(fm.status)
			const priority = fm.priority === 'critical' ? pc.red(' !!') :
				fm.priority === 'high' ? pc.yellow(' !') : ''

			console.log(`  ${icon} ${pc.dim(`#${fm.sequence}`)} ${fm.title}${priority} ${pc.dim(`[${color(fm.status)}]`)}`)
		}

		const done = tasks.filter((t) => t.frontmatter.status === 'done').length
		const percent = Math.round((done / tasks.length) * 100)
		console.log('')
		console.log(pc.dim(`  ${done}/${tasks.length} done (${percent}%)`))
		console.log('')
	})

// vanguard task create
taskCommand
	.command('create')
	.description('Create a new task')
	.option('-t, --title <title>', 'Task title')
	.option('-p, --plan <plan>', 'Linked plan name')
	.action(async (options) => {
		const tasksDir = getTasksDir()

		p.intro(pc.bgCyan(pc.black(' vanguard task create ')))

		const title = options.title ?? await p.text({
			message: 'Task title?',
			validate: (v) => {
				if (!v.trim()) return 'Title is required'
				return undefined
			},
		})
		if (p.isCancel(title)) { p.cancel('Cancelled.'); return }

		const plan = options.plan ?? await p.text({
			message: 'Linked plan? (optional, press Enter to skip)',
			initialValue: '',
		})
		if (p.isCancel(plan)) { p.cancel('Cancelled.'); return }

		const priority = await p.select({
			message: 'Priority?',
			initialValue: 'medium',
			options: [
				{ value: 'low', label: 'Low' },
				{ value: 'medium', label: 'Medium' },
				{ value: 'high', label: 'High', hint: '!' },
				{ value: 'critical', label: 'Critical', hint: '!!' },
			],
		})
		if (p.isCancel(priority)) { p.cancel('Cancelled.'); return }

		const objective = await p.text({
			message: 'What does this task accomplish?',
			validate: (v) => {
				if (!v.trim()) return 'Objective is required'
				return undefined
			},
		})
		if (p.isCancel(objective)) { p.cancel('Cancelled.'); return }

		// Auto-calculate sequence number
		const existing = loadAllTasks(tasksDir)
		const sequence = existing.length > 0
			? Math.max(...existing.map((t) => t.frontmatter.sequence)) + 1
			: 1

		// Generate filename
		const slug = (title as string)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50)

		const filename = `task-${String(sequence).padStart(3, '0')}-${slug}.md`

		// Determine directory
		let taskDir = tasksDir
		if (plan && String(plan).trim()) {
			const planSlug = String(plan)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
			taskDir = path.join(tasksDir, planSlug)
			fs.mkdirSync(taskDir, { recursive: true })
		}

		const today = new Date().toISOString().split('T')[0]

		const frontmatter = {
			title: title as string,
			...(plan && String(plan).trim() ? { plan: plan as string } : {}),
			status: 'todo' as const,
			sequence,
			created: today as string,
			priority: (priority ?? 'medium') as 'low' | 'medium' | 'high' | 'critical',
		}

		const content = `---
${stringify(frontmatter)}---

# Task: ${title}

## Objective
${objective}

## Steps
1. [ ] Step 1
2. [ ] Step 2
3. [ ] Step 3

## Acceptance Criteria
- [ ] Criteria 1
- [ ] All tests pass

## Files to Create/Modify
- \`path/to/file\` — [what to do]

## Testing
- [ ] Unit tests added
- [ ] All tests pass
`

		const filePath = path.join(taskDir, filename)
		fs.writeFileSync(filePath, content, 'utf-8')

		p.log.success(`Created: ${pc.cyan(path.relative(process.cwd(), filePath))}`)
		p.outro(pc.dim(`Task #${sequence} — ${title}`))
	})

// vanguard task start <sequence>
taskCommand
	.command('start [sequence]')
	.description('Start working on a task (creates git branch + marks in-progress)')
	.option('--no-branch', 'Skip git branch creation')
	.action(async (sequenceArg, options) => {
		const tasksDir = getTasksDir()
		const tasks = loadAllTasks(tasksDir)
		const todoTasks = tasks.filter((t) => t.frontmatter.status === 'todo')

		if (todoTasks.length === 0) {
			console.log(pc.dim('\n  No todo tasks found.\n'))
			return
		}

		let target: TaskFile | undefined

		if (sequenceArg) {
			target = tasks.find((t) => t.frontmatter.sequence === Number(sequenceArg))
		} else {
			const selected = await p.select({
				message: 'Which task to start?',
				options: todoTasks.map((t) => ({
					value: t.path,
					label: `#${t.frontmatter.sequence} ${t.frontmatter.title}`,
					hint: t.frontmatter.priority ?? 'medium',
				})),
			})
			if (p.isCancel(selected)) return
			target = tasks.find((t) => t.path === selected)
		}

		if (!target) {
			console.log(pc.red('\n  Task not found.\n'))
			return
		}

		updateTaskStatus(target.path, 'in-progress')

		// Create git branch
		if (options.branch !== false) {
			const seq = String(target.frontmatter.sequence).padStart(3, '0')
			const slug = target.frontmatter.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
				.slice(0, 40)
			const branchName = `feature/task-${seq}-${slug}`

			try {
				const { execSync } = await import('node:child_process')
				// Check if git repo
				execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' })

				// Check if branch already exists
				try {
					execSync(`git rev-parse --verify ${branchName}`, { stdio: 'pipe' })
					// Branch exists, switch to it
					execSync(`git checkout ${branchName}`, { stdio: 'pipe' })
					console.log(pc.cyan(`\n  Switched to existing branch: ${branchName}`))
				} catch {
					// Branch doesn't exist, create it
					execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' })
					console.log(pc.cyan(`\n  Created branch: ${branchName}`))
				}
			} catch {
				console.log(pc.dim('\n  (Not a git repo — branch creation skipped)'))
			}
		}

		console.log(pc.green(`  ◐ Started: ${target.frontmatter.title}\n`))
	})

// vanguard task done [sequence]
taskCommand
	.command('done [sequence]')
	.description('Mark a task as done')
	.action(async (sequenceArg) => {
		const tasksDir = getTasksDir()
		const tasks = loadAllTasks(tasksDir)
		const activeTasks = tasks.filter((t) =>
			t.frontmatter.status === 'in-progress' || t.frontmatter.status === 'in-review'
		)

		if (activeTasks.length === 0) {
			console.log(pc.dim('\n  No active tasks found.\n'))
			return
		}

		let target: TaskFile | undefined

		if (sequenceArg) {
			target = tasks.find((t) => t.frontmatter.sequence === Number(sequenceArg))
		} else {
			const selected = await p.select({
				message: 'Which task is done?',
				options: activeTasks.map((t) => ({
					value: t.path,
					label: `#${t.frontmatter.sequence} ${t.frontmatter.title}`,
					hint: t.frontmatter.status,
				})),
			})
			if (p.isCancel(selected)) return
			target = tasks.find((t) => t.path === selected)
		}

		if (!target) {
			console.log(pc.red('\n  Task not found.\n'))
			return
		}

		updateTaskStatus(target.path, 'done')
		console.log(pc.green(`\n  ● Done: ${target.frontmatter.title}\n`))
	})

// vanguard task review [sequence]
taskCommand
	.command('review [sequence]')
	.description('Mark a task as in-review')
	.action(async (sequenceArg) => {
		const tasksDir = getTasksDir()
		const tasks = loadAllTasks(tasksDir)
		const inProgressTasks = tasks.filter((t) => t.frontmatter.status === 'in-progress')

		if (inProgressTasks.length === 0) {
			console.log(pc.dim('\n  No in-progress tasks found.\n'))
			return
		}

		let target: TaskFile | undefined

		if (sequenceArg) {
			target = tasks.find((t) => t.frontmatter.sequence === Number(sequenceArg))
		} else {
			const selected = await p.select({
				message: 'Which task to send for review?',
				options: inProgressTasks.map((t) => ({
					value: t.path,
					label: `#${t.frontmatter.sequence} ${t.frontmatter.title}`,
				})),
			})
			if (p.isCancel(selected)) return
			target = tasks.find((t) => t.path === selected)
		}

		if (!target) {
			console.log(pc.red('\n  Task not found.\n'))
			return
		}

		updateTaskStatus(target.path, 'in-review')
		console.log(pc.blue(`\n  ◑ In Review: ${target.frontmatter.title}\n`))
	})

import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { IntegrationService } from '../../../application/services/integration.service.js'
import type { ExternalTask } from '../../../domain/entities/integration.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { CliGitService } from '../../../infrastructure/git-service.js'
import { GitService } from '../../../infrastructure/git.service.js'
import { DefaultIntegrationProviderFactory } from '../../../infrastructure/integrations/index.js'
import { requireAuth } from '../utils/require-auth.js'

const factory = new DefaultIntegrationProviderFactory()
const service = new IntegrationService(
	factory,
	new FsFileReader(),
	new FsFileWriter(),
	new CliGitService(),
)
const git = new GitService()

function canceled(): never {
	p.cancel('Operation canceled.')
	process.exit(1)
}

/**
 * Format a task for display.
 */
function formatTask(task: ExternalTask): string {
	const priority =
		task.priority === 'urgent'
			? pc.red('!!!')
			: task.priority === 'high'
				? pc.yellow('!!')
				: task.priority === 'medium'
					? pc.blue('!')
					: pc.dim('-')

	const status =
		task.status === 'done'
			? pc.green(task.originalStatus)
			: task.status === 'in-progress'
				? pc.cyan(task.originalStatus)
				: task.status === 'blocked'
					? pc.red(task.originalStatus)
					: pc.dim(task.originalStatus)

	return `${priority} ${pc.bold(task.key)} ${task.title} [${status}]`
}

/**
 * Get the default integration name.
 */
async function getIntegrationName(options: { integration?: string }): Promise<string> {
	// Always initialize service to populate providers
	await service.initialize()

	if (options.integration) {
		return options.integration
	}

	const integrations = await service.getIntegrations()

	if (integrations.length === 0) {
		p.log.error('No integrations configured. Run "vanguard integrations add" first.')
		process.exit(1)
	}

	if (integrations.length === 1 && integrations[0]) {
		return integrations[0].name
	}

	const name = await p.select({
		message: 'Select integration',
		options: integrations.map((i) => ({
			value: i.name,
			label: `${i.name} (${i.type})`,
		})),
	})

	if (p.isCancel(name)) canceled()
	return name as string
}

/**
 * Command to list available tasks.
 */
const listCommand = new Command('list')
	.description('List tasks from PM tool')
	.option('-i, --integration <name>', 'Integration name')
	.option('-s, --status <status>', 'Filter by status')
	.option('-a, --assignee <assignee>', 'Filter by assignee')
	.option('-l, --limit <limit>', 'Maximum number of tasks', '20')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		const spinner = p.spinner()
		spinner.start('Fetching tasks...')

		try {
			const tasks = await service.getAvailableTasks(integrationName, {
				status: options.status,
				assignee: options.assignee,
				limit: Number.parseInt(options.limit, 10),
			})

			spinner.stop(`Found ${tasks.length} tasks`)

			if (tasks.length === 0) {
				p.log.info('No tasks found matching your criteria.')
				return
			}

			console.log()
			for (const task of tasks) {
				console.log(`  ${formatTask(task)}`)
				if (task.assignee) {
					console.log(pc.dim(`    Assignee: ${task.assignee}`))
				}
			}
			console.log()
		} catch (err) {
			spinner.stop('Failed to fetch tasks')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to search tasks.
 */
const searchCommand = new Command('search')
	.description('Search tasks')
	.argument('<query>', 'Search query')
	.option('-i, --integration <name>', 'Integration name')
	.action(async (query: string, options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		const spinner = p.spinner()
		spinner.start('Searching...')

		try {
			const tasks = await service.searchTasks(integrationName, query)
			spinner.stop(`Found ${tasks.length} tasks`)

			if (tasks.length === 0) {
				p.log.info('No tasks found matching your query.')
				return
			}

			console.log()
			for (const task of tasks) {
				console.log(`  ${formatTask(task)}`)
				console.log(pc.dim(`    ${task.url}`))
			}
			console.log()
		} catch (err) {
			spinner.stop('Search failed')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to show task details.
 */
const showCommand = new Command('show')
	.description('Show task details')
	.argument('<id>', 'Task ID or key')
	.option('-i, --integration <name>', 'Integration name')
	.action(async (taskId: string, options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		const spinner = p.spinner()
		spinner.start('Fetching task...')

		try {
			const task = await service.getTask(integrationName, taskId)

			if (!task) {
				spinner.stop('Task not found')
				p.log.error(`Task not found: ${taskId}`)
				process.exit(1)
			}

			spinner.stop('Task loaded')

			console.log()
			console.log(pc.bold(pc.cyan(`${task.key}: ${task.title}`)))
			console.log()
			console.log(`${pc.bold('Status')}: ${task.originalStatus} (${task.status})`)
			console.log(`${pc.bold('Priority')}: ${task.priority}`)
			if (task.assignee) {
				console.log(`${pc.bold('Assignee')}: ${task.assignee}`)
			}
			if (task.labels.length > 0) {
				console.log(`${pc.bold('Labels')}: ${task.labels.join(', ')}`)
			}
			if (task.dueDate) {
				console.log(`${pc.bold('Due')}: ${task.dueDate}`)
			}
			console.log(`${pc.bold('URL')}: ${task.url}`)
			console.log()
			if (task.description) {
				console.log(pc.dim('Description:'))
				console.log(task.description)
			}
			console.log()
		} catch (err) {
			spinner.stop('Failed to fetch task')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to start working on a task.
 */
const startCommand = new Command('start')
	.description('Start working on a task (creates branch)')
	.argument('<id>', 'Task ID or key')
	.option('-i, --integration <name>', 'Integration name')
	.option('--no-status-update', 'Do not update task status')
	.action(async (taskId: string, options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		const spinner = p.spinner()
		spinner.start('Starting task...')

		try {
			const result = await service.startTask(integrationName, taskId, {
				updateStatus: options.statusUpdate !== false,
			})

			if (!result.success) {
				spinner.stop('Failed to start task')
				p.log.error(result.error ?? 'Unknown error')
				process.exit(1)
			}

			spinner.stop('Task started')

			p.note(
				`${pc.bold('Task')}: ${result.task.key} - ${result.task.title}
${pc.bold('Branch')}: ${result.branchName}
${pc.bold('Status')}: ${result.task.originalStatus}

${pc.dim('You are now on branch:')} ${pc.cyan(result.branchName)}`,
				'Ready to work',
			)

			p.outro(pc.green('Happy coding!'))
		} catch (err) {
			spinner.stop('Failed to start task')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to update task status.
 */
const updateCommand = new Command('update')
	.description('Update task status or details')
	.argument('<id>', 'Task ID or key')
	.option('-i, --integration <name>', 'Integration name')
	.option('-s, --status <status>', 'New status')
	.option('-c, --comment <comment>', 'Add a comment')
	.action(async (taskId: string, options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		// Get current task
		const task = await service.getTask(integrationName, taskId)
		if (!task) {
			p.log.error(`Task not found: ${taskId}`)
			process.exit(1)
		}

		// If no options provided, prompt for status
		let newStatus = options.status
		if (!newStatus && !options.comment) {
			const statuses = await service.getStatuses(integrationName)

			newStatus = await p.select({
				message: 'New status',
				initialValue: task.originalStatus,
				options: statuses.map((s) => ({
					value: s,
					label: s,
				})),
			})

			if (p.isCancel(newStatus)) canceled()
		}

		const spinner = p.spinner()
		spinner.start('Updating task...')

		try {
			if (newStatus) {
				const result = await service.updateTask(integrationName, taskId, {
					status: newStatus as string,
				})

				if (!result.success) {
					spinner.stop('Update failed')
					p.log.error(result.error ?? 'Unknown error')
					process.exit(1)
				}
			}

			if (options.comment) {
				await service.addComment(integrationName, taskId, options.comment)
			}

			spinner.stop('Task updated')
			p.log.success(`Updated ${task.key}`)
		} catch (err) {
			spinner.stop('Update failed')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to mark task as complete.
 */
const completeCommand = new Command('complete')
	.description('Mark task as complete')
	.argument('[id]', 'Task ID (uses active task if not provided)')
	.option('-i, --integration <name>', 'Integration name')
	.option('-c, --comment <comment>', 'Completion comment')
	.option('--skip-review', 'Skip review check (emergency use only)')
	.action(async (taskId: string | undefined, options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		// Get task ID from active task if not provided
		let finalTaskId = taskId
		if (!finalTaskId) {
			const activeTask = await service.getActiveTask()
			if (activeTask) {
				finalTaskId = activeTask.task.id
			} else {
				p.log.error('No task ID provided and no active task found.')
				process.exit(1)
			}
		}

		// Check for review unless skipped
		if (!options.skipReview) {
			const mergeCheck = git.canMerge()
			if (!mergeCheck.canMerge && mergeCheck.taskId) {
				p.log.error(pc.red('Review required before completion'))
				p.log.info(mergeCheck.reason ?? 'Run /vanguard.review to perform code review')
				p.log.info(pc.dim('Use --skip-review to bypass (emergency only)'))
				process.exit(1)
			}
		} else {
			p.log.warn(pc.yellow('Skipping review check - use sparingly!'))
		}

		// Get available statuses to find a "done" status
		const statuses = await service.getStatuses(integrationName)
		const doneStatus =
			statuses.find(
				(s) =>
					s.toLowerCase().includes('done') ||
					s.toLowerCase().includes('complete') ||
					s.toLowerCase().includes('closed'),
			) ?? 'done'

		const spinner = p.spinner()
		spinner.start('Completing task...')

		try {
			const result = await service.completeTask(integrationName, finalTaskId, {
				completedStatus: doneStatus,
				comment: options.comment,
			})

			if (!result.success) {
				spinner.stop('Failed to complete task')
				p.log.error(result.error ?? 'Unknown error')
				process.exit(1)
			}

			spinner.stop('Task completed')
			p.log.success(`Marked task as ${doneStatus}`)
		} catch (err) {
			spinner.stop('Failed to complete task')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to show current active task.
 */
const currentCommand = new Command('current')
	.description('Show current active task')
	.action(async () => {
		// Require authentication
		await requireAuth()

		const activeTask = await service.getActiveTask()

		if (!activeTask) {
			p.log.info('No active task. Use "vanguard task start <id>" to start one.')
			return
		}

		console.log()
		console.log(pc.bold(pc.cyan(`${activeTask.task.key}: ${activeTask.task.title}`)))
		console.log()
		console.log(`${pc.bold('Integration')}: ${activeTask.integration}`)
		console.log(`${pc.bold('Branch')}: ${activeTask.branchName}`)
		console.log(`${pc.bold('Started')}: ${activeTask.startedAt}`)
		console.log(`${pc.bold('URL')}: ${activeTask.task.url}`)
		console.log()
	})

/**
 * Command to create a new task.
 */
const createCommand = new Command('create')
	.description('Create a new task')
	.option('-i, --integration <name>', 'Integration name')
	.option('-t, --title <title>', 'Task title')
	.option('-d, --description <desc>', 'Task description')
	.option('-p, --priority <priority>', 'Priority (urgent, high, medium, low)')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		// Prompt for title if not provided
		const title = options.title
			? options.title
			: await p.text({
					message: 'Task title',
					validate: (value) => {
						if (!value) return 'Title is required'
						return undefined
					},
				})

		if (p.isCancel(title)) canceled()

		// Prompt for description if not provided
		const description = options.description
			? options.description
			: await p.text({
					message: 'Description (optional)',
					defaultValue: '',
				})

		if (p.isCancel(description)) canceled()

		// Prompt for priority if not provided
		const priority = options.priority
			? options.priority
			: await p.select({
					message: 'Priority',
					options: [
						{ value: 'medium', label: 'Medium' },
						{ value: 'high', label: 'High' },
						{ value: 'urgent', label: 'Urgent' },
						{ value: 'low', label: 'Low' },
					],
				})

		if (p.isCancel(priority)) canceled()

		const spinner = p.spinner()
		spinner.start('Creating task...')

		try {
			const result = await service.createTask(integrationName, {
				title: title as string,
				description: description as string,
				priority: priority as 'urgent' | 'high' | 'medium' | 'low',
			})

			if (!result.success) {
				spinner.stop('Failed to create task')
				p.log.error(result.error ?? 'Unknown error')
				process.exit(1)
			}

			spinner.stop('Task created')

			if (result.task) {
				p.note(
					`${pc.bold('ID')}: ${result.task.key}
${pc.bold('Title')}: ${result.task.title}
${pc.bold('URL')}: ${result.task.url}`,
					'Task created',
				)
			}

			p.outro(pc.green('Task created successfully!'))
		} catch (err) {
			spinner.stop('Failed to create task')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to start a code review.
 */
const reviewCommand = new Command('review')
	.description('Start code review for a task')
	.argument('[id]', 'Task ID (uses active task if not provided)')
	.option('-i, --integration <name>', 'Integration name')
	.option('-c, --comment <comment>', 'Review initiation comment')
	.action(async (taskId: string | undefined, options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		// Get task ID from active task if not provided
		let finalTaskId = taskId
		if (!finalTaskId) {
			const activeTask = await service.getActiveTask()
			if (activeTask) {
				finalTaskId = activeTask.task.id
			} else {
				p.log.error('No task ID provided and no active task found.')
				process.exit(1)
			}
		}

		// Get task details
		const task = await service.getTask(integrationName, finalTaskId)
		if (!task) {
			p.log.error(`Task not found: ${finalTaskId}`)
			process.exit(1)
		}

		// Get available statuses to find a "review" status
		const statuses = await service.getStatuses(integrationName)
		const reviewStatus = statuses.find(
			(s) => s.toLowerCase().includes('review') || s.toLowerCase().includes('reviewing'),
		)

		const spinner = p.spinner()
		spinner.start('Starting review...')

		try {
			let statusUpdated = false

			// Try to update status to reviewing (graceful if status doesn't exist)
			if (reviewStatus) {
				const result = await service.updateTask(integrationName, finalTaskId, {
					status: reviewStatus,
				})
				statusUpdated = result.success

				if (!result.success) {
					spinner.stop('Note')
					p.log.warn(
						pc.yellow(
							`Could not update status to '${reviewStatus}': ${result.error ?? 'unknown error'}`,
						),
					)
					p.log.info('Continuing with review anyway...')
					spinner.start('Starting review...')
				}
			} else {
				spinner.stop('Note')
				p.log.warn(pc.yellow('No "review" status found in PM tool - status unchanged'))
				p.log.info('Continuing with review anyway...')
				spinner.start('Starting review...')
			}

			// Add review comment
			const comment = options.comment ?? `🔍 Code review initiated for task ${task.key}`
			await service.addComment(integrationName, finalTaskId, comment)

			spinner.stop('Review started')

			const statusInfo = statusUpdated
				? `${pc.bold('Status')}: ${reviewStatus}`
				: `${pc.bold('Status')}: ${pc.dim('unchanged (no review status in PM)')}`

			p.note(
				`${pc.bold('Task')}: ${task.key} - ${task.title}
${statusInfo}
${pc.bold('URL')}: ${task.url}

${pc.dim('Run /vanguard.review to perform the code review')}`,
				'Ready for review',
			)

			p.outro(pc.cyan('Review mode activated'))
		} catch (err) {
			spinner.stop('Failed to start review')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to get and start the next task.
 */
const nextCommand = new Command('next')
	.description('Get the next prioritized task from the queue')
	.option('-i, --integration <name>', 'Integration name')
	.option('-n, --count <count>', 'Number of tasks to show', '5')
	.option('-s, --skip', 'Skip starting a task, just show the list')
	.option('-a, --auto', 'Auto-start the highest priority task without prompting')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		const integrationName = await getIntegrationName(options)

		// Check if on a task branch that's not merged
		const currentBranch = git.getCurrentBranch()
		const taskId = currentBranch ? git.extractTaskFromBranch(currentBranch) : undefined

		if (taskId && !git.isOnDefaultBranch()) {
			p.log.warn(pc.yellow(`Currently on task branch: ${currentBranch}`))

			const shouldContinue = await p.confirm({
				message: 'Do you want to see available tasks anyway?',
			})

			if (p.isCancel(shouldContinue) || !shouldContinue) {
				p.outro('Use "vanguard task complete" when you\'re done with the current task.')
				return
			}
		}

		const spinner = p.spinner()
		spinner.start('Fetching available tasks...')

		try {
			// Get next prioritized tasks
			const count = Number.parseInt(options.count, 10)
			const tasks = await service.getAvailableTasks(integrationName, {
				status: 'Open', // Get open/todo tasks
				limit: count,
			})

			if (tasks.length === 0) {
				spinner.stop('No tasks available')
				p.log.info('All caught up! No tasks in the queue.')
				return
			}

			spinner.stop(`Found ${tasks.length} task${tasks.length > 1 ? 's' : ''}`)

			// Auto-start the first task if --auto flag is set
			if (options.auto && tasks[0]) {
				const firstTask = tasks[0]
				spinner.start(`Auto-starting task ${firstTask.key}...`)

				const result = await service.startTask(integrationName, firstTask.id, {
					updateStatus: true,
				})

				if (!result.success) {
					spinner.stop('Failed to start task')
					p.log.error(result.error ?? 'Unknown error')
					process.exit(1)
				}

				spinner.stop('Task started')

				p.note(
					`${pc.bold('Task')}: ${result.task.key} - ${result.task.title}
${pc.bold('Branch')}: ${result.branchName}
${pc.bold('Status')}: ${result.task.originalStatus}

${pc.dim('You are now on branch:')} ${pc.cyan(result.branchName)}`,
					'Auto-started highest priority task',
				)

				p.outro(pc.green('Happy coding!'))
				return
			}

			if (options.skip) {
				// Just show the list
				console.log()
				for (const task of tasks) {
					console.log(formatTask(task))
				}
				console.log()
				p.outro('Use "vanguard task start <id>" to begin working on a task.')
				return
			}

			// Interactive selection
			const taskOptions = tasks.map((task) => {
				const opt: { value: string; label: string; hint?: string } = {
					value: task.id,
					label: `${task.key}: ${task.title}`,
				}
				if (task.priority !== 'none') {
					opt.hint = `Priority: ${task.priority}`
				}
				return opt
			})

			const selection = await p.select({
				message: 'Select a task to start working on:',
				options: [
					...taskOptions,
					{
						value: '__skip__',
						label: 'Skip - just show the list',
						hint: 'Not ready to start yet',
					},
				],
			})

			if (p.isCancel(selection)) canceled()

			if (selection === '__skip__') {
				console.log()
				for (const task of tasks) {
					console.log(formatTask(task))
				}
				console.log()
				p.outro('Use "vanguard task start <id>" when you\'re ready.')
				return
			}

			// Start the selected task
			const selectedTask = tasks.find((t) => t.id === selection)
			if (!selectedTask) {
				p.log.error('Task not found')
				process.exit(1)
			}

			spinner.start(`Starting task ${selectedTask.key}...`)

			const result = await service.startTask(integrationName, selectedTask.id, {
				updateStatus: true,
			})

			if (!result.success) {
				spinner.stop('Failed to start task')
				p.log.error(result.error ?? 'Unknown error')
				process.exit(1)
			}

			spinner.stop('Task started')

			p.note(
				`${pc.bold('Task')}: ${result.task.key} - ${result.task.title}
${pc.bold('Branch')}: ${result.branchName}
${pc.bold('Status')}: ${result.task.originalStatus}

${pc.dim('You are now on branch:')} ${pc.cyan(result.branchName)}`,
				'Ready to work',
			)

			p.outro(pc.green('Happy coding!'))
		} catch (err) {
			spinner.stop('Failed to fetch tasks')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Main task command group.
 */
export const taskCommand = new Command('task')
	.description('Work with PM tool tasks')
	.addCommand(listCommand)
	.addCommand(searchCommand)
	.addCommand(showCommand)
	.addCommand(startCommand)
	.addCommand(updateCommand)
	.addCommand(completeCommand)
	.addCommand(currentCommand)
	.addCommand(createCommand)
	.addCommand(reviewCommand)
	.addCommand(nextCommand)

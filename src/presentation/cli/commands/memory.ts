/**
 * Memory CLI Commands.
 *
 * Commands for managing Vanguard Memory - the persistent knowledge system
 * for AI coding agents.
 */

import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import type { MemorySearchResult } from '../../../application/ports/memory-api-client.js'
import { MemoryContextGeneratorService } from '../../../application/services/memory-context-generator.service.js'
import { PostTaskHookService } from '../../../application/services/post-task-hook.service.js'
import { PreTaskHookService } from '../../../application/services/pre-task-hook.service.js'
import { SessionStartHookService } from '../../../application/services/session-start-hook.service.js'
import {
	AddMemoryItemUseCase,
	DeleteMemoryItemUseCase,
	GetMemoryItemUseCase,
	ImportMemoryUseCase,
	InitMemoryUseCase,
	ListMemoryItemsUseCase,
	PullMemoryUseCase,
	PushMemoryUseCase,
	SearchMemoryUseCase,
	UpdateMemoryItemUseCase,
} from '../../../application/use-cases/memory/index.js'
import type { MemoryItem } from '../../../domain/entities/memory-item.js'
import type { ConfidenceLevel } from '../../../domain/value-objects/confidence.js'
import type { MemorySourceType } from '../../../domain/value-objects/memory-source.js'
import {
	VanguardEmbeddingService,
	VanguardMemoryApiClient,
} from '../../../infrastructure/api/index.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import {
	FileMemoryConfigRepository,
	FileMemoryRepository,
} from '../../../infrastructure/repositories/index.js'
import { requireAuth } from '../utils/require-auth.js'

// Initialize repositories and use cases
const memoryRepository = new FileMemoryRepository()
const configRepository = new FileMemoryConfigRepository()

// API clients
const embeddingService = new VanguardEmbeddingService()
const apiClient = new VanguardMemoryApiClient()

const initUseCase = new InitMemoryUseCase(configRepository)
const addUseCase = new AddMemoryItemUseCase(memoryRepository, configRepository)
const listUseCase = new ListMemoryItemsUseCase(memoryRepository, configRepository)
const getUseCase = new GetMemoryItemUseCase(memoryRepository, configRepository)
const updateUseCase = new UpdateMemoryItemUseCase(memoryRepository, configRepository)
const deleteUseCase = new DeleteMemoryItemUseCase(memoryRepository, configRepository)
const pushUseCase = new PushMemoryUseCase(
	memoryRepository,
	configRepository,
	embeddingService,
	apiClient,
)
const pullUseCase = new PullMemoryUseCase(memoryRepository, configRepository, apiClient)
const searchUseCase = new SearchMemoryUseCase(configRepository, apiClient)
const importUseCase = new ImportMemoryUseCase(
	memoryRepository,
	configRepository,
	new FsFileReader(),
)
const contextGenerator = new MemoryContextGeneratorService(configRepository, memoryRepository)
const preTaskHook = new PreTaskHookService(configRepository, memoryRepository, apiClient)
const postTaskHook = new PostTaskHookService(configRepository, memoryRepository)
const sessionStartHook = new SessionStartHookService(apiClient)

function canceled(): never {
	p.cancel('Operation canceled.')
	process.exit(1)
}

/**
 * Format confidence level with color.
 */
function formatConfidence(level: ConfidenceLevel): string {
	switch (level) {
		case 'high':
			return pc.green(level)
		case 'medium':
			return pc.yellow(level)
		case 'low':
			return pc.red(level)
	}
}

/**
 * Format source type with color.
 */
function formatSource(source: MemorySourceType): string {
	switch (source) {
		case 'manual':
			return pc.blue(source)
		case 'auto-captured':
			return pc.magenta(source)
		case 'imported':
			return pc.cyan(source)
	}
}

/**
 * Format a memory item for list display.
 */
function formatMemoryItemShort(item: MemoryItem): string {
	const confidence = formatConfidence(item.confidence.level)
	return `${pc.bold(item.id.toString())} ${pc.dim('|')} ${item.title} ${pc.dim(`[${confidence}]`)}`
}

/**
 * Format a memory item for detailed display.
 */
function formatMemoryItemDetail(item: MemoryItem): string {
	const lines = [
		`${pc.bold('ID')}: ${item.id.toString()}`,
		`${pc.bold('Title')}: ${item.title}`,
		`${pc.bold('Domain')}: ${item.domain}`,
	]

	if (item.topic) {
		lines.push(`${pc.bold('Topic')}: ${item.topic}`)
	}
	if (item.subtopic) {
		lines.push(`${pc.bold('Subtopic')}: ${item.subtopic}`)
	}

	lines.push(`${pc.bold('Confidence')}: ${formatConfidence(item.confidence.level)}`)
	lines.push(`${pc.bold('Source')}: ${formatSource(item.source.type)}`)

	if (item.author) {
		lines.push(`${pc.bold('Author')}: ${item.author}`)
	}
	if (item.tags.length > 0) {
		lines.push(`${pc.bold('Tags')}: ${item.tags.map((t) => pc.cyan(t)).join(', ')}`)
	}
	if (item.relations.length > 0) {
		lines.push(`${pc.bold('Relations')}: ${item.relations.join(', ')}`)
	}

	lines.push(`${pc.bold('Created')}: ${item.createdAt.toISOString()}`)
	lines.push(`${pc.bold('Updated')}: ${item.updatedAt.toISOString()}`)
	lines.push('')
	lines.push(pc.dim('─'.repeat(60)))
	lines.push(item.content)

	return lines.join('\n')
}

/**
 * Command to initialize memory for a project.
 */
const initCommand = new Command('init')
	.description('Initialize memory for this project')
	.option('-p, --project <name>', 'Project name')
	.option('-f, --force', 'Reinitialize even if already initialized')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		const isInitialized = await configRepository.isInitialized()

		if (isInitialized && !options.force) {
			p.log.warn('Memory is already initialized for this project.')
			p.log.info('Use --force to reinitialize.')
			return
		}

		// Get project name
		let projectName = options.project
		if (!projectName) {
			// Try to get from package.json or prompt
			try {
				const { readFileSync } = await import('node:fs')
				const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
				projectName = pkg.name
			} catch {
				// Prompt for project name
			}

			if (!projectName) {
				const name = await p.text({
					message: 'Project name',
					validate: (value) => {
						if (!value) return 'Project name is required'
						return undefined
					},
				})

				if (p.isCancel(name)) canceled()
				projectName = name as string
			}
		}

		const spinner = p.spinner()
		spinner.start('Initializing memory...')

		try {
			const result = await initUseCase.execute({
				projectName,
				force: options.force ?? false,
			})

			spinner.stop('Memory initialized')

			p.note(
				`${pc.bold('Project')}: ${result.config.project}
${pc.bold('Location')}: .vanguard/memory/
${pc.bold('Config')}: .vanguard/memory/config.yaml
${pc.bold('Items')}: .vanguard/memory/items/`,
				'Memory ready',
			)

			p.outro(pc.green(result.message))
		} catch (err) {
			spinner.stop('Failed to initialize memory')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to add a new memory item.
 */
const addCommand = new Command('add')
	.description('Add a new memory item')
	.option('-t, --title <title>', 'Memory item title')
	.option('-d, --domain <domain>', 'Domain (e.g., patterns, decisions, conventions)')
	.option('--topic <topic>', 'Topic within the domain')
	.option('--subtopic <subtopic>', 'Subtopic within the topic')
	.option('-c, --confidence <level>', 'Confidence level (low, medium, high)', 'medium')
	.option('-s, --source <source>', 'Source type (manual, auto-captured, imported)', 'manual')
	.option('-a, --author <author>', 'Author name')
	.option('--tags <tags>', 'Comma-separated tags')
	.option('--content <content>', 'Content (or use stdin)')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		// Get title
		const title =
			options.title ??
			(await p.text({
				message: 'Title',
				validate: (value) => (value ? undefined : 'Title is required'),
			}))
		if (p.isCancel(title)) canceled()

		// Get domain
		const domain =
			options.domain ??
			(await p.select({
				message: 'Domain',
				options: [
					{ value: 'patterns', label: 'Patterns', hint: 'Reusable solutions and approaches' },
					{ value: 'decisions', label: 'Decisions', hint: 'Architectural/design decisions' },
					{ value: 'conventions', label: 'Conventions', hint: 'Code style and naming' },
					{ value: 'errors', label: 'Errors', hint: 'Common errors and solutions' },
					{ value: 'learnings', label: 'Learnings', hint: 'Project-specific knowledge' },
				],
			}))
		if (p.isCancel(domain)) canceled()

		// Get content
		let content = options.content
		if (!content) {
			content = await p.text({
				message: 'Content (markdown supported)',
				validate: (value) => (value ? undefined : 'Content is required'),
			})
			if (p.isCancel(content)) canceled()
		}

		// Parse tags
		const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined

		const spinner = p.spinner()
		spinner.start('Adding memory item...')

		try {
			const result = await addUseCase.execute({
				title: title as string,
				content: content as string,
				domain: domain as string,
				...(options.topic !== undefined && { topic: options.topic }),
				...(options.subtopic !== undefined && { subtopic: options.subtopic }),
				confidence: options.confidence as ConfidenceLevel,
				source: options.source as MemorySourceType,
				...(options.author !== undefined && { author: options.author }),
				...(tags !== undefined && { tags }),
			})

			spinner.stop('Memory item added')

			p.note(
				`${pc.bold('ID')}: ${result.item.id.toString()}
${pc.bold('Title')}: ${result.item.title}
${pc.bold('Path')}: ${result.item.getHierarchyPath()}`,
				'Created',
			)

			p.outro(pc.green(result.message))
		} catch (err) {
			spinner.stop('Failed to add memory item')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to list memory items.
 */
const listCommand = new Command('list')
	.description('List memory items')
	.option('-d, --domain <domain>', 'Filter by domain')
	.option('--topic <topic>', 'Filter by topic')
	.option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
	.option('-c, --confidence <levels>', 'Filter by confidence (comma-separated)')
	.option('-l, --limit <limit>', 'Maximum number of items', '20')
	.option('-o, --offset <offset>', 'Offset for pagination', '0')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		const spinner = p.spinner()
		spinner.start('Loading memory items...')

		try {
			const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined
			const confidence = options.confidence
				? (options.confidence.split(',').map((c: string) => c.trim()) as ConfidenceLevel[])
				: undefined

			const result = await listUseCase.execute({
				...(options.domain !== undefined && { domain: options.domain }),
				...(options.topic !== undefined && { topic: options.topic }),
				...(tags !== undefined && { tags }),
				...(confidence !== undefined && { confidence }),
				limit: Number.parseInt(options.limit, 10),
				offset: Number.parseInt(options.offset, 10),
			})

			spinner.stop(`Found ${result.total} item${result.total !== 1 ? 's' : ''}`)

			if (result.items.length === 0) {
				p.log.info('No memory items found.')
				if (result.domains.length > 0) {
					p.log.info(`Available domains: ${result.domains.join(', ')}`)
				}
				return
			}

			console.log()
			for (const item of result.items) {
				console.log(`  ${formatMemoryItemShort(item)}`)
			}
			console.log()

			if (result.total > result.items.length) {
				p.log.info(`Showing ${result.items.length} of ${result.total}. Use --offset to paginate.`)
			}
		} catch (err) {
			spinner.stop('Failed to list memory items')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to get a specific memory item.
 */
const getCommand = new Command('get')
	.description('Get a specific memory item')
	.argument('<id>', 'Memory item ID (e.g., patterns/error-handling/api-errors)')
	.action(async (id: string) => {
		// Require authentication
		await requireAuth()

		const spinner = p.spinner()
		spinner.start('Loading memory item...')

		try {
			const result = await getUseCase.execute({ id })

			spinner.stop('Found')

			console.log()
			console.log(formatMemoryItemDetail(result.item))
			console.log()
		} catch (err) {
			spinner.stop('Failed to get memory item')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to update a memory item.
 */
const updateCommand = new Command('update')
	.description('Update a memory item')
	.argument('<id>', 'Memory item ID')
	.option('-t, --title <title>', 'New title')
	.option('--content <content>', 'New content')
	.option('-c, --confidence <level>', 'New confidence level')
	.option('--add-tags <tags>', 'Tags to add (comma-separated)')
	.option('--remove-tags <tags>', 'Tags to remove (comma-separated)')
	.option('--add-relations <ids>', 'Relations to add (comma-separated)')
	.option('--remove-relations <ids>', 'Relations to remove (comma-separated)')
	.action(async (id: string, options) => {
		// Require authentication
		await requireAuth()

		const spinner = p.spinner()
		spinner.start('Updating memory item...')

		try {
			const addTags = options.addTags
				? options.addTags.split(',').map((t: string) => t.trim())
				: undefined
			const removeTags = options.removeTags
				? options.removeTags.split(',').map((t: string) => t.trim())
				: undefined
			const addRelations = options.addRelations
				? options.addRelations.split(',').map((r: string) => r.trim())
				: undefined
			const removeRelations = options.removeRelations
				? options.removeRelations.split(',').map((r: string) => r.trim())
				: undefined

			const result = await updateUseCase.execute({
				id,
				...(options.title !== undefined && { title: options.title }),
				...(options.content !== undefined && { content: options.content }),
				...(options.confidence !== undefined && {
					confidence: options.confidence as ConfidenceLevel,
				}),
				...(addTags !== undefined && { addTags }),
				...(removeTags !== undefined && { removeTags }),
				...(addRelations !== undefined && { addRelations }),
				...(removeRelations !== undefined && { removeRelations }),
			})

			spinner.stop('Updated')

			if (result.changes.length > 0) {
				p.note(
					`${pc.bold('Changes')}:\n${result.changes.map((c) => `  • ${c}`).join('\n')}`,
					result.message,
				)
			} else {
				p.log.info('No changes made.')
			}
		} catch (err) {
			spinner.stop('Failed to update memory item')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to delete a memory item.
 */
const deleteCommand = new Command('delete')
	.description('Delete a memory item')
	.argument('<id>', 'Memory item ID')
	.option('-f, --force', 'Force delete even if referenced by other items')
	.action(async (id: string, options) => {
		// Require authentication
		await requireAuth()

		// Confirm deletion
		if (!options.force) {
			const confirm = await p.confirm({
				message: `Are you sure you want to delete ${id}?`,
			})

			if (p.isCancel(confirm) || !confirm) {
				p.log.info('Deletion cancelled.')
				return
			}
		}

		const spinner = p.spinner()
		spinner.start('Deleting memory item...')

		try {
			const result = await deleteUseCase.execute({
				id,
				force: options.force ?? false,
			})

			spinner.stop(result.deleted ? 'Deleted' : 'Not deleted')

			if (!result.deleted) {
				p.log.warn(result.message)
				if (result.referencedBy.length > 0) {
					p.log.info(`Referenced by: ${result.referencedBy.join(', ')}`)
				}
			} else {
				p.log.success(result.message)
			}
		} catch (err) {
			spinner.stop('Failed to delete memory item')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to show memory stats.
 */
const statsCommand = new Command('stats').description('Show memory statistics').action(async () => {
	const spinner = p.spinner()
	spinner.start('Loading statistics...')

	try {
		const result = await listUseCase.execute({})

		spinner.stop('Statistics loaded')

		// Calculate stats
		const byDomain: Record<string, number> = {}
		const byConfidence: Record<string, number> = {}
		const bySource: Record<string, number> = {}

		for (const item of result.items) {
			byDomain[item.domain] = (byDomain[item.domain] ?? 0) + 1
			byConfidence[item.confidence.level] = (byConfidence[item.confidence.level] ?? 0) + 1
			bySource[item.source.type] = (bySource[item.source.type] ?? 0) + 1
		}

		const domainStats = Object.entries(byDomain)
			.sort(([, a], [, b]) => b - a)
			.map(([domain, count]) => `  ${pc.bold(domain)}: ${count}`)
			.join('\n')

		const confidenceStats = Object.entries(byConfidence)
			.map(([level, count]) => `  ${formatConfidence(level as ConfidenceLevel)}: ${count}`)
			.join('\n')

		const sourceStats = Object.entries(bySource)
			.map(([source, count]) => `  ${formatSource(source as MemorySourceType)}: ${count}`)
			.join('\n')

		p.note(
			`${pc.bold('Total Items')}: ${result.total}
${pc.bold('Unique Domains')}: ${result.domains.length}
${pc.bold('Unique Tags')}: ${result.tags.length}

${pc.bold('By Domain')}:
${domainStats || '  (none)'}

${pc.bold('By Confidence')}:
${confidenceStats || '  (none)'}

${pc.bold('By Source')}:
${sourceStats || '  (none)'}`,
			'Memory Statistics',
		)
	} catch (err) {
		spinner.stop('Failed to load statistics')
		p.log.error(`${err}`)
		process.exit(1)
	}
})

/**
 * Command to push local memory to team context.
 * Equivalent to ByteRover's /push command.
 */
const pushCommand = new Command('push')
	.description('Push local memory to team context (share with teammates)')
	.option('-f, --force', 'Force re-push all items')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		console.log(pc.cyan('Pushing context to team...'))
		console.log()

		try {
			const result = await pushUseCase.execute({ force: options.force ?? false }, (progress) => {
				if (progress.phase === 'pushing') {
					process.stdout.write(
						`\r${pc.dim('Uploading:')} ${progress.current}/${progress.total} items`,
					)
				}
			})

			// Clear the progress line
			process.stdout.write(`\r${' '.repeat(50)}\r`)

			// ByteRover-style output
			if (result.added > 0 || result.updated > 0 || result.deleted > 0) {
				console.log(pc.green('Context pushed successfully!'))
				console.log()
				console.log(`  ${pc.green('+')} ${result.added} new item(s)`)
				console.log(`  ${pc.yellow('~')} ${result.updated} updated`)
				console.log(`  ${pc.red('-')} ${result.deleted} removed`)
				if (result.unchanged > 0) {
					console.log(`  ${pc.dim('=')} ${result.unchanged} unchanged`)
				}
			} else {
				console.log(pc.dim('Context is up to date. Nothing to push.'))
			}

			if (result.errors.length > 0) {
				console.log()
				console.log(pc.yellow(`${result.errors.length} warning(s):`))
				for (const err of result.errors.slice(0, 3)) {
					console.log(`  ${pc.dim('•')} ${err}`)
				}
			}

			console.log()
			console.log(pc.dim('Your team can now access this context with: vanguard memory pull'))
		} catch (err) {
			console.log(pc.red(`Push failed: ${err}`))
			process.exit(1)
		}
	})

/**
 * Command to pull team context to local memory.
 * Equivalent to ByteRover's /pull command.
 */
const pullCommand = new Command('pull')
	.description('Pull team context to local memory (sync from teammates)')
	.option('-f, --force', 'Force overwrite local changes')
	.option('--since <date>', 'Only pull items updated since this date (ISO 8601)')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		console.log(pc.cyan('Pulling context from team...'))
		console.log()

		try {
			const result = await pullUseCase.execute(
				{
					force: options.force ?? false,
					...(options.since !== undefined && { since: options.since }),
				},
				(progress) => {
					if (progress.phase === 'merging') {
						process.stdout.write(
							`\r${pc.dim('Processing:')} ${progress.current}/${progress.total} items`,
						)
					}
				},
			)

			// Clear the progress line
			process.stdout.write(`\r${' '.repeat(50)}\r`)

			// ByteRover-style output
			if (result.added > 0 || result.updated > 0) {
				console.log(pc.green('Context pulled successfully!'))
				console.log()
				console.log(`  ${pc.green('+')} ${result.added} new item(s)`)
				console.log(`  ${pc.yellow('~')} ${result.updated} updated`)
				if (result.unchanged > 0) {
					console.log(`  ${pc.dim('=')} ${result.unchanged} unchanged`)
				}
				if (result.conflicts > 0) {
					console.log(`  ${pc.magenta('!')} ${result.conflicts} conflict(s) (local newer, kept)`)
				}
			} else if (result.unchanged > 0) {
				console.log(pc.dim('Context is up to date. Nothing new to pull.'))
			} else {
				console.log(pc.dim('No team context available.'))
			}

			if (result.errors.length > 0) {
				console.log()
				console.log(pc.yellow(`${result.errors.length} warning(s):`))
				for (const err of result.errors.slice(0, 3)) {
					console.log(`  ${pc.dim('•')} ${err}`)
				}
			}

			console.log()
			console.log(
				pc.dim("Team context is now available locally. Use 'vanguard memory list' to see items."),
			)
		} catch (err) {
			console.log(pc.red(`Pull failed: ${err}`))
			process.exit(1)
		}
	})

/**
 * Format a search result for display.
 */
function formatSearchResult(result: MemorySearchResult, index: number): string {
	const similarity = Math.round(result.similarity * 100)
	const similarityColor = similarity >= 80 ? pc.green : similarity >= 60 ? pc.yellow : pc.red
	// Type assertion needed since we receive API data
	const item = result.item as unknown as {
		id: string
		title: string
		domain: string
		confidence: string
	}
	return `${pc.dim(`${index + 1}.`)} ${pc.bold(item.title)} ${pc.dim(`(${item.domain})`)} ${similarityColor(`${similarity}%`)}`
}

/**
 * Command to search memory items semantically.
 */
const searchCommand = new Command('search')
	.description('Search memory items using semantic search')
	.argument('<query>', 'Search query')
	.option('-d, --domains <domains>', 'Filter by domains (comma-separated)')
	.option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
	.option('-c, --confidence <levels>', 'Filter by confidence (comma-separated)')
	.option('-l, --limit <limit>', 'Maximum number of results', '5')
	.option('--threshold <threshold>', 'Similarity threshold (0-1)', '0.6')
	.option('--no-relations', 'Exclude related items')
	.action(async (query: string, options) => {
		// Require authentication
		await requireAuth()

		const spinner = p.spinner()
		spinner.start('Searching...')

		try {
			const domains = options.domains
				? options.domains.split(',').map((d: string) => d.trim())
				: undefined
			const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined
			const confidence = options.confidence
				? (options.confidence.split(',').map((c: string) => c.trim()) as ConfidenceLevel[])
				: undefined

			const result = await searchUseCase.execute({
				query,
				...(domains !== undefined && { domains }),
				...(tags !== undefined && { tags }),
				...(confidence !== undefined && { confidence }),
				limit: Number.parseInt(options.limit, 10),
				threshold: Number.parseFloat(options.threshold),
				includeRelations: options.relations !== false,
			})

			spinner.stop(`Found ${result.totalMatches} result(s) in ${result.searchTimeMs}ms`)

			if (result.results.length === 0) {
				p.log.info('No matching memory items found.')
				p.log.info(pc.dim('Try a different query or lower the similarity threshold.'))
				return
			}

			console.log()
			console.log(pc.bold('Results:'))
			for (let i = 0; i < result.results.length; i++) {
				const searchResult = result.results[i]
				if (searchResult) {
					console.log(`  ${formatSearchResult(searchResult, i)}`)
				}
			}

			if (result.relatedItems.length > 0) {
				console.log()
				console.log(pc.bold('Related items:'))
				for (let i = 0; i < result.relatedItems.length; i++) {
					const relatedItem = result.relatedItems[i]
					if (relatedItem) {
						console.log(`  ${formatSearchResult(relatedItem, i)}`)
					}
				}
			}

			console.log()
			p.log.info(pc.dim(`Use "vanguard memory get <id>" to view full details.`))
		} catch (err) {
			spinner.stop('Search failed')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to generate a context file from memory.
 */
const contextCommand = new Command('context')
	.description('Generate a context file from memory items')
	.option('-o, --output <file>', 'Output file path', 'MEMORY_CONTEXT.md')
	.option('-d, --domains <domains>', 'Include only these domains (comma-separated)')
	.option('-c, --min-confidence <level>', 'Minimum confidence level (low, medium, high)')
	.option('-m, --max-items <count>', 'Maximum number of items')
	.option('--metadata', 'Include metadata (confidence, tags)')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		const spinner = p.spinner()
		spinner.start('Generating context...')

		try {
			const domains = options.domains
				? options.domains.split(',').map((d: string) => d.trim())
				: undefined
			const maxItems = options.maxItems ? Number.parseInt(options.maxItems, 10) : undefined

			const result = await contextGenerator.generate({
				...(domains !== undefined && { domains }),
				...(options.minConfidence !== undefined && {
					minConfidence: options.minConfidence as ConfidenceLevel,
				}),
				...(maxItems !== undefined && { maxItems }),
				includeMetadata: options.metadata ?? false,
			})

			spinner.stop('Context generated')

			// Write to file
			const { writeFileSync } = await import('node:fs')
			writeFileSync(options.output, result.content, 'utf-8')

			p.note(
				`${pc.bold('File')}: ${options.output}
${pc.bold('Items')}: ${result.itemCount}
${pc.bold('Domains')}: ${result.domains.join(', ') || '(none)'}`,
				'Context file created',
			)

			p.outro(pc.green(`Context written to ${options.output}`))
		} catch (err) {
			spinner.stop('Failed to generate context')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to capture knowledge from session output.
 * Interactive review and approval of extracted candidates.
 */
const captureCommand = new Command('capture')
	.description('Extract and capture knowledge from a coding session')
	.option('-f, --file <file>', 'Input file with session output')
	.option('--auto', 'Auto-approve all candidates (no prompts)')
	.option('-d, --dry-run', 'Preview candidates without saving')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		p.intro(pc.cyan('Vanguard Memory Capture'))

		// Read session output
		let sessionOutput = ''

		if (options.file) {
			const { readFileSync, existsSync } = await import('node:fs')
			if (!existsSync(options.file)) {
				p.log.error(`File not found: ${options.file}`)
				process.exit(1)
			}
			sessionOutput = readFileSync(options.file, 'utf-8')
		} else {
			// Try reading from stdin
			const { readFileSync } = await import('node:fs')
			try {
				sessionOutput = readFileSync(0, 'utf-8')
			} catch {
				p.log.error('No input provided. Use --file or pipe session output to stdin.')
				process.exit(1)
			}
		}

		if (!sessionOutput.trim()) {
			p.log.error('Input is empty.')
			process.exit(1)
		}

		const spinner = p.spinner()
		spinner.start('Analyzing session output...')

		try {
			const result = await postTaskHook.execute({
				sessionOutput,
				prompt: '',
			})

			spinner.stop('Analysis complete')

			if (result.candidates.length === 0) {
				p.log.info('No knowledge candidates found in the session output.')
				p.outro(
					pc.dim('Tip: Knowledge is extracted from patterns, decisions, fixes, and conventions.'),
				)
				return
			}

			p.log.info(`Found ${pc.bold(String(result.candidates.length))} knowledge candidate(s)`)
			if (result.skippedDuplicates > 0) {
				p.log.info(pc.dim(`Skipped ${result.skippedDuplicates} duplicate(s)`))
			}
			p.log.message('')

			// Process each candidate
			let savedCount = 0
			let skippedCount = 0

			for (let i = 0; i < result.candidates.length; i++) {
				const candidate = result.candidates[i]
				if (!candidate) continue

				p.log.message(pc.bold(`\nCandidate ${i + 1}/${result.candidates.length}`))
				p.note(
					`${pc.bold('Title')}: ${candidate.title}
${pc.bold('Domain')}: ${candidate.domain}
${pc.bold('Type')}: ${candidate.extractionType}
${pc.bold('Confidence')}: ${Math.round(candidate.confidence * 100)}%

${pc.dim('Content preview:')}
${candidate.content.slice(0, 200)}${candidate.content.length > 200 ? '...' : ''}`,
					'',
				)

				if (options.dryRun) {
					continue
				}

				let shouldSave = options.auto

				if (!shouldSave) {
					const action = await p.select({
						message: 'What would you like to do?',
						options: [
							{ value: 'save', label: 'Save - Add to memory' },
							{ value: 'edit', label: 'Edit - Modify before saving' },
							{ value: 'skip', label: 'Skip - Ignore this candidate' },
							{ value: 'stop', label: 'Stop - Exit capture' },
						],
					})

					if (p.isCancel(action)) canceled()

					if (action === 'stop') {
						p.log.info('Stopping capture...')
						break
					}

					if (action === 'skip') {
						skippedCount++
						continue
					}

					if (action === 'edit') {
						// Allow editing title, domain, and content
						const editedTitle = await p.text({
							message: 'Title:',
							defaultValue: candidate.title,
						})
						if (p.isCancel(editedTitle)) canceled()

						const editedDomain = await p.text({
							message: 'Domain:',
							defaultValue: candidate.domain,
						})
						if (p.isCancel(editedDomain)) canceled()

						// Map confidence percentage to level
						const confidenceLevel: ConfidenceLevel =
							candidate.confidence >= 0.7 ? 'high' : candidate.confidence >= 0.5 ? 'medium' : 'low'

						try {
							await addUseCase.execute({
								title: editedTitle,
								content: candidate.content,
								domain: editedDomain,
								confidence: confidenceLevel,
								source: 'auto-captured',
								tags: [candidate.extractionType],
							})
							savedCount++
							p.log.success(`Saved: ${editedTitle}`)
						} catch (err) {
							p.log.error(`Failed to save: ${err}`)
						}
						continue
					}

					shouldSave = action === 'save'
				}

				if (shouldSave) {
					// Map confidence percentage to level
					const confidenceLevel: ConfidenceLevel =
						candidate.confidence >= 0.7 ? 'high' : candidate.confidence >= 0.5 ? 'medium' : 'low'

					try {
						await addUseCase.execute({
							title: candidate.title,
							content: candidate.content,
							domain: candidate.domain,
							confidence: confidenceLevel,
							source: 'auto-captured',
							tags: [candidate.extractionType],
						})
						savedCount++
						if (!options.auto) {
							p.log.success(`Saved: ${candidate.title}`)
						}
					} catch (err) {
						p.log.error(`Failed to save: ${err}`)
					}
				}
			}

			// Summary
			if (options.dryRun) {
				p.outro(pc.yellow(`Dry run: ${result.candidates.length} candidates found (none saved)`))
			} else {
				p.note(
					`${pc.bold('Saved')}: ${savedCount}
${pc.bold('Skipped')}: ${skippedCount}
${pc.bold('Duplicates filtered')}: ${result.skippedDuplicates}`,
					'Capture Summary',
				)
				p.outro(pc.green(`Captured ${savedCount} knowledge item(s)`))
			}
		} catch (err) {
			spinner.stop('Failed to analyze session')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to import knowledge from external sources.
 */
const importCommand = new Command('import')
	.description('Import knowledge from external sources (ADRs, CLAUDE.md, markdown files)')
	.argument('<file>', 'File to import')
	.option('-t, --type <type>', 'Source type (adr, claude-md, markdown)', 'markdown')
	.option('--skip-duplicates', 'Skip duplicate items instead of failing')
	.action(async (file: string, options) => {
		// Require authentication
		await requireAuth()

		p.intro(pc.cyan('Vanguard Memory Import'))

		const spinner = p.spinner()
		spinner.start(`Importing from ${file}...`)

		try {
			// Validate type
			const validTypes = ['adr', 'claude-md', 'markdown']
			if (!validTypes.includes(options.type)) {
				spinner.stop('Invalid type')
				p.log.error(`Invalid type: ${options.type}. Valid types: ${validTypes.join(', ')}`)
				process.exit(1)
			}

			const result = await importUseCase.execute({
				source: options.type as 'adr' | 'claude-md' | 'markdown',
				filePath: file,
				skipDuplicates: options.skipDuplicates ?? false,
			})

			spinner.stop('Import complete')

			if (result.imported > 0) {
				p.log.success(`Imported ${result.imported} item(s)`)
				for (const item of result.items) {
					p.log.info(`  ${pc.cyan(item.title)} ${pc.dim(`[${item.domain}]`)}`)
				}
			}

			if (result.skipped > 0) {
				p.log.warn(`Skipped ${result.skipped} duplicate(s)`)
			}

			if (result.errors.length > 0) {
				p.log.warn('Errors:')
				for (const error of result.errors) {
					p.log.error(`  ${error}`)
				}
			}

			p.outro(
				result.imported > 0
					? pc.green(`Successfully imported ${result.imported} knowledge item(s)`)
					: pc.yellow('No items imported'),
			)
		} catch (err) {
			spinner.stop('Import failed')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to run the pre-task hook (for Claude Code integration).
 */
const hookPreTaskCommand = new Command('pre-task')
	.description('Run pre-task hook to get relevant context (for Claude Code)')
	.argument('<prompt>', 'The user prompt to find context for')
	.option('-p, --phase <phase>', 'Vanguard workflow phase (discover, specify, implement, etc.)')
	.option('-m, --max-items <count>', 'Maximum number of items', '5')
	.option('-s, --session-id <id>', 'Session ID for telemetry tracking')
	.option('--persona <id>', 'Persona ID (e.g., developer, architect)')
	.option('--project <name>', 'Project name')
	.option('--json', 'Output as JSON')
	.action(async (prompt: string, options) => {
		// Require authentication
		await requireAuth()

		try {
			// Generate session ID if not provided (for telemetry)
			const sessionId =
				options.sessionId ?? `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

			const result = await preTaskHook.execute({
				prompt,
				...(options.phase !== undefined && { phase: options.phase }),
				sessionId,
				...(options.persona !== undefined && { personaId: options.persona }),
				...(options.project !== undefined && { projectName: options.project }),
				maxItems: Number.parseInt(options.maxItems, 10),
			})

			if (options.json) {
				console.log(JSON.stringify({ ...result, sessionId }, null, 2))
			} else if (result.context) {
				// Output context directly for Claude Code to consume
				console.log(result.context)
			}
		} catch (err) {
			// Hooks should fail silently to not block Claude Code
			if (options.json) {
				console.log(JSON.stringify({ error: String(err), context: '', itemCount: 0 }))
			}
		}
	})

/**
 * Command to run the post-task hook (for Claude Code integration).
 */
const hookPostTaskCommand = new Command('post-task')
	.description('Run post-task hook to extract knowledge (for Claude Code)')
	.option('-p, --prompt <prompt>', 'The original user prompt')
	.option('--phase <phase>', 'Vanguard workflow phase')
	.option('--json', 'Output as JSON')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		// Read session output from stdin
		const { readFileSync } = await import('node:fs')
		let sessionOutput = ''

		try {
			// Try reading from stdin if available
			sessionOutput = readFileSync(0, 'utf-8')
		} catch {
			// No stdin available
		}

		if (!sessionOutput) {
			if (options.json) {
				console.log(JSON.stringify({ candidates: [], skippedDuplicates: 0 }))
			}
			return
		}

		try {
			const result = await postTaskHook.execute({
				sessionOutput,
				prompt: options.prompt ?? '',
				...(options.phase !== undefined && { phase: options.phase }),
			})

			if (options.json) {
				console.log(JSON.stringify(result, null, 2))
			} else if (result.candidates.length > 0) {
				console.log(pc.bold(`Found ${result.candidates.length} knowledge candidate(s):`))
				console.log()
				for (const candidate of result.candidates) {
					console.log(`  ${pc.cyan(candidate.title)}`)
					console.log(
						`  ${pc.dim(`Domain: ${candidate.domain} | Confidence: ${Math.round(candidate.confidence * 100)}%`)}`,
					)
					console.log()
				}
				console.log(pc.dim('Use "vanguard memory add" to save these candidates.'))
			}
		} catch (err) {
			// Hooks should fail silently
			if (options.json) {
				console.log(JSON.stringify({ error: String(err), candidates: [], skippedDuplicates: 0 }))
			}
		}
	})

/**
 * Command to submit feedback for a memory item.
 */
const feedbackCommand = new Command('feedback')
	.description('Submit feedback for a memory item (helpful/not helpful)')
	.argument('<id>', 'Memory item ID')
	.option('--helpful', 'Mark as helpful (boosts effectiveness)')
	.option('--not-helpful', 'Mark as not helpful (reduces effectiveness)')
	.option('-s, --session-id <id>', 'Session ID for telemetry')
	.option('-t, --telemetry-id <id>', 'Telemetry ID from context injection')
	.option('-c, --comment <text>', 'Optional comment')
	.action(async (id: string, options) => {
		// Require authentication
		await requireAuth()

		// Determine helpful/not helpful
		if (!options.helpful && !options.notHelpful) {
			p.log.error('Must specify --helpful or --not-helpful')
			process.exit(1)
		}
		if (options.helpful && options.notHelpful) {
			p.log.error('Cannot specify both --helpful and --not-helpful')
			process.exit(1)
		}

		const wasHelpful = options.helpful === true

		const spinner = p.spinner()
		spinner.start(`Submitting feedback for ${id}...`)

		try {
			const result = await apiClient.submitFeedback({
				memoryId: id,
				wasHelpful,
				...(options.sessionId !== undefined && { sessionId: options.sessionId }),
				...(options.telemetryId !== undefined && { telemetryId: options.telemetryId }),
				...(options.comment !== undefined && { comment: options.comment }),
			})

			spinner.stop('Feedback submitted')

			const scoreChange = result.newEffectivenessScore - result.previousScore
			const scoreChangeStr =
				scoreChange >= 0
					? pc.green(`+${(scoreChange * 100).toFixed(1)}%`)
					: pc.red(`${(scoreChange * 100).toFixed(1)}%`)

			p.note(
				`${pc.bold('Memory')}: ${result.memoryId}
${pc.bold('Feedback')}: ${wasHelpful ? pc.green('Helpful') : pc.red('Not helpful')}
${pc.bold('Effectiveness')}: ${(result.previousScore * 100).toFixed(1)}% → ${(result.newEffectivenessScore * 100).toFixed(1)}% (${scoreChangeStr})`,
				'Feedback recorded',
			)
		} catch (err) {
			spinner.stop('Failed to submit feedback')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to set priority (stars) for a memory item.
 */
const priorityCommand = new Command('priority')
	.description('Set priority (0-5 stars) for a memory item')
	.argument('<id>', 'Memory item ID')
	.argument('<stars>', 'Priority level (0-5)')
	.action(async (id: string, stars: string) => {
		// Require authentication
		await requireAuth()

		const priority = Number.parseInt(stars, 10)
		if (Number.isNaN(priority) || priority < 0 || priority > 5) {
			p.log.error('Priority must be a number between 0 and 5')
			process.exit(1)
		}

		const spinner = p.spinner()
		spinner.start(`Setting priority for ${id}...`)

		try {
			const result = await apiClient.setPriority({
				memoryId: id,
				priority,
			})

			spinner.stop('Priority updated')

			const starsDisplay = '★'.repeat(result.priority) + '☆'.repeat(5 - result.priority)
			p.note(
				`${pc.bold('Memory')}: ${result.memoryId}
${pc.bold('Priority')}: ${pc.yellow(starsDisplay)} (${result.priority}/5)`,
				'Priority set',
			)
		} catch (err) {
			spinner.stop('Failed to set priority')
			p.log.error(`${err}`)
			process.exit(1)
		}
	})

/**
 * Command to run the session-start hook (for Claude Code integration).
 *
 * Fetches a compact project context summary from the knowledge graph.
 * Designed to be wired into Claude Code's SessionStart hook (including
 * the "compact" matcher for re-injection after auto-compaction).
 */
const hookSessionStartCommand = new Command('session-start')
	.description('Run session-start hook to get project context summary (for Claude Code)')
	.option('--project <name>', 'Project name')
	.option('--persona <id>', 'Persona ID (e.g., developer, architect)')
	.option('--token-budget <count>', 'Maximum token budget for context', '1500')
	.option('--json', 'Output as JSON')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		try {
			const result = await sessionStartHook.execute({
				...(options.project !== undefined && { projectName: options.project }),
				...(options.persona !== undefined && { persona: options.persona }),
				tokenBudget: Number.parseInt(options.tokenBudget, 10),
			})

			if (options.json) {
				console.log(JSON.stringify(result, null, 2))
			} else if (result.context) {
				// Output context directly for Claude Code to consume
				console.log(result.context)
			}
		} catch {
			// Hooks should fail silently to not block Claude Code
			if (options.json) {
				console.log(JSON.stringify({ context: '', tokenEstimate: 0, searchTimeMs: 0 }))
			}
		}
	})

/**
 * Hook command group.
 */
const hookCommand = new Command('hook')
	.description('Claude Code hook commands')
	.addCommand(hookSessionStartCommand)
	.addCommand(hookPreTaskCommand)
	.addCommand(hookPostTaskCommand)

/**
 * Main memory command group.
 */
export const memoryCommand = new Command('memory')
	.description('Manage project memory - persistent knowledge for AI agents')
	.addCommand(initCommand)
	.addCommand(addCommand)
	.addCommand(listCommand)
	.addCommand(getCommand)
	.addCommand(updateCommand)
	.addCommand(deleteCommand)
	.addCommand(statsCommand)
	.addCommand(pushCommand)
	.addCommand(pullCommand)
	.addCommand(searchCommand)
	.addCommand(contextCommand)
	.addCommand(captureCommand)
	.addCommand(importCommand)
	.addCommand(feedbackCommand)
	.addCommand(priorityCommand)
	.addCommand(hookCommand)

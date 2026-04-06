import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { parse, stringify } from 'yaml'

interface MemoryFrontmatter {
	title: string
	domain: string
	topic?: string
	confidence: 'low' | 'medium' | 'high'
	source: 'manual' | 'auto-captured'
	tags: string[]
	created: string
	updated: string
}

interface MemoryFile {
	path: string
	frontmatter: MemoryFrontmatter
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

function getMemoryDir(): string {
	const memoryDir = path.join(getVanguardDir(), 'memory', 'items')
	fs.mkdirSync(memoryDir, { recursive: true })
	return memoryDir
}

function loadAllMemory(memoryDir: string): MemoryFile[] {
	const items: MemoryFile[] = []

	function scanDir(dir: string): void {
		if (!fs.existsSync(dir)) return
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				scanDir(fullPath)
			} else if (entry.name.endsWith('.md')) {
				const content = fs.readFileSync(fullPath, 'utf-8')
				const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
				if (match?.[1]) {
					try {
						const frontmatter = parse(match[1]) as MemoryFrontmatter
						items.push({ path: fullPath, frontmatter, body: match[2] ?? '' })
					} catch {
						// skip invalid
					}
				}
			}
		}
	}

	scanDir(memoryDir)
	return items
}

export const memoryCommand = new Command('memory')
	.description('Manage project knowledge and memory')

// vanguard memory add
memoryCommand
	.command('add')
	.description('Add a knowledge item')
	.option('-t, --title <title>', 'Item title')
	.option('-d, --domain <domain>', 'Domain (patterns, decisions, architecture, conventions)')
	.action(async (options) => {
		const memoryDir = getMemoryDir()

		p.intro(pc.bgCyan(pc.black(' vanguard memory add ')))

		const title = options.title ?? await p.text({
			message: 'Title?',
			placeholder: 'e.g., Use Supabase RLS for row-level security',
			validate: (v) => {
				if (!v.trim()) return 'Title is required'
				return undefined
			},
		})
		if (p.isCancel(title)) { p.cancel('Cancelled.'); return }

		const domain = options.domain ?? await p.select({
			message: 'Domain?',
			options: [
				{ value: 'patterns', label: 'Patterns', hint: 'Reusable code/architecture patterns' },
				{ value: 'decisions', label: 'Decisions', hint: 'Architecture decision records' },
				{ value: 'architecture', label: 'Architecture', hint: 'Architecture-specific knowledge' },
				{ value: 'conventions', label: 'Conventions', hint: 'Coding conventions & standards' },
				{ value: 'solutions', label: 'Solutions', hint: 'Error solutions & fixes' },
				{ value: 'context', label: 'Context', hint: 'Project context & background' },
			],
		})
		if (p.isCancel(domain)) { p.cancel('Cancelled.'); return }

		const topic = await p.text({
			message: 'Topic? (optional, press Enter to skip)',
			placeholder: 'e.g., error-handling, auth, database',
			initialValue: '',
		})
		if (p.isCancel(topic)) { p.cancel('Cancelled.'); return }

		const content = await p.text({
			message: 'Content? (describe the knowledge)',
			validate: (v) => {
				if (!v.trim()) return 'Content is required'
				return undefined
			},
		})
		if (p.isCancel(content)) { p.cancel('Cancelled.'); return }

		const confidence = await p.select({
			message: 'Confidence level?',
			initialValue: 'medium',
			options: [
				{ value: 'low', label: 'Low', hint: 'Experimental, needs validation' },
				{ value: 'medium', label: 'Medium', hint: 'Proven in this project' },
				{ value: 'high', label: 'High', hint: 'Team-wide standard' },
			],
		})
		if (p.isCancel(confidence)) { p.cancel('Cancelled.'); return }

		const tagsInput = await p.text({
			message: 'Tags? (comma-separated, optional)',
			placeholder: 'e.g., security, performance, nextjs',
			initialValue: '',
		})
		if (p.isCancel(tagsInput)) { p.cancel('Cancelled.'); return }

		const tags = String(tagsInput).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)

		// Generate slug
		const slug = String(title)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 64)

		// Create directory
		const domainStr = String(domain)
		const topicStr = String(topic).trim()
		let itemDir = path.join(memoryDir, domainStr)
		if (topicStr) {
			const topicSlug = topicStr.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
			itemDir = path.join(memoryDir, domainStr, topicSlug)
		}
		fs.mkdirSync(itemDir, { recursive: true })

		const today = new Date().toISOString().split('T')[0]

		const frontmatter: MemoryFrontmatter = {
			title: title as string,
			domain: domainStr,
			...(topicStr ? { topic: topicStr } : {}),
			confidence: confidence as MemoryFrontmatter['confidence'],
			source: 'manual',
			tags,
			created: today as string,
			updated: today as string,
		}

		const fileContent = `---
${stringify(frontmatter)}---

# ${title}

${content}
`

		const filePath = path.join(itemDir, `${slug}.md`)
		fs.writeFileSync(filePath, fileContent, 'utf-8')

		p.log.success(`Added: ${pc.cyan(path.relative(process.cwd(), filePath))}`)
		p.outro(pc.dim(`Domain: ${domain} | Confidence: ${confidence}`))
	})

// vanguard memory list
memoryCommand
	.command('list')
	.description('List all memory items')
	.option('-d, --domain <domain>', 'Filter by domain')
	.option('-c, --confidence <level>', 'Filter by confidence (low, medium, high)')
	.action((options) => {
		const memoryDir = getMemoryDir()
		let items = loadAllMemory(memoryDir)

		if (options.domain) {
			items = items.filter((i) => i.frontmatter.domain === options.domain)
		}
		if (options.confidence) {
			items = items.filter((i) => i.frontmatter.confidence === options.confidence)
		}

		if (items.length === 0) {
			console.log(pc.dim('\n  No memory items found. Run `vanguard memory add` to add knowledge.\n'))
			return
		}

		console.log('')
		console.log(pc.bold(`  Memory (${items.length} items)`))
		console.log(pc.dim('  ─────────────────────────────────────'))

		// Group by domain
		const grouped = new Map<string, MemoryFile[]>()
		for (const item of items) {
			const domain = item.frontmatter.domain
			if (!grouped.has(domain)) grouped.set(domain, [])
			grouped.get(domain)?.push(item)
		}

		for (const [domain, domainItems] of grouped) {
			console.log('')
			console.log(pc.bold(`  ${domain}/`) + pc.dim(` (${domainItems.length})`))

			for (const item of domainItems) {
				const fm = item.frontmatter
				const confIcon = fm.confidence === 'high' ? pc.green('●') :
					fm.confidence === 'medium' ? pc.yellow('●') : pc.dim('●')
				const topicStr = fm.topic ? pc.dim(`/${fm.topic}`) : ''

				console.log(`    ${confIcon} ${fm.title}${topicStr}`)
				if (fm.tags.length > 0) {
					console.log(pc.dim(`      tags: ${fm.tags.join(', ')}`))
				}
			}
		}

		console.log('')
	})

// vanguard memory search
memoryCommand
	.command('search <query>')
	.description('Search memory items')
	.action((query: string) => {
		const memoryDir = getMemoryDir()
		const items = loadAllMemory(memoryDir)
		const queryLower = query.toLowerCase()

		const results = items.filter((item) => {
			const fm = item.frontmatter
			return (
				fm.title.toLowerCase().includes(queryLower) ||
				fm.domain.toLowerCase().includes(queryLower) ||
				(fm.topic?.toLowerCase().includes(queryLower) ?? false) ||
				fm.tags.some((t) => t.includes(queryLower)) ||
				item.body.toLowerCase().includes(queryLower)
			)
		})

		if (results.length === 0) {
			console.log(pc.dim(`\n  No results for "${query}".\n`))
			return
		}

		console.log('')
		console.log(pc.bold(`  Search: "${query}" (${results.length} results)`))
		console.log(pc.dim('  ─────────────────────────────────────'))

		for (const item of results) {
			const fm = item.frontmatter
			const confIcon = fm.confidence === 'high' ? pc.green('●') :
				fm.confidence === 'medium' ? pc.yellow('●') : pc.dim('●')

			console.log(`  ${confIcon} ${pc.bold(fm.title)}`)
			console.log(pc.dim(`    ${fm.domain}${fm.topic ? `/${fm.topic}` : ''} | ${fm.confidence} | ${fm.created}`))

			// Show snippet of body
			const snippet = item.body.trim().split('\n').find((line) => {
				const l = line.replace(/^#+\s*/, '').trim()
				return l.length > 0 && l.toLowerCase().includes(queryLower)
			})
			if (snippet) {
				const highlighted = snippet.replace(
					new RegExp(`(${query})`, 'gi'),
					pc.bgYellow(pc.black('$1')),
				)
				console.log(`    ${highlighted.trim().slice(0, 100)}`)
			}
			console.log('')
		}
	})

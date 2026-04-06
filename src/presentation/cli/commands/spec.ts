import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { parse, stringify } from 'yaml'

function getVanguardDir(): string {
	const rootPath = process.cwd()
	const vanguardDir = path.join(rootPath, '.vanguard')
	if (!fs.existsSync(vanguardDir)) {
		console.log(pc.red('Not a Vanguard project. Run `vanguard init` first.'))
		process.exit(1)
	}
	return vanguardDir
}

function updateManifest(type: 'specs' | 'plans', slug: string, title: string, filePath: string): void {
	const manifestPath = path.join(process.cwd(), 'vanguard.manifest.yaml')
	if (!fs.existsSync(manifestPath)) return

	try {
		const manifest = parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
		const docs = (manifest['documents'] ?? {}) as Record<string, Record<string, unknown>>
		if (!docs[type]) docs[type] = {}
		docs[type][slug] = {
			path: path.relative(process.cwd(), filePath),
			summary: title,
			status: 'draft',
			createdAt: new Date().toISOString().split('T')[0],
		}
		manifest['documents'] = docs
		fs.writeFileSync(manifestPath, stringify(manifest), 'utf-8')
	} catch {
		// Non-critical
	}
}

export const specCommand = new Command('spec')
	.description('Manage feature specifications')

// vanguard spec create
specCommand
	.command('create')
	.description('Create a new specification')
	.option('-t, --title <title>', 'Spec title')
	.action(async (options) => {
		const vanguardDir = getVanguardDir()
		const specsDir = path.join(vanguardDir, 'specs')
		fs.mkdirSync(specsDir, { recursive: true })

		p.intro(pc.bgCyan(pc.black(' vanguard spec create ')))

		const title = options.title ?? await p.text({
			message: 'Specification title?',
			placeholder: 'e.g., User Authentication System',
			validate: (v) => {
				if (!v.trim()) return 'Title is required'
				return undefined
			},
		})
		if (p.isCancel(title)) { p.cancel('Cancelled.'); return }

		const overview = await p.text({
			message: 'Brief overview?',
			placeholder: 'What does this feature do?',
			validate: (v) => {
				if (!v.trim()) return 'Overview is required'
				return undefined
			},
		})
		if (p.isCancel(overview)) { p.cancel('Cancelled.'); return }

		const userStories = await p.text({
			message: 'Primary user story? (As a ___, I want ___, so that ___)',
			placeholder: 'As a user, I want to log in, so that I can access my dashboard',
		})
		if (p.isCancel(userStories)) { p.cancel('Cancelled.'); return }

		const priority = await p.select({
			message: 'Priority?',
			initialValue: 'medium',
			options: [
				{ value: 'critical', label: 'Critical', hint: 'Blocks everything' },
				{ value: 'high', label: 'High', hint: 'Must have for release' },
				{ value: 'medium', label: 'Medium', hint: 'Should have' },
				{ value: 'low', label: 'Low', hint: 'Nice to have' },
			],
		})
		if (p.isCancel(priority)) { p.cancel('Cancelled.'); return }

		const today = new Date().toISOString().split('T')[0]
		const slug = String(title)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50)

		const content = `---
title: "${title}"
status: draft
priority: ${priority}
created: ${today}
author: ""
---

# Specification: ${title}

## Overview
${overview}

## User Stories
- ${userStories}
- As a [user type], I want [goal], so that [benefit]

## Requirements

### Functional
1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

### Non-Functional
- **Performance**: [Response time targets, throughput]
- **Security**: [Authentication, authorization, data protection]
- **Scalability**: [Expected load, growth considerations]

## Acceptance Criteria
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- [ ] [Testable criterion 3]

## Edge Cases
1. [What happens when...]
2. [What if...]

## Error Scenarios
| Scenario | Expected Behavior |
|----------|------------------|
| [Error case] | [How the system should respond] |

## Dependencies
- [External service / API / library]

## Out of Scope
- [What this spec does NOT cover]
- [Features deferred to future iterations]

## Open Questions
- [ ] [Question that needs answering before implementation]

## Design Mockups
[Link to designs or describe UI expectations]

---
*Created: ${today} | Status: Draft | Priority: ${priority}*
`

		const filePath = path.join(specsDir, `${slug}.md`)
		fs.writeFileSync(filePath, content, 'utf-8')
		updateManifest('specs', slug, title as string, filePath)

		p.log.success(`Created: ${pc.cyan(`.vanguard/specs/${slug}.md`)}`)
		p.log.info('')
		p.log.info(pc.bold('Next steps:'))
		p.log.info(`  ${pc.yellow('1.')} Fill in the requirements and acceptance criteria`)
		p.log.info(`  ${pc.yellow('2.')} Get review/approval`)
		p.log.info(`  ${pc.yellow('3.')} Create plan: ${pc.dim(`vanguard plan create --spec ${slug}`)}`)
		p.log.info('')
		p.outro(pc.dim(`Spec: ${title}`))
	})

// vanguard spec list
specCommand
	.command('list')
	.description('List all specifications')
	.action(() => {
		const specsDir = path.join(getVanguardDir(), 'specs')
		if (!fs.existsSync(specsDir)) {
			console.log(pc.dim('\n  No specs yet. Run `vanguard spec create`.\n'))
			return
		}

		const files = fs.readdirSync(specsDir).filter((f) => f.endsWith('.md'))
		if (files.length === 0) {
			console.log(pc.dim('\n  No specs yet. Run `vanguard spec create`.\n'))
			return
		}

		console.log('')
		console.log(pc.bold(`  Specifications (${files.length})`))
		console.log(pc.dim('  ─────────────────────────────────────'))

		for (const file of files) {
			const content = fs.readFileSync(path.join(specsDir, file), 'utf-8')
			const match = content.match(/^---\n([\s\S]*?)\n---/)
			if (match?.[1]) {
				try {
					const fm = parse(match[1]) as { title: string; status: string; priority: string }
					const statusIcon = fm.status === 'approved' ? pc.green('●') :
						fm.status === 'in-review' ? pc.blue('◐') : pc.yellow('○')
					const priorityIcon = fm.priority === 'critical' ? pc.red('!!') :
						fm.priority === 'high' ? pc.yellow('!') : ''
					console.log(`  ${statusIcon} ${fm.title}${priorityIcon} ${pc.dim(`[${fm.status}]`)}`)
				} catch {
					console.log(`  ${pc.dim('○')} ${file}`)
				}
			}
		}
		console.log('')
	})

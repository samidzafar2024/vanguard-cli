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

function updateManifest(slug: string, title: string, filePath: string): void {
	const manifestPath = path.join(process.cwd(), 'vanguard.manifest.yaml')
	if (!fs.existsSync(manifestPath)) return

	try {
		const manifest = parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
		const docs = (manifest['documents'] ?? {}) as Record<string, Record<string, unknown>>
		if (!docs['plans']) docs['plans'] = {}
		docs['plans'][slug] = {
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

function getAvailableSpecs(): Array<{ value: string; label: string }> {
	const specsDir = path.join(getVanguardDir(), 'specs')
	if (!fs.existsSync(specsDir)) return []

	return fs.readdirSync(specsDir)
		.filter((f) => f.endsWith('.md'))
		.map((f) => {
			const content = fs.readFileSync(path.join(specsDir, f), 'utf-8')
			const match = content.match(/^---\n([\s\S]*?)\n---/)
			let title = f.replace('.md', '')
			if (match?.[1]) {
				try {
					const fm = parse(match[1]) as { title: string }
					title = fm.title ?? title
				} catch { /* skip */ }
			}
			return { value: f.replace('.md', ''), label: title }
		})
}

export const planCommand = new Command('plan')
	.description('Manage implementation plans')

// vanguard plan create
planCommand
	.command('create')
	.description('Create a new implementation plan')
	.option('-t, --title <title>', 'Plan title')
	.option('-s, --spec <spec>', 'Linked specification slug')
	.action(async (options) => {
		const vanguardDir = getVanguardDir()
		const plansDir = path.join(vanguardDir, 'plans')
		fs.mkdirSync(plansDir, { recursive: true })

		p.intro(pc.bgCyan(pc.black(' vanguard plan create ')))

		// Link to spec
		const specs = getAvailableSpecs()
		let linkedSpec = options.spec ?? ''

		if (!linkedSpec && specs.length > 0) {
			const specChoice = await p.select({
				message: 'Link to a specification?',
				options: [
					{ value: '__none__', label: 'No spec — standalone plan' },
					...specs,
				],
			})
			if (p.isCancel(specChoice)) { p.cancel('Cancelled.'); return }
			if (specChoice !== '__none__') linkedSpec = specChoice as string
		}

		const title = options.title ?? await p.text({
			message: 'Plan title?',
			placeholder: 'e.g., Authentication Implementation Plan',
			initialValue: linkedSpec ? specs.find((s) => s.value === linkedSpec)?.label ?? '' : '',
			validate: (v) => {
				if (!v.trim()) return 'Title is required'
				return undefined
			},
		})
		if (p.isCancel(title)) { p.cancel('Cancelled.'); return }

		const approach = await p.text({
			message: 'High-level approach?',
			placeholder: 'How will you implement this?',
			validate: (v) => {
				if (!v.trim()) return 'Approach is required'
				return undefined
			},
		})
		if (p.isCancel(approach)) { p.cancel('Cancelled.'); return }

		const phases = await p.text({
			message: 'How many phases? (number)',
			initialValue: '3',
			validate: (v) => {
				const n = Number(v)
				if (Number.isNaN(n) || n < 1 || n > 10) return 'Enter 1-10'
				return undefined
			},
		})
		if (p.isCancel(phases)) { p.cancel('Cancelled.'); return }

		const numPhases = Number(phases)
		const today = new Date().toISOString().split('T')[0]
		const slug = String(title)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50)

		const phaseLetters = 'ABCDEFGHIJ'
		let phasesContent = ''
		for (let i = 0; i < numPhases; i++) {
			phasesContent += `
### Phase ${phaseLetters[i]}: [Phase Name]
**Goal**: [What this phase achieves]

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

**Deliverables**: [What's done when this phase completes]
`
		}

		const content = `---
title: "${title}"
spec: "${linkedSpec}"
status: draft
created: ${today}
phases: ${numPhases}
---

# Implementation Plan: ${title}

${linkedSpec ? `> Implements specification: \`.vanguard/specs/${linkedSpec}.md\`\n` : ''}
## Approach
${approach}

## Architecture Impact
- **New components**: [List new files/modules to create]
- **Modified components**: [List existing files to change]
- **Database changes**: [Migrations needed?]

## Phases
${phasesContent}

## Dependencies
- [External dependency 1]
- [Prerequisite that must be done first]

## Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| [Risk 1] | High/Med/Low | High/Med/Low | [How to mitigate] |

## Testing Strategy
- **Unit tests**: [What domain logic to test]
- **Integration tests**: [What integrations to verify]
- **E2E tests**: [Critical user flows to test]

## Estimates
| Phase | Effort | Notes |
|-------|--------|-------|
${Array.from({ length: numPhases }, (_, i) => `| Phase ${phaseLetters[i]} | [X days] | |`).join('\n')}
| **Total** | **[X days]** | |

## Rollback Plan
[How to safely revert if something goes wrong]

---
*Created: ${today} | Status: Draft | Phases: ${numPhases}*
`

		const filePath = path.join(plansDir, `${slug}.md`)
		fs.writeFileSync(filePath, content, 'utf-8')
		updateManifest(slug, title as string, filePath)

		p.log.success(`Created: ${pc.cyan(`.vanguard/plans/${slug}.md`)}`)
		p.log.info('')
		p.log.info(pc.bold('Next steps:'))
		p.log.info(`  ${pc.yellow('1.')} Fill in phases, steps, and estimates`)
		p.log.info(`  ${pc.yellow('2.')} Review with team/client`)
		p.log.info(`  ${pc.yellow('3.')} Break into tasks: ${pc.dim('vanguard task create --plan ' + slug)}`)
		p.log.info('')
		p.outro(pc.dim(`Plan: ${title} (${numPhases} phases)`))
	})

// vanguard plan list
planCommand
	.command('list')
	.description('List all plans')
	.action(() => {
		const plansDir = path.join(getVanguardDir(), 'plans')
		if (!fs.existsSync(plansDir)) {
			console.log(pc.dim('\n  No plans yet. Run `vanguard plan create`.\n'))
			return
		}

		const files = fs.readdirSync(plansDir).filter((f) => f.endsWith('.md'))
		if (files.length === 0) {
			console.log(pc.dim('\n  No plans yet. Run `vanguard plan create`.\n'))
			return
		}

		console.log('')
		console.log(pc.bold(`  Plans (${files.length})`))
		console.log(pc.dim('  ─────────────────────────────────────'))

		for (const file of files) {
			const content = fs.readFileSync(path.join(plansDir, file), 'utf-8')
			const match = content.match(/^---\n([\s\S]*?)\n---/)
			if (match?.[1]) {
				try {
					const fm = parse(match[1]) as { title: string; status: string; spec: string; phases: number }
					const statusIcon = fm.status === 'approved' ? pc.green('●') :
						fm.status === 'in-progress' ? pc.yellow('◐') : pc.dim('○')
					const specRef = fm.spec ? pc.dim(` → ${fm.spec}`) : ''
					console.log(`  ${statusIcon} ${fm.title} ${pc.dim(`(${fm.phases} phases)`)}${specRef} ${pc.dim(`[${fm.status}]`)}`)
				} catch {
					console.log(`  ${pc.dim('○')} ${file}`)
				}
			}
		}
		console.log('')
	})

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import gradient from 'gradient-string'
import pc from 'picocolors'
import {
	type ProjectSummary,
	VanguardGeneratorService,
} from '../../../application/services/vanguard-generator.service.js'
import { InitMemoryUseCase } from '../../../application/use-cases/memory/init-memory.use-case.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { ProjectDetector } from '../../../infrastructure/project-detector.js'
import { FileMemoryConfigRepository } from '../../../infrastructure/repositories/memory-config.repository.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path to the CLI's own bundled methodology files
const CLI_ROOT = path.join(__dirname, '..', '..', '..', '..')

/**
 * Sanitize a directory name into a valid project name.
 */
function sanitizeProjectName(dirName: string): string {
	let name = dirName
		.toLowerCase()
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')

	if (!/^[a-z0-9]/.test(name)) {
		name = `project-${name}`
	}

	return name || 'my-project'
}

/**
 * Check if a directory appears to be an existing project (brownfield).
 */
function detectProjectType(rootPath: string): 'greenfield' | 'brownfield' {
	const indicators = [
		'package.json',
		'requirements.txt',
		'pyproject.toml',
		'Cargo.toml',
		'go.mod',
		'pom.xml',
		'build.gradle',
		'.git',
		'src',
		'lib',
		'app',
	]

	for (const indicator of indicators) {
		if (fs.existsSync(path.join(rootPath, indicator))) {
			return 'brownfield'
		}
	}

	return 'greenfield'
}

// Custom Vanguard gradient (cyan to purple)
const vanguardGradient = gradient(['#00d4ff', '#7c3aed', '#c026d3'])

function getCliVersion(): string {
	const pkgPath = path.join(CLI_ROOT, 'package.json')
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
	return pkg.version ?? '0.0.0'
}

function showBanner(): void {
	const logo = `
██╗   ██╗ █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
██║   ██║██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
██║   ██║███████║██╔██╗ ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║
╚██╗ ██╔╝██╔══██║██║╚██╗██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
 ╚████╔╝ ██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝`

	console.log(vanguardGradient.multiline(logo))
	console.log(pc.dim(`    v${getCliVersion()}`))
	console.log(pc.dim('    Discover → Specify → Architect → Plan → Implement'))
	console.log('')
}

// ============================================================================
// Local Choices
// ============================================================================

const STACKS = [
	{ value: 'nextjs-app-router', label: 'Next.js (App Router)' },
	{ value: 'express-typescript', label: 'Express.js (TypeScript)' },
	{ value: 'fastapi', label: 'FastAPI (Python)' },
	{ value: 'django', label: 'Django (Python)' },
	{ value: 'nestjs', label: 'NestJS (TypeScript)' },
	{ value: 'aspnet-webapi', label: 'ASP.NET Web API (C#)' },
	{ value: 'react-vite', label: 'React + Vite' },
	{ value: 'plain-typescript', label: 'Plain TypeScript' },
	{ value: 'plain-python', label: 'Plain Python' },
	{ value: 'other', label: 'Other' },
]

const ARCHITECTURES = [
	{ value: 'mvc-interactors', label: 'MVC with Interactors' },
	{ value: 'clean-architecture', label: 'Clean Architecture (DDD)' },
	{ value: 'simple-layered', label: 'Simple Layered (Routes → Services → Data)' },
	{ value: 'hexagonal', label: 'Hexagonal / Ports & Adapters' },
	{ value: 'other', label: 'Other / None' },
]

const TRACKS = [
	{ value: 'solo', label: 'Solo — just me' },
	{ value: 'team', label: 'Team — small team' },
	{ value: 'enterprise', label: 'Enterprise — large org' },
]

// ============================================================================
// Copy Methodology Files from CLI Bundle
// ============================================================================

/**
 * Recursively copy a directory, returning count of files written.
 */
function copyDirRecursive(src: string, dest: string): number {
	if (!fs.existsSync(src)) return 0

	fs.mkdirSync(dest, { recursive: true })
	let count = 0

	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name)
		const destPath = path.join(dest, entry.name)

		if (entry.isDirectory()) {
			count += copyDirRecursive(srcPath, destPath)
		} else {
			fs.copyFileSync(srcPath, destPath)
			count++
		}
	}

	return count
}

/**
 * Copy bundled methodology files from CLI installation to target project.
 */
function copyMethodologyFiles(rootPath: string): number {
	let count = 0

	// Copy .claude/agents/
	count += copyDirRecursive(
		path.join(CLI_ROOT, '.claude', 'agents'),
		path.join(rootPath, '.claude', 'agents'),
	)

	// Copy .claude/skills/
	count += copyDirRecursive(
		path.join(CLI_ROOT, '.claude', 'skills'),
		path.join(rootPath, '.claude', 'skills'),
	)

	// Copy .claude/rules/
	count += copyDirRecursive(
		path.join(CLI_ROOT, '.claude', 'rules'),
		path.join(rootPath, '.claude', 'rules'),
	)

	// Copy .claude/hooks/
	count += copyDirRecursive(
		path.join(CLI_ROOT, '.claude', 'hooks'),
		path.join(rootPath, '.claude', 'hooks'),
	)

	// Copy .vanguard/templates/
	count += copyDirRecursive(
		path.join(CLI_ROOT, '.vanguard', 'templates'),
		path.join(rootPath, '.vanguard', 'templates'),
	)

	// Copy .vanguard/workflows/
	count += copyDirRecursive(
		path.join(CLI_ROOT, '.vanguard', 'workflows'),
		path.join(rootPath, '.vanguard', 'workflows'),
	)

	// Copy .vanguard/commands/
	count += copyDirRecursive(
		path.join(CLI_ROOT, '.vanguard', 'commands'),
		path.join(rootPath, '.vanguard', 'commands'),
	)

	// Copy .vanguard/constitution.md
	const constitutionSrc = path.join(CLI_ROOT, '.vanguard', 'constitution.md')
	if (fs.existsSync(constitutionSrc)) {
		fs.mkdirSync(path.join(rootPath, '.vanguard'), { recursive: true })
		fs.copyFileSync(constitutionSrc, path.join(rootPath, '.vanguard', 'constitution.md'))
		count++
	}

	return count
}

// ============================================================================
// Wire Hooks Locally
// ============================================================================

function wireHooksLocally(rootPath: string): void {
	const settingsPath = path.join(rootPath, '.claude', 'settings.json')
	const hooksTemplatePath = path.join(CLI_ROOT, 'templates', 'claude-hooks.json')

	if (!fs.existsSync(hooksTemplatePath)) return

	try {
		const hookTemplate = JSON.parse(fs.readFileSync(hooksTemplatePath, 'utf-8'))
		let existing: Record<string, unknown> = {}

		if (fs.existsSync(settingsPath)) {
			existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
		}

		// Merge hooks into settings
		existing.hooks = { ...(existing.hooks as Record<string, unknown> ?? {}), ...hookTemplate.hooks }

		fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
		fs.writeFileSync(settingsPath, JSON.stringify(existing, null, '\t'), 'utf-8')
	} catch {
		// Non-critical
	}
}

// ============================================================================
// Generate CLAUDE.md
// ============================================================================

function generateClaudeMd(rootPath: string, projectName: string, architecture: string): void {
	const archLabel = ARCHITECTURES.find((a) => a.value === architecture)?.label ?? architecture

	const content = `# ${projectName}

> This file provides context for Claude Code. It is auto-generated by Vanguard.

## Vanguard Structure

\`\`\`
.claude/
├── agents/       → Agent personas (analyst, architect, developer, etc.)
├── skills/       → Slash commands (/vanguard.discover, /vanguard.implement, etc.)
├── rules/        → Project principles
└── hooks/        → Memory hooks

.vanguard/
├── config.yaml   → Project configuration
├── constitution.md → Project principles
├── templates/    → Spec, plan, task templates
├── workflows/    → Phase workflows
├── commands/     → Command definitions
├── specs/        → Generated specifications
├── plans/        → Generated plans
└── tasks/        → Generated tasks
\`\`\`

## Architecture: ${archLabel}

## Available Commands

| Command | Description |
|---------|-------------|
| \`/vanguard.discover\` | Analyze codebase or explore problem space |
| \`/vanguard.brainstorm\` | Creative ideation session |
| \`/vanguard.specify\` | Create feature specification |
| \`/vanguard.clarify\` | Resolve spec ambiguities |
| \`/vanguard.architect\` | Design technical architecture |
| \`/vanguard.plan\` | Break into granular tasks |
| \`/vanguard.implement\` | Write code following patterns |
| \`/vanguard.review\` | QA review implementation |
| \`/vanguard.design\` | Create UX/UI design |
| \`/vanguard.constitute\` | Review project principles |
| \`/vanguard.extend\` | Add stacks or modules |

---
_Generated by Vanguard CLI v${getCliVersion()}_
`

	fs.writeFileSync(path.join(rootPath, 'CLAUDE.md'), content, 'utf-8')
}

// ============================================================================
// Command Definition
// ============================================================================

export const initCommand = new Command('init')
	.description('Initialize a new Vanguard project')
	.argument('[path]', 'Project path', '.')
	.option('-n, --name <name>', 'Project name')
	.option('-t, --type <type>', 'Project type (greenfield|brownfield)')
	.option('--track <track>', 'Project scale (solo|team|enterprise)')
	.option('-s, --stack <stack>', 'Tech stack ID')
	.option('-a, --architecture <arch>', 'Architecture pattern ID')
	.option('-y, --yes', 'Accept all defaults')
	.action(async (targetPath: string, options) => {
		const rootPath = path.resolve(targetPath === '.' ? process.cwd() : targetPath)

		showBanner()
		p.intro(pc.bgCyan(pc.black(' Initialize Project ')))

		const canceled = (): never => {
			p.cancel('Operation canceled.')
			process.exit(1)
		}

		// Detect existing project
		const detectedProjectType = detectProjectType(rootPath)
		let smartDefaults: Record<string, string> = {}

		if (detectedProjectType === 'brownfield') {
			const detector = new ProjectDetector()
			const detected = detector.detect(rootPath)

			if (detected.language || detected.framework) {
				const detectedItems: string[] = []
				if (detected.language) detectedItems.push(`Language: ${detected.language}`)
				if (detected.framework) detectedItems.push(`Framework: ${detected.framework}`)
				if (detected.orm) detectedItems.push(`ORM: ${detected.orm}`)
				if (detected.database) detectedItems.push(`Database: ${detected.database}`)
				if (detected.testFramework) detectedItems.push(`Testing: ${detected.testFramework}`)
				p.note(detectedItems.join('\n'), 'Detected from existing project')
			}

			if (detected.stackId) smartDefaults.stack = detected.stackId
		}

		// --- Prompts ---
		const dirName = rootPath.split('/').pop() ?? 'my-project'
		const defaultProjectName = sanitizeProjectName(dirName)

		const projectName = options.yes
			? ((options.name ?? defaultProjectName) as string)
			: await (async () => {
					const result = await p.text({
						message: 'Project name',
						defaultValue: (options.name ?? defaultProjectName) as string,
						placeholder: defaultProjectName,
						validate: (value) => {
							if (!value) return 'Name is required'
							if (!/^[a-z0-9-]+$/.test(value))
								return 'Name must be lowercase alphanumeric with hyphens'
							return undefined
						},
					})
					if (p.isCancel(result)) canceled()
					return result as string
				})()

		const track = options.yes
			? ((options.track ?? 'team') as string)
			: await (async () => {
					const result = await p.select({
						message: 'Project scale',
						options: TRACKS,
						initialValue: (options.track as string) ?? 'team',
					})
					if (p.isCancel(result)) canceled()
					return result as string
				})()

		const stack = options.yes
			? ((options.stack ?? smartDefaults.stack ?? 'plain-typescript') as string)
			: await (async () => {
					const result = await p.select({
						message: 'Tech stack',
						options: STACKS,
						initialValue: (options.stack as string) ?? smartDefaults.stack,
					})
					if (p.isCancel(result)) canceled()
					return result as string
				})()

		const architecture = options.yes
			? ((options.architecture ?? 'mvc-interactors') as string)
			: await (async () => {
					const result = await p.select({
						message: 'Architecture pattern',
						options: ARCHITECTURES,
						initialValue: (options.architecture as string) ?? 'mvc-interactors',
					})
					if (p.isCancel(result)) canceled()
					return result as string
				})()

		// --- Confirm ---
		const stackLabel = STACKS.find((s) => s.value === stack)?.label ?? stack
		const archLabel = ARCHITECTURES.find((a) => a.value === architecture)?.label ?? architecture
		const trackLabel = TRACKS.find((t) => t.value === track)?.label ?? track

		p.note(
			[
				`${pc.bold('Project')}: ${projectName}`,
				`${pc.bold('Type')}: ${detectedProjectType}`,
				`${pc.bold('Scale')}: ${trackLabel}`,
				`${pc.bold('Stack')}: ${stackLabel}`,
				`${pc.bold('Architecture')}: ${archLabel}`,
			].join('\n'),
			'Configuration',
		)

		if (!options.yes) {
			const confirmed = await p.confirm({
				message: 'Create project with these settings?',
				initialValue: true,
			})
			if (p.isCancel(confirmed) || !confirmed) canceled()
		}

		// --- Generate ---
		const selections: Record<string, string> = {
			'project-type': detectedProjectType,
			track,
			stack,
			architecture,
		}

		// Generate local project ID
		const projectId = `local-${crypto.randomUUID()}`
		fs.mkdirSync(path.join(rootPath, '.vanguard'), { recursive: true })
		fs.writeFileSync(path.join(rootPath, '.vanguard', '.project-id'), projectId, 'utf-8')

		// Generate manifest + config
		const genSpinner = p.spinner()
		genSpinner.start('Generating Vanguard artifacts')

		const writer = new FsFileWriter()
		const generator = new VanguardGeneratorService()
		const summary: ProjectSummary = {
			name: projectName,
			type: detectedProjectType as ProjectSummary['type'],
			track: track as ProjectSummary['track'],
			rootPath,
			selections,
		}
		const localFiles = generator.generateLocalFilesFromSelections(summary)
		await writer.writeAll(localFiles)
		genSpinner.stop('Generated manifest and config')

		// Copy methodology files from CLI bundle
		const methodSpinner = p.spinner()
		methodSpinner.start('Installing methodology files')
		const methodCount = copyMethodologyFiles(rootPath)
		methodSpinner.stop(`Installed ${methodCount} methodology files`)

		// Generate CLAUDE.md
		generateClaudeMd(rootPath, projectName, architecture)
		p.log.success('Generated CLAUDE.md')

		// Wire hooks
		wireHooksLocally(rootPath)
		p.log.success('Configured hooks')

		// Init memory (non-critical)
		try {
			const memoryConfigRepo = new FileMemoryConfigRepository(rootPath)
			const initMemory = new InitMemoryUseCase(memoryConfigRepo)
			await initMemory.execute({ projectName })
		} catch {
			// Non-critical
		}

		// Create empty dirs for specs/plans/tasks
		for (const dir of ['specs', 'plans', 'tasks', 'reviews']) {
			const dirPath = path.join(rootPath, '.vanguard', dir)
			fs.mkdirSync(dirPath, { recursive: true })
			const gitkeep = path.join(dirPath, '.gitkeep')
			if (!fs.existsSync(gitkeep)) {
				fs.writeFileSync(gitkeep, '', 'utf-8')
			}
		}

		// --- Done ---
		p.note(
			`${pc.cyan('cd')} ${rootPath === process.cwd() ? '.' : rootPath}
${pc.cyan('cat')} CLAUDE.md                   ${pc.dim('# Claude Code context')}

${pc.bold('Available commands')}:
  /vanguard.discover   - Analyze codebase or problem space
  /vanguard.brainstorm - Creative ideation session
  /vanguard.specify    - Create feature specification
  /vanguard.clarify    - Resolve spec ambiguities
  /vanguard.architect  - Design technical architecture
  /vanguard.plan       - Break into granular tasks
  /vanguard.implement  - Write code following patterns
  /vanguard.review     - QA review implementation`,
			'Next steps',
		)

		p.outro(pc.green('Vanguard initialized successfully!'))
	})

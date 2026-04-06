import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { stringify } from 'yaml'

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
		'setup.py',
		'pyproject.toml',
		'Cargo.toml',
		'go.mod',
		'pom.xml',
		'build.gradle',
		'.csproj',
		'Gemfile',
	]

	for (const indicator of indicators) {
		if (fs.existsSync(path.join(rootPath, indicator))) {
			return 'brownfield'
		}
	}
	return 'greenfield'
}

/**
 * Auto-detect the tech stack from existing project files.
 */
function detectStack(rootPath: string): {
	language?: string
	stack?: string
	orm?: string
	database?: string
	testFramework?: string
} {
	const detected: {
		language?: string
		stack?: string
		orm?: string
		database?: string
		testFramework?: string
	} = {}

	const pkgPath = path.join(rootPath, 'package.json')
	if (fs.existsSync(pkgPath)) {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
		const deps = { ...pkg.dependencies, ...pkg.devDependencies }

		detected.language = 'typescript'

		if (deps['next']) detected.stack = 'nextjs-app-router'
		else if (deps['@nestjs/core']) detected.stack = 'nestjs'
		else if (deps['express']) detected.stack = 'express'
		else if (deps['react']) detected.stack = 'react'

		if (deps['prisma'] || deps['@prisma/client']) detected.orm = 'prisma'
		else if (deps['drizzle-orm']) detected.orm = 'drizzle'
		else if (deps['typeorm']) detected.orm = 'typeorm'
		else if (deps['mongoose']) detected.orm = 'mongoose'

		if (deps['vitest']) detected.testFramework = 'vitest'
		else if (deps['jest']) detected.testFramework = 'jest'
	}

	const requirementsTxt = path.join(rootPath, 'requirements.txt')
	const pyprojectToml = path.join(rootPath, 'pyproject.toml')
	if (fs.existsSync(requirementsTxt) || fs.existsSync(pyprojectToml)) {
		detected.language = 'python'

		if (fs.existsSync(requirementsTxt)) {
			const content = fs.readFileSync(requirementsTxt, 'utf-8')
			if (content.includes('fastapi')) detected.stack = 'fastapi'
			else if (content.includes('django')) detected.stack = 'django'
			else if (content.includes('flask')) detected.stack = 'flask'
		}
	}

	return detected
}

export const initCommand = new Command('init')
	.description('Initialize a new Vanguard project')
	.option('-n, --name <name>', 'Project name')
	.option('-s, --stack <stack>', 'Tech stack (e.g., nextjs-app-router, fastapi)')
	.option('-a, --architecture <arch>', 'Architecture pattern (e.g., clean-architecture, ddd, mvc)')
	.option('-t, --type <type>', 'Project type (greenfield or brownfield)')
	.option('--track <track>', 'Development track (solo, team, enterprise)')
	.action(async (options) => {
		const rootPath = process.cwd()

		p.intro(pc.bgCyan(pc.black(' vanguard init ')))

		// Check if already initialized
		if (fs.existsSync(path.join(rootPath, '.vanguard'))) {
			const shouldContinue = await p.confirm({
				message: 'This project already has a .vanguard directory. Reinitialize?',
			})
			if (p.isCancel(shouldContinue) || !shouldContinue) {
				p.cancel('Initialization cancelled.')
				return
			}
		}

		// Detect project type
		const detectedType = detectProjectType(rootPath)
		const detectedStack = detectedType === 'brownfield' ? detectStack(rootPath) : {}

		if (detectedType === 'brownfield') {
			p.log.info(pc.dim('Detected existing project:'))
			if (detectedStack.language) p.log.info(pc.dim(`  Language: ${detectedStack.language}`))
			if (detectedStack.stack) p.log.info(pc.dim(`  Stack: ${detectedStack.stack}`))
			if (detectedStack.orm) p.log.info(pc.dim(`  ORM: ${detectedStack.orm}`))
			if (detectedStack.testFramework) p.log.info(pc.dim(`  Tests: ${detectedStack.testFramework}`))
		}

		// Interactive prompts
		const projectName = options.name ?? await p.text({
			message: 'Project name?',
			initialValue: sanitizeProjectName(path.basename(rootPath)),
			validate: (v) => {
				if (!v.trim()) return 'Name is required'
				return undefined
			},
		})
		if (p.isCancel(projectName)) { p.cancel('Cancelled.'); return }

		const projectType = options.type ?? await p.select({
			message: 'Project type?',
			initialValue: detectedType,
			options: [
				{ value: 'greenfield', label: 'Greenfield', hint: 'New project from scratch' },
				{ value: 'brownfield', label: 'Brownfield', hint: 'Existing codebase' },
			],
		})
		if (p.isCancel(projectType)) { p.cancel('Cancelled.'); return }

		const track = options.track ?? await p.select({
			message: 'Development track?',
			initialValue: 'team',
			options: [
				{ value: 'solo', label: 'Solo', hint: '1 developer, quick iteration' },
				{ value: 'team', label: 'Team', hint: '2-8 devs, standard workflows' },
				{ value: 'enterprise', label: 'Enterprise', hint: 'Large org, full governance' },
			],
		})
		if (p.isCancel(track)) { p.cancel('Cancelled.'); return }

		const language = await p.select({
			message: 'Primary language?',
			initialValue: detectedStack.language ?? 'typescript',
			options: [
				{ value: 'typescript', label: 'TypeScript' },
				{ value: 'python', label: 'Python' },
				{ value: 'csharp', label: 'C#' },
				{ value: 'go', label: 'Go' },
				{ value: 'rust', label: 'Rust' },
				{ value: 'java', label: 'Java' },
			],
		})
		if (p.isCancel(language)) { p.cancel('Cancelled.'); return }

		const stackOptions: Record<string, Array<{ value: string; label: string; hint?: string }>> = {
			typescript: [
				{ value: 'nextjs-app-router', label: 'Next.js (App Router)', hint: 'React full-stack' },
				{ value: 'nextjs-pages', label: 'Next.js (Pages Router)' },
				{ value: 'nestjs', label: 'NestJS', hint: 'Node.js backend framework' },
				{ value: 'express', label: 'Express.js', hint: 'Minimal Node.js backend' },
				{ value: 'react-vite', label: 'React + Vite', hint: 'SPA frontend' },
			],
			python: [
				{ value: 'fastapi', label: 'FastAPI', hint: 'Modern async API' },
				{ value: 'django', label: 'Django', hint: 'Full-featured web framework' },
				{ value: 'flask', label: 'Flask', hint: 'Lightweight web framework' },
			],
			csharp: [
				{ value: 'aspnet-webapi', label: 'ASP.NET Web API' },
				{ value: 'aspnet-mvc', label: 'ASP.NET MVC' },
			],
			go: [
				{ value: 'go-chi', label: 'Chi', hint: 'Lightweight router' },
				{ value: 'go-gin', label: 'Gin', hint: 'HTTP web framework' },
			],
			rust: [
				{ value: 'actix-web', label: 'Actix Web' },
				{ value: 'axum', label: 'Axum' },
			],
			java: [
				{ value: 'spring-boot', label: 'Spring Boot' },
			],
		}

		const stack = options.stack ?? await p.select({
			message: 'Tech stack?',
			initialValue: detectedStack.stack,
			options: stackOptions[language as string] ?? [{ value: 'custom', label: 'Custom' }],
		})
		if (p.isCancel(stack)) { p.cancel('Cancelled.'); return }

		const architecture = options.architecture ?? await p.select({
			message: 'Architecture pattern?',
			initialValue: 'clean-architecture',
			options: [
				{ value: 'clean-architecture', label: 'Clean Architecture', hint: 'Ports & Adapters, use cases' },
				{ value: 'ddd', label: 'Domain-Driven Design', hint: 'Aggregates, bounded contexts' },
				{ value: 'mvc', label: 'MVC', hint: 'Model-View-Controller' },
				{ value: 'layered', label: 'Layered', hint: 'Traditional N-tier' },
				{ value: 'simple', label: 'Simple', hint: 'Flat structure, minimal patterns' },
			],
		})
		if (p.isCancel(architecture)) { p.cancel('Cancelled.'); return }

		const database = await p.select({
			message: 'Database?',
			initialValue: detectedStack.database ?? 'postgresql',
			options: [
				{ value: 'postgresql', label: 'PostgreSQL' },
				{ value: 'mysql', label: 'MySQL' },
				{ value: 'sqlite', label: 'SQLite' },
				{ value: 'mongodb', label: 'MongoDB' },
				{ value: 'none', label: 'None' },
			],
		})
		if (p.isCancel(database)) { p.cancel('Cancelled.'); return }

		const orm = database !== 'none' ? await p.select({
			message: 'ORM?',
			initialValue: detectedStack.orm ?? 'prisma',
			options: [
				{ value: 'prisma', label: 'Prisma' },
				{ value: 'drizzle', label: 'Drizzle' },
				{ value: 'typeorm', label: 'TypeORM' },
				{ value: 'mongoose', label: 'Mongoose', hint: 'MongoDB only' },
				{ value: 'none', label: 'None (raw queries)' },
			],
		}) : 'none'
		if (p.isCancel(orm)) { p.cancel('Cancelled.'); return }

		const testFramework = await p.select({
			message: 'Test framework?',
			initialValue: detectedStack.testFramework ?? 'vitest',
			options: [
				{ value: 'vitest', label: 'Vitest' },
				{ value: 'jest', label: 'Jest' },
				{ value: 'pytest', label: 'Pytest', hint: 'Python' },
				{ value: 'none', label: 'None' },
			],
		})
		if (p.isCancel(testFramework)) { p.cancel('Cancelled.'); return }

		// Generate project files
		const s = p.spinner()
		s.start('Creating Vanguard project structure...')

		const vanguardDir = path.join(rootPath, '.vanguard')

		// Create directory structure
		const dirs = [
			'.vanguard',
			'.vanguard/specs',
			'.vanguard/plans',
			'.vanguard/tasks',
			'.vanguard/docs',
			'.vanguard/templates',
			'.vanguard/workflows',
			'.vanguard/memory',
			'.vanguard/memory/items',
			'.vanguard/memory/items/patterns',
			'.vanguard/memory/items/decisions',
			'.vanguard/integrations',
			'.vanguard/reviews',
		]

		for (const dir of dirs) {
			fs.mkdirSync(path.join(rootPath, dir), { recursive: true })
		}

		// Generate config.yaml
		const config = {
			project: {
				name: projectName,
				type: projectType,
				track,
			},
			stack: {
				id: stack,
				language,
			},
			database: {
				type: database,
				orm: orm !== 'none' ? orm : undefined,
			},
			architecture: {
				primary: architecture,
			},
			testing: {
				unit: testFramework !== 'none' ? testFramework : undefined,
			},
		}

		fs.writeFileSync(
			path.join(vanguardDir, 'config.yaml'),
			stringify(config),
			'utf-8',
		)

		// Generate constitution.md
		const constitution = `# Project Constitution: ${projectName}

## Project Overview
- **Name**: ${projectName}
- **Type**: ${projectType}
- **Track**: ${track}
- **Stack**: ${stack} (${language})
- **Architecture**: ${architecture}

## Architecture Principles

### ${architecture}
- Follow the dependency rule: inner layers must not depend on outer layers
- Business logic belongs in the domain layer only
- External systems are accessed through port interfaces
- Infrastructure implements domain contracts

## Code Conventions
- Use consistent naming conventions
- Write self-documenting code
- Keep functions small and focused (SRP)
- Prefer composition over inheritance

## Testing Requirements
- Unit tests for all domain logic
- Integration tests for infrastructure adapters
- Test coverage target: 80%+

## Security Principles
1. No secrets in code — use environment variables
2. Validate all external inputs at system boundaries
3. Use parameterized queries — no string concatenation in SQL
4. Follow principle of least privilege
5. Log security-relevant events

## Anti-Patterns to Avoid
- God classes / God functions
- Anemic domain models
- Business logic in controllers
- Direct database access from presentation layer
- Catching and swallowing exceptions silently

## Governance
- All specs must be reviewed before implementation
- Architecture decisions documented as ADRs
- Breaking changes require team discussion
- Code review required for all PRs
`

		fs.writeFileSync(
			path.join(vanguardDir, 'constitution.md'),
			constitution,
			'utf-8',
		)

		// Generate manifest
		const manifest = {
			vanguard: { version: '1.0' },
			project: {
				name: projectName,
				type: projectType,
				track,
			},
			documents: {
				specs: {},
				plans: {},
				tasks: {},
			},
		}

		fs.writeFileSync(
			path.join(rootPath, 'vanguard.manifest.yaml'),
			stringify(manifest),
			'utf-8',
		)

		// Generate templates
		const specTemplate = `---
title: "[Spec Title]"
status: draft
created: ${new Date().toISOString().split('T')[0]}
author: ""
---

# Specification: [Title]

## Overview
[Brief description of the feature/change]

## User Stories
- As a [user], I want [goal] so that [benefit]

## Requirements
### Functional
1. [Requirement 1]

### Non-Functional
- Performance: [target]
- Security: [considerations]

## Acceptance Criteria
- [ ] [Criteria 1]

## Out of Scope
- [What this spec does NOT cover]
`

		const planTemplate = `---
title: "[Plan Title]"
spec: "[linked spec]"
status: draft
created: ${new Date().toISOString().split('T')[0]}
---

# Implementation Plan: [Title]

## Approach
[High-level implementation strategy]

## Phases
### Phase A: [Name]
- [ ] Step 1
- [ ] Step 2

## Dependencies
- [External dependency 1]

## Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| [Risk] | [Impact] | [Mitigation] |

## Estimates
- Total: [X days/weeks]
`

		const taskTemplate = `---
title: "[Task Title]"
plan: "[linked plan]"
status: todo
sequence: 1
created: ${new Date().toISOString().split('T')[0]}
---

# Task: [Title]

## Objective
[What this task accomplishes]

## Steps
1. [ ] [Step 1]
2. [ ] [Step 2]

## Acceptance Criteria
- [ ] [Criteria]

## Files to Create/Modify
- \`path/to/file.ts\` — [what to do]

## Testing
- [ ] Unit tests added
- [ ] All tests pass
`

		fs.writeFileSync(path.join(vanguardDir, 'templates', 'spec.md'), specTemplate, 'utf-8')
		fs.writeFileSync(path.join(vanguardDir, 'templates', 'plan.md'), planTemplate, 'utf-8')
		fs.writeFileSync(path.join(vanguardDir, 'templates', 'task.md'), taskTemplate, 'utf-8')

		// Generate memory config
		const memoryConfig = {
			project: projectName,
			initialized: true,
			autoCapture: {
				enabled: true,
				domains: ['patterns', 'decisions', 'architecture'],
				confidenceThreshold: 'medium',
			},
		}

		fs.writeFileSync(
			path.join(vanguardDir, 'memory', 'config.yaml'),
			stringify(memoryConfig),
			'utf-8',
		)

		s.stop('Project structure created!')

		// Summary
		p.log.success(pc.green('Vanguard project initialized!'))
		p.log.info('')
		p.log.info(pc.bold('Created:'))
		p.log.info(`  ${pc.cyan('.vanguard/config.yaml')}       — Project configuration`)
		p.log.info(`  ${pc.cyan('.vanguard/constitution.md')}   — Project principles`)
		p.log.info(`  ${pc.cyan('.vanguard/templates/')}        — Spec, plan, task templates`)
		p.log.info(`  ${pc.cyan('.vanguard/memory/')}           — Knowledge management`)
		p.log.info(`  ${pc.cyan('vanguard.manifest.yaml')}      — Project manifest`)
		p.log.info('')
		p.log.info(pc.bold('Next steps:'))
		p.log.info(`  ${pc.yellow('1.')} Write your first spec:  ${pc.dim('vanguard spec create')}`)
		p.log.info(`  ${pc.yellow('2.')} Plan implementation:    ${pc.dim('vanguard plan create')}`)
		p.log.info(`  ${pc.yellow('3.')} Break into tasks:       ${pc.dim('vanguard task create')}`)
		p.log.info(`  ${pc.yellow('4.')} Connect PM tool:        ${pc.dim('vanguard integrations add')}`)
		p.log.info('')

		p.outro(pc.bgGreen(pc.black(' Ready to build! ')))
	})

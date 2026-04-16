import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { parse } from 'yaml'

interface VanguardConfig {
	project: { name: string; type: string; track: string }
	stack: { id: string; language: string }
	architecture: { primary: string }
	database: { type: string; orm?: string }
	testing: { unit?: string }
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

function getPackageRoot(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
}

function copyDirRecursive(src: string, dest: string, force: boolean): number {
	if (!fs.existsSync(src)) return 0
	let count = 0
	const entries = fs.readdirSync(src, { withFileTypes: true })
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name)
		const destPath = path.join(dest, entry.name)
		if (entry.isDirectory()) {
			fs.mkdirSync(destPath, { recursive: true })
			count += copyDirRecursive(srcPath, destPath, force)
		} else {
			if (!force && fs.existsSync(destPath)) continue
			fs.copyFileSync(srcPath, destPath)
			count++
		}
	}
	return count
}

function loadConfig(): VanguardConfig {
	const configPath = path.join(getVanguardDir(), 'config.yaml')
	return parse(fs.readFileSync(configPath, 'utf-8')) as VanguardConfig
}

function generateAgentMarkdown(
	_role: string,
	name: string,
	description: string,
	principles: string[],
	responsibilities: string[],
	config: VanguardConfig,
): string {
	const constitutionRef = fs.existsSync(path.join(getVanguardDir(), 'constitution.md'))
		? '\n> Always follow the project constitution at `.vanguard/constitution.md`\n'
		: ''

	return `# ${name}

${description}

## Role
You are the **${name}** for the ${config.project.name} project.
${constitutionRef}
## Project Context
- **Stack**: ${config.stack.id} (${config.stack.language})
- **Architecture**: ${config.architecture.primary}
- **Database**: ${config.database.type}${config.database.orm ? ` (${config.database.orm})` : ''}
${config.testing.unit ? `- **Testing**: ${config.testing.unit}` : ''}

## Principles
${principles.map((p) => `- ${p}`).join('\n')}

## Responsibilities
${responsibilities.map((r) => `- ${r}`).join('\n')}

## Communication Style
- Be direct and actionable
- Reference specific files and line numbers
- Follow the project's architecture patterns
- Cite the constitution when making decisions
- Use ${config.stack.language} code examples
`
}

function generateAgents(config: VanguardConfig): Record<string, string> {
	const agents: Record<string, string> = {}

	agents['analyst'] = generateAgentMarkdown(
		'analyst',
		'Analyst',
		'Explores and understands existing codebases. Identifies patterns, risks, and opportunities.',
		[
			'Understand before suggesting changes',
			'Map dependencies and data flow',
			'Identify technical debt and risks',
			'Document assumptions explicitly',
		],
		[
			'Analyze codebase structure and patterns',
			'Identify anti-patterns and technical debt',
			'Map component dependencies',
			'Assess test coverage gaps',
			'Document findings in .vanguard/docs/',
		],
		config,
	)

	agents['product-manager'] = generateAgentMarkdown(
		'product-manager',
		'Product Manager',
		'Creates detailed specifications from requirements. Focuses on user value and acceptance criteria.',
		[
			'User value comes first',
			'Acceptance criteria must be testable',
			'Scope creep is the enemy — define what is OUT of scope',
			'Specs are living documents — update as you learn',
		],
		[
			'Write feature specifications in .vanguard/specs/',
			'Define user stories with clear acceptance criteria',
			'Identify edge cases and error scenarios',
			'Prioritize requirements (must-have vs nice-to-have)',
			'Keep specs linked to tasks via frontmatter',
		],
		config,
	)

	agents['architect'] = generateAgentMarkdown(
		'architect',
		'Architect',
		'Designs technical solutions following project architecture patterns. Makes structural decisions.',
		[
			`Follow ${config.architecture.primary} architecture strictly`,
			'Dependency rule: inner layers must not depend on outer layers',
			'Prefer composition over inheritance',
			'Document decisions as ADRs in .vanguard/docs/',
			'Design for testability',
		],
		[
			'Design system architecture and component structure',
			'Write implementation plans in .vanguard/plans/',
			'Make technology decisions with ADR documentation',
			'Review code for architectural violations',
			'Define domain boundaries and interfaces',
			`Enforce ${config.architecture.primary} layer separation`,
		],
		config,
	)

	agents['scrum-master'] = generateAgentMarkdown(
		'scrum-master',
		'Scrum Master',
		'Breaks work into actionable, well-defined tasks. Manages workflow and removes blockers.',
		[
			'Tasks should be small enough to complete in 1-4 hours',
			'Each task must have clear acceptance criteria',
			'Dependencies between tasks must be explicit',
			'Sequence tasks in dependency order',
		],
		[
			'Break specs/plans into granular tasks in .vanguard/tasks/',
			'Estimate effort and sequence tasks',
			'Identify dependencies and blockers',
			'Track progress and update task status',
			'Sync tasks with PM tools (Jira/ClickUp)',
		],
		config,
	)

	agents['developer'] = generateAgentMarkdown(
		'developer',
		'Developer',
		'Implements code following project patterns and architecture. Writes tests alongside code.',
		[
			`Follow ${config.architecture.primary} architecture`,
			'Write tests before or alongside implementation',
			'Keep functions small and focused (SRP)',
			'No business logic in controllers/routes',
			'Handle errors at system boundaries',
			`Use ${config.stack.language} best practices`,
		],
		[
			'Implement tasks following the plan',
			'Write unit tests for all business logic',
			'Follow code conventions from constitution',
			'Create clean, readable commits',
			'Update task status as you work',
			'Store learnings in memory: `vanguard memory add`',
		],
		config,
	)

	agents['qa-reviewer'] = generateAgentMarkdown(
		'qa-reviewer',
		'QA Reviewer',
		'Validates implementations against specs and architecture. Ensures quality standards.',
		[
			'Review against spec acceptance criteria',
			'Check for architectural violations',
			'Verify error handling at boundaries',
			'Ensure test coverage for new code',
			'Security review for external inputs',
		],
		[
			'Review code against specification requirements',
			'Check architectural compliance',
			'Verify test coverage and quality',
			'Identify security vulnerabilities',
			'Write review notes in .vanguard/reviews/',
			'Approve or request changes with clear feedback',
		],
		config,
	)

	return agents
}

function generateCommands(config: VanguardConfig): Record<string, string> {
	const commands: Record<string, string> = {}

	commands['discover'] = `# /vanguard.discover

Activate **Analyst** mode. Explore and understand the codebase.

## Instructions
1. Read the project constitution at \`.vanguard/constitution.md\`
2. Analyze the current codebase structure
3. Map key components and their dependencies
4. Identify patterns, anti-patterns, and tech debt
5. Document findings in \`.vanguard/docs/\`

## Project
- Stack: ${config.stack.id} (${config.stack.language})
- Architecture: ${config.architecture.primary}

## Output
Create a discovery document in \`.vanguard/docs/discovery-<topic>.md\` with:
- Component map
- Dependency graph
- Identified risks
- Recommended improvements
`

	commands['specify'] = `# /vanguard.specify

Activate **Product Manager** mode. Write a feature specification.

## Instructions
1. Read the project constitution at \`.vanguard/constitution.md\`
2. Understand the feature requirements from the user
3. Write a detailed spec using the template at \`.vanguard/templates/spec.md\`
4. Include user stories, acceptance criteria, edge cases
5. Save to \`.vanguard/specs/<feature-name>.md\`

## Output
A complete specification with:
- User stories
- Functional & non-functional requirements
- Acceptance criteria (testable!)
- Out of scope
- Dependencies
`

	commands['architect'] = `# /vanguard.architect

Activate **Architect** mode. Design the technical solution.

## Instructions
1. Read the project constitution at \`.vanguard/constitution.md\`
2. Read the relevant spec from \`.vanguard/specs/\`
3. Design the technical approach following ${config.architecture.primary} architecture
4. Write implementation plan using template at \`.vanguard/templates/plan.md\`
5. Save to \`.vanguard/plans/<feature-name>.md\`

## Architecture: ${config.architecture.primary}
- Follow the dependency rule strictly
- Domain layer has no external dependencies
- Infrastructure implements domain interfaces
- Keep business logic out of controllers

## Output
An implementation plan with:
- Technical approach
- Phase breakdown
- Component design
- Database changes (if any)
- Risk assessment
`

	commands['plan'] = `# /vanguard.plan

Activate **Scrum Master** mode. Break the plan into tasks.

## Instructions
1. Read the plan from \`.vanguard/plans/\`
2. Break into granular tasks (1-4 hours each)
3. Use the task template at \`.vanguard/templates/task.md\`
4. Save tasks to \`.vanguard/tasks/<plan-name>/\`
5. Number sequentially: task-001-<slug>.md, task-002-<slug>.md, etc.

## Output
A set of task files, each with:
- Clear objective
- Step-by-step checklist
- Acceptance criteria
- Files to create/modify
- Testing requirements
- Proper sequence and dependencies
`

	commands['implement'] = `# /vanguard.implement

Activate **Developer** mode. Implement the current task.

## Instructions
1. Read the project constitution at \`.vanguard/constitution.md\`
2. Check current task: look in \`.vanguard/tasks/\` for in-progress tasks
3. Follow the task's step-by-step checklist
4. Write tests alongside implementation
5. Follow ${config.architecture.primary} architecture patterns
6. Mark checklist items as you complete them

## Stack: ${config.stack.id} (${config.stack.language})
## Architecture: ${config.architecture.primary}

## Rules
- No business logic in presentation layer
- Validate inputs at system boundaries
- Write unit tests for domain logic
- Keep functions focused (SRP)
- Use meaningful names
`

	commands['review'] = `# /vanguard.review

Activate **QA Reviewer** mode. Review the implementation.

## Instructions
1. Read the project constitution at \`.vanguard/constitution.md\`
2. Read the relevant spec from \`.vanguard/specs/\`
3. Review the implementation against acceptance criteria
4. Check for:
   - Architectural violations
   - Missing error handling
   - Security issues
   - Test coverage gaps
   - Code quality issues
5. Write review in \`.vanguard/reviews/\`

## Output
A review document with:
- Pass/Fail for each acceptance criterion
- Issues found (with severity)
- Suggestions for improvement
- Approval or request for changes
`

	return commands
}

export const agentsCommand = new Command('agents')
	.description('Generate Claude Code agents and commands')

// vanguard agents generate
agentsCommand
	.command('generate')
	.description('Generate .claude/ agents, commands, and rules')
	.option('--force', 'Overwrite existing files')
	.action((options) => {
		const config = loadConfig()
		const rootPath = process.cwd()

		const s = p.spinner()
		s.start('Generating Claude Code integration...')

		// Create directories
		const claudeDir = path.join(rootPath, '.claude')
		const agentsDir = path.join(claudeDir, 'agents')
		const commandsDir = path.join(claudeDir, 'commands')
		const rulesDir = path.join(claudeDir, 'rules')

		fs.mkdirSync(agentsDir, { recursive: true })
		fs.mkdirSync(commandsDir, { recursive: true })
		fs.mkdirSync(rulesDir, { recursive: true })

		// Generate agents
		const agents = generateAgents(config)
		let agentCount = 0
		for (const [name, content] of Object.entries(agents)) {
			const filePath = path.join(agentsDir, `${name}.md`)
			if (!options.force && fs.existsSync(filePath)) continue
			fs.writeFileSync(filePath, content, 'utf-8')
			agentCount++
		}

		// Generate commands (slash commands)
		const commands = generateCommands(config)
		let cmdCount = 0
		for (const [name, content] of Object.entries(commands)) {
			const dirPath = path.join(commandsDir, `vanguard.${name}`)
			fs.mkdirSync(dirPath, { recursive: true })
			const filePath = path.join(dirPath, 'COMMAND.md')
			if (!options.force && fs.existsSync(filePath)) continue
			fs.writeFileSync(filePath, content, 'utf-8')
			cmdCount++
		}

		// Copy bundled skills from templates
		const skillsDir = path.join(claudeDir, 'skills')
		fs.mkdirSync(skillsDir, { recursive: true })
		const pkgRoot = getPackageRoot()
		const bundledSkillsDir = path.join(pkgRoot, 'templates', 'skills')
		const skillCount = copyDirRecursive(bundledSkillsDir, skillsDir, options.force ?? false)

		// Copy bundled agents from templates (overrides generated ones with richer versions)
		const bundledAgentsDir = path.join(pkgRoot, 'templates', 'agents')
		const bundledAgentCount = copyDirRecursive(bundledAgentsDir, agentsDir, options.force ?? false)
		agentCount += bundledAgentCount

		// Generate rules (constitution link)
		const constitutionRule = `# Project Constitution

This project follows the Vanguard development methodology.

## Key Rules
1. Always read \`.vanguard/constitution.md\` before making architectural decisions
2. Follow ${config.architecture.primary} architecture patterns
3. Write tests for all business logic
4. Keep business logic in the domain layer
5. Use ${config.stack.language} best practices
6. Check \`.vanguard/tasks/\` for current work items
7. Store learnings with \`vanguard memory add\`

## Available Commands
- \`/vanguard.discover\` — Analyze codebase (Analyst mode)
- \`/vanguard.specify\` — Write specifications (PM mode)
- \`/vanguard.architect\` — Design solutions (Architect mode)
- \`/vanguard.plan\` — Break into tasks (Scrum Master mode)
- \`/vanguard.implement\` — Code implementation (Developer mode)
- \`/vanguard.review\` — Code review (QA mode)
`
		const rulesPath = path.join(rulesDir, 'vanguard.md')
		if (options.force || !fs.existsSync(rulesPath)) {
			fs.writeFileSync(rulesPath, constitutionRule, 'utf-8')
		}

		// Generate CLAUDE.md at project root
		const claudeMd = `# ${config.project.name}

## Vanguard Project
- **Stack**: ${config.stack.id} (${config.stack.language})
- **Architecture**: ${config.architecture.primary}
- **Database**: ${config.database.type}${config.database.orm ? ` (${config.database.orm})` : ''}

## Key Files
- \`.vanguard/constitution.md\` — Project principles (READ FIRST)
- \`.vanguard/config.yaml\` — Project configuration
- \`vanguard.manifest.yaml\` — Project manifest

## Workflow
Use slash commands to follow the development workflow:
1. \`/vanguard.discover\` — Understand the codebase
2. \`/vanguard.specify\` — Write feature specs
3. \`/vanguard.architect\` — Design the solution
4. \`/vanguard.plan\` — Break into tasks
5. \`/vanguard.implement\` — Build it
6. \`/vanguard.review\` — Review the code

## Agents
Specialized AI personas available in \`.claude/agents/\`:
- **Analyst** — Codebase exploration
- **Product Manager** — Specifications
- **Architect** — Technical design
- **Scrum Master** — Task management
- **Developer** — Implementation
- **QA Reviewer** — Quality assurance
`
		const claudeMdPath = path.join(rootPath, 'CLAUDE.md')
		if (options.force || !fs.existsSync(claudeMdPath)) {
			fs.writeFileSync(claudeMdPath, claudeMd, 'utf-8')
		}

		s.stop('Generated!')

		console.log('')
		console.log(pc.bold('  Created:'))
		console.log(`  ${pc.cyan('.claude/agents/')}     — ${agentCount} agent personas`)
		console.log(`  ${pc.cyan('.claude/skills/')}     — ${skillCount} skills`)
		console.log(`  ${pc.cyan('.claude/commands/')}   — ${cmdCount} slash commands`)
		console.log(`  ${pc.cyan('.claude/rules/')}      — Project rules`)
		console.log(`  ${pc.cyan('CLAUDE.md')}           — Project context for Claude`)
		console.log('')
		console.log(pc.bold('  Slash Commands:'))
		console.log(`  ${pc.yellow('/vanguard.discover')}    — Analyst mode`)
		console.log(`  ${pc.yellow('/vanguard.specify')}     — Product Manager mode`)
		console.log(`  ${pc.yellow('/vanguard.architect')}   — Architect mode`)
		console.log(`  ${pc.yellow('/vanguard.plan')}        — Scrum Master mode`)
		console.log(`  ${pc.yellow('/vanguard.implement')}   — Developer mode`)
		console.log(`  ${pc.yellow('/vanguard.review')}      — QA Reviewer mode`)
		console.log('')
	})

// vanguard agents list
agentsCommand
	.command('list')
	.description('List available agents')
	.action(() => {
		const agentsDir = path.join(process.cwd(), '.claude', 'agents')
		if (!fs.existsSync(agentsDir)) {
			console.log(pc.dim('\n  No agents generated. Run `vanguard agents generate`.\n'))
			return
		}

		const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))
		console.log('')
		console.log(pc.bold(`  Agents (${files.length})`))
		console.log(pc.dim('  ─────────────────────────────────────'))
		for (const file of files) {
			const name = file.replace('.md', '')
			const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8')
			const firstLine = content.split('\n').find((l) => l.startsWith('#'))?.replace(/^#+\s*/, '') ?? name
			console.log(`  ${pc.cyan('●')} ${firstLine}`)
		}
		console.log('')
	})

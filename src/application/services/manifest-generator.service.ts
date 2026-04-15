import { stringify } from 'yaml'
import type { AgentRole } from '../../domain/entities/agent.js'
import type {
	Manifest,
	ManifestAgent,
	ManifestDocuments,
	ManifestPhase,
} from '../../domain/entities/manifest.js'
import type { Project } from '../../domain/entities/project.js'
import { FilePath } from '../../domain/value-objects/file-path.js'
import type { GeneratedFile, ManifestGenerator } from '../ports/generator.js'
import type { ProjectSummary } from './vanguard-generator.service.js'

/**
 * Phase definitions for the manifest.
 * Maps each workflow phase to its agent and I/O patterns.
 */
const PHASE_DEFINITIONS: Record<
	string,
	Omit<ManifestPhase, 'description'> & { description: string }
> = {
	discover: {
		agent: 'analyst',
		description: 'Analyze existing codebase or explore problem space',
		inputs: ['user-request'],
		outputs: ['.vanguard/specs/discovery.md'],
	},
	brainstorm: {
		agent: 'brainstorm-coach',
		description: 'Facilitate creative brainstorming session',
		inputs: ['user-request', 'discovery.md'],
		outputs: ['.vanguard/specs/brainstorm-{topic}.md'],
	},
	constitute: {
		agent: 'architect',
		description: 'Review and customize project constitution',
		inputs: ['.vanguard/constitution.md'],
		outputs: ['.vanguard/constitution.md'],
	},
	specify: {
		agent: 'product-manager',
		description: 'Create feature specification document',
		inputs: ['user-request', 'discovery.md'],
		outputs: ['.vanguard/specs/{feature}.md'],
		templates: ['.vanguard/templates/spec-template.md'],
	},
	clarify: {
		agent: 'analyst',
		description: 'Resolve specification ambiguities',
		inputs: ['.vanguard/specs/{feature}.md'],
		outputs: ['.vanguard/specs/{feature}.md'],
	},
	architect: {
		agent: 'architect',
		description: 'Create technical design for specification',
		inputs: ['.vanguard/specs/{feature}.md', '.vanguard/constitution.md'],
		outputs: ['.vanguard/plans/{feature}.md'],
		templates: ['.vanguard/templates/plan-template.md'],
	},
	plan: {
		agent: 'scrum-master',
		description: 'Break technical design into executable tasks',
		inputs: ['.vanguard/plans/{feature}.md'],
		outputs: ['.vanguard/tasks/{feature}/task-{n}.md'],
		templates: ['.vanguard/templates/task-template.md'],
	},
	implement: {
		agent: 'developer',
		description: 'Implement task following project conventions',
		inputs: ['.vanguard/tasks/{feature}/task-{n}.md', '.vanguard/constitution.md'],
		outputs: ['source-code', 'tests'],
	},
	review: {
		agent: 'qa',
		description: 'Review implementation for quality and compliance',
		inputs: ['source-code', 'tests', '.vanguard/tasks/{feature}/task-{n}.md'],
		outputs: ['approval', 'feedback'],
	},
	extend: {
		agent: 'module-architect',
		description: 'Add new stacks, architectures, or modules',
		inputs: ['user-request'],
		outputs: ['module-definition'],
	},
}

/**
 * Agent definitions for the manifest.
 * Provides quick lookup of agent capabilities without loading full agent files.
 */
const AGENT_DEFINITIONS: Record<AgentRole, Omit<ManifestAgent, 'file'>> = {
	analyst: {
		role: 'analyst',
		capabilities: ['discover', 'clarify', 'risks', 'questions', 'analyze'],
	},
	'brainstorm-coach': {
		role: 'brainstorm-coach',
		capabilities: ['session', 'techniques', 'random', 'organize', 'ideate'],
	},
	'product-manager': {
		role: 'product-manager',
		capabilities: ['spec', 'story', 'prioritize', 'requirements'],
	},
	architect: {
		role: 'architect',
		capabilities: ['design', 'review', 'adr', 'layers', 'constitute'],
	},
	'scrum-master': {
		role: 'scrum-master',
		capabilities: ['plan', 'story', 'estimate', 'dependencies'],
	},
	developer: {
		role: 'developer',
		capabilities: ['implement', 'test', 'lint', 'refactor'],
	},
	qa: {
		role: 'qa',
		capabilities: ['review', 'security', 'coverage', 'checklist'],
	},
	'module-architect': {
		role: 'module-architect',
		capabilities: ['stack', 'architecture', 'examples', 'validate'],
	},
	'ux-designer': {
		role: 'ux-designer',
		capabilities: [
			'design',
			'experience-principles',
			'user-journey',
			'visual-foundation',
			'component-strategy',
			'a11y-audit',
			'lovable-prompt',
			'v0-prompt',
		],
	},
}

/**
 * Agent ID mapping for file paths.
 */
const AGENT_FILE_IDS: Record<AgentRole, string> = {
	analyst: 'analyst',
	'brainstorm-coach': 'brainstorm',
	'product-manager': 'pm',
	architect: 'architect',
	'scrum-master': 'sm',
	developer: 'dev',
	qa: 'qa',
	'module-architect': 'modarch',
	'ux-designer': 'ux',
}

/**
 * Service that generates the project manifest.
 *
 * The manifest is the central registry that enables:
 * 1. **Context efficiency** - Claude reads one file to understand project structure
 * 2. **State tracking** - Documents and tasks have status for workflow awareness
 * 3. **Semantic lookup** - Summaries and keywords enable finding relevant docs
 *
 * Developer Experience:
 * - On `vanguard init`: Generates fresh manifest with empty document registry
 * - On `vanguard sync`: Updates manifest from file system (future feature)
 * - On phase commands: Claude reads manifest first to understand current state
 */
export class ManifestGeneratorService implements ManifestGenerator {
	generate(project: Project): GeneratedFile {
		const content = this.generateContent(project)

		return {
			path: project.rootPath.join('vanguard.manifest.yaml'),
			content,
		}
	}

	/**
	 * Generate manifest from a ProjectSummary (dynamic init flow).
	 * Only needs name, type, track, rootPath — same fields buildManifest() reads.
	 */
	generateFromSummary(summary: ProjectSummary): GeneratedFile {
		const manifest: Manifest = {
			vanguard: {
				version: '1.0',
				generatedAt: new Date().toISOString(),
			},
			project: {
				name: summary.name,
				type: summary.type,
				track: summary.track,
				rootPath: summary.rootPath,
			},
			phases: this.buildPhases(),
			agents: this.buildAgents(),
			documents: this.buildEmptyDocuments(),
		}

		const header = `# Vanguard Project Manifest
#
# This file is the central registry for your Vanguard project.
# Claude reads this file first to understand project structure and state.
#
# Structure:
#   - project: Basic project info
#   - phases: Workflow phases with their agents and I/O patterns
#   - agents: Agent personas with their capabilities
#   - documents: Registry of specs, plans, and tasks with summaries
#
# Usage:
#   - vanguard init: Generates this file
#   - vanguard sync: Updates document registry from file system
#   - Phase commands: Read this to understand current state
#
# Tips:
#   - Add summaries and keywords when creating new documents
#   - Update status as documents move through workflow
#   - Use keywords for quick semantic lookup
#
# Generated: ${new Date().toISOString()}

`

		const content =
			header +
			stringify(manifest, {
				indent: 2,
				lineWidth: 100,
			})

		return {
			path: FilePath.create(summary.rootPath).join('vanguard.manifest.yaml'),
			content,
		}
	}

	generateContent(project: Project): string {
		const manifest = this.buildManifest(project)

		const header = `# Vanguard Project Manifest
#
# This file is the central registry for your Vanguard project.
# Claude reads this file first to understand project structure and state.
#
# Structure:
#   - project: Basic project info
#   - phases: Workflow phases with their agents and I/O patterns
#   - agents: Agent personas with their capabilities
#   - documents: Registry of specs, plans, and tasks with summaries
#
# Usage:
#   - vanguard init: Generates this file
#   - vanguard sync: Updates document registry from file system
#   - Phase commands: Read this to understand current state
#
# Tips:
#   - Add summaries and keywords when creating new documents
#   - Update status as documents move through workflow
#   - Use keywords for quick semantic lookup
#
# Generated: ${new Date().toISOString()}

`

		return (
			header +
			stringify(manifest, {
				indent: 2,
				lineWidth: 100,
			})
		)
	}

	private buildManifest(project: Project): Manifest {
		return {
			vanguard: {
				version: '1.0',
				generatedAt: new Date().toISOString(),
			},

			project: {
				name: project.name,
				type: project.type,
				track: project.track,
				rootPath: project.rootPath.toString(),
			},

			phases: this.buildPhases(),

			agents: this.buildAgents(),

			documents: this.buildDocuments(project),
		}
	}

	private buildPhases(): Record<string, ManifestPhase> {
		const phases: Record<string, ManifestPhase> = {}

		for (const [name, definition] of Object.entries(PHASE_DEFINITIONS)) {
			phases[name] = {
				agent: definition.agent,
				description: definition.description,
				inputs: definition.inputs,
				outputs: definition.outputs,
				templates: definition.templates,
			}
		}

		return phases
	}

	private buildAgents(): Record<string, ManifestAgent> {
		const agents: Record<string, ManifestAgent> = {}

		for (const [role, definition] of Object.entries(AGENT_DEFINITIONS)) {
			const fileId = AGENT_FILE_IDS[role as AgentRole]
			agents[role] = {
				role: definition.role,
				file: `.claude/commands/vanguard/agents/${fileId}.md`,
				capabilities: definition.capabilities,
			}
		}

		return agents
	}

	private buildDocuments(_project: Project): ManifestDocuments {
		return this.buildEmptyDocuments()
	}

	private buildEmptyDocuments(): ManifestDocuments {
		// Initial manifest has empty document registries
		// These get populated as the project progresses
		return {
			constitution: '.vanguard/constitution.md',
			specs: {
				// Example structure (commented in YAML):
				// 'feature-name':
				//   path: '.vanguard/specs/feature-name.md'
				//   summary: 'Brief description of what this spec covers'
				//   keywords: [auth, login, security]
				//   status: draft | in-review | approved | superseded
				//   createdAt: ISO timestamp
				//   updatedAt: ISO timestamp
			},
			plans: {
				// Same structure as specs
			},
			tasks: {
				// 'feature/task-001':
				//   path: '.vanguard/tasks/feature/task-001.md'
				//   title: 'Implement user login endpoint'
				//   summary: 'Create POST /auth/login with JWT response'
				//   status: pending | in-progress | blocked | completed
				//   feature: 'feature-name'
				//   sequence: 1
				//   dependsOn: []
			},
		}
	}
}

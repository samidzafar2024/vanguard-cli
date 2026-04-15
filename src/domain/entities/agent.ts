import { Identifier } from '../value-objects/identifier.js'

/**
 * Agent role/phase in the development workflow.
 */
export type AgentRole =
	| 'analyst'
	| 'product-manager'
	| 'architect'
	| 'scrum-master'
	| 'developer'
	| 'qa'
	| 'module-architect'
	| 'brainstorm-coach'
	| 'ux-designer'

/**
 * Communication style for the agent.
 */
export interface CommunicationStyle {
	readonly tone: string
	readonly focus: readonly string[]
	readonly avoids: readonly string[]
}

/**
 * Agent Entity - represents a persona that can be activated in Claude Code.
 * Agents have specific roles, behaviors, and prompt contexts.
 */
export class Agent {
	private constructor(
		public readonly id: Identifier,
		public readonly name: string,
		public readonly role: AgentRole,
		public readonly description: string,
		public readonly principles: readonly string[],
		public readonly responsibilities: readonly string[],
		public readonly style: CommunicationStyle,
		public readonly promptTemplate: string,
		public readonly outputFormat: string,
	) {}

	static create(params: {
		id: string
		name: string
		role: AgentRole
		description: string
		principles: readonly string[]
		responsibilities: readonly string[]
		style: CommunicationStyle
		promptTemplate: string
		outputFormat: string
	}): Agent {
		return new Agent(
			Identifier.create(params.id),
			params.name,
			params.role,
			params.description,
			params.principles,
			params.responsibilities,
			params.style,
			params.promptTemplate,
			params.outputFormat,
		)
	}

	/**
	 * Generate the full prompt for this agent with context injection.
	 */
	generatePrompt(context: AgentContext): string {
		let prompt = this.promptTemplate

		// Replace context placeholders
		prompt = prompt.replace('{agent_name}', this.name)
		prompt = prompt.replace('{agent_role}', this.role)
		prompt = prompt.replace('{agent_description}', this.description)
		prompt = prompt.replace('{principles}', this.principles.map((p) => `- ${p}`).join('\n'))
		prompt = prompt.replace(
			'{responsibilities}',
			this.responsibilities.map((r) => `- ${r}`).join('\n'),
		)
		prompt = prompt.replace('{communication_style}', this.formatStyle())

		// Inject project context
		if (context.stackContext) {
			prompt = prompt.replace('{stack_context}', context.stackContext)
		}
		if (context.architectureContext) {
			prompt = prompt.replace('{architecture_context}', context.architectureContext)
		}
		if (context.testingContext) {
			prompt = prompt.replace('{testing_context}', context.testingContext)
		}
		if (context.constitutionPath) {
			prompt = prompt.replace('{constitution_path}', context.constitutionPath)
		}
		if (context.currentTask) {
			prompt = prompt.replace('{current_task}', context.currentTask)
		}

		return prompt
	}

	private formatStyle(): string {
		const lines = [
			`**Tone**: ${this.style.tone}`,
			'**Focus Areas**:',
			...this.style.focus.map((f) => `  - ${f}`),
			'**Avoids**:',
			...this.style.avoids.map((a) => `  - ${a}`),
		]
		return lines.join('\n')
	}

	/**
	 * Check if this agent handles a specific phase.
	 */
	handlesPhase(phase: string): boolean {
		const phaseToRole: Record<string, AgentRole> = {
			discover: 'analyst',
			constitute: 'architect',
			specify: 'product-manager',
			clarify: 'analyst',
			architect: 'architect',
			plan: 'scrum-master',
			implement: 'developer',
			review: 'qa',
			'add-module': 'module-architect',
		}

		return phaseToRole[phase.toLowerCase()] === this.role
	}
}

/**
 * Context to inject into agent prompts.
 */
export interface AgentContext {
	readonly stackContext?: string
	readonly architectureContext?: string
	readonly testingContext?: string
	readonly constitutionPath?: string
	readonly currentTask?: string
	readonly fewShotExamples?: readonly string[]
}

/**
 * Get Project Context Use Case.
 *
 * Retrieves the project context information for agents and prompts.
 */

import type { Project } from '../../../domain/entities/project.js'

/**
 * Project context for agents.
 */
export interface ProjectContext {
	readonly name: string
	readonly type: 'greenfield' | 'brownfield'
	readonly track: 'solo' | 'team' | 'enterprise'
	readonly stackName: string
	readonly architectureName: string
	readonly agentContext: string
	readonly fewShotExamples: readonly string[]
	readonly constitutionPath: string
	readonly configPath: string
}

/**
 * Output from getting project context.
 */
export interface GetProjectContextOutput {
	readonly context: ProjectContext
}

/**
 * Use case for getting project context for agents.
 *
 * Responsibilities:
 * - Extracts relevant project information
 * - Generates agent context string
 * - Collects few-shot examples
 */
export class GetProjectContextUseCase {
	execute(project: Project): GetProjectContextOutput {
		const context: ProjectContext = {
			name: project.name,
			type: project.type,
			track: project.track,
			stackName: project.stack.name,
			architectureName: project.architecture.name,
			agentContext: project.generateAgentContext(),
			fewShotExamples: project.getFewShotExamples(),
			constitutionPath: project.getConstitutionPath().toString(),
			configPath: project.getConfigPath().toString(),
		}

		return { context }
	}
}

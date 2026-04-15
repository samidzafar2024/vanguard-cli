/**
 * Start Workflow Use Case.
 *
 * Initializes a new workflow execution for a feature.
 */

import type { Workflow, WorkflowRepository, WorkflowState } from '../../ports/repositories.js'

/**
 * Input for starting a workflow.
 */
export interface StartWorkflowInput {
	readonly workflowId: string
	readonly feature: string
}

/**
 * Output from starting a workflow.
 */
export interface StartWorkflowOutput {
	readonly success: boolean
	readonly state?: WorkflowState | undefined
	readonly workflow?: Workflow | undefined
	readonly error?: string | undefined
}

/**
 * Use case for starting a new workflow execution.
 *
 * Responsibilities:
 * - Validates workflow exists
 * - Creates initial workflow state
 * - Returns the workflow definition with current state
 */
export class StartWorkflowUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(input: StartWorkflowInput): Promise<StartWorkflowOutput> {
		// Check if workflow exists
		const workflow = await this.workflowRepository.findById(input.workflowId)
		if (!workflow) {
			return {
				success: false,
				error: `Workflow not found: ${input.workflowId}`,
			}
		}

		// Check if there's already an active workflow for this feature
		const existingState = await this.workflowRepository.getState(input.feature)
		if (existingState) {
			return {
				success: false,
				error: `Workflow already in progress for feature: ${input.feature}`,
				state: existingState,
				workflow,
			}
		}

		// Create initial state
		const now = new Date().toISOString()
		const stepStatuses: Record<string, 'pending'> = {}
		for (const step of workflow.steps) {
			stepStatuses[step.id] = 'pending'
		}

		const state: WorkflowState = {
			workflowId: input.workflowId,
			feature: input.feature,
			currentStepIndex: 0,
			stepStatuses,
			outputs: {},
			startedAt: now,
			updatedAt: now,
		}

		await this.workflowRepository.saveState(state)

		return {
			success: true,
			state,
			workflow,
		}
	}
}

/**
 * Resume Workflow Use Case.
 *
 * Resumes an existing workflow execution.
 */
export interface ResumeWorkflowInput {
	readonly feature: string
}

export interface ResumeWorkflowOutput {
	readonly success: boolean
	readonly state?: WorkflowState | undefined
	readonly workflow?: Workflow | undefined
	readonly error?: string | undefined
}

export class ResumeWorkflowUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(input: ResumeWorkflowInput): Promise<ResumeWorkflowOutput> {
		const state = await this.workflowRepository.getState(input.feature)
		if (!state) {
			return {
				success: false,
				error: `No active workflow found for feature: ${input.feature}`,
			}
		}

		const workflow = await this.workflowRepository.findById(state.workflowId)
		if (!workflow) {
			return {
				success: false,
				error: `Workflow definition not found: ${state.workflowId}`,
			}
		}

		return {
			success: true,
			state,
			workflow,
		}
	}
}

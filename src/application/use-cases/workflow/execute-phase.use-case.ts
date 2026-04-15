/**
 * Execute Phase Use Cases.
 *
 * Manages execution of individual workflow phases.
 */

import type { WorkflowRepository, WorkflowState, WorkflowStep } from '../../ports/repositories.js'

/**
 * Input for getting current phase.
 */
export interface GetCurrentPhaseInput {
	readonly feature: string
}

/**
 * Output from getting current phase.
 */
export interface GetCurrentPhaseOutput {
	readonly success: boolean
	readonly phase?: WorkflowStep | undefined
	readonly phaseIndex?: number | undefined
	readonly totalPhases?: number | undefined
	readonly state?: WorkflowState | undefined
	readonly isComplete?: boolean | undefined
	readonly error?: string | undefined
}

/**
 * Use case for getting the current phase of a workflow.
 */
export class GetCurrentPhaseUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(input: GetCurrentPhaseInput): Promise<GetCurrentPhaseOutput> {
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

		const isComplete = state.currentStepIndex >= workflow.steps.length
		if (isComplete) {
			return {
				success: true,
				state,
				isComplete: true,
				totalPhases: workflow.steps.length,
			}
		}

		const currentPhase = workflow.steps[state.currentStepIndex]

		return {
			success: true,
			phase: currentPhase,
			phaseIndex: state.currentStepIndex,
			totalPhases: workflow.steps.length,
			state,
			isComplete: false,
		}
	}
}

/**
 * Input for completing a phase.
 */
export interface CompletePhaseInput {
	readonly feature: string
	readonly output?: string | undefined
}

/**
 * Output from completing a phase.
 */
export interface CompletePhaseOutput {
	readonly success: boolean
	readonly completedPhase?: WorkflowStep | undefined
	readonly nextPhase?: WorkflowStep | undefined
	readonly state?: WorkflowState | undefined
	readonly isWorkflowComplete?: boolean | undefined
	readonly error?: string | undefined
}

/**
 * Use case for completing the current phase and advancing.
 */
export class CompletePhaseUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(input: CompletePhaseInput): Promise<CompletePhaseOutput> {
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

		if (state.currentStepIndex >= workflow.steps.length) {
			return {
				success: false,
				error: 'Workflow is already complete',
			}
		}

		const completedPhase = workflow.steps[state.currentStepIndex]
		if (!completedPhase) {
			return {
				success: false,
				error: 'Invalid step index in workflow state',
			}
		}

		// Update step status to completed and advance
		const newStepStatuses = {
			...state.stepStatuses,
			[completedPhase.id]: 'completed' as const,
		}

		const newOutputs = input.output
			? { ...state.outputs, [completedPhase.id]: input.output }
			: state.outputs

		const newState: WorkflowState = {
			...state,
			currentStepIndex: state.currentStepIndex + 1,
			stepStatuses: newStepStatuses,
			outputs: newOutputs,
			updatedAt: new Date().toISOString(),
		}

		await this.workflowRepository.saveState(newState)

		const isComplete = newState.currentStepIndex >= workflow.steps.length
		const nextPhase = isComplete ? undefined : workflow.steps[newState.currentStepIndex]

		return {
			success: true,
			completedPhase,
			nextPhase,
			state: newState,
			isWorkflowComplete: isComplete,
		}
	}
}

/**
 * Input for skipping a phase.
 */
export interface SkipPhaseInput {
	readonly feature: string
	readonly reason?: string | undefined
}

/**
 * Output from skipping a phase.
 */
export interface SkipPhaseOutput {
	readonly success: boolean
	readonly skippedPhase?: WorkflowStep | undefined
	readonly nextPhase?: WorkflowStep | undefined
	readonly state?: WorkflowState | undefined
	readonly error?: string | undefined
}

/**
 * Use case for skipping the current phase.
 */
export class SkipPhaseUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(input: SkipPhaseInput): Promise<SkipPhaseOutput> {
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

		if (state.currentStepIndex >= workflow.steps.length) {
			return {
				success: false,
				error: 'Workflow is already complete',
			}
		}

		const skippedPhase = workflow.steps[state.currentStepIndex]
		if (!skippedPhase) {
			return {
				success: false,
				error: 'Invalid step index in workflow state',
			}
		}

		// Update step status to skipped and advance
		const newState: WorkflowState = {
			...state,
			currentStepIndex: state.currentStepIndex + 1,
			stepStatuses: {
				...state.stepStatuses,
				[skippedPhase.id]: 'skipped' as const,
			},
			updatedAt: new Date().toISOString(),
		}

		await this.workflowRepository.saveState(newState)

		const isComplete = newState.currentStepIndex >= workflow.steps.length
		const nextPhase = isComplete ? undefined : workflow.steps[newState.currentStepIndex]

		return {
			success: true,
			skippedPhase,
			nextPhase,
			state: newState,
		}
	}
}

/**
 * Input for starting execution of a phase.
 */
export interface StartPhaseExecutionInput {
	readonly feature: string
}

/**
 * Output from starting phase execution.
 */
export interface StartPhaseExecutionOutput {
	readonly success: boolean
	readonly phase?: WorkflowStep | undefined
	readonly state?: WorkflowState | undefined
	readonly error?: string | undefined
}

/**
 * Use case for marking the current phase as in-progress.
 */
export class StartPhaseExecutionUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(input: StartPhaseExecutionInput): Promise<StartPhaseExecutionOutput> {
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

		if (state.currentStepIndex >= workflow.steps.length) {
			return {
				success: false,
				error: 'Workflow is already complete',
			}
		}

		const currentPhase = workflow.steps[state.currentStepIndex]
		if (!currentPhase) {
			return {
				success: false,
				error: 'Invalid step index in workflow state',
			}
		}

		// Update step status to in-progress
		const newState: WorkflowState = {
			...state,
			stepStatuses: {
				...state.stepStatuses,
				[currentPhase.id]: 'in-progress' as const,
			},
			updatedAt: new Date().toISOString(),
		}

		await this.workflowRepository.saveState(newState)

		return {
			success: true,
			phase: currentPhase,
			state: newState,
		}
	}
}

/**
 * Workflow Status Use Cases.
 *
 * Query use cases for workflow status and progress.
 */

import type {
	Workflow,
	WorkflowRepository,
	WorkflowState,
	WorkflowStep,
} from '../../ports/repositories.js'

/**
 * Input for getting workflow status.
 */
export interface GetWorkflowStatusInput {
	readonly feature: string
}

/**
 * Phase status summary.
 */
export interface PhaseStatusSummary {
	readonly id: string
	readonly name: string
	readonly status: 'pending' | 'in-progress' | 'completed' | 'skipped'
	readonly output?: string | undefined
}

/**
 * Output from getting workflow status.
 */
export interface GetWorkflowStatusOutput {
	readonly success: boolean
	readonly workflow?: Workflow | undefined
	readonly state?: WorkflowState | undefined
	readonly phases?: readonly PhaseStatusSummary[] | undefined
	readonly currentPhase?: WorkflowStep | undefined
	readonly progress?:
		| {
				readonly completed: number
				readonly total: number
				readonly percentage: number
		  }
		| undefined
	readonly isComplete?: boolean | undefined
	readonly error?: string | undefined
}

/**
 * Use case for getting detailed workflow status.
 */
export class GetWorkflowStatusUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(input: GetWorkflowStatusInput): Promise<GetWorkflowStatusOutput> {
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

		// Build phase status summaries
		const phases: PhaseStatusSummary[] = workflow.steps.map((step) => ({
			id: step.id,
			name: step.name,
			status: state.stepStatuses[step.id] ?? 'pending',
			output: state.outputs[step.id],
		}))

		// Calculate progress
		const completedCount = Object.values(state.stepStatuses).filter(
			(status) => status === 'completed' || status === 'skipped',
		).length
		const total = workflow.steps.length
		const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0

		const isComplete = state.currentStepIndex >= workflow.steps.length
		const currentPhase = isComplete ? undefined : workflow.steps[state.currentStepIndex]

		return {
			success: true,
			workflow,
			state,
			phases,
			currentPhase,
			progress: {
				completed: completedCount,
				total,
				percentage,
			},
			isComplete,
		}
	}
}

/**
 * Output from listing available workflows.
 */
export interface ListWorkflowsOutput {
	readonly workflows: readonly Workflow[]
}

/**
 * Use case for listing all available workflows.
 */
export class ListWorkflowsUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(): Promise<ListWorkflowsOutput> {
		const workflows = await this.workflowRepository.findAll()
		return { workflows }
	}
}

/**
 * Output from listing active workflow states.
 */
export interface ListActiveWorkflowsOutput {
	readonly activeWorkflows: readonly {
		readonly feature: string
		readonly workflowId: string
		readonly currentPhase: string
		readonly progress: number
		readonly startedAt: string
	}[]
}

/**
 * Use case for listing all active workflow executions.
 */
export class ListActiveWorkflowsUseCase {
	constructor(private readonly workflowRepository: WorkflowRepository) {}

	async execute(): Promise<ListActiveWorkflowsOutput> {
		const states = await this.workflowRepository.listActiveStates()
		const workflows = await this.workflowRepository.findAll()

		const workflowMap = new Map<string, Workflow>()
		for (const workflow of workflows) {
			workflowMap.set(workflow.id, workflow)
		}

		const activeWorkflows = states.map((state) => {
			const workflow = workflowMap.get(state.workflowId)
			const totalSteps = workflow?.steps.length ?? 0
			const completedSteps = Object.values(state.stepStatuses).filter(
				(status) => status === 'completed' || status === 'skipped',
			).length
			const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

			const currentStep =
				workflow && state.currentStepIndex < workflow.steps.length
					? workflow.steps[state.currentStepIndex]
					: undefined
			const currentPhaseName = currentStep?.name ?? 'Complete'

			return {
				feature: state.feature,
				workflowId: state.workflowId,
				currentPhase: currentPhaseName,
				progress,
				startedAt: state.startedAt,
			}
		})

		return { activeWorkflows }
	}
}

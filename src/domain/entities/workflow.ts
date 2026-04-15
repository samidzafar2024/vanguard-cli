import type { AgentRole } from './agent.js'
import type { Track } from './project.js'

/**
 * Step status for tracking workflow progress.
 */
export type StepStatus = 'pending' | 'in-progress' | 'completed' | 'skipped'

/**
 * A single step in a workflow.
 *
 * Steps are the atomic units of work in Vanguard workflows.
 * Each step has:
 * - A clear, single objective
 * - Defined inputs (what it needs to start)
 * - Defined outputs (what it produces)
 * - A checkpoint for user confirmation before proceeding
 * - Track inclusion (which project scales include this step)
 */
export interface WorkflowStep {
	readonly id: string
	readonly name: string
	readonly description: string
	readonly objective: string
	readonly inputs: readonly string[]
	readonly outputs: readonly string[]
	readonly checkpoint: string
	readonly instructions: string
	readonly tips?: readonly string[] | undefined
	/**
	 * Which tracks include this step. If undefined, included in all tracks.
	 * - solo: Minimal workflow for individual developers
	 * - team: Standard workflow for small teams
	 * - enterprise: Full workflow with governance for large organizations
	 */
	readonly tracks?: readonly Track[] | undefined
}

/**
 * A workflow definition that orchestrates multiple steps.
 *
 * Workflows define:
 * - The sequence of steps to execute
 * - Which agent handles the workflow
 * - Entry conditions and final outputs
 */
export interface Workflow {
	readonly id: string
	readonly name: string
	readonly description: string
	readonly agent: AgentRole
	readonly steps: readonly WorkflowStep[]
	readonly entryConditions: readonly string[]
	readonly finalOutputs: readonly string[]
}

/**
 * State of a workflow execution.
 * Tracks progress through steps and stores intermediate outputs.
 */
export interface WorkflowState {
	readonly workflowId: string
	readonly feature: string
	readonly currentStepIndex: number
	readonly stepStatuses: Record<string, StepStatus>
	readonly outputs: Record<string, string>
	readonly startedAt: string
	readonly updatedAt: string
}

/**
 * Factory functions for creating workflow state.
 */
export const WorkflowStateFactory = {
	/**
	 * Create initial state for a new workflow execution.
	 */
	create(workflowId: string, feature: string, stepIds: readonly string[]): WorkflowState {
		const now = new Date().toISOString()
		const stepStatuses: Record<string, StepStatus> = {}

		for (const stepId of stepIds) {
			stepStatuses[stepId] = 'pending'
		}

		return {
			workflowId,
			feature,
			currentStepIndex: 0,
			stepStatuses,
			outputs: {},
			startedAt: now,
			updatedAt: now,
		}
	},

	/**
	 * Advance to the next step.
	 */
	completeStep(state: WorkflowState, stepId: string, output?: string): WorkflowState {
		const newStatuses = { ...state.stepStatuses, [stepId]: 'completed' as StepStatus }
		const newOutputs = output ? { ...state.outputs, [stepId]: output } : state.outputs

		return {
			...state,
			currentStepIndex: state.currentStepIndex + 1,
			stepStatuses: newStatuses,
			outputs: newOutputs,
			updatedAt: new Date().toISOString(),
		}
	},

	/**
	 * Mark current step as in-progress.
	 */
	startStep(state: WorkflowState, stepId: string): WorkflowState {
		return {
			...state,
			stepStatuses: { ...state.stepStatuses, [stepId]: 'in-progress' as StepStatus },
			updatedAt: new Date().toISOString(),
		}
	},

	/**
	 * Skip a step.
	 */
	skipStep(state: WorkflowState, stepId: string): WorkflowState {
		return {
			...state,
			currentStepIndex: state.currentStepIndex + 1,
			stepStatuses: { ...state.stepStatuses, [stepId]: 'skipped' as StepStatus },
			updatedAt: new Date().toISOString(),
		}
	},

	/**
	 * Check if workflow is complete.
	 */
	isComplete(state: WorkflowState, totalSteps: number): boolean {
		return state.currentStepIndex >= totalSteps
	},
}

/**
 * Filter workflow steps to only include those for a specific track.
 * If a step has no tracks specified, it's included in all tracks.
 */
export function filterStepsByTrack(steps: readonly WorkflowStep[], track: Track): WorkflowStep[] {
	return steps.filter((step) => {
		// If no tracks specified, include in all tracks
		if (!step.tracks || step.tracks.length === 0) {
			return true
		}
		return step.tracks.includes(track)
	})
}

/**
 * Get a workflow with steps filtered for a specific track.
 */
export function getWorkflowForTrack(workflow: Workflow, track: Track): Workflow {
	return {
		...workflow,
		steps: filterStepsByTrack(workflow.steps, track),
	}
}

/**
 * Track-specific workflow characteristics.
 */
export const TRACK_CHARACTERISTICS: Record<
	Track,
	{
		name: string
		description: string
		governance: 'light' | 'standard' | 'heavy'
		documentationLevel: 'minimal' | 'standard' | 'detailed'
		skipPlanPhase: boolean
	}
> = {
	solo: {
		name: 'Solo Developer',
		description: 'Quick iteration, minimal documentation, lightweight governance',
		governance: 'light',
		documentationLevel: 'minimal',
		skipPlanPhase: true, // Solo devs go straight to implement
	},
	team: {
		name: 'Team',
		description: 'Standard workflow for small to medium teams',
		governance: 'standard',
		documentationLevel: 'standard',
		skipPlanPhase: false,
	},
	enterprise: {
		name: 'Enterprise',
		description: 'Full governance, compliance artifacts, detailed ADRs',
		governance: 'heavy',
		documentationLevel: 'detailed',
		skipPlanPhase: false,
	},
}

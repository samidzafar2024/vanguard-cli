/**
 * Workflow Use Cases.
 *
 * Clean architecture use cases for workflow phase management.
 */

export { StartWorkflowUseCase, ResumeWorkflowUseCase } from './start-workflow.use-case.js'
export type {
	StartWorkflowInput,
	StartWorkflowOutput,
	ResumeWorkflowInput,
	ResumeWorkflowOutput,
} from './start-workflow.use-case.js'

export {
	GetCurrentPhaseUseCase,
	CompletePhaseUseCase,
	SkipPhaseUseCase,
	StartPhaseExecutionUseCase,
} from './execute-phase.use-case.js'
export type {
	GetCurrentPhaseInput,
	GetCurrentPhaseOutput,
	CompletePhaseInput,
	CompletePhaseOutput,
	SkipPhaseInput,
	SkipPhaseOutput,
	StartPhaseExecutionInput,
	StartPhaseExecutionOutput,
} from './execute-phase.use-case.js'

export {
	GetWorkflowStatusUseCase,
	ListWorkflowsUseCase,
	ListActiveWorkflowsUseCase,
} from './workflow-status.use-case.js'
export type {
	GetWorkflowStatusInput,
	GetWorkflowStatusOutput,
	PhaseStatusSummary,
	ListWorkflowsOutput,
	ListActiveWorkflowsOutput,
} from './workflow-status.use-case.js'

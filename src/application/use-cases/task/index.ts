/**
 * Task Workflow Use Cases.
 *
 * Clean architecture use cases for task management operations.
 */

export { StartTaskUseCase } from './start-task.use-case.js'
export type { StartTaskInput, StartTaskOutput, BranchService } from './start-task.use-case.js'

export { CompleteTaskUseCase } from './complete-task.use-case.js'
export type { CompleteTaskInput, CompleteTaskOutput } from './complete-task.use-case.js'

export {
	ReviewTaskUseCase,
	ApproveReviewUseCase,
	RequestChangesUseCase,
} from './review-task.use-case.js'
export type { ReviewTaskInput, ReviewTaskOutput } from './review-task.use-case.js'

export { GetNextTaskUseCase } from './get-next-task.use-case.js'
export type {
	GetNextTaskInput,
	GetNextTaskOutput,
	GetNextTasksOutput,
} from './get-next-task.use-case.js'

export {
	GetCurrentTaskUseCase,
	GetTaskByIdUseCase,
	ListTasksUseCase,
} from './get-current-task.use-case.js'
export type {
	GetCurrentTaskOutput,
	ListTasksInput,
	ListTasksOutput,
} from './get-current-task.use-case.js'

export { CreateTaskUseCase } from './create-task.use-case.js'
export type { CreateTaskInput, CreateTaskOutput } from './create-task.use-case.js'

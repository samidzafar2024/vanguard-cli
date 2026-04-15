/**
 * Project Use Cases.
 *
 * Clean architecture use cases for project management operations.
 */

export { InitializeProjectUseCase } from './initialize-project.use-case.js'
export type {
	InitializeProjectInput,
	InitializeProjectOutput,
	ProjectFileWriter,
	ProjectGenerator,
} from './initialize-project.use-case.js'

export { DetectProjectUseCase } from './detect-project.use-case.js'
export type {
	DetectedProjectInfo,
	DetectProjectOutput,
	ProjectDetectorPort,
} from './detect-project.use-case.js'

export { LoadProjectUseCase, CheckProjectExistsUseCase } from './load-project.use-case.js'
export type { LoadProjectOutput, ProjectLoaderPort } from './load-project.use-case.js'

export { GetProjectContextUseCase } from './get-project-context.use-case.js'
export type { ProjectContext, GetProjectContextOutput } from './get-project-context.use-case.js'

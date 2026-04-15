/**
 * Repository ports for DDD compliance.
 *
 * These interfaces define how the application layer accesses
 * persistent data without depending on infrastructure details.
 */

import type { Architecture } from '../../domain/entities/architecture.js'
import type { IntegrationConfig } from '../../domain/entities/integration.js'
import type { Project } from '../../domain/entities/project.js'
import type { Stack } from '../../domain/entities/stack.js'

/**
 * Repository for Project aggregate.
 */
export interface ProjectRepository {
	/**
	 * Find project by directory path.
	 */
	findByPath(path: string): Promise<Project | undefined>

	/**
	 * Save project configuration.
	 */
	save(project: Project): Promise<void>

	/**
	 * Check if a project exists at path.
	 */
	exists(path: string): Promise<boolean>
}

/**
 * Repository for Architecture definitions.
 */
export interface ArchitectureRepository {
	/**
	 * Find architecture by ID.
	 */
	findById(id: string): Promise<Architecture | undefined>

	/**
	 * Get all available architectures.
	 */
	findAll(): Promise<readonly Architecture[]>

	/**
	 * Find architectures compatible with a stack.
	 */
	findByStack(stackId: string): Promise<readonly Architecture[]>

	/**
	 * Register a custom architecture (for project-local extensions).
	 */
	register(architecture: Architecture): Promise<void>
}

/**
 * Repository for Stack definitions.
 */
export interface StackRepository {
	/**
	 * Find stack by ID.
	 */
	findById(id: string): Promise<Stack | undefined>

	/**
	 * Get all available stacks.
	 */
	findAll(): Promise<readonly Stack[]>

	/**
	 * Find stacks by language.
	 */
	findByLanguage(language: string): Promise<readonly Stack[]>

	/**
	 * Register a custom stack (for project-local extensions).
	 */
	register(stack: Stack): Promise<void>
}

/**
 * Unified repository for tasks (both local and PM-integrated).
 */
export interface TaskRepository {
	/**
	 * Find task by ID.
	 */
	findById(id: string): Promise<TaskEntity | undefined>

	/**
	 * Get all tasks.
	 */
	findAll(): Promise<readonly TaskEntity[]>

	/**
	 * Find tasks by status.
	 */
	findByStatus(status: TaskStatus): Promise<readonly TaskEntity[]>

	/**
	 * Get the current active task.
	 */
	findCurrent(): Promise<TaskEntity | undefined>

	/**
	 * Get next prioritized task.
	 */
	findNext(): Promise<TaskEntity | undefined>

	/**
	 * Save task (create or update).
	 */
	save(task: TaskEntity): Promise<void>

	/**
	 * Set the current active task.
	 */
	setCurrent(taskId: string | undefined): Promise<void>
}

/**
 * Unified task status across local and PM systems.
 */
export type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done'

/**
 * Unified task entity that works for both local and PM tasks.
 */
export interface TaskEntity {
	readonly id: string
	readonly title: string
	readonly description: string
	readonly status: TaskStatus
	readonly source: 'local' | 'integration'
	readonly integrationName?: string | undefined
	readonly branchName?: string | undefined
	readonly url?: string | undefined
	readonly priority?: 'urgent' | 'high' | 'medium' | 'low' | 'none' | undefined
	readonly createdAt: string
	readonly updatedAt: string
}

/**
 * Repository for integration configurations.
 */
export interface IntegrationRepository {
	/**
	 * Find integration config by name.
	 */
	findByName(name: string): Promise<IntegrationConfig | undefined>

	/**
	 * Get all configured integrations.
	 */
	findAll(): Promise<readonly IntegrationConfig[]>

	/**
	 * Save integration configuration.
	 */
	save(config: IntegrationConfig): Promise<void>

	/**
	 * Delete integration configuration.
	 */
	delete(name: string): Promise<void>

	/**
	 * Get the default integration (if only one configured).
	 */
	findDefault(): Promise<IntegrationConfig | undefined>
}

/**
 * Repository for TechPattern definitions (future use).
 */
export interface PatternRepository {
	/**
	 * Find pattern by ID.
	 */
	findById(id: string): Promise<TechPattern | undefined>

	/**
	 * Get all available patterns.
	 */
	findAll(): Promise<readonly TechPattern[]>

	/**
	 * Find patterns applicable to a stack.
	 */
	findByStack(stackId: string): Promise<readonly TechPattern[]>

	/**
	 * Find patterns applicable to an architecture.
	 */
	findByArchitecture(architectureId: string): Promise<readonly TechPattern[]>

	/**
	 * Register a custom pattern.
	 */
	register(pattern: TechPattern): Promise<void>
}

/**
 * Tech pattern definition (placeholder for future implementation).
 */
export interface TechPattern {
	readonly id: string
	readonly name: string
	readonly description: string
	readonly applicableStacks: readonly string[]
	readonly applicableArchitectures: readonly string[]
	readonly principles: readonly string[]
	readonly antiPatterns: readonly string[]
}

/**
 * Repository for Workflow definitions and state.
 */
export interface WorkflowRepository {
	/**
	 * Find workflow by ID.
	 */
	findById(id: string): Promise<Workflow | undefined>

	/**
	 * Get all available workflows.
	 */
	findAll(): Promise<readonly Workflow[]>

	/**
	 * Get current workflow state for a feature.
	 */
	getState(feature: string): Promise<WorkflowState | undefined>

	/**
	 * Save workflow state.
	 */
	saveState(state: WorkflowState): Promise<void>

	/**
	 * List all active workflow states.
	 */
	listActiveStates(): Promise<readonly WorkflowState[]>
}

/**
 * Workflow definition for repository.
 */
export interface Workflow {
	readonly id: string
	readonly name: string
	readonly description: string
	readonly steps: readonly WorkflowStep[]
}

/**
 * Workflow step definition.
 */
export interface WorkflowStep {
	readonly id: string
	readonly name: string
	readonly description: string
}

/**
 * Workflow execution state.
 */
export interface WorkflowState {
	readonly workflowId: string
	readonly feature: string
	readonly currentStepIndex: number
	readonly stepStatuses: Record<string, 'pending' | 'in-progress' | 'completed' | 'skipped'>
	readonly outputs: Record<string, string>
	readonly startedAt: string
	readonly updatedAt: string
}

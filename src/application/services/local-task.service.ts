import { join } from 'node:path'
import { FilePath } from '../../domain/value-objects/file-path.js'
import type { FileReader } from '../ports/file-reader.js'
import type { FileWriter } from '../ports/file-writer.js'

/**
 * Local task status - mirrors PM workflow.
 */
export type LocalTaskStatus = 'todo' | 'in-progress' | 'in-review' | 'done'

/**
 * A locally tracked task (no external PM required).
 */
export interface LocalTask {
	readonly id: string
	readonly title: string
	readonly description: string
	readonly status: LocalTaskStatus
	readonly branchName?: string | undefined
	readonly createdAt: string
	readonly updatedAt: string
}

/**
 * Local task store structure.
 */
interface LocalTaskStore {
	tasks: LocalTask[]
	currentTaskId?: string | undefined
}

/**
 * Service for managing local tasks without external PM integration.
 *
 * Provides a baseline todo/in-progress/in-review/done workflow
 * that works entirely locally using .vanguard/tasks.json.
 */
export class LocalTaskService {
	private readonly storePath: FilePath
	private readonly storeDir: FilePath

	constructor(
		private readonly fileReader: FileReader,
		private readonly fileWriter: FileWriter,
		cwd: string = process.cwd(),
	) {
		this.storeDir = FilePath.create(join(cwd, '.vanguard'))
		this.storePath = FilePath.create(join(cwd, '.vanguard', 'tasks.json'))
	}

	/**
	 * Check if local task store exists.
	 */
	async hasLocalTasks(): Promise<boolean> {
		return this.fileReader.exists(this.storePath)
	}

	/**
	 * Get all local tasks.
	 */
	async getTasks(): Promise<LocalTask[]> {
		const store = await this.loadStore()
		return store.tasks
	}

	/**
	 * Get tasks by status.
	 */
	async getTasksByStatus(status: LocalTaskStatus): Promise<LocalTask[]> {
		const tasks = await this.getTasks()
		return tasks.filter((t) => t.status === status)
	}

	/**
	 * Get the current active task (in-progress).
	 */
	async getCurrentTask(): Promise<LocalTask | undefined> {
		const store = await this.loadStore()
		if (store.currentTaskId) {
			return store.tasks.find((t) => t.id === store.currentTaskId)
		}
		// Fall back to any in-progress task
		return store.tasks.find((t) => t.status === 'in-progress')
	}

	/**
	 * Get next task from todo queue.
	 */
	async getNextTask(): Promise<LocalTask | undefined> {
		const todos = await this.getTasksByStatus('todo')
		return todos[0]
	}

	/**
	 * Create a new local task.
	 */
	async createTask(title: string, description = ''): Promise<LocalTask> {
		const store = await this.loadStore()
		const now = new Date().toISOString()

		const task: LocalTask = {
			id: this.generateId(),
			title,
			description,
			status: 'todo',
			createdAt: now,
			updatedAt: now,
		}

		store.tasks.push(task)
		await this.saveStore(store)

		return task
	}

	/**
	 * Start a task - moves to in-progress.
	 */
	async startTask(taskId: string, branchName?: string): Promise<LocalTask | undefined> {
		const store = await this.loadStore()
		const task = store.tasks.find((t) => t.id === taskId)

		if (!task) {
			return undefined
		}

		const updatedTask: LocalTask = {
			...task,
			status: 'in-progress',
			branchName,
			updatedAt: new Date().toISOString(),
		}

		store.tasks = store.tasks.map((t) => (t.id === taskId ? updatedTask : t))
		store.currentTaskId = taskId
		await this.saveStore(store)

		return updatedTask
	}

	/**
	 * Move task to review.
	 */
	async startReview(taskId: string): Promise<LocalTask | undefined> {
		return this.updateStatus(taskId, 'in-review')
	}

	/**
	 * Complete a task - moves to done.
	 */
	async completeTask(taskId: string): Promise<LocalTask | undefined> {
		const store = await this.loadStore()
		const result = await this.updateStatus(taskId, 'done')

		if (result && store.currentTaskId === taskId) {
			store.currentTaskId = undefined
			await this.saveStore(store)
		}

		return result
	}

	/**
	 * Update task status.
	 */
	async updateStatus(taskId: string, status: LocalTaskStatus): Promise<LocalTask | undefined> {
		const store = await this.loadStore()
		const task = store.tasks.find((t) => t.id === taskId)

		if (!task) {
			return undefined
		}

		const updatedTask: LocalTask = {
			...task,
			status,
			updatedAt: new Date().toISOString(),
		}

		store.tasks = store.tasks.map((t) => (t.id === taskId ? updatedTask : t))
		await this.saveStore(store)

		return updatedTask
	}

	/**
	 * Get task by ID.
	 */
	async getTask(taskId: string): Promise<LocalTask | undefined> {
		const store = await this.loadStore()
		return store.tasks.find((t) => t.id === taskId)
	}

	/**
	 * Get task statistics.
	 */
	async getStats(): Promise<{ todo: number; inProgress: number; inReview: number; done: number }> {
		const tasks = await this.getTasks()
		return {
			todo: tasks.filter((t) => t.status === 'todo').length,
			inProgress: tasks.filter((t) => t.status === 'in-progress').length,
			inReview: tasks.filter((t) => t.status === 'in-review').length,
			done: tasks.filter((t) => t.status === 'done').length,
		}
	}

	// Private helpers

	private async loadStore(): Promise<LocalTaskStore> {
		const content = await this.fileReader.readOrNull(this.storePath)
		if (!content) {
			return { tasks: [] }
		}

		try {
			return JSON.parse(content) as LocalTaskStore
		} catch {
			return { tasks: [] }
		}
	}

	private async saveStore(store: LocalTaskStore): Promise<void> {
		await this.fileWriter.ensureDirectory(this.storeDir)
		await this.fileWriter.write({
			path: this.storePath,
			content: JSON.stringify(store, null, '\t'),
		})
	}

	private generateId(): string {
		return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
	}
}

import type {
	CreateTaskResult,
	ExternalProject,
	ExternalTask,
	IntegrationConfig,
	TaskComment,
	TaskCreate,
	TaskPriority,
	TaskStatus,
	TaskUpdate,
	UpdateTaskResult,
} from '../../domain/entities/integration.js'
import type { IntegrationProvider } from '../../domain/interfaces/integration-provider.js'

/**
 * ClickUp API response types.
 */
interface ClickUpTeam {
	id: string
	name: string
}

interface ClickUpSpace {
	id: string
	name: string
	statuses: Array<{ status: string; type: string }>
}

interface ClickUpFolder {
	id: string
	name: string
	lists: ClickUpList[]
}

interface ClickUpList {
	id: string
	name: string
	content?: string
	statuses?: Array<{ status: string; type: string }>
}

interface ClickUpTask {
	id: string
	custom_id?: string
	name: string
	description?: string
	status: { status: string; type: string }
	priority?: { id: string; priority: string }
	assignees?: Array<{ id: number; username: string; email: string }>
	tags?: Array<{ name: string }>
	parent?: string
	url: string
	date_created: string
	date_updated: string
	due_date?: string
	custom_fields?: Array<{ id: string; name: string; value: unknown }>
	list: { id: string; name: string }
	folder: { id: string; name: string }
	space: { id: string }
}

interface ClickUpComment {
	id: string
	comment_text: string
	user: { username: string }
	date: string
}

/**
 * ClickUp integration provider.
 *
 * Implements the IntegrationProvider interface for ClickUp's API v2.
 *
 * Setup:
 * 1. Get API token from ClickUp Settings → Apps → API Token
 * 2. Configure with workspace and list IDs
 */
export class ClickUpProvider implements IntegrationProvider {
	readonly type = 'clickup'

	private apiToken = ''
	private baseUrl = 'https://api.clickup.com/api/v2'
	private workspaceId = ''
	private statusMapping: Record<string, TaskStatus> = {}

	initialize(config: IntegrationConfig): void {
		this.apiToken = config.apiToken
		this.workspaceId = config.workspaceId
		this.statusMapping = config.statusMapping
		if (config.baseUrl) {
			this.baseUrl = config.baseUrl
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await this.fetch('/user')
			return response.ok
		} catch {
			return false
		}
	}

	async getWorkspaces(): Promise<ReadonlyArray<{ id: string; name: string }>> {
		const response = await this.fetch('/team')
		const data = (await response.json()) as { teams: ClickUpTeam[] }
		return data.teams.map((team) => ({
			id: team.id,
			name: team.name,
		}))
	}

	async getProjects(workspaceId: string): Promise<readonly ExternalProject[]> {
		// In ClickUp, projects are "Lists" which live in Spaces and Folders
		// We'll get all lists from all spaces in the workspace
		const projects: ExternalProject[] = []

		// Get spaces
		const spacesResponse = await this.fetch(`/team/${workspaceId}/space`)
		const spacesData = (await spacesResponse.json()) as { spaces: ClickUpSpace[] }

		for (const space of spacesData.spaces) {
			// Get folders in space
			const foldersResponse = await this.fetch(`/space/${space.id}/folder`)
			const foldersData = (await foldersResponse.json()) as { folders: ClickUpFolder[] }

			for (const folder of foldersData.folders) {
				for (const list of folder.lists) {
					projects.push(this.mapListToProject(list, space, folder.name))
				}
			}

			// Get folderless lists
			const listsResponse = await this.fetch(`/space/${space.id}/list`)
			const listsData = (await listsResponse.json()) as { lists: ClickUpList[] }

			for (const list of listsData.lists) {
				projects.push(this.mapListToProject(list, space))
			}
		}

		return projects
	}

	async getTasks(
		projectId: string,
		options?: {
			status?: string
			statuses?: readonly string[]
			assignee?: string
			labels?: readonly string[]
			limit?: number
			includeClosed?: boolean
		},
	): Promise<readonly ExternalTask[]> {
		const params = new URLSearchParams()

		// Support both single status and multiple statuses
		if (options?.statuses && options.statuses.length > 0) {
			for (const status of options.statuses) {
				params.append('statuses[]', status)
			}
		} else if (options?.status) {
			params.append('statuses[]', options.status)
		}
		if (options?.assignee) {
			params.append('assignees[]', options.assignee)
		}
		if (options?.labels) {
			for (const label of options.labels) {
				params.append('tags[]', label)
			}
		}
		if (options?.limit) {
			params.append('page_size', options.limit.toString())
		}
		// ClickUp excludes closed tasks by default
		if (options?.includeClosed) {
			params.append('include_closed', 'true')
		}

		const queryString = params.toString()
		const url = `/list/${projectId}/task${queryString ? `?${queryString}` : ''}`

		const response = await this.fetch(url)
		const data = (await response.json()) as { tasks: ClickUpTask[] }

		return data.tasks.map((task) => this.mapTask(task))
	}

	/**
	 * Normalize task ID to API format.
	 *
	 * ClickUp displays IDs as "CU-abc123" but the API expects just the raw ID.
	 * The raw ID is typically prefixed with "86a" internally.
	 *
	 * Learning: Display format (CU-xxx) vs API format (86axxx)
	 */
	normalizeTaskId(taskId: string): string {
		// Remove CU- prefix if present (case insensitive)
		if (taskId.toLowerCase().startsWith('cu-')) {
			return taskId.slice(3)
		}
		return taskId
	}

	async getTask(taskId: string): Promise<ExternalTask | undefined> {
		try {
			const normalizedId = this.normalizeTaskId(taskId)
			const response = await this.fetch(`/task/${normalizedId}`)
			if (!response.ok) {
				return undefined
			}
			const task = (await response.json()) as ClickUpTask
			return this.mapTask(task)
		} catch {
			return undefined
		}
	}

	async searchTasks(query: string, projectId?: string): Promise<readonly ExternalTask[]> {
		// ClickUp search is workspace-wide
		const params = new URLSearchParams({
			query,
			team_id: this.workspaceId,
		})

		if (projectId) {
			params.append('list_ids[]', projectId)
		}

		const response = await this.fetch(`/team/${this.workspaceId}/task?${params.toString()}`)
		const data = (await response.json()) as { tasks: ClickUpTask[] }

		return data.tasks.map((task) => this.mapTask(task))
	}

	async createTask(projectId: string, task: TaskCreate): Promise<CreateTaskResult> {
		try {
			const body: Record<string, unknown> = {
				name: task.title,
			}

			if (task.description) {
				body.description = task.description
			}
			if (task.status) {
				body.status = task.status
			}
			if (task.priority) {
				body.priority = this.mapPriorityToClickUp(task.priority)
			}
			if (task.assignee) {
				// Would need to look up user ID - for now, skip
			}
			if (task.labels && task.labels.length > 0) {
				body.tags = task.labels
			}
			if (task.dueDate) {
				body.due_date = new Date(task.dueDate).getTime()
			}
			if (task.parentId) {
				body.parent = task.parentId
			}

			const response = await this.fetch(`/list/${projectId}/task`, {
				method: 'POST',
				body: JSON.stringify(body),
			})

			if (!response.ok) {
				const error = await response.text()
				return {
					task: {} as ExternalTask,
					success: false,
					error: `Failed to create task: ${error}`,
				}
			}

			const createdTask = (await response.json()) as ClickUpTask
			return {
				task: this.mapTask(createdTask),
				success: true,
			}
		} catch (err) {
			return {
				task: {} as ExternalTask,
				success: false,
				error: `Failed to create task: ${err}`,
			}
		}
	}

	async updateTask(taskId: string, update: TaskUpdate): Promise<UpdateTaskResult> {
		try {
			const normalizedId = this.normalizeTaskId(taskId)
			const body: Record<string, unknown> = {}

			if (update.title) {
				body.name = update.title
			}
			if (update.description) {
				body.description = update.description
			}
			if (update.status) {
				body.status = update.status
			}
			if (update.priority) {
				body.priority = this.mapPriorityToClickUp(update.priority)
			}
			if (update.labels) {
				body.tags = update.labels
			}
			if (update.dueDate) {
				body.due_date = new Date(update.dueDate).getTime()
			}

			const response = await this.fetch(`/task/${normalizedId}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			})

			if (!response.ok) {
				const error = await response.text()
				return {
					task: {} as ExternalTask,
					success: false,
					error: `Failed to update task: ${error}`,
				}
			}

			const updatedTask = (await response.json()) as ClickUpTask
			return {
				task: this.mapTask(updatedTask),
				success: true,
			}
		} catch (err) {
			return {
				task: {} as ExternalTask,
				success: false,
				error: `Failed to update task: ${err}`,
			}
		}
	}

	async addComment(taskId: string, comment: TaskComment): Promise<boolean> {
		try {
			const normalizedId = this.normalizeTaskId(taskId)
			const response = await this.fetch(`/task/${normalizedId}/comment`, {
				method: 'POST',
				body: JSON.stringify({
					comment_text: comment.text,
				}),
			})

			return response.ok
		} catch {
			return false
		}
	}

	async getComments(taskId: string): Promise<
		ReadonlyArray<{
			id: string
			text: string
			author: string
			createdAt: string
		}>
	> {
		const normalizedId = this.normalizeTaskId(taskId)
		const response = await this.fetch(`/task/${normalizedId}/comment`)
		const data = (await response.json()) as { comments: ClickUpComment[] }

		return data.comments.map((comment) => ({
			id: comment.id,
			text: comment.comment_text,
			author: comment.user.username,
			createdAt: new Date(Number.parseInt(comment.date)).toISOString(),
		}))
	}

	async getStatuses(projectId: string): Promise<readonly string[]> {
		const response = await this.fetch(`/list/${projectId}`)
		const list = (await response.json()) as ClickUpList

		return list.statuses?.map((s) => s.status) ?? []
	}

	/**
	 * Make an authenticated request to the ClickUp API.
	 */
	private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
		const url = `${this.baseUrl}${path}`

		const headers: Record<string, string> = {
			Authorization: this.apiToken,
			'Content-Type': 'application/json',
			...(options.headers as Record<string, string>),
		}

		return fetch(url, {
			...options,
			headers,
		})
	}

	/**
	 * Map a ClickUp task to our normalized ExternalTask.
	 */
	private mapTask(task: ClickUpTask): ExternalTask {
		const customFields: Record<string, unknown> = {}
		if (task.custom_fields) {
			for (const field of task.custom_fields) {
				customFields[field.name] = field.value
			}
		}

		return {
			id: task.id,
			// Use full API ID for key - truncated IDs can't be used for lookups
			key: task.custom_id ?? task.id,
			title: task.name,
			description: task.description ?? '',
			status: this.mapStatus(task.status.status),
			originalStatus: task.status.status,
			priority: this.mapPriority(task.priority?.priority),
			assignee: task.assignees?.[0]?.username,
			labels: task.tags?.map((t) => t.name) ?? [],
			parentId: task.parent,
			url: task.url,
			createdAt: new Date(Number.parseInt(task.date_created)).toISOString(),
			updatedAt: new Date(Number.parseInt(task.date_updated)).toISOString(),
			dueDate: task.due_date ? new Date(Number.parseInt(task.due_date)).toISOString() : undefined,
			customFields,
			raw: task,
		}
	}

	/**
	 * Map a ClickUp list to our normalized ExternalProject.
	 */
	private mapListToProject(
		list: ClickUpList,
		space: ClickUpSpace,
		folderName?: string,
	): ExternalProject {
		const name = folderName
			? `${space.name} / ${folderName} / ${list.name}`
			: `${space.name} / ${list.name}`

		return {
			id: list.id,
			name,
			description: list.content,
			url: `https://app.clickup.com/${this.workspaceId}/v/li/${list.id}`,
			statuses: list.statuses?.map((s) => s.status) ?? space.statuses.map((s) => s.status),
		}
	}

	/**
	 * Map ClickUp status to normalized status.
	 */
	private mapStatus(clickUpStatus: string): TaskStatus {
		// Check custom mapping first
		if (this.statusMapping[clickUpStatus]) {
			return this.statusMapping[clickUpStatus]
		}

		// Default mappings
		const lower = clickUpStatus.toLowerCase()

		if (lower.includes('backlog')) return 'backlog'
		if (lower.includes('to do') || lower === 'open') return 'todo'
		if (lower.includes('progress') || lower.includes('doing')) return 'in-progress'
		if (lower.includes('review')) return 'in-review'
		if (lower.includes('done') || lower.includes('complete') || lower.includes('closed'))
			return 'done'
		if (lower.includes('block')) return 'blocked'
		if (lower.includes('cancel')) return 'cancelled'

		return 'todo'
	}

	/**
	 * Map ClickUp priority to normalized priority.
	 */
	private mapPriority(clickUpPriority?: string): TaskPriority {
		if (!clickUpPriority) return 'none'

		const lower = clickUpPriority.toLowerCase()

		if (lower === 'urgent') return 'urgent'
		if (lower === 'high') return 'high'
		if (lower === 'normal') return 'medium'
		if (lower === 'low') return 'low'

		return 'none'
	}

	/**
	 * Map normalized priority to ClickUp priority ID.
	 */
	private mapPriorityToClickUp(priority: TaskPriority): number {
		switch (priority) {
			case 'urgent':
				return 1
			case 'high':
				return 2
			case 'medium':
				return 3
			case 'low':
				return 4
			default:
				return 0 // No priority
		}
	}
}

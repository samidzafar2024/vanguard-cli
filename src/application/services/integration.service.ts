import * as path from 'node:path'
import type {
	BranchNamingConfig,
	ExternalProject,
	ExternalTask,
	IntegrationConfig,
	TaskCreate,
	TaskStatus,
	TaskUpdate,
} from '../../domain/entities/integration.js'
import {
	DEFAULT_BRANCH_NAMING,
	extractTaskKeyFromBranch,
	generateBranchName,
} from '../../domain/entities/integration.js'
import type {
	IntegrationProvider,
	IntegrationProviderFactory,
} from '../../domain/interfaces/integration-provider.js'
import { FilePath } from '../../domain/value-objects/file-path.js'
import {
	ensureEnvInGitignore,
	loadEnvFile,
	writeEnvEntry,
} from '../../infrastructure/utils/dotenv.js'
import {
	createEnvVarReference,
	generateEnvVarName,
	isEnvVarReference,
	resolveEnvVarReference,
} from '../../infrastructure/utils/env-token.js'
import type { FileReader } from '../ports/file-reader.js'
import type { FileWriter } from '../ports/file-writer.js'
import type { GitService } from '../ports/git-service.js'

/**
 * Result of starting work on a task.
 */
export interface StartTaskResult {
	readonly task: ExternalTask
	readonly branchName: string
	readonly success: boolean
	readonly error?: string | undefined
}

/**
 * Active task context for the current working session.
 */
export interface ActiveTaskContext {
	readonly task: ExternalTask
	readonly integration: string
	readonly branchName: string
	readonly startedAt: string
	readonly specPath?: string | undefined
}

/**
 * Service for managing project management integrations.
 *
 * Provides high-level operations for agents to work with external PM tools:
 * - Start work on a task (claim + create branch)
 * - Update task status and add comments
 * - Sync task with spec documents
 * - List available tasks
 */
export class IntegrationService {
	private readonly providerFactory: IntegrationProviderFactory
	private readonly providers = new Map<string, IntegrationProvider>()
	private readonly configDir: string
	private readonly projectRoot: string
	private readonly branchNaming: BranchNamingConfig

	constructor(
		providerFactory: IntegrationProviderFactory,
		private readonly fileReader: FileReader,
		private readonly fileWriter: FileWriter,
		private readonly gitService: GitService,
		vanguardDir = '.vanguard',
		branchNaming: BranchNamingConfig = DEFAULT_BRANCH_NAMING,
	) {
		this.providerFactory = providerFactory
		this.projectRoot = path.resolve(path.dirname(vanguardDir))
		this.configDir = path.join(vanguardDir, 'integrations')
		this.branchNaming = branchNaming
	}

	/**
	 * Initialize integrations from saved configuration.
	 */
	async initialize(): Promise<void> {
		const configs = await this.loadConfigurations()
		for (const config of configs) {
			if (config.enabled) {
				this.initializeProvider(config)
			}
		}
	}

	/**
	 * Add a new integration configuration.
	 *
	 * The raw API token is used to test the connection, then stored
	 * in the project's .env file. The JSON config stores an env var
	 * reference (env:VANGUARD_{NAME}_TOKEN) instead of the raw token.
	 */
	async addIntegration(config: IntegrationConfig): Promise<boolean> {
		if (!this.providerFactory.supports(config.type)) {
			throw new Error(`Unsupported integration type: ${config.type}`)
		}

		// Test connection with the real token before saving
		const provider = this.providerFactory.create(config.type, config)
		const connected = await provider.testConnection()
		if (!connected) {
			throw new Error(`Failed to connect to ${config.type}. Please check your credentials.`)
		}

		// Obfuscate: store token in .env, save reference in config JSON
		const envVarName = generateEnvVarName(config.name)
		const envPath = path.join(this.projectRoot, '.env')

		ensureEnvInGitignore(this.projectRoot)
		writeEnvEntry(envPath, envVarName, config.apiToken)

		const obfuscatedConfig: IntegrationConfig = {
			...config,
			apiToken: createEnvVarReference(envVarName),
		}
		await this.saveConfiguration(obfuscatedConfig)

		// Store provider with real token for current session
		this.providers.set(config.name, provider)

		return true
	}

	/**
	 * Remove an integration.
	 */
	async removeIntegration(name: string): Promise<boolean> {
		const configPath = FilePath.create(path.join(this.configDir, `${name}.json`))
		const exists = await this.fileReader.exists(configPath)

		if (exists) {
			await this.fileWriter.delete(configPath)
			this.providers.delete(name)
			return true
		}

		return false
	}

	/**
	 * Get all configured integrations.
	 */
	async getIntegrations(): Promise<readonly IntegrationConfig[]> {
		return this.loadConfigurations()
	}

	/**
	 * Get a provider by integration name.
	 */
	getProvider(name: string): IntegrationProvider | undefined {
		return this.providers.get(name)
	}

	/**
	 * List available workspaces for an integration type.
	 */
	async listWorkspaces(
		type: string,
		apiToken: string,
		baseUrl?: string,
	): Promise<ReadonlyArray<{ id: string; name: string }>> {
		const config: IntegrationConfig = {
			type: type as IntegrationConfig['type'],
			name: 'temp',
			apiToken,
			baseUrl,
			workspaceId: '',
			projectId: '',
			statusMapping: {},
			enabled: false,
		}

		const provider = this.providerFactory.create(type, config)
		return provider.getWorkspaces()
	}

	/**
	 * List projects in a workspace.
	 */
	async listProjects(
		type: string,
		apiToken: string,
		workspaceId: string,
		baseUrl?: string,
	): Promise<readonly ExternalProject[]> {
		const config: IntegrationConfig = {
			type: type as IntegrationConfig['type'],
			name: 'temp',
			apiToken,
			baseUrl,
			workspaceId,
			projectId: '',
			statusMapping: {},
			enabled: false,
		}

		const provider = this.providerFactory.create(type, config)
		return provider.getProjects(workspaceId)
	}

	/**
	 * Get available tasks from an integration.
	 */
	async getAvailableTasks(
		integrationName: string,
		options?: {
			status?: string
			assignee?: string
			labels?: readonly string[]
			limit?: number
		},
	): Promise<readonly ExternalTask[]> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			throw new Error(`Integration not found: ${integrationName}`)
		}

		const config = await this.getConfiguration(integrationName)
		if (!config) {
			throw new Error(`Configuration not found for: ${integrationName}`)
		}

		return provider.getTasks(config.projectId, options)
	}

	/**
	 * Search tasks across an integration.
	 */
	async searchTasks(integrationName: string, query: string): Promise<readonly ExternalTask[]> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			throw new Error(`Integration not found: ${integrationName}`)
		}

		const config = await this.getConfiguration(integrationName)
		return provider.searchTasks(query, config?.projectId)
	}

	/**
	 * Get a specific task by ID.
	 */
	async getTask(integrationName: string, taskId: string): Promise<ExternalTask | undefined> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			throw new Error(`Integration not found: ${integrationName}`)
		}

		return provider.getTask(taskId)
	}

	/**
	 * Start working on a task.
	 *
	 * This will:
	 * 1. Fetch the task details
	 * 2. Generate a branch name
	 * 3. Create a local git branch
	 * 4. Optionally update task status to "in-progress"
	 * 5. Save active task context
	 */
	async startTask(
		integrationName: string,
		taskId: string,
		options?: {
			updateStatus?: boolean
			inProgressStatus?: string
		},
	): Promise<StartTaskResult> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			return {
				task: {} as ExternalTask,
				branchName: '',
				success: false,
				error: `Integration not found: ${integrationName}`,
			}
		}

		const task = await provider.getTask(taskId)
		if (!task) {
			return {
				task: {} as ExternalTask,
				branchName: '',
				success: false,
				error: `Task not found: ${taskId}`,
			}
		}

		const branchName = generateBranchName(task, this.branchNaming)

		// Create git branch
		const branchCreated = await this.createGitBranch(branchName)
		if (!branchCreated.success) {
			return {
				task,
				branchName,
				success: false,
				error: branchCreated.error,
			}
		}

		// Update task status if requested
		if (options?.updateStatus) {
			const status = options.inProgressStatus ?? 'in progress'
			await provider.updateTask(taskId, { status })
		}

		// Save active task context
		const context: ActiveTaskContext = {
			task,
			integration: integrationName,
			branchName,
			startedAt: new Date().toISOString(),
		}
		await this.saveActiveTask(context)

		return {
			task,
			branchName,
			success: true,
		}
	}

	/**
	 * Update a task in the PM tool.
	 */
	async updateTask(
		integrationName: string,
		taskId: string,
		update: TaskUpdate,
	): Promise<{ success: boolean; error?: string }> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			return { success: false, error: `Integration not found: ${integrationName}` }
		}

		const result = await provider.updateTask(taskId, update)
		if (result.error) {
			return { success: result.success, error: result.error }
		}
		return { success: result.success }
	}

	/**
	 * Create a new task in the PM tool.
	 */
	async createTask(
		integrationName: string,
		task: TaskCreate,
	): Promise<{ task?: ExternalTask; success: boolean; error?: string }> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			return { success: false, error: `Integration not found: ${integrationName}` }
		}

		const config = await this.getConfiguration(integrationName)
		if (!config) {
			return { success: false, error: `Configuration not found for: ${integrationName}` }
		}

		const result = await provider.createTask(config.projectId, task)
		if (result.error) {
			return { task: result.task, success: result.success, error: result.error }
		}
		return { task: result.task, success: result.success }
	}

	/**
	 * Add a comment to a task.
	 */
	async addComment(integrationName: string, taskId: string, comment: string): Promise<boolean> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			return false
		}

		return provider.addComment(taskId, { text: comment })
	}

	/**
	 * Complete work on the active task.
	 *
	 * This will:
	 * 1. Update task status to done/complete
	 * 2. Add a completion comment
	 * 3. Clear active task context
	 */
	async completeTask(
		integrationName: string,
		taskId: string,
		options?: {
			completedStatus?: string
			comment?: string
		},
	): Promise<{ success: boolean; error?: string }> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			return { success: false, error: `Integration not found: ${integrationName}` }
		}

		// Update status
		const status = options?.completedStatus ?? 'done'
		const updateResult = await provider.updateTask(taskId, { status })

		if (!updateResult.success) {
			if (updateResult.error) {
				return { success: false, error: updateResult.error }
			}
			return { success: false, error: 'Failed to update task status' }
		}

		// Add completion comment if provided
		if (options?.comment) {
			await provider.addComment(taskId, { text: options.comment })
		}

		// Clear active task
		await this.clearActiveTask()

		return { success: true }
	}

	/**
	 * Get the currently active task.
	 */
	async getActiveTask(): Promise<ActiveTaskContext | undefined> {
		const activePath = FilePath.create(path.join(this.configDir, 'active-task.json'))
		const content = await this.fileReader.readOrNull(activePath)

		if (!content) {
			return undefined
		}

		return JSON.parse(content) as ActiveTaskContext
	}

	/**
	 * Get task from current git branch name.
	 */
	async getTaskFromCurrentBranch(integrationName: string): Promise<ExternalTask | undefined> {
		const branchName = await this.gitService.getCurrentBranch()
		if (!branchName) {
			return undefined
		}

		const taskKey = extractTaskKeyFromBranch(branchName)
		if (!taskKey) {
			return undefined
		}

		const tasks = await this.searchTasks(integrationName, taskKey)
		return tasks[0]
	}

	/**
	 * Get available statuses for a project.
	 */
	async getStatuses(integrationName: string): Promise<readonly string[]> {
		const provider = this.getProvider(integrationName)
		if (!provider) {
			return []
		}

		const config = await this.getConfiguration(integrationName)
		if (!config) {
			return []
		}

		return provider.getStatuses(config.projectId)
	}

	/**
	 * Get supported integration types.
	 */
	getSupportedTypes(): readonly string[] {
		return this.providerFactory.getSupportedTypes()
	}

	/**
	 * Build default status mapping for an integration type.
	 */
	buildDefaultStatusMapping(
		_type: string,
		statuses: readonly string[],
	): Record<string, TaskStatus> {
		const mapping: Record<string, TaskStatus> = {}

		for (const status of statuses) {
			mapping[status] = this.inferTaskStatus(status.toLowerCase())
		}

		return mapping
	}

	private inferTaskStatus(lower: string): TaskStatus {
		const statusPatterns: Array<{ patterns: string[]; status: TaskStatus }> = [
			{ patterns: ['backlog'], status: 'backlog' },
			{ patterns: ['to do', 'open', 'todo'], status: 'todo' },
			{ patterns: ['progress', 'doing'], status: 'in-progress' },
			{ patterns: ['review'], status: 'in-review' },
			{ patterns: ['done', 'complete', 'closed'], status: 'done' },
			{ patterns: ['block'], status: 'blocked' },
			{ patterns: ['cancel'], status: 'cancelled' },
		]

		for (const { patterns, status } of statusPatterns) {
			if (patterns.some((p) => lower.includes(p) || lower === p)) {
				return status
			}
		}

		return 'todo'
	}

	// Private helpers

	private initializeProvider(config: IntegrationConfig): void {
		const provider = this.providerFactory.create(config.type, config)
		this.providers.set(config.name, provider)
	}

	private async loadConfigurations(): Promise<IntegrationConfig[]> {
		const configDirPath = FilePath.create(this.configDir)
		const dirExists = await this.fileReader.exists(configDirPath)
		if (!dirExists) {
			return []
		}

		// Load .env file so env var references can be resolved
		const envPath = path.join(this.projectRoot, '.env')
		loadEnvFile(envPath)

		const files = await this.fileReader.listFiles(configDirPath)
		const jsonFiles = files.filter((f) => f.endsWith('.json'))
		const resolvedConfigs: IntegrationConfig[] = []

		for (const file of jsonFiles) {
			if (file === 'active-task.json') continue

			const filePath = FilePath.create(path.join(this.configDir, file))
			const content = await this.fileReader.readOrNull(filePath)
			if (!content) continue

			const config = JSON.parse(content) as IntegrationConfig

			if (isEnvVarReference(config.apiToken)) {
				// Resolve env var reference to real token
				try {
					const resolvedToken = resolveEnvVarReference(config.apiToken)
					resolvedConfigs.push({ ...config, apiToken: resolvedToken })
				} catch {
					console.warn(
						`Integration "${config.name}" requires env var ${config.apiToken.slice(4)}. Set it in your .env file or environment.`,
					)
				}
			} else {
				// Plain text token — auto-migrate to env var reference
				const envVarName = generateEnvVarName(config.name)
				ensureEnvInGitignore(this.projectRoot)
				writeEnvEntry(envPath, envVarName, config.apiToken)

				const migratedConfig: IntegrationConfig = {
					...config,
					apiToken: createEnvVarReference(envVarName),
				}
				await this.saveConfiguration(migratedConfig)

				console.warn(
					`\n⚠  Integration "${config.name}" had a plain text API token.\n   It has been moved to .env as ${envVarName}.\n   If this file was previously shared via git or other means,\n   consider rotating your API key.\n`,
				)

				// Use the real token in memory for this session
				resolvedConfigs.push(config)
			}
		}

		return resolvedConfigs
	}

	private async getConfiguration(name: string): Promise<IntegrationConfig | undefined> {
		const configPath = FilePath.create(path.join(this.configDir, `${name}.json`))
		const content = await this.fileReader.readOrNull(configPath)

		if (!content) {
			return undefined
		}

		const config = JSON.parse(content) as IntegrationConfig

		// Resolve env var reference if present
		if (isEnvVarReference(config.apiToken)) {
			const envPath = path.join(this.projectRoot, '.env')
			loadEnvFile(envPath)
			try {
				const resolvedToken = resolveEnvVarReference(config.apiToken)
				return { ...config, apiToken: resolvedToken }
			} catch {
				console.warn(
					`Integration "${config.name}" requires env var ${config.apiToken.slice(4)}. Set it in your .env file or environment.`,
				)
				return undefined
			}
		}

		return config
	}

	private async saveConfiguration(config: IntegrationConfig): Promise<void> {
		const configDirPath = FilePath.create(this.configDir)
		await this.fileWriter.ensureDirectory(configDirPath)

		const configPath = FilePath.create(path.join(this.configDir, `${config.name}.json`))
		await this.fileWriter.write({
			path: configPath,
			content: JSON.stringify(config, null, 2),
		})
	}

	private async saveActiveTask(context: ActiveTaskContext): Promise<void> {
		const configDirPath = FilePath.create(this.configDir)
		await this.fileWriter.ensureDirectory(configDirPath)

		const activePath = FilePath.create(path.join(this.configDir, 'active-task.json'))
		await this.fileWriter.write({
			path: activePath,
			content: JSON.stringify(context, null, 2),
		})
	}

	private async clearActiveTask(): Promise<void> {
		const activePath = FilePath.create(path.join(this.configDir, 'active-task.json'))
		await this.fileWriter.delete(activePath)
	}

	private async createGitBranch(branchName: string): Promise<{ success: boolean; error?: string }> {
		try {
			const exists = await this.gitService.branchExists(branchName)
			if (exists) {
				await this.gitService.checkoutBranch(branchName)
			} else {
				await this.gitService.createBranch(branchName)
			}

			return { success: true }
		} catch (err) {
			return {
				success: false,
				error: `Failed to create/checkout branch: ${err}`,
			}
		}
	}
}

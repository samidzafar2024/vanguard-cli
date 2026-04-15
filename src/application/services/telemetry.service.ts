/**
 * Telemetry Service - Collects and syncs telemetry data
 *
 * Handles:
 * - Git log collection
 * - Claude session message parsing
 * - Batch creation and transmission
 */

import { createHash, randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { FilePath } from '../../domain/value-objects/file-path.js'
import { authRepository } from '../../infrastructure/repositories/auth.repository.js'
import type { FileReader } from '../ports/file-reader.js'
import type { GitService } from '../ports/git-service.js'

export interface TelemetryEvent {
	eventId: string
	timestamp: string
	sessionId: string
	projectName?: string
	projectPath?: string
	gitBranch?: string
	eventType: 'message' | 'commit' | 'tool_call' | 'phase' | 'file_change' | 'error'
	eventSubtype?: string
	eventSource: 'claude' | 'git' | 'cursor' | 'copilot'
	phase?: string
	persona?: string
	detectionMethod?: string
	detectionConfidence?: number
	messageUuid?: string
	commitSha?: string
	toolCallId?: string
	inputTokens?: number
	outputTokens?: number
	cacheReadTokens?: number
	cacheWriteTokens?: number
	linesAdded?: number
	linesRemoved?: number
	filesChanged?: number
	durationMs?: number
	provider?: string
	model?: string
	attributes?: Record<string, unknown>
}

export interface TelemetryBatch {
	apiKey?: string
	clientVersion: string
	clientOs: string
	machineId: string
	batchId: string
	batchTimestamp: string
	eventCount: number
	compressedSize?: number
	checksum: string
	events: TelemetryEvent[]
}

export interface SyncResult {
	success: boolean
	eventsCollected: number
	eventsInserted: number
	eventsDeduplicated: number
	errors: string[]
}

interface IngestApiResponse {
	success: boolean
	batchId: string
	eventsReceived: number
	eventsInserted: number
	eventsDeduplicated: number
	embeddingsReceived: number
	embeddingsInserted: number
	rateLimitRemaining: number
	rateLimitResetAt: string
	errors?: Array<{ eventId?: string; code: string; message: string }>
}

// Vanguard phase detection patterns
const VANGUARD_COMMAND_PATTERNS = [
	{
		pattern: /<command-name>\/?(vanguard.discover|vanguard:agents:analyst)<\/command-name>/i,
		phase: 'discover',
		persona: 'analyst',
	},
	{
		pattern: /<command-name>\/?(vanguard.specify|vanguard:agents:pm)<\/command-name>/i,
		phase: 'specify',
		persona: 'pm',
	},
	{
		pattern: /<command-name>\/?(vanguard.architect|vanguard:agents:architect)<\/command-name>/i,
		phase: 'architect',
		persona: 'architect',
	},
	{
		pattern: /<command-name>\/?(vanguard.plan|vanguard:agents:sm)<\/command-name>/i,
		phase: 'plan',
		persona: 'sm',
	},
	{
		pattern: /<command-name>\/?(vanguard.implement|vanguard:agents:dev)<\/command-name>/i,
		phase: 'implement',
		persona: 'dev',
	},
	{
		pattern: /<command-name>\/?(vanguard.review|vanguard:agents:qa)<\/command-name>/i,
		phase: 'review',
		persona: 'qa',
	},
	{
		pattern: /<command-name>\/?(vanguard.brainstorm|vanguard:agents:brainstorm)<\/command-name>/i,
		phase: 'brainstorm',
		persona: 'brainstorm',
	},
	{
		pattern: /<command-name>\/?(vanguard.constitute)<\/command-name>/i,
		phase: 'constitute',
		persona: null,
	},
	{
		pattern: /<command-name>\/?(vanguard.clarify)<\/command-name>/i,
		phase: 'clarify',
		persona: null,
	},
	{
		pattern: /<command-name>\/?(vanguard.extend|vanguard:agents:modarch)<\/command-name>/i,
		phase: 'extend',
		persona: 'modarch',
	},
]

export class TelemetryService {
	private projectPath: string
	private projectName: string | undefined
	private clientVersion: string

	constructor(
		projectPath: string,
		clientVersion: string,
		private readonly fileReader: FileReader,
		private readonly gitService: GitService,
	) {
		this.projectPath = projectPath
		this.clientVersion = clientVersion
	}

	/**
	 * Load project name from vanguard.manifest.yaml if it exists,
	 * otherwise fall back to the directory name.
	 */
	private async getProjectName(): Promise<string> {
		if (this.projectName) return this.projectName

		try {
			const manifestPath = FilePath.create(path.join(this.projectPath, 'vanguard.manifest.yaml'))
			const content = await this.fileReader.readOrNull(manifestPath)
			if (content) {
				const manifest = parseYaml(content) as { project?: { name?: string } }
				if (manifest?.project?.name) {
					this.projectName = manifest.project.name
					return this.projectName
				}
			}
		} catch {
			// Fall through to default
		}
		// Normalize directory name: convert underscores to hyphens for consistency
		this.projectName = path.basename(this.projectPath).replace(/_/g, '-')
		return this.projectName
	}

	/**
	 * Collect all telemetry from git logs and Claude sessions
	 */
	async collectAll(options?: {
		onProgress?: (phase: string, current: number, total: number) => void
	}): Promise<TelemetryEvent[]> {
		const events: TelemetryEvent[] = []

		// Collect git commits
		options?.onProgress?.('git', 0, 1)
		const commits = await this.collectGitCommits()
		events.push(...commits)
		options?.onProgress?.('git', 1, 1)

		// Collect Claude sessions
		options?.onProgress?.('claude', 0, 1)
		const sessions = await this.collectClaudeSessions(options)
		events.push(...sessions)
		options?.onProgress?.('claude', 1, 1)

		// Sort by timestamp
		events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

		return events
	}

	/**
	 * Collect git commit events
	 */
	async collectGitCommits(): Promise<TelemetryEvent[]> {
		const events: TelemetryEvent[] = []

		try {
			// Check if this is a git repo
			const gitDir = FilePath.create(path.join(this.projectPath, '.git'))
			if (!(await this.fileReader.exists(gitDir))) {
				return events
			}

			// Get git log with stats
			const log = await this.gitService.getLogWithNumstat()

			let currentCommit: {
				sha: string
				timestamp: string
				author: string
				email: string
				message: string
				linesAdded: number
				linesRemoved: number
				filesChanged: number
			} | null = null

			for (const line of log.split('\n')) {
				if (line.includes('|') && line.split('|').length >= 5) {
					// Save previous commit
					if (currentCommit) {
						events.push(await this.commitToEvent(currentCommit))
					}

					// Parse new commit
					const parts = line.split('|')
					const sha = parts[0] ?? ''
					const timestamp = parts[1] ?? ''
					const author = parts[2] ?? ''
					const email = parts[3] ?? ''
					const message = parts.slice(4).join('|')
					currentCommit = {
						sha,
						timestamp,
						author,
						email,
						message,
						linesAdded: 0,
						linesRemoved: 0,
						filesChanged: 0,
					}
				} else if (currentCommit && line.trim()) {
					// Parse numstat line (added \t removed \t filename)
					const statParts = line.split('\t')
					if (statParts.length >= 2) {
						const added = Number.parseInt(statParts[0] ?? '0', 10)
						const removed = Number.parseInt(statParts[1] ?? '0', 10)
						if (!Number.isNaN(added)) currentCommit.linesAdded += added
						if (!Number.isNaN(removed)) currentCommit.linesRemoved += removed
						currentCommit.filesChanged++
					}
				}
			}

			// Save last commit
			if (currentCommit) {
				events.push(await this.commitToEvent(currentCommit))
			}

			// Get current branch
			const branch = await this.gitService.getCurrentBranch()

			// Tag all events with branch
			if (branch) {
				for (const event of events) {
					event.gitBranch = branch
				}
			}
		} catch {
			// Git not available or not a repo
		}

		return events
	}

	/**
	 * Collect Claude session events from JSONL files
	 */
	async collectClaudeSessions(options?: {
		onProgress?: (phase: string, current: number, total: number) => void
	}): Promise<TelemetryEvent[]> {
		const events: TelemetryEvent[] = []

		try {
			// Find Claude session files
			// Standard location: ~/.claude/projects/{project-path-hash}/*.jsonl
			const claudeDir = FilePath.create(path.join(os.homedir(), '.claude', 'projects'))

			if (!(await this.fileReader.exists(claudeDir))) {
				return events
			}

			// Look for project directories that might match this project
			const projectDirs = await this.fileReader.listFiles(claudeDir)

			// First pass: collect all matching JSONL files
			const allFiles: { sessionDir: string; file: string }[] = []
			for (const dir of projectDirs) {
				// Check if this directory is for our project
				// The format is typically: -Users-username-projects-projectname
				// Note: Claude Code normalizes underscores to hyphens in directory names
				const projectBasename = path.basename(this.projectPath)
				const normalizedBasename = projectBasename.replace(/_/g, '-')

				if (!dir.includes(projectBasename) && !dir.includes(normalizedBasename)) {
					continue
				}

				const sessionDir = path.join(os.homedir(), '.claude', 'projects', dir)
				const sessionDirPath = FilePath.create(sessionDir)
				const dirFiles = await this.fileReader.listFiles(sessionDirPath)
				const jsonlFiles = dirFiles.filter((f) => f.endsWith('.jsonl'))

				for (const file of jsonlFiles) {
					allFiles.push({ sessionDir, file })
				}
			}

			// Second pass: process files with progress reporting
			for (let i = 0; i < allFiles.length; i++) {
				const entry = allFiles[i]
				if (!entry) continue
				const { sessionDir, file } = entry
				const sessionId = path.basename(file, '.jsonl')
				const filePath = FilePath.create(path.join(sessionDir, file))

				// Report progress per file
				options?.onProgress?.('sessions', i, allFiles.length)

				try {
					const content = await this.fileReader.read(filePath)
					const lines = content.split('\n').filter(Boolean)

					for (const line of lines) {
						try {
							const entry = JSON.parse(line)
							const event = await this.parseClaudeEntry(entry, sessionId)
							if (event) {
								events.push(event)
							}
						} catch {
							// Skip malformed lines
						}
					}
				} catch {
					// Skip unreadable files
				}
			}

			// Final progress update
			if (allFiles.length > 0) {
				options?.onProgress?.('sessions', allFiles.length, allFiles.length)
			}
		} catch {
			// Claude directory not found
		}

		return events
	}

	/**
	 * Create and send telemetry batches
	 * Events are chunked to avoid exceeding API body size limits
	 */
	async sync(options?: {
		onBatchProgress?: (sent: number, total: number) => void
		onCollectProgress?: (phase: string, current: number, total: number) => void
	}): Promise<SyncResult> {
		// Check if authenticated
		const accessToken = await authRepository.getAccessToken()
		const apiEndpoint = await authRepository.getApiEndpoint()

		if (!accessToken || !apiEndpoint) {
			return {
				success: false,
				eventsCollected: 0,
				eventsInserted: 0,
				eventsDeduplicated: 0,
				errors: ['Not authenticated. Run `vanguard login` first.'],
			}
		}

		// Collect events with progress reporting
		const collectOptions = options?.onCollectProgress
			? { onProgress: options.onCollectProgress }
			: undefined
		const events = await this.collectAll(collectOptions)

		if (events.length === 0) {
			return {
				success: true,
				eventsCollected: 0,
				eventsInserted: 0,
				eventsDeduplicated: 0,
				errors: [],
			}
		}

		// Use smaller batch size for more granular progress updates
		const BATCH_SIZE = 100
		const chunks: TelemetryEvent[][] = []
		for (let i = 0; i < events.length; i += BATCH_SIZE) {
			chunks.push(events.slice(i, i + BATCH_SIZE))
		}

		let totalInserted = 0
		let totalDeduplicated = 0
		const allErrors: string[] = []
		let eventsSent = 0

		// Send each batch
		for (let i = 0; i < chunks.length; i++) {
			const chunkEvents = chunks[i]
			if (!chunkEvents) continue
			const eventsJson = JSON.stringify(chunkEvents)
			const checksum = createHash('sha256').update(eventsJson).digest('hex')

			const batch: TelemetryBatch = {
				clientVersion: this.clientVersion,
				clientOs: process.platform,
				machineId: this.getMachineId(),
				batchId: randomUUID(),
				batchTimestamp: new Date().toISOString(),
				eventCount: chunkEvents.length,
				checksum,
				events: chunkEvents,
			}

			try {
				const response = await fetch(`${apiEndpoint}/api/telemetry/ingest`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${accessToken}`,
						'User-Agent': `vanguard-cli/${this.clientVersion}`,
					},
					body: JSON.stringify(batch),
				})

				const result = (await response.json()) as IngestApiResponse

				if (!response.ok) {
					// Enhanced error logging with HTTP status and full error details
					const statusText = `HTTP ${response.status} ${response.statusText}`
					const errorDetails =
						result.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ??
						result.errors?.[0]?.message ??
						'No error details provided'
					allErrors.push(`Batch ${i + 1} failed - ${statusText} - ${errorDetails}`)
					console.error('[Telemetry] Full error response:', JSON.stringify(result, null, 2))
				} else {
					totalInserted += result.eventsInserted
					totalDeduplicated += result.eventsDeduplicated
					if (result.errors) {
						allErrors.push(...result.errors.map((e) => e.message))
					}
				}

				// Report progress after each batch for smooth updates
				eventsSent += chunkEvents.length
				options?.onBatchProgress?.(eventsSent, events.length)
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : `Batch ${i + 1} network error`
				allErrors.push(errorMsg)
				console.error('[Telemetry] Network error:', error)
			}
		}

		return {
			success: allErrors.length === 0,
			eventsCollected: events.length,
			eventsInserted: totalInserted,
			eventsDeduplicated: totalDeduplicated,
			errors: allErrors,
		}
	}

	private async commitToEvent(commit: {
		sha: string
		timestamp: string
		author: string
		email: string
		message: string
		linesAdded: number
		linesRemoved: number
		filesChanged: number
	}): Promise<TelemetryEvent> {
		// Detect phase from commit message
		const { phase, persona } = this.detectPhaseFromContent(commit.message)
		const projectName = await this.getProjectName()

		const event: TelemetryEvent = {
			eventId: `commit-${commit.sha}`,
			timestamp: commit.timestamp,
			sessionId: `git-${this.getMachineId()}`,
			projectName,
			projectPath: this.projectPath,
			eventType: 'commit',
			eventSource: 'git',
			commitSha: commit.sha,
			linesAdded: commit.linesAdded,
			linesRemoved: commit.linesRemoved,
			filesChanged: commit.filesChanged,
			attributes: {
				author: commit.author,
				email: commit.email,
				message: commit.message,
			},
		}

		// Only add optional fields if they have values
		if (phase) {
			event.phase = phase
			event.detectionMethod = 'content_inference'
			event.detectionConfidence = 0.6
		}
		if (persona) {
			event.persona = persona
		}

		return event
	}

	private async parseClaudeEntry(
		entry: Record<string, unknown>,
		sessionId: string,
	): Promise<TelemetryEvent | null> {
		// Skip non-message entries
		if (entry.type !== 'message' && entry.type !== 'assistant' && entry.type !== 'user') {
			return null
		}

		const uuid = (entry.uuid as string) || (entry.id as string) || randomUUID()
		const timestamp = (entry.timestamp as string) || new Date().toISOString()
		const content = this.extractContent(entry)

		// Detect phase and persona
		const { phase, persona, method, confidence } = this.detectPhaseFromMessage(entry)

		// Extract token usage
		const usage = entry.usage as Record<string, number> | undefined
		const projectName = await this.getProjectName()

		const event: TelemetryEvent = {
			eventId: `claude-${uuid}`,
			timestamp,
			sessionId,
			projectName,
			projectPath: this.projectPath,
			eventType: 'message',
			eventSource: 'claude',
			messageUuid: uuid,
			provider: 'anthropic',
			attributes: {
				role: entry.role,
				contentLength: content?.length,
				// Include content for embedding generation (truncate if very long)
				content: content?.length > 10000 ? `${content.substring(0, 10000)}...` : content,
			},
		}

		// Add optional fields only if they have values
		const subtype = (entry.role as string) || (entry.type as string)
		if (subtype) event.eventSubtype = subtype
		if (phase) event.phase = phase
		if (persona) event.persona = persona
		if (method) event.detectionMethod = method
		if (confidence !== undefined) event.detectionConfidence = confidence
		if (usage?.input_tokens) event.inputTokens = usage.input_tokens
		if (usage?.output_tokens) event.outputTokens = usage.output_tokens
		if (usage?.cache_read_input_tokens) event.cacheReadTokens = usage.cache_read_input_tokens
		if (usage?.cache_creation_input_tokens)
			event.cacheWriteTokens = usage.cache_creation_input_tokens
		if (entry.model) event.model = entry.model as string

		return event
	}

	private extractContent(entry: Record<string, unknown>): string {
		// Check entry.content first (direct content)
		if (typeof entry.content === 'string') {
			return entry.content
		}
		if (Array.isArray(entry.content)) {
			return entry.content
				.filter((c) => c.type === 'text')
				.map((c) => c.text)
				.join('\n')
		}

		// Check entry.message.content (nested structure from Claude JSONL)
		const message = entry.message as Record<string, unknown> | undefined
		if (message?.content) {
			if (typeof message.content === 'string') {
				return message.content
			}
			if (Array.isArray(message.content)) {
				return (message.content as Array<{ type: string; text: string }>)
					.filter((c) => c.type === 'text')
					.map((c) => c.text)
					.join('\n')
			}
		}

		return ''
	}

	private detectPhaseFromMessage(entry: Record<string, unknown>): {
		phase: string | undefined
		persona: string | undefined
		method: string | undefined
		confidence: number | undefined
	} {
		const content = this.extractContent(entry)

		// Check for explicit command patterns
		for (const { pattern, phase, persona } of VANGUARD_COMMAND_PATTERNS) {
			if (pattern.test(content)) {
				return {
					phase,
					persona: persona || undefined,
					method: 'explicit_command',
					confidence: 1.0,
				}
			}
		}

		// Check for file access patterns
		if (content.includes('.vanguard/specs/discovery')) {
			return { phase: 'discover', persona: undefined, method: 'file_access', confidence: 0.8 }
		}
		if (content.includes('.vanguard/specs/')) {
			return { phase: 'specify', persona: undefined, method: 'file_access', confidence: 0.7 }
		}
		if (content.includes('.vanguard/plans/')) {
			return { phase: 'architect', persona: undefined, method: 'file_access', confidence: 0.7 }
		}
		if (content.includes('.vanguard/tasks/')) {
			return { phase: 'plan', persona: undefined, method: 'file_access', confidence: 0.7 }
		}

		// Content inference (lower confidence)
		return this.detectPhaseFromContent(content)
	}

	private detectPhaseFromContent(content: string): {
		phase: string | undefined
		persona: string | undefined
		method: string | undefined
		confidence: number | undefined
	} {
		const lower = content.toLowerCase()

		// Keyword-based inference
		if (
			lower.includes('discover') ||
			lower.includes('exploration') ||
			lower.includes('codebase analysis')
		) {
			return { phase: 'discover', persona: 'analyst', method: 'content_inference', confidence: 0.4 }
		}
		if (
			lower.includes('specification') ||
			lower.includes('requirements') ||
			lower.includes('user story')
		) {
			return { phase: 'specify', persona: 'pm', method: 'content_inference', confidence: 0.4 }
		}
		if (
			lower.includes('architecture') ||
			lower.includes('design pattern') ||
			lower.includes('component diagram')
		) {
			return {
				phase: 'architect',
				persona: 'architect',
				method: 'content_inference',
				confidence: 0.4,
			}
		}
		if (lower.includes('task breakdown') || lower.includes('sprint') || lower.includes('backlog')) {
			return { phase: 'plan', persona: 'sm', method: 'content_inference', confidence: 0.4 }
		}
		if (
			lower.includes('implement') ||
			lower.includes('code review') ||
			lower.includes('pull request')
		) {
			return { phase: 'implement', persona: 'dev', method: 'content_inference', confidence: 0.4 }
		}
		if (lower.includes('test') || lower.includes('qa') || lower.includes('quality assurance')) {
			return { phase: 'review', persona: 'qa', method: 'content_inference', confidence: 0.4 }
		}

		return { phase: undefined, persona: undefined, method: undefined, confidence: undefined }
	}

	private getMachineId(): string {
		const info = [os.hostname(), os.platform(), os.arch(), os.userInfo().username].join(':')
		return createHash('sha256').update(info).digest('hex').substring(0, 16)
	}
}

/**
 * Session Start Hook Service.
 *
 * Fetches a compact project context summary from the Graphiti knowledge
 * graph for injection at Claude Code session start and after compaction.
 *
 * Unlike the pre-task hook, this has no user prompt — it retrieves
 * the top architectural decisions and key entities for the project.
 */

import type { MemoryApiClient } from '../ports/memory-api-client.js'

/**
 * Input for the session start hook.
 */
export interface SessionStartHookInput {
	readonly projectName?: string
	readonly persona?: string
	readonly tokenBudget?: number
}

/**
 * Output from the session start hook.
 */
export interface SessionStartHookOutput {
	readonly context: string
	readonly tokenEstimate: number
	readonly searchTimeMs: number
}

const EMPTY_OUTPUT: SessionStartHookOutput = {
	context: '',
	tokenEstimate: 0,
	searchTimeMs: 0,
}

/**
 * Default query used when no user prompt is available.
 * Broad enough to surface the most relevant project knowledge.
 */
const DEFAULT_QUERY = 'project architecture decisions conventions patterns requirements'

/**
 * Service for handling session start hooks.
 *
 * Queries the Graphiti knowledge graph for a compact project
 * context summary. Returns empty context (not an error) when
 * the API is unavailable.
 */
export class SessionStartHookService {
	constructor(private readonly apiClient: MemoryApiClient) {}

	async execute(input: SessionStartHookInput): Promise<SessionStartHookOutput> {
		const startTime = Date.now()

		try {
			const isAvailable = await this.apiClient.isAvailable()
			if (!isAvailable) {
				return EMPTY_OUTPUT
			}

			const result = await this.apiClient.queryForGraphContext({
				query: DEFAULT_QUERY,
				...(input.projectName !== undefined && { projectName: input.projectName }),
				...(input.persona !== undefined && { persona: input.persona }),
				tokenBudget: input.tokenBudget ?? 1500,
			})

			return {
				context: result.context,
				tokenEstimate: result.tokenEstimate,
				searchTimeMs: Date.now() - startTime,
			}
		} catch {
			return EMPTY_OUTPUT
		}
	}
}

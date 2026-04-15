/**
 * Context API Client Port.
 *
 * Abstracts communication with vanguard-web's /api/memory/graph/context
 * endpoint for fetching assembled project context at pre-task hook time.
 */

/**
 * Request for assembled project context.
 */
export interface ProjectContextRequest {
	readonly projectId: string
	readonly query: string
	readonly persona?: string
	readonly tokenBudget?: number
}

/**
 * Assembled context block ready for LLM injection.
 */
export interface ProjectContextResponse {
	/** Pre-formatted XML-tagged context block */
	readonly context: string
	/** Estimated token count of the context string */
	readonly tokenEstimate: number
	/** Time spent querying the knowledge graph (ms) */
	readonly searchTimeMs: number
}

/**
 * Port interface for the Context API client.
 */
export interface ContextApiClient {
	/**
	 * Fetch an assembled context block for a project.
	 *
	 * Queries the Graphiti knowledge graph and returns a pre-formatted
	 * context string with decisions and entities, shaped by the given
	 * persona template. Returns empty context (not an error) when the
	 * knowledge graph is unavailable.
	 */
	getProjectContext(request: ProjectContextRequest): Promise<ProjectContextResponse>
}

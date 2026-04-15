/**
 * Graphiti Write Port.
 *
 * Abstracts writing episodes to the Graphiti knowledge graph.
 * Used by the post-task hook to store extracted knowledge candidates.
 *
 * Evans: "Separated Interface" — the port lives in the application layer,
 * the adapter lives in infrastructure.
 */

/**
 * Input for adding an episode to Graphiti.
 */
export interface AddEpisodeInput {
	/** Episode name with prefix (e.g. "Pattern: Repository per aggregate") */
	readonly name: string
	/** Episode content (max 2000 chars) */
	readonly episodeBody: string
	/** Source description for provenance */
	readonly sourceDescription: string
	/** Graph namespace (org--project slug) */
	readonly groupId: string
}

/**
 * Result from adding an episode.
 */
export interface AddEpisodeResult {
	readonly success: boolean
	readonly error?: string
}

/**
 * Port interface for writing to the Graphiti knowledge graph.
 */
export interface GraphitiWritePort {
	/**
	 * Add an episode to Graphiti.
	 *
	 * This is a fire-and-forget operation — the server queues the episode
	 * for async processing (25-30s). The CLI does not wait for completion.
	 */
	addEpisode(input: AddEpisodeInput): Promise<AddEpisodeResult>
}

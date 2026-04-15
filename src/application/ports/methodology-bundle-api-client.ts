/**
 * Methodology Bundle API Client Port.
 *
 * Fowler: "Separated Interface" — the port lives in the application layer,
 * the adapter lives in infrastructure. Dependency flows inward.
 *
 * Abstracts communication with vanguard-web's /api/methodology/bundle
 * endpoint for fetching pre-rendered methodology files at init/refresh time.
 *
 * The server resolves org overrides, applies track filtering, and renders
 * all methodology content into RenderedFile[] — the CLI writes them to disk.
 */

import type { MethodologyBundle } from '../../domain/entities/methodology-bundle.js'

/**
 * Port interface for the Methodology Bundle API client.
 */
export interface MethodologyBundleApiClient {
	/**
	 * Fetch the full methodology bundle for a project.
	 *
	 * The server resolves org overrides and filters workflow steps
	 * by the project's track (solo/team/enterprise).
	 */
	fetch(projectId: string): Promise<MethodologyBundle>

	/**
	 * Fetch the methodology bundle only if it has changed since lastHash.
	 *
	 * Sends If-None-Match with the last known contentHash.
	 * Returns null if the server responds with 304 Not Modified.
	 * Returns the full bundle on 200.
	 */
	fetchIfChanged(projectId: string, lastHash: string): Promise<MethodologyBundle | null>
}

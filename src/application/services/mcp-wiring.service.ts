/**
 * MCP Wiring Service.
 *
 * Generates .mcp.json and .claude/settings.local.json for
 * MCP connectivity to vanguard-web (single URL gateway).
 *
 * - .mcp.json is committed to git (env var substitution for token)
 * - .claude/settings.local.json is gitignored (contains actual token)
 */

import path from 'node:path'
import { FilePath } from '../../domain/value-objects/file-path.js'
import type { FileReader } from '../ports/file-reader.js'
import type { FileWriter } from '../ports/file-writer.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpWiringOptions {
	/** Project root path */
	readonly projectRoot: string
	/** Auth token from vanguard login */
	readonly token: string
	/** MCP server URL (default: production) */
	readonly mcpUrl?: string
	/** Project UUID from registration — vanguard-web resolves group_id server-side */
	readonly projectId?: string
}

export interface McpWiringResult {
	readonly mcpJsonWritten: boolean
	readonly settingsWritten: boolean
	readonly gitignoreUpdated: boolean
	readonly connectivityOk: boolean | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MCP_URL = 'https://localhost:3000/api/mcp'
const SETTINGS_LOCAL_PATH = '.claude/settings.local.json'
const GITIGNORE_ENTRY = '.claude/settings.local.json'

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class McpWiringService {
	constructor(
		private readonly fileWriter: FileWriter,
		private readonly fileReader: FileReader,
	) {}

	/**
	 * Wire up MCP configuration files.
	 */
	async wire(options: McpWiringOptions): Promise<McpWiringResult> {
		const mcpJsonOk = await this.createMcpJson(options)
		const settingsOk = await this.writeSettingsLocal(options)
		const gitignoreOk = await this.ensureGitignore(options.projectRoot)
		const connectivityOk = await this.verifyConnectivity(options)

		return {
			mcpJsonWritten: mcpJsonOk,
			settingsWritten: settingsOk,
			gitignoreUpdated: gitignoreOk,
			connectivityOk,
		}
	}

	/**
	 * Create or merge .mcp.json with vanguard server entry.
	 * Uses env var substitution so the file can be committed.
	 */
	async createMcpJson(options: McpWiringOptions): Promise<boolean> {
		const mcpJsonPath = path.join(options.projectRoot, '.mcp.json')
		const mcpUrl = options.mcpUrl ?? DEFAULT_MCP_URL

		// Build the vanguard server entry
		// URL is written directly (not a secret). Token uses env var from settings.local.json.
		const vanguardEntry = {
			type: 'http',
			url: mcpUrl,
			headers: {
				Authorization: 'Bearer ${VANGUARD_TOKEN}',
				...(options.projectId && { 'X-Vanguard-Project-Id': options.projectId }),
			},
		}

		// Merge with existing .mcp.json if it exists
		const mcpConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} }

		const existingContent = await this.fileReader.readOrNull(FilePath.create(mcpJsonPath))
		if (existingContent) {
			try {
				const existing = JSON.parse(existingContent)
				mcpConfig.mcpServers = existing.mcpServers ?? {}
			} catch {
				// Corrupted file — overwrite
			}
		}

		mcpConfig.mcpServers.vanguard = vanguardEntry

		const result = await this.fileWriter.write({
			path: FilePath.create(mcpJsonPath),
			content: `${JSON.stringify(mcpConfig, null, 2)}\n`,
		})

		return result.success
	}

	/**
	 * Write .claude/settings.local.json with the auth token.
	 * This file is gitignored — it contains the actual secret.
	 */
	async writeSettingsLocal(options: McpWiringOptions): Promise<boolean> {
		const settingsPath = path.join(options.projectRoot, SETTINGS_LOCAL_PATH)
		const claudeDir = FilePath.create(path.dirname(settingsPath))

		await this.fileWriter.ensureDirectory(claudeDir)

		const settings = {
			env: {
				VANGUARD_TOKEN: options.token,
			},
			permissions: {
				allow: [
					// Pre-approve all memory tools so agents operate autonomously
					'mcp__vanguard__add_memory',
					'mcp__vanguard__search_memory_facts',
					'mcp__vanguard__search_nodes',
					'mcp__vanguard__get_episodes',
					'mcp__vanguard__get_entity_edge',
					'mcp__vanguard__get_status',
					'mcp__vanguard__delete_entity_edge',
					'mcp__vanguard__delete_episode',
					'mcp__vanguard__clear_graph',
					'mcp__vanguard__build_communities',
					'mcp__vanguard__search_communities',
					'mcp__vanguard__search_hybrid',
					'mcp__vanguard__ingest_text',
					'mcp__vanguard__get_memory_overview',
				],
			},
			enableAllProjectMcpServers: true,
			enabledMcpjsonServers: ['vanguard'],
			allowedTools: [
				// Knowledge graph — read
				'mcp__vanguard__search_memory_facts',
				'mcp__vanguard__search_nodes',
				'mcp__vanguard__get_episodes',
				'mcp__vanguard__get_entity_edge',
				'mcp__vanguard__get_status',
				// Knowledge graph — write
				'mcp__vanguard__add_memory',
				'mcp__vanguard__delete_entity_edge',
				'mcp__vanguard__delete_episode',
				'mcp__vanguard__clear_graph',
				// Communities
				'mcp__vanguard__build_communities',
				'mcp__vanguard__search_communities',
				'mcp__vanguard__search_hybrid',
				'mcp__vanguard__ingest_text',
				'mcp__vanguard__get_memory_overview',
			],
		}

		const result = await this.fileWriter.write({
			path: FilePath.create(settingsPath),
			content: `${JSON.stringify(settings, null, 2)}\n`,
		})

		return result.success
	}

	/**
	 * Ensure .gitignore includes .claude/settings.local.json.
	 */
	async ensureGitignore(projectRoot: string): Promise<boolean> {
		const gitignorePath = path.join(projectRoot, '.gitignore')
		const content = (await this.fileReader.readOrNull(FilePath.create(gitignorePath))) ?? ''

		// Check if already present
		const lines = content.split('\n')
		if (lines.some((line) => line.trim() === GITIGNORE_ENTRY)) {
			return false // Already present, no change needed
		}

		// Append the entry
		const separator = content.endsWith('\n') || content === '' ? '' : '\n'
		const newContent = `${content + separator + GITIGNORE_ENTRY}\n`

		const result = await this.fileWriter.write({
			path: FilePath.create(gitignorePath),
			content: newContent,
		})

		return result.success
	}

	/**
	 * Verify MCP connectivity with a 3s timeout.
	 * Returns null if we can't determine (no token/url).
	 */
	async verifyConnectivity(options: McpWiringOptions): Promise<boolean | null> {
		const url = options.mcpUrl ?? DEFAULT_MCP_URL

		try {
			const controller = new AbortController()
			const timeout = setTimeout(() => controller.abort(), 3000)

			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${options.token}`,
				},
				signal: controller.signal,
			})

			clearTimeout(timeout)
			return response.ok || response.status === 405 // 405 = MCP expects POST, but server is up
		} catch {
			return false
		}
	}
}

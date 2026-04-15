/**
 * Hook Wiring Service.
 *
 * Merges methodology bundle hook configuration into .claude/settings.json
 * and sets executable permissions on hook scripts.
 *
 * Follows the same port/adapter pattern as McpWiringService.
 */

import { chmod } from 'node:fs/promises'
import path from 'node:path'
import type { BundleHookConfig, RenderedFile } from '../../domain/entities/methodology-bundle.js'
import { FilePath } from '../../domain/value-objects/file-path.js'
import type { FileReader } from '../ports/file-reader.js'
import type { FileWriter } from '../ports/file-writer.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookWiringOptions {
	/** Project root path */
	readonly projectRoot: string
	/** Hook configuration from the methodology bundle */
	readonly hookConfig: BundleHookConfig
	/** Files that need executable permission (from bundle RenderedFile[]) */
	readonly executableFiles: readonly RenderedFile[]
}

export interface HookWiringResult {
	readonly settingsMerged: boolean
	readonly executableCount: number
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class HookWiringService {
	constructor(
		private readonly fileWriter: FileWriter,
		private readonly fileReader: FileReader,
	) {}

	/**
	 * Wire hook configuration into the project.
	 *
	 * 1. Set executable permissions on hook scripts (already written by MethodologyService)
	 * 2. Merge hook config into .claude/settings.json
	 */
	async wire(options: HookWiringOptions): Promise<HookWiringResult> {
		let executableCount = 0

		// 1. Set executable permissions on hook scripts
		for (const file of options.executableFiles) {
			try {
				const fullPath = path.join(options.projectRoot, file.path)
				await chmod(fullPath, 0o755)
				executableCount++
			} catch {
				// Non-critical — script still works, just might need manual chmod
			}
		}

		// 2. Merge hook config into .claude/settings.json
		const settingsMerged = await this.mergeSettings(options.projectRoot, options.hookConfig)

		return { settingsMerged, executableCount }
	}

	/**
	 * Merge bundle hook config into .claude/settings.json.
	 *
	 * Preserves existing user hooks (e.g. SessionStart, UserPromptSubmit
	 * from vanguard memory hook). Deduplicates by command string to prevent
	 * double-registration on repeated init/refresh.
	 */
	private async mergeSettings(projectRoot: string, hookConfig: BundleHookConfig): Promise<boolean> {
		const settingsPath = path.join(projectRoot, '.claude', 'settings.json')
		const claudeDir = FilePath.create(path.dirname(settingsPath))

		await this.fileWriter.ensureDirectory(claudeDir)

		// Read existing settings
		let existing: Record<string, unknown> = {}
		const content = await this.fileReader.readOrNull(FilePath.create(settingsPath))
		if (content) {
			try {
				existing = JSON.parse(content)
			} catch {
				// Corrupted file — start fresh but preserve non-hooks keys
			}
		}

		// Deep-merge hooks
		const merged = this.deepMergeHooks(existing, hookConfig)

		const result = await this.fileWriter.write({
			path: FilePath.create(settingsPath),
			content: `${JSON.stringify(merged, null, 2)}\n`,
		})

		return result.success
	}

	/**
	 * Merge bundle hook entries into existing settings.
	 *
	 * Strategy:
	 * - Preserves all existing non-hooks keys (permissions, env, etc.)
	 * - For each hook event, appends bundle entries that don't already exist
	 * - Deduplicates by comparing the command string of the first hook in each entry
	 */
	private deepMergeHooks(
		existing: Record<string, unknown>,
		bundle: BundleHookConfig,
	): Record<string, unknown> {
		const merged = { ...existing }
		const existingHooks = (merged.hooks as Record<string, unknown[]>) ?? {}
		const mergedHooks: Record<string, unknown[]> = { ...existingHooks }

		for (const [event, entries] of Object.entries(bundle.hooks)) {
			const currentEntries = (mergedHooks[event] as Array<Record<string, unknown>>) ?? []
			const updatedEntries = [...currentEntries]

			for (const entry of entries) {
				const command = entry.hooks?.[0]?.command ?? ''
				// Check if an entry with this command already exists
				const exists = updatedEntries.some((e) => {
					const hooks = e.hooks as Array<Record<string, unknown>> | undefined
					return hooks?.some((h) => h.command === command)
				})
				if (!exists) {
					updatedEntries.push(entry as unknown as Record<string, unknown>)
				}
			}

			mergedHooks[event] = updatedEntries
		}

		merged.hooks = mergedHooks
		return merged
	}
}

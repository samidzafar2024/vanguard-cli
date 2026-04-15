/**
 * Methodology Service — Application Service for methodology bundle lifecycle.
 *
 * Evans: "Application services orchestrate domain objects and coordinate
 * workflows. They do not contain business logic themselves."
 *
 * Fowler: "Service Layer — defines the application's boundary and its
 * set of available operations."
 *
 * This service encapsulates:
 * - Fetching the pre-rendered methodology bundle from the server
 * - Anti-corruption layer: converting server RenderedFile → CLI GeneratedFile
 * - Writing methodology files to disk
 * - Storing metadata (content hash, project ID) for refresh
 * - Diff-based change detection for refresh flows
 *
 * The presentation layer (init.ts, refresh.ts) stays thin — it handles
 * CLI interaction and delegates all methodology orchestration here.
 */

import path from 'node:path'
import type {
	BundleHookConfig,
	BundlePhase,
	MethodologyBundle,
	RenderedFile,
} from '../../domain/entities/methodology-bundle.js'
import { FilePath } from '../../domain/value-objects/file-path.js'
import type { FileReader } from '../ports/file-reader.js'
import type { FileWriter } from '../ports/file-writer.js'
import type { GeneratedFile } from '../ports/generator.js'
import type { MethodologyBundleApiClient } from '../ports/methodology-bundle-api-client.js'
// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function createSimpleDiff(oldContent: string, newContent: string, filename: string): string {
	const oldLines = oldContent.split('\n')
	const newLines = newContent.split('\n')
	const output: string[] = [`--- a/${filename}`, `+++ b/${filename}`]

	const removedLines = oldLines.filter(
		(line, idx) => idx >= newLines.length || line !== newLines[idx],
	)
	const addedLines = newLines.filter(
		(line, idx) => idx >= oldLines.length || line !== oldLines[idx],
	)

	output.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`)
	for (const line of removedLines) output.push(`-${line}`)
	for (const line of addedLines) output.push(`+${line}`)

	return output.join('\n')
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface MethodologyInstallResult {
	/** Number of files successfully written */
	readonly filesWritten: number
	/** Whether the bundle was fetched from the server (false = fallback) */
	readonly usedBundle: boolean
	/** Content hash for future ETag refresh */
	readonly contentHash: string | null
	/** Active phases from the server, for dynamic command listing */
	readonly phases: readonly BundlePhase[]
	/** Hook configuration for .claude/settings.json merge */
	readonly hookConfig?: BundleHookConfig
	/** Files that need executable permission (hook scripts) */
	readonly executableFiles: readonly RenderedFile[]
}

export interface MethodologyFileChange {
	readonly path: string
	readonly relativePath: string
	readonly status: 'modified' | 'unchanged' | 'new'
	readonly diff?: string
	readonly newContent?: string
}

export interface MethodologyRefreshResult {
	/** Whether the server reported changes (false = 304 Not Modified) */
	readonly hasChanges: boolean
	/** Files that differ from what's on disk */
	readonly changes: readonly MethodologyFileChange[]
	/** The bundle (if fetched), held for applyRefresh */
	readonly bundle: MethodologyBundle | null
	/** Hook configuration for .claude/settings.json merge */
	readonly hookConfig?: BundleHookConfig
	/** Files that need executable permission (hook scripts) */
	readonly executableFiles: readonly RenderedFile[]
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Application service for methodology bundle install and refresh.
 *
 * Martin: "A class should have one, and only one, reason to change."
 * This service changes only when the methodology install/refresh flow changes.
 *
 * Constructor injection follows the DDD port/adapter pattern used
 * throughout vanguard-cli.
 */
export class MethodologyService {
	constructor(
		private readonly bundleClient: MethodologyBundleApiClient,
		private readonly fileWriter: FileWriter,
		private readonly fileReader: FileReader,
	) {}

	/**
	 * Install methodology files from the server bundle.
	 *
	 * Called during `vanguard init` after project registration.
	 * Fetches the pre-rendered bundle, writes files to disk,
	 * and stores metadata for future refresh.
	 */
	async install(projectId: string, projectRoot: string): Promise<MethodologyInstallResult> {
		const bundle = await this.bundleClient.fetch(projectId)
		const generatedFiles = this.toGeneratedFiles(bundle.files, projectRoot)

		const results = await this.fileWriter.writeAll(generatedFiles)
		const filesWritten = results.filter((r) => r.success).length

		// Persist metadata for refresh
		await this.writeMetadata(projectRoot, projectId, bundle.contentHash)

		return {
			filesWritten,
			usedBundle: true,
			contentHash: bundle.contentHash,
			phases: bundle.phases,
			...(bundle.hookConfig ? { hookConfig: bundle.hookConfig } : {}),
			executableFiles: bundle.files.filter((f) => f.executable),
		}
	}

	/**
	 * Check for methodology changes since last install/refresh.
	 *
	 * Called during `vanguard refresh`. Uses ETag (content hash)
	 * for conditional request. If the server reports changes,
	 * diffs each file against what's on disk.
	 *
	 * Does NOT write files — call applyRefresh() after user confirmation.
	 */
	async refresh(projectRoot: string): Promise<MethodologyRefreshResult> {
		const projectId = await this.readProjectId(projectRoot)
		if (!projectId) {
			throw new Error(
				'No project ID found. Run "vanguard init" first, or re-register with "vanguard login".',
			)
		}

		const lastHash = await this.readContentHash(projectRoot)
		const bundle = lastHash
			? await this.bundleClient.fetchIfChanged(projectId, lastHash)
			: await this.bundleClient.fetch(projectId)

		if (!bundle) {
			return { hasChanges: false, changes: [], bundle: null, executableFiles: [] }
		}

		// Diff each rendered file against disk
		const changes: MethodologyFileChange[] = await Promise.all(
			bundle.files.map((rf) => this.diffFile(projectRoot, rf.path, rf.content)),
		)

		const hasChanges = changes.some((c) => c.status !== 'unchanged')

		return {
			hasChanges,
			changes,
			bundle,
			...(bundle.hookConfig ? { hookConfig: bundle.hookConfig } : {}),
			executableFiles: bundle.files.filter((f) => f.executable),
		}
	}

	/**
	 * Apply refreshed methodology files to disk.
	 *
	 * Called after the user confirms the changes shown by refresh().
	 * Writes all bundle files and updates stored metadata.
	 */
	async applyRefresh(result: MethodologyRefreshResult, projectRoot: string): Promise<number> {
		if (!result.bundle) return 0

		const generatedFiles = this.toGeneratedFiles(result.bundle.files, projectRoot)
		const writeResults = await this.fileWriter.writeAll(generatedFiles)
		const written = writeResults.filter((r) => r.success).length

		// Update content hash
		const projectId = await this.readProjectId(projectRoot)
		if (projectId) {
			await this.writeMetadata(projectRoot, projectId, result.bundle.contentHash)
		}

		return written
	}

	// -----------------------------------------------------------------------
	// Anti-corruption layer
	// -----------------------------------------------------------------------

	/**
	 * Convert server's RenderedFile[] to CLI's GeneratedFile[].
	 *
	 * Evans: "Anti-Corruption Layer — translates between bounded contexts."
	 * The server's RenderedFile uses plain string paths; the CLI's
	 * GeneratedFile uses FilePath value objects with normalization
	 * and path-traversal protection.
	 */
	private toGeneratedFiles(
		renderedFiles: readonly RenderedFile[],
		projectRoot: string,
	): GeneratedFile[] {
		return renderedFiles.map((rf) => ({
			path: FilePath.create(path.join(projectRoot, rf.path)),
			content: rf.content,
		}))
	}

	// -----------------------------------------------------------------------
	// Metadata persistence
	// -----------------------------------------------------------------------

	private async writeMetadata(
		projectRoot: string,
		projectId: string,
		contentHash: string,
	): Promise<void> {
		await this.fileWriter.write({
			path: FilePath.create(path.join(projectRoot, '.vanguard/.content-hash')),
			content: contentHash,
		})
		await this.fileWriter.write({
			path: FilePath.create(path.join(projectRoot, '.vanguard/.project-id')),
			content: projectId,
		})
	}

	private async readContentHash(projectRoot: string): Promise<string | null> {
		const hashPath = FilePath.create(path.join(projectRoot, '.vanguard', '.content-hash'))
		const content = await this.fileReader.readOrNull(hashPath)
		return content?.trim() ?? null
	}

	private async readProjectId(projectRoot: string): Promise<string | null> {
		const idPath = FilePath.create(path.join(projectRoot, '.vanguard', '.project-id'))
		const content = await this.fileReader.readOrNull(idPath)
		return content?.trim() ?? null
	}

	// -----------------------------------------------------------------------
	// Diffing
	// -----------------------------------------------------------------------

	private async diffFile(
		projectRoot: string,
		relativePath: string,
		newContent: string,
	): Promise<MethodologyFileChange> {
		const fullPath = path.join(projectRoot, relativePath)
		const filePath = FilePath.create(fullPath)

		const currentContent = await this.fileReader.readOrNull(filePath)

		if (currentContent === null) {
			return {
				path: fullPath,
				relativePath,
				status: 'new',
				diff: createSimpleDiff('', newContent, relativePath),
				newContent,
			}
		}

		if (currentContent === newContent) {
			return { path: fullPath, relativePath, status: 'unchanged' }
		}

		return {
			path: fullPath,
			relativePath,
			status: 'modified',
			diff: createSimpleDiff(currentContent, newContent, relativePath),
			newContent,
		}
	}
}

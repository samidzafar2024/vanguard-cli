import type { FilePath } from '../../domain/value-objects/file-path.js'
import type { GeneratedFile } from './generator.js'

/**
 * Result of a file write operation.
 */
export interface WriteResult {
	readonly path: FilePath
	readonly success: boolean
	readonly error?: string
}

/**
 * Port for writing generated files to disk.
 * Infrastructure layer implements this.
 */
export interface FileWriter {
	/**
	 * Write a single file.
	 */
	write(file: GeneratedFile): Promise<WriteResult>

	/**
	 * Write multiple files.
	 */
	writeAll(files: readonly GeneratedFile[]): Promise<WriteResult[]>

	/**
	 * Ensure a directory exists.
	 */
	ensureDirectory(path: FilePath): Promise<void>

	/**
	 * Check if a file exists.
	 */
	exists(path: FilePath): Promise<boolean>

	/**
	 * Create a symlink.
	 */
	symlink(target: FilePath, link: FilePath): Promise<WriteResult>

	/**
	 * Delete a file. No-op if file does not exist.
	 */
	delete(path: FilePath): Promise<void>
}

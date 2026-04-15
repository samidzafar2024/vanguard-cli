import type { FilePath } from '../../domain/value-objects/file-path.js'

/**
 * Port for reading files from disk.
 *
 * Separates read operations from write operations (FileWriter).
 * Application services inject this port instead of importing node:fs directly.
 */
export interface FileReader {
	/**
	 * Read file contents as UTF-8 string.
	 * Throws if the file does not exist.
	 */
	read(path: FilePath): Promise<string>

	/**
	 * Read file contents, returning null if the file does not exist.
	 */
	readOrNull(path: FilePath): Promise<string | null>

	/**
	 * Check if a file or directory exists.
	 */
	exists(path: FilePath): Promise<boolean>

	/**
	 * List files in a directory, returning filenames (not full paths).
	 * Returns empty array if directory does not exist.
	 */
	listFiles(dir: FilePath): Promise<string[]>
}

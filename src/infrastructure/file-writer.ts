import { symlink as fsSymlink, mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { FileWriter, WriteResult } from '../application/ports/file-writer.js'
import type { GeneratedFile } from '../application/ports/generator.js'
import type { FilePath } from '../domain/value-objects/file-path.js'

/**
 * File system implementation of the FileWriter port.
 */
export class FsFileWriter implements FileWriter {
	async write(file: GeneratedFile): Promise<WriteResult> {
		const pathStr = file.path.toString()

		try {
			// Ensure parent directory exists
			await this.ensureDirectory(file.path.parent())

			// Write the file
			await writeFile(pathStr, file.content, 'utf-8')

			return {
				path: file.path,
				success: true,
			}
		} catch (error) {
			return {
				path: file.path,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async writeAll(files: readonly GeneratedFile[]): Promise<WriteResult[]> {
		// Write files in parallel for performance
		return Promise.all(files.map((file) => this.write(file)))
	}

	async ensureDirectory(path: FilePath): Promise<void> {
		await mkdir(path.toString(), { recursive: true })
	}

	async exists(path: FilePath): Promise<boolean> {
		try {
			await stat(path.toString())
			return true
		} catch {
			return false
		}
	}

	async delete(path: FilePath): Promise<void> {
		try {
			await unlink(path.toString())
		} catch {
			// No-op if file does not exist
		}
	}

	async symlink(target: FilePath, link: FilePath): Promise<WriteResult> {
		try {
			// Ensure parent directory exists
			await mkdir(dirname(link.toString()), { recursive: true })

			// Remove existing symlink if it exists
			try {
				await unlink(link.toString())
			} catch {
				// Ignore if doesn't exist
			}

			await fsSymlink(target.toString(), link.toString())

			return {
				path: link,
				success: true,
			}
		} catch (error) {
			return {
				path: link,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}
}

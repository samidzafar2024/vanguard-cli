import { readFile, readdir, stat } from 'node:fs/promises'
import type { FileReader } from '../application/ports/file-reader.js'
import type { FilePath } from '../domain/value-objects/file-path.js'

/**
 * File system implementation of the FileReader port.
 */
export class FsFileReader implements FileReader {
	async read(path: FilePath): Promise<string> {
		return readFile(path.toString(), 'utf-8')
	}

	async readOrNull(path: FilePath): Promise<string | null> {
		try {
			return await readFile(path.toString(), 'utf-8')
		} catch {
			return null
		}
	}

	async exists(path: FilePath): Promise<boolean> {
		try {
			await stat(path.toString())
			return true
		} catch {
			return false
		}
	}

	async listFiles(dir: FilePath): Promise<string[]> {
		try {
			return await readdir(dir.toString())
		} catch {
			return []
		}
	}
}

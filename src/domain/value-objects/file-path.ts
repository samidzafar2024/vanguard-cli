import { InvalidValueError } from '../errors/domain-error.js'

/**
 * File path value object - ensures valid, normalized paths.
 * Does not check file existence (that's infrastructure concern).
 */
export class FilePath {
	private constructor(private readonly value: string) {}

	static create(value: string): FilePath {
		const trimmed = value.trim()

		if (!trimmed) {
			throw new InvalidValueError('filePath', value, 'Cannot be empty')
		}

		const normalized = trimmed.replace(/\\/g, '/').replace(/\/+$/, '')

		if (normalized.includes('..')) {
			throw new InvalidValueError('filePath', value, 'Path traversal (..) is not allowed')
		}

		return new FilePath(normalized)
	}

	static cwd(): FilePath {
		return new FilePath('.')
	}

	join(...segments: string[]): FilePath {
		const joined = [this.value, ...segments].join('/').replace(/\/+/g, '/')
		return FilePath.create(joined)
	}

	parent(): FilePath {
		const parts = this.value.split('/')
		if (parts.length <= 1) {
			return FilePath.create('.')
		}
		parts.pop()
		return FilePath.create(parts.join('/') || '.')
	}

	basename(): string {
		const parts = this.value.split('/')
		return parts[parts.length - 1] ?? ''
	}

	extension(): string | undefined {
		const name = this.basename()
		const dotIndex = name.lastIndexOf('.')
		return dotIndex > 0 ? name.slice(dotIndex + 1) : undefined
	}

	isAbsolute(): boolean {
		return this.value.startsWith('/')
	}

	toString(): string {
		return this.value
	}

	equals(other: FilePath): boolean {
		return this.value === other.value
	}
}

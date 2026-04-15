import { describe, expect, it } from 'vitest'
import { InvalidValueError } from '../../../../src/domain/errors/domain-error.js'
import { FilePath } from '../../../../src/domain/value-objects/file-path.js'

describe('FilePath', () => {
	describe('create', () => {
		it('should create a valid file path', () => {
			const path = FilePath.create('/Users/test/project')
			expect(path.toString()).toBe('/Users/test/project')
		})

		it('should normalize backslashes to forward slashes', () => {
			const path = FilePath.create('C:\\Users\\test\\project')
			expect(path.toString()).toBe('C:/Users/test/project')
		})

		it('should remove trailing slashes', () => {
			const path = FilePath.create('/Users/test/project/')
			expect(path.toString()).toBe('/Users/test/project')
		})

		it('should trim whitespace', () => {
			const path = FilePath.create('  /Users/test  ')
			expect(path.toString()).toBe('/Users/test')
		})

		it('should reject empty strings', () => {
			expect(() => FilePath.create('')).toThrow(InvalidValueError)
			expect(() => FilePath.create('   ')).toThrow(InvalidValueError)
		})

		it('should reject paths with path traversal', () => {
			expect(() => FilePath.create('/Users/../etc/passwd')).toThrow(InvalidValueError)
			expect(() => FilePath.create('../secret')).toThrow(InvalidValueError)
		})
	})

	describe('cwd', () => {
		it('should create current directory path', () => {
			const path = FilePath.cwd()
			expect(path.toString()).toBe('.')
		})
	})

	describe('join', () => {
		it('should join path segments', () => {
			const path = FilePath.create('/Users/test')
			const joined = path.join('project', 'src')
			expect(joined.toString()).toBe('/Users/test/project/src')
		})

		it('should handle multiple segments', () => {
			const path = FilePath.create('/app')
			const joined = path.join('src', 'domain', 'entities')
			expect(joined.toString()).toBe('/app/src/domain/entities')
		})

		it('should normalize multiple slashes', () => {
			const path = FilePath.create('/app/')
			const joined = path.join('/src/')
			expect(joined.toString()).toBe('/app/src')
		})
	})

	describe('parent', () => {
		it('should return parent directory', () => {
			const path = FilePath.create('/Users/test/project')
			expect(path.parent().toString()).toBe('/Users/test')
		})

		it('should return current directory for root-level paths', () => {
			const path = FilePath.create('/Users')
			expect(path.parent().toString()).toBe('.')
		})

		it('should return current directory for single segment', () => {
			const path = FilePath.create('project')
			expect(path.parent().toString()).toBe('.')
		})
	})

	describe('basename', () => {
		it('should return the file/directory name', () => {
			const path = FilePath.create('/Users/test/project')
			expect(path.basename()).toBe('project')
		})

		it('should return filename with extension', () => {
			const path = FilePath.create('/app/src/index.ts')
			expect(path.basename()).toBe('index.ts')
		})
	})

	describe('extension', () => {
		it('should return file extension', () => {
			const path = FilePath.create('/app/src/index.ts')
			expect(path.extension()).toBe('ts')
		})

		it('should return undefined for directories', () => {
			const path = FilePath.create('/app/src')
			expect(path.extension()).toBeUndefined()
		})

		it('should return undefined for dotfiles (no extension)', () => {
			// Dotfiles like .gitignore are named files, not extensions
			const path = FilePath.create('/app/.gitignore')
			expect(path.extension()).toBeUndefined()
		})

		it('should return last extension for multiple dots', () => {
			const path = FilePath.create('/app/file.test.ts')
			expect(path.extension()).toBe('ts')
		})
	})

	describe('isAbsolute', () => {
		it('should return true for absolute paths', () => {
			const path = FilePath.create('/Users/test')
			expect(path.isAbsolute()).toBe(true)
		})

		it('should return false for relative paths', () => {
			const path = FilePath.create('src/index.ts')
			expect(path.isAbsolute()).toBe(false)
		})

		it('should return false for current directory', () => {
			const path = FilePath.cwd()
			expect(path.isAbsolute()).toBe(false)
		})
	})

	describe('equals', () => {
		it('should return true for equal paths', () => {
			const p1 = FilePath.create('/Users/test')
			const p2 = FilePath.create('/Users/test')
			expect(p1.equals(p2)).toBe(true)
		})

		it('should return false for different paths', () => {
			const p1 = FilePath.create('/Users/test')
			const p2 = FilePath.create('/Users/other')
			expect(p1.equals(p2)).toBe(false)
		})

		it('should compare normalized paths', () => {
			const p1 = FilePath.create('/Users/test/')
			const p2 = FilePath.create('/Users/test')
			expect(p1.equals(p2)).toBe(true)
		})
	})
})

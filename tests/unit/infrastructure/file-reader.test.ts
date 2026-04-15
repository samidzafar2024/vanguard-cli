import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilePath } from '../../../src/domain/value-objects/file-path.js'
import { FsFileReader } from '../../../src/infrastructure/file-reader.js'

describe('FsFileReader', () => {
	let reader: FsFileReader
	let testDir: string

	beforeEach(() => {
		reader = new FsFileReader()
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanguard-test-'))
	})

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true })
	})

	describe('read', () => {
		it('reads file contents as UTF-8', async () => {
			const filePath = path.join(testDir, 'test.txt')
			fs.writeFileSync(filePath, 'hello world', 'utf-8')

			const result = await reader.read(FilePath.create(filePath))
			expect(result).toBe('hello world')
		})

		it('throws when file does not exist', async () => {
			const filePath = path.join(testDir, 'missing.txt')
			await expect(reader.read(FilePath.create(filePath))).rejects.toThrow()
		})
	})

	describe('readOrNull', () => {
		it('reads file contents when file exists', async () => {
			const filePath = path.join(testDir, 'test.txt')
			fs.writeFileSync(filePath, 'content', 'utf-8')

			const result = await reader.readOrNull(FilePath.create(filePath))
			expect(result).toBe('content')
		})

		it('returns null when file does not exist', async () => {
			const filePath = path.join(testDir, 'missing.txt')
			const result = await reader.readOrNull(FilePath.create(filePath))
			expect(result).toBeNull()
		})
	})

	describe('exists', () => {
		it('returns true for existing file', async () => {
			const filePath = path.join(testDir, 'test.txt')
			fs.writeFileSync(filePath, '', 'utf-8')

			const result = await reader.exists(FilePath.create(filePath))
			expect(result).toBe(true)
		})

		it('returns true for existing directory', async () => {
			const result = await reader.exists(FilePath.create(testDir))
			expect(result).toBe(true)
		})

		it('returns false for non-existent path', async () => {
			const filePath = path.join(testDir, 'nope')
			const result = await reader.exists(FilePath.create(filePath))
			expect(result).toBe(false)
		})
	})
})

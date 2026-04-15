import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	ensureEnvInGitignore,
	loadEnvFile,
	parseEnvContent,
	readEnvFile,
	writeEnvEntry,
} from '../../../../src/infrastructure/utils/dotenv.js'

describe('dotenv utilities', () => {
	let testDir: string

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanguard-dotenv-test-'))
	})

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true })
	})

	describe('parseEnvContent', () => {
		it('parses KEY=VALUE pairs', () => {
			expect(parseEnvContent('FOO=bar\nBAZ=qux')).toEqual({
				FOO: 'bar',
				BAZ: 'qux',
			})
		})

		it('skips comments', () => {
			expect(parseEnvContent('# comment\nFOO=bar')).toEqual({ FOO: 'bar' })
		})

		it('skips empty lines', () => {
			expect(parseEnvContent('FOO=bar\n\nBAZ=qux\n')).toEqual({
				FOO: 'bar',
				BAZ: 'qux',
			})
		})

		it('strips surrounding double quotes', () => {
			expect(parseEnvContent('FOO="bar baz"')).toEqual({ FOO: 'bar baz' })
		})

		it('strips surrounding single quotes', () => {
			expect(parseEnvContent("FOO='bar baz'")).toEqual({ FOO: 'bar baz' })
		})

		it('handles values with equals signs', () => {
			expect(parseEnvContent('FOO=bar=baz')).toEqual({ FOO: 'bar=baz' })
		})

		it('handles empty values', () => {
			expect(parseEnvContent('FOO=')).toEqual({ FOO: '' })
		})

		it('strips inline comments when env value is not in quotes', () => {
			expect(parseEnvContent('FOO=bar # this is a comment')).toEqual({ FOO: 'bar' })
		})

		it('strips inline comments when env value is in double quotes', () => {
			expect(parseEnvContent('FOO="bar" # this is a comment')).toEqual({ FOO: 'bar' })
		})

		it('strips inline comments when the env value is in single quotes', () => {
			expect(parseEnvContent("FOO='bar' # this is a comment")).toEqual({ FOO: 'bar' })
		})

		it('does not strip inline comments when the # is in quotes', () => {
			expect(parseEnvContent('FOO="bar # not a comment"')).toEqual({
				FOO: 'bar # not a comment',
			})
		})
	})

	describe('readEnvFile', () => {
		it('returns empty object for missing file', () => {
			const result = readEnvFile(path.join(testDir, '.env'))
			expect(result).toEqual({})
		})

		it('parses existing .env file', () => {
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'FOO=bar\nBAZ=qux\n', 'utf-8')

			const result = readEnvFile(envPath)
			expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' })
		})
	})

	describe('writeEnvEntry', () => {
		it('creates new file with entry', () => {
			const envPath = path.join(testDir, '.env')
			writeEnvEntry(envPath, 'FOO', 'bar')

			const content = fs.readFileSync(envPath, 'utf-8')
			expect(content).toBe('FOO=bar\n')
		})

		it('appends entry to existing file', () => {
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'EXISTING=value\n', 'utf-8')

			writeEnvEntry(envPath, 'NEW', 'entry')

			const content = fs.readFileSync(envPath, 'utf-8')
			expect(content).toContain('EXISTING=value')
			expect(content).toContain('NEW=entry')
		})

		it('updates existing key without duplication', () => {
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'FOO=old\nBAR=keep\n', 'utf-8')

			writeEnvEntry(envPath, 'FOO', 'new')

			const content = fs.readFileSync(envPath, 'utf-8')
			expect(content).toContain('FOO=new')
			expect(content).toContain('BAR=keep')
			// Should not have duplicate FOO entries
			expect(content.match(/FOO=/g)?.length).toBe(1)
		})

		it('preserves comments', () => {
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, '# My comment\nFOO=bar\n', 'utf-8')

			writeEnvEntry(envPath, 'BAZ', 'qux')

			const content = fs.readFileSync(envPath, 'utf-8')
			expect(content).toContain('# My comment')
		})

		it('creates parent directories if needed', () => {
			const envPath = path.join(testDir, 'subdir', 'nested', '.env')
			writeEnvEntry(envPath, 'FOO', 'bar')

			expect(fs.existsSync(envPath)).toBe(true)
		})
	})

	describe('loadEnvFile', () => {
		const originalEnv = { ...process.env }

		afterEach(() => {
			// Restore original env
			for (const key of Object.keys(process.env)) {
				if (!(key in originalEnv)) {
					Reflect.deleteProperty(process.env, key)
				}
			}
			for (const [key, value] of Object.entries(originalEnv)) {
				process.env[key] = value
			}
		})

		it('loads vars into process.env', () => {
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'VANGUARD_TEST_LOAD=loaded_value\n', 'utf-8')

			loadEnvFile(envPath)

			expect(process.env.VANGUARD_TEST_LOAD).toBe('loaded_value')
		})

		it('does not override existing env vars', () => {
			process.env.VANGUARD_TEST_EXISTING = 'original'
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'VANGUARD_TEST_EXISTING=override\n', 'utf-8')

			loadEnvFile(envPath)

			expect(process.env.VANGUARD_TEST_EXISTING).toBe('original')
		})

		it('handles missing .env file gracefully', () => {
			const envPath = path.join(testDir, 'nonexistent', '.env')
			expect(() => loadEnvFile(envPath)).not.toThrow()
		})
	})

	describe('ensureEnvInGitignore', () => {
		it('creates .gitignore with .env if missing', () => {
			const result = ensureEnvInGitignore(testDir)

			expect(result).toBe(true)
			const content = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf-8')
			expect(content).toContain('.env')
		})

		it('appends .env when not already in .gitignore', () => {
			fs.writeFileSync(path.join(testDir, '.gitignore'), 'node_modules/\n', 'utf-8')

			const result = ensureEnvInGitignore(testDir)

			expect(result).toBe(true)
			const content = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf-8')
			expect(content).toContain('.env')
			expect(content).toContain('node_modules/')
		})

		it('is a no-op when .env is already listed', () => {
			fs.writeFileSync(path.join(testDir, '.gitignore'), 'node_modules/\n.env\ndist/\n', 'utf-8')

			const result = ensureEnvInGitignore(testDir)

			expect(result).toBe(false)
		})

		it('detects .env* wildcard pattern', () => {
			fs.writeFileSync(path.join(testDir, '.gitignore'), '.env*\n', 'utf-8')

			const result = ensureEnvInGitignore(testDir)

			expect(result).toBe(false)
		})
	})
})

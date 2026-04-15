import { afterEach, describe, expect, it } from 'vitest'
import {
	createEnvVarReference,
	extractEnvVarName,
	generateEnvVarName,
	isEnvVarReference,
	resolveEnvVarReference,
} from '../../../../src/infrastructure/utils/env-token.js'

describe('env-token utilities', () => {
	describe('generateEnvVarName', () => {
		it('generates correct name from integration name', () => {
			expect(generateEnvVarName('clickup-vanguard')).toBe('VANGUARD_CLICKUP_COPOINT_AI_TOKEN')
		})

		it('uppercases the name', () => {
			expect(generateEnvVarName('myintegration')).toBe('VANGUARD_MYINTEGRATION_TOKEN')
		})

		it('replaces hyphens with underscores', () => {
			expect(generateEnvVarName('JIRA-MY-PROJECT')).toBe('VANGUARD_JIRA_MY_PROJECT_TOKEN')
		})

		it('handles single-word names', () => {
			expect(generateEnvVarName('clickup')).toBe('VANGUARD_CLICKUP_TOKEN')
		})
	})

	describe('isEnvVarReference', () => {
		it('returns true for env: prefixed values', () => {
			expect(isEnvVarReference('env:VANGUARD_CLICKUP_TOKEN')).toBe(true)
		})

		it('returns true for env: with any suffix', () => {
			expect(isEnvVarReference('env:FOO')).toBe(true)
		})

		it('returns false for raw tokens', () => {
			expect(isEnvVarReference('pk_111940232_xxx')).toBe(false)
		})

		it('returns false for empty string', () => {
			expect(isEnvVarReference('')).toBe(false)
		})

		it('returns false for partial prefix', () => {
			expect(isEnvVarReference('en:FOO')).toBe(false)
		})
	})

	describe('extractEnvVarName', () => {
		it('strips the env: prefix', () => {
			expect(extractEnvVarName('env:VANGUARD_CLICKUP_TOKEN')).toBe('VANGUARD_CLICKUP_TOKEN')
		})
	})

	describe('resolveEnvVarReference', () => {
		const originalEnv = process.env

		afterEach(() => {
			process.env = originalEnv
		})

		it('resolves from process.env', () => {
			process.env = { ...originalEnv, VANGUARD_TEST_TOKEN: 'my-secret-token' }
			expect(resolveEnvVarReference('env:VANGUARD_TEST_TOKEN')).toBe('my-secret-token')
		})

		it('throws when env var is not set', () => {
			process.env = { ...originalEnv }
			Reflect.deleteProperty(process.env, 'VANGUARD_MISSING_TOKEN')

			expect(() => resolveEnvVarReference('env:VANGUARD_MISSING_TOKEN')).toThrow(
				'Environment variable VANGUARD_MISSING_TOKEN is not set',
			)
		})

		it('throws when env var is empty string', () => {
			process.env = { ...originalEnv, VANGUARD_EMPTY_TOKEN: '' }

			expect(() => resolveEnvVarReference('env:VANGUARD_EMPTY_TOKEN')).toThrow(
				'Environment variable VANGUARD_EMPTY_TOKEN is not set',
			)
		})
	})

	describe('createEnvVarReference', () => {
		it('creates env: prefixed reference', () => {
			expect(createEnvVarReference('VANGUARD_CLICKUP_TOKEN')).toBe('env:VANGUARD_CLICKUP_TOKEN')
		})
	})
})

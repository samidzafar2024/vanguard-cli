import { describe, expect, it } from 'vitest'
import {
	MethodologyBundleValidationError,
	parseMethodologyBundle,
} from '../../../../src/domain/entities/methodology-bundle.js'
import type { MethodologyBundle } from '../../../../src/domain/entities/methodology-bundle.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createValidBundleJson(): Record<string, unknown> {
	return {
		files: [
			{
				path: '.claude/commands/vanguard/agents/analyst.md',
				content: '# Analyst\n\n> Business Analyst & Requirements Expert\n',
			},
			{
				path: '.claude/commands/vanguard.discover.md',
				content: '# Discover Phase\n\nAnalyze the codebase.\n',
			},
			{
				path: '.vanguard/workflows/discover/gather-context.md',
				content: '# Step 1: Gather Context\n\nBuild a mental model.\n',
			},
			{
				path: '.vanguard/workflows/discover/_flow.yaml',
				content: 'workflow:\n  id: discover\n  name: Discovery Workflow\n',
			},
			{
				path: '.vanguard/constitution.md',
				content: '# Project Constitution\n\nCore principles.\n',
			},
			{
				path: '.vanguard/templates/spec-template.md',
				content: '# Specification: {{feature}}\n',
			},
		],
		contentHash: 'abc123def456',
		bundledAt: '2026-02-10T14:30:00Z',
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseMethodologyBundle', () => {
	it('parses a valid bundle response', () => {
		const json = createValidBundleJson()
		const bundle: MethodologyBundle = parseMethodologyBundle(json)

		expect(bundle.files).toHaveLength(6)
		expect(bundle.contentHash).toBe('abc123def456')
		expect(bundle.bundledAt).toBe('2026-02-10T14:30:00Z')
	})

	it('preserves file paths and content', () => {
		const bundle = parseMethodologyBundle(createValidBundleJson())

		const agentFile = bundle.files.find((f) => f.path.includes('agents/analyst.md'))
		expect(agentFile).toBeDefined()
		expect(agentFile?.path).toBe('.claude/commands/vanguard/agents/analyst.md')
		expect(agentFile?.content).toContain('# Analyst')

		const constitutionFile = bundle.files.find((f) => f.path.includes('constitution.md'))
		expect(constitutionFile).toBeDefined()
		expect(constitutionFile?.content).toContain('# Project Constitution')
	})

	it('returns readonly files array', () => {
		const bundle = parseMethodologyBundle(createValidBundleJson())

		// TypeScript enforces readonly, but verify the shape is correct
		expect(Array.isArray(bundle.files)).toBe(true)
		for (const file of bundle.files) {
			expect(typeof file.path).toBe('string')
			expect(typeof file.content).toBe('string')
		}
	})

	it('parses empty files array', () => {
		const json = {
			files: [],
			contentHash: 'empty-hash',
			bundledAt: '2026-01-01T00:00:00Z',
		}

		const bundle = parseMethodologyBundle(json)
		expect(bundle.files).toEqual([])
		expect(bundle.contentHash).toBe('empty-hash')
	})

	it('throws on null input', () => {
		expect(() => parseMethodologyBundle(null)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(null)).toThrow('Expected an object')
	})

	it('throws on non-object input', () => {
		expect(() => parseMethodologyBundle('string')).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(42)).toThrow(MethodologyBundleValidationError)
	})

	it('throws when files field is missing', () => {
		const json = {
			contentHash: 'abc',
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected array for field 'files'")
	})

	it('throws when files is not an array', () => {
		const json = {
			files: 'not-an-array',
			contentHash: 'abc',
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected array for field 'files'")
	})

	it('throws when contentHash is missing', () => {
		const json = {
			files: [],
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected string for field 'contentHash'")
	})

	it('throws when contentHash is wrong type', () => {
		const json = {
			files: [],
			contentHash: 123,
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected string for field 'contentHash'")
	})

	it('throws when bundledAt is missing', () => {
		const json = {
			files: [],
			contentHash: 'abc',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected string for field 'bundledAt'")
	})

	it('throws when a rendered file is not an object', () => {
		const json = {
			files: ['not-an-object'],
			contentHash: 'abc',
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow('Expected object for rendered file')
	})

	it('throws when a rendered file is missing path', () => {
		const json = {
			files: [{ content: 'some content' }],
			contentHash: 'abc',
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected string for field 'path'")
	})

	it('throws when a rendered file is missing content', () => {
		const json = {
			files: [{ path: '.vanguard/constitution.md' }],
			contentHash: 'abc',
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected string for field 'content'")
	})

	it('throws when a rendered file path is wrong type', () => {
		const json = {
			files: [{ path: 123, content: 'some content' }],
			contentHash: 'abc',
			bundledAt: '2026-01-01T00:00:00Z',
		}

		expect(() => parseMethodologyBundle(json)).toThrow(MethodologyBundleValidationError)
		expect(() => parseMethodologyBundle(json)).toThrow("Expected string for field 'path'")
	})

	it('handles large file count', () => {
		const files = Array.from({ length: 50 }, (_, i) => ({
			path: `.vanguard/file-${i}.md`,
			content: `Content for file ${i}`,
		}))

		const bundle = parseMethodologyBundle({
			files,
			contentHash: 'large-hash',
			bundledAt: '2026-02-10T00:00:00Z',
		})

		expect(bundle.files).toHaveLength(50)
		expect(bundle.files[49]?.path).toBe('.vanguard/file-49.md')
	})

	// -----------------------------------------------------------------------
	// Hook-related parsing (executable, hookConfig)
	// -----------------------------------------------------------------------

	it('parses executable flag on rendered files', () => {
		const json = createValidBundleJson()
		;(json.files as Record<string, unknown>[]).push({
			path: '.claude/hooks/memory-protocol.sh',
			content: '#!/bin/bash\necho test',
			executable: true,
		})

		const bundle = parseMethodologyBundle(json)
		const hookFile = bundle.files.find((f) => f.path.includes('memory-protocol.sh'))

		expect(hookFile?.executable).toBe(true)
	})

	it('omits executable when not set', () => {
		const bundle = parseMethodologyBundle(createValidBundleJson())

		for (const file of bundle.files) {
			expect(file.executable).toBeUndefined()
		}
	})

	it('parses hookConfig when present', () => {
		const json = createValidBundleJson()
		;(json as Record<string, unknown>).hookConfig = {
			hooks: {
				PostToolUse: [
					{
						hooks: [{ type: 'command', command: 'test-track', timeout: 2 }],
					},
				],
				PreToolUse: [
					{
						matcher: 'Skill',
						hooks: [{ type: 'command', command: 'test-phase', timeout: 5 }],
					},
				],
				Stop: [
					{
						hooks: [{ type: 'command', command: 'test-check', timeout: 3 }],
					},
				],
			},
		}

		const bundle = parseMethodologyBundle(json)

		expect(bundle.hookConfig).toBeDefined()
		expect(bundle.hookConfig?.hooks.PostToolUse).toHaveLength(1)
		expect(bundle.hookConfig?.hooks.PostToolUse[0]?.hooks[0]?.command).toBe('test-track')
		expect(bundle.hookConfig?.hooks.PostToolUse[0]?.hooks[0]?.timeout).toBe(2)
		expect(bundle.hookConfig?.hooks.PreToolUse[0]?.matcher).toBe('Skill')
		expect(bundle.hookConfig?.hooks.Stop).toHaveLength(1)
	})

	it('returns undefined hookConfig when not present', () => {
		const bundle = parseMethodologyBundle(createValidBundleJson())
		expect(bundle.hookConfig).toBeUndefined()
	})

	it('preserves matcher on hook entries when provided', () => {
		const json = createValidBundleJson()
		;(json as Record<string, unknown>).hookConfig = {
			hooks: {
				PreToolUse: [
					{
						matcher: 'Skill',
						hooks: [{ type: 'command', command: 'cmd', timeout: 5 }],
					},
				],
			},
		}

		const bundle = parseMethodologyBundle(json)
		expect(bundle.hookConfig?.hooks.PreToolUse[0]?.matcher).toBe('Skill')
	})

	it('omits matcher when not provided in hook entry', () => {
		const json = createValidBundleJson()
		;(json as Record<string, unknown>).hookConfig = {
			hooks: {
				Stop: [
					{
						hooks: [{ type: 'command', command: 'cmd', timeout: 3 }],
					},
				],
			},
		}

		const bundle = parseMethodologyBundle(json)
		expect(bundle.hookConfig?.hooks.Stop[0]?.matcher).toBeUndefined()
	})

	it('defaults timeout when not a number in hookConfig', () => {
		const json = createValidBundleJson()
		;(json as Record<string, unknown>).hookConfig = {
			hooks: {
				Stop: [
					{
						hooks: [{ type: 'command', command: 'cmd' }],
					},
				],
			},
		}

		const bundle = parseMethodologyBundle(json)
		expect(bundle.hookConfig?.hooks.Stop[0]?.hooks[0]?.timeout).toBe(5)
	})

	it('parses phases from bundle', () => {
		const json = createValidBundleJson()
		;(json as Record<string, unknown>).phases = [
			{ slug: 'discover', name: 'Discover', description: 'Analyze codebase' },
			{ slug: 'implement', name: 'Implement', description: 'Write code' },
		]

		const bundle = parseMethodologyBundle(json)
		expect(bundle.phases).toHaveLength(2)
		expect(bundle.phases[0]?.slug).toBe('discover')
	})

	it('defaults to empty phases when not provided', () => {
		const json = createValidBundleJson()
		;(json as Record<string, unknown>).phases = undefined

		const bundle = parseMethodologyBundle(json)
		expect(bundle.phases).toHaveLength(0)
	})
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileReader } from '../../../../src/application/ports/file-reader.js'
import type { FileWriter } from '../../../../src/application/ports/file-writer.js'
import { HookWiringService } from '../../../../src/application/services/hook-wiring.service.js'
import type {
	BundleHookConfig,
	RenderedFile,
} from '../../../../src/domain/entities/methodology-bundle.js'
import { FilePath } from '../../../../src/domain/value-objects/file-path.js'

// ---------------------------------------------------------------------------
// Mock chmod — must be before service import uses it
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
	chmod: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockFileWriter(): FileWriter {
	return {
		write: vi.fn().mockResolvedValue({ path: FilePath.create('/tmp/x'), success: true }),
		writeAll: vi.fn().mockResolvedValue([]),
		ensureDirectory: vi.fn().mockResolvedValue(undefined),
		exists: vi.fn().mockResolvedValue(false),
		symlink: vi.fn().mockResolvedValue({ path: FilePath.create('/tmp/x'), success: true }),
		delete: vi.fn().mockResolvedValue(undefined),
	}
}

function createMockFileReader(): FileReader {
	return {
		read: vi.fn().mockRejectedValue(new Error('ENOENT')),
		readOrNull: vi.fn().mockResolvedValue(null),
		exists: vi.fn().mockResolvedValue(false),
		listFiles: vi.fn().mockResolvedValue([]),
	}
}

function createHookConfig(overrides: Partial<BundleHookConfig> = {}): BundleHookConfig {
	return {
		hooks: {
			PostToolUse: [
				{
					hooks: [
						{
							type: 'command',
							command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/memory-protocol.sh track',
							timeout: 2,
						},
					],
				},
			],
			PreToolUse: [
				{
					matcher: 'Skill',
					hooks: [
						{
							type: 'command',
							command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/memory-protocol.sh phase',
							timeout: 5,
						},
					],
				},
			],
			Stop: [
				{
					hooks: [
						{
							type: 'command',
							command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/memory-protocol.sh check',
							timeout: 3,
						},
					],
				},
			],
		},
		...overrides,
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HookWiringService', () => {
	let service: HookWiringService
	let fileWriter: FileWriter
	let fileReader: FileReader

	beforeEach(() => {
		vi.clearAllMocks()
		fileWriter = createMockFileWriter()
		fileReader = createMockFileReader()
		service = new HookWiringService(fileWriter, fileReader)
	})

	describe('wire()', () => {
		it('merges hook config into empty settings.json', async () => {
			vi.mocked(fileReader.readOrNull).mockResolvedValue(null)

			const result = await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			expect(result.settingsMerged).toBe(true)
			expect(fileWriter.write).toHaveBeenCalledOnce()

			const written = vi.mocked(fileWriter.write).mock.calls[0]?.[0]
			const parsed = JSON.parse(written?.content)
			expect(parsed.hooks.PostToolUse).toHaveLength(1)
			expect(parsed.hooks.PreToolUse).toHaveLength(1)
			expect(parsed.hooks.Stop).toHaveLength(1)
		})

		it('preserves existing user hooks', async () => {
			const existing = {
				hooks: {
					SessionStart: [
						{
							matcher: 'startup',
							hooks: [
								{
									type: 'command',
									command: 'vanguard memory hook session-start',
									timeout: 10,
								},
							],
						},
					],
				},
			}
			vi.mocked(fileReader.readOrNull).mockResolvedValue(JSON.stringify(existing))

			await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			const written = vi.mocked(fileWriter.write).mock.calls[0]?.[0]
			const parsed = JSON.parse(written?.content)

			// User hooks preserved
			expect(parsed.hooks.SessionStart).toHaveLength(1)
			expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe(
				'vanguard memory hook session-start',
			)

			// Bundle hooks added
			expect(parsed.hooks.PostToolUse).toHaveLength(1)
			expect(parsed.hooks.PreToolUse).toHaveLength(1)
			expect(parsed.hooks.Stop).toHaveLength(1)
		})

		it('deduplicates by command string', async () => {
			const existing = {
				hooks: {
					PostToolUse: [
						{
							hooks: [
								{
									type: 'command',
									command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/memory-protocol.sh track',
									timeout: 2,
								},
							],
						},
					],
				},
			}
			vi.mocked(fileReader.readOrNull).mockResolvedValue(JSON.stringify(existing))

			await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			const written = vi.mocked(fileWriter.write).mock.calls[0]?.[0]
			const parsed = JSON.parse(written?.content)

			// No duplicate — still only 1 PostToolUse entry
			expect(parsed.hooks.PostToolUse).toHaveLength(1)
		})

		it('adds new hooks when existing has different commands', async () => {
			const existing = {
				hooks: {
					PostToolUse: [
						{
							hooks: [
								{
									type: 'command',
									command: 'some-other-hook',
									timeout: 5,
								},
							],
						},
					],
				},
			}
			vi.mocked(fileReader.readOrNull).mockResolvedValue(JSON.stringify(existing))

			await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			const written = vi.mocked(fileWriter.write).mock.calls[0]?.[0]
			const parsed = JSON.parse(written?.content)

			// Both kept — different commands
			expect(parsed.hooks.PostToolUse).toHaveLength(2)
		})

		it('preserves non-hooks settings keys', async () => {
			const existing = {
				permissions: { allow: ['mcp__vanguard__add_memory'] },
				env: { VANGUARD_TOKEN: 'secret' },
				hooks: {},
			}
			vi.mocked(fileReader.readOrNull).mockResolvedValue(JSON.stringify(existing))

			await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			const written = vi.mocked(fileWriter.write).mock.calls[0]?.[0]
			const parsed = JSON.parse(written?.content)

			expect(parsed.permissions.allow).toContain('mcp__vanguard__add_memory')
			expect(parsed.env.VANGUARD_TOKEN).toBe('secret')
		})

		it('handles corrupted settings.json gracefully', async () => {
			vi.mocked(fileReader.readOrNull).mockResolvedValue('not valid json {{{')

			const result = await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			expect(result.settingsMerged).toBe(true)
			const written = vi.mocked(fileWriter.write).mock.calls[0]?.[0]
			const parsed = JSON.parse(written?.content)
			expect(parsed.hooks.PostToolUse).toHaveLength(1)
		})

		it('sets executable permissions on hook scripts', async () => {
			const { chmod } = await import('node:fs/promises')

			const executableFiles: RenderedFile[] = [
				{
					path: '.claude/hooks/memory-protocol.sh',
					content: '#!/bin/bash\necho test',
					executable: true,
				},
			]

			const result = await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles,
			})

			expect(result.executableCount).toBe(1)
			expect(chmod).toHaveBeenCalledWith('/proj/.claude/hooks/memory-protocol.sh', 0o755)
		})

		it('handles chmod failure gracefully', async () => {
			const { chmod } = await import('node:fs/promises')
			vi.mocked(chmod).mockRejectedValueOnce(new Error('EPERM'))

			const result = await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [
					{
						path: '.claude/hooks/memory-protocol.sh',
						content: '#!/bin/bash',
						executable: true,
					},
				],
			})

			// Should not throw, just skip the chmod
			expect(result.executableCount).toBe(0)
			expect(result.settingsMerged).toBe(true)
		})

		it('ensures .claude directory exists', async () => {
			vi.mocked(fileReader.readOrNull).mockResolvedValue(null)

			await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			expect(fileWriter.ensureDirectory).toHaveBeenCalled()
		})

		it('re-merges on refresh (idempotent)', async () => {
			// First wire
			vi.mocked(fileReader.readOrNull).mockResolvedValue(null)
			await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			// Get what was written and feed it back
			const firstWrite = vi.mocked(fileWriter.write).mock.calls[0]?.[0]
			vi.mocked(fileReader.readOrNull).mockResolvedValue(firstWrite?.content)

			// Second wire (refresh) — same config
			await service.wire({
				projectRoot: '/proj',
				hookConfig: createHookConfig(),
				executableFiles: [],
			})

			const secondWrite = vi.mocked(fileWriter.write).mock.calls[1]?.[0]
			const parsed = JSON.parse(secondWrite?.content)

			// Still only 1 entry per event — no duplicates
			expect(parsed.hooks.PostToolUse).toHaveLength(1)
			expect(parsed.hooks.PreToolUse).toHaveLength(1)
			expect(parsed.hooks.Stop).toHaveLength(1)
		})
	})
})

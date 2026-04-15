import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileReader } from '../../../../src/application/ports/file-reader.js'
import type { FileWriter, WriteResult } from '../../../../src/application/ports/file-writer.js'
import type { MethodologyBundleApiClient } from '../../../../src/application/ports/methodology-bundle-api-client.js'
import { MethodologyService } from '../../../../src/application/services/methodology.service.js'
import type { MethodologyBundle } from '../../../../src/domain/entities/methodology-bundle.js'
import { FilePath } from '../../../../src/domain/value-objects/file-path.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockBundleClient(): MethodologyBundleApiClient {
	return {
		fetch: vi.fn(),
		fetchIfChanged: vi.fn(),
	}
}

function createMockFileWriter(): FileWriter {
	return {
		write: vi.fn().mockResolvedValue({ path: FilePath.create('/tmp/x'), success: true }),
		writeAll: vi.fn().mockResolvedValue([]),
		ensureDirectory: vi.fn().mockResolvedValue(undefined),
		exists: vi.fn().mockResolvedValue(false),
		symlink: vi.fn().mockResolvedValue({ path: FilePath.create('/tmp/x'), success: true }),
	}
}

function createMockFileReader(): FileReader {
	return {
		read: vi.fn().mockRejectedValue(new Error('ENOENT')),
		readOrNull: vi.fn().mockResolvedValue(null),
		exists: vi.fn().mockResolvedValue(false),
	}
}

function createBundle(overrides: Partial<MethodologyBundle> = {}): MethodologyBundle {
	return {
		files: [
			{ path: '.claude/commands/vanguard/agents/analyst.md', content: '# Analyst' },
			{ path: '.claude/commands/vanguard.discover.md', content: '# Discover' },
			{ path: '.vanguard/constitution.md', content: '# Constitution' },
		],
		phases: [],
		contentHash: 'abc123',
		bundledAt: '2026-02-10T00:00:00Z',
		...overrides,
	}
}

function successResult(filePath: string): WriteResult {
	return { path: FilePath.create(filePath), success: true }
}

// ---------------------------------------------------------------------------
// install()
// ---------------------------------------------------------------------------

describe('MethodologyService.install', () => {
	let service: MethodologyService
	let bundleClient: MethodologyBundleApiClient
	let fileWriter: FileWriter
	let fileReader: FileReader

	beforeEach(() => {
		bundleClient = createMockBundleClient()
		fileWriter = createMockFileWriter()
		fileReader = createMockFileReader()
		service = new MethodologyService(bundleClient, fileWriter, fileReader)
	})

	it('fetches bundle and writes files', async () => {
		const bundle = createBundle()
		vi.mocked(bundleClient.fetch).mockResolvedValue(bundle)
		vi.mocked(fileWriter.writeAll).mockResolvedValue([
			successResult('/proj/.claude/commands/vanguard/agents/analyst.md'),
			successResult('/proj/.claude/commands/vanguard.discover.md'),
			successResult('/proj/.vanguard/constitution.md'),
		])

		const result = await service.install('proj-123', '/proj')

		expect(bundleClient.fetch).toHaveBeenCalledWith('proj-123')
		expect(fileWriter.writeAll).toHaveBeenCalledOnce()
		expect(result.filesWritten).toBe(3)
		expect(result.usedBundle).toBe(true)
		expect(result.contentHash).toBe('abc123')
	})

	it('converts RenderedFile paths to absolute GeneratedFile paths', async () => {
		const bundle = createBundle({
			files: [{ path: '.vanguard/constitution.md', content: '# Test' }],
		})
		vi.mocked(bundleClient.fetch).mockResolvedValue(bundle)
		vi.mocked(fileWriter.writeAll).mockResolvedValue([
			successResult('/my-project/.vanguard/constitution.md'),
		])

		await service.install('proj-123', '/my-project')

		const writtenFiles = vi.mocked(fileWriter.writeAll).mock.calls[0]?.[0]
		expect(writtenFiles).toHaveLength(1)
		expect(writtenFiles[0]?.path.toString()).toBe('/my-project/.vanguard/constitution.md')
		expect(writtenFiles[0]?.content).toBe('# Test')
	})

	it('stores content hash and project ID', async () => {
		vi.mocked(bundleClient.fetch).mockResolvedValue(createBundle())
		vi.mocked(fileWriter.writeAll).mockResolvedValue([])

		await service.install('proj-456', '/proj')

		const writeCalls = vi.mocked(fileWriter.write).mock.calls
		expect(writeCalls).toHaveLength(2)

		// Content hash
		expect(writeCalls[0]?.[0].path.toString()).toContain('.content-hash')
		expect(writeCalls[0]?.[0].content).toBe('abc123')

		// Project ID
		expect(writeCalls[1]?.[0].path.toString()).toContain('.project-id')
		expect(writeCalls[1]?.[0].content).toBe('proj-456')
	})

	it('counts only successful writes', async () => {
		vi.mocked(bundleClient.fetch).mockResolvedValue(createBundle())
		vi.mocked(fileWriter.writeAll).mockResolvedValue([
			successResult('/proj/a'),
			{ path: FilePath.create('/proj/b'), success: false, error: 'EPERM' },
			successResult('/proj/c'),
		])

		const result = await service.install('proj-123', '/proj')
		expect(result.filesWritten).toBe(2)
	})

	it('propagates fetch errors', async () => {
		vi.mocked(bundleClient.fetch).mockRejectedValue(new Error('Network error'))

		await expect(service.install('proj-123', '/proj')).rejects.toThrow('Network error')
	})
})

// ---------------------------------------------------------------------------
// refresh()
// ---------------------------------------------------------------------------

describe('MethodologyService.refresh', () => {
	let service: MethodologyService
	let bundleClient: MethodologyBundleApiClient
	let fileWriter: FileWriter
	let fileReader: FileReader

	beforeEach(() => {
		bundleClient = createMockBundleClient()
		fileWriter = createMockFileWriter()
		fileReader = createMockFileReader()
		service = new MethodologyService(bundleClient, fileWriter, fileReader)
	})

	it('throws when no project ID is stored', async () => {
		// fileReader.readOrNull returns null by default → no project ID
		await expect(service.refresh('/nonexistent')).rejects.toThrow('No project ID found')
	})

	it('uses fetchIfChanged when content hash exists', async () => {
		// Mock: project ID exists, content hash exists
		vi.mocked(fileReader.readOrNull).mockImplementation(async (p) => {
			const pathStr = p.toString()
			if (pathStr.includes('.project-id')) return 'proj-789'
			if (pathStr.includes('.content-hash')) return 'old-hash'
			return null
		})
		vi.mocked(bundleClient.fetchIfChanged).mockResolvedValue(null)

		const result = await service.refresh('/proj')

		expect(bundleClient.fetchIfChanged).toHaveBeenCalledWith('proj-789', 'old-hash')
		expect(result.hasChanges).toBe(false)
	})

	it('detects new files', async () => {
		vi.mocked(fileReader.readOrNull).mockImplementation(async (p) => {
			if (p.toString().includes('.project-id')) return 'proj-1'
			if (p.toString().includes('.content-hash')) return null
			return null // file doesn't exist on disk
		})
		const bundle = createBundle({
			files: [{ path: '.vanguard/new-file.md', content: '# New' }],
		})
		vi.mocked(bundleClient.fetch).mockResolvedValue(bundle)

		const result = await service.refresh('/proj')

		expect(result.hasChanges).toBe(true)
		expect(result.changes).toHaveLength(1)
		expect(result.changes[0]?.status).toBe('new')
	})

	it('detects modified files', async () => {
		vi.mocked(fileReader.readOrNull).mockImplementation(async (p) => {
			if (p.toString().includes('.project-id')) return 'proj-1'
			if (p.toString().includes('.content-hash')) return null
			return '# Old content' // existing file on disk
		})
		const bundle = createBundle({
			files: [{ path: '.vanguard/file.md', content: '# New content' }],
		})
		vi.mocked(bundleClient.fetch).mockResolvedValue(bundle)

		const result = await service.refresh('/proj')

		expect(result.hasChanges).toBe(true)
		expect(result.changes[0]?.status).toBe('modified')
	})

	it('detects unchanged files', async () => {
		vi.mocked(fileReader.readOrNull).mockImplementation(async (p) => {
			if (p.toString().includes('.project-id')) return 'proj-1'
			if (p.toString().includes('.content-hash')) return null
			return '# Same' // same content on disk
		})
		const bundle = createBundle({
			files: [{ path: '.vanguard/file.md', content: '# Same' }],
		})
		vi.mocked(bundleClient.fetch).mockResolvedValue(bundle)

		const result = await service.refresh('/proj')

		expect(result.hasChanges).toBe(false)
		expect(result.changes[0]?.status).toBe('unchanged')
	})
})

// ---------------------------------------------------------------------------
// applyRefresh()
// ---------------------------------------------------------------------------

describe('MethodologyService.applyRefresh', () => {
	let service: MethodologyService
	let bundleClient: MethodologyBundleApiClient
	let fileWriter: FileWriter
	let fileReader: FileReader

	beforeEach(() => {
		bundleClient = createMockBundleClient()
		fileWriter = createMockFileWriter()
		fileReader = createMockFileReader()
		service = new MethodologyService(bundleClient, fileWriter, fileReader)
	})

	it('returns 0 when bundle is null', async () => {
		const result = await service.applyRefresh(
			{ hasChanges: false, changes: [], bundle: null, executableFiles: [] },
			'/proj',
		)
		expect(result).toBe(0)
		expect(fileWriter.writeAll).not.toHaveBeenCalled()
	})

	it('writes bundle files and returns count', async () => {
		const bundle = createBundle()
		vi.mocked(fileWriter.writeAll).mockResolvedValue([
			successResult('/proj/a'),
			successResult('/proj/b'),
			successResult('/proj/c'),
		])
		vi.mocked(fileReader.readOrNull).mockImplementation(async (p) => {
			if (p.toString().includes('.project-id')) return 'proj-1'
			return null
		})

		const result = await service.applyRefresh(
			{ hasChanges: true, changes: [], bundle, executableFiles: [] },
			'/proj',
		)
		expect(result).toBe(3)
		expect(fileWriter.writeAll).toHaveBeenCalledOnce()
	})
})

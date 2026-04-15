/**
 * File-based Memory Repository Implementation.
 *
 * Stores memory items as markdown files with YAML frontmatter
 * in the .vanguard/memory/items/ directory.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type {
	MemoryQueryOptions,
	MemoryRepository,
} from '../../application/ports/memory-repository.js'
import type { MemoryItem } from '../../domain/entities/memory-item.js'
import type { ConfidenceLevel } from '../../domain/value-objects/confidence.js'
import type { ContentHash } from '../../domain/value-objects/content-hash.js'
import type { MemoryId } from '../../domain/value-objects/memory-id.js'
import { MemoryFileParser } from '../persistence/memory-file-parser.js'
import { MemoryFileWriter } from '../persistence/memory-file-writer.js'

/**
 * Confidence level ordering for comparison.
 */
const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
	low: 0,
	medium: 1,
	high: 2,
}

/**
 * File-based implementation of MemoryRepository.
 *
 * Directory structure:
 * .vanguard/memory/items/
 * ├── patterns/
 * │   ├── error-handling/
 * │   │   └── api-errors.md
 * │   └── logging/
 * │       └── structured-logs.md
 * └── decisions/
 *     └── 003-auth-strategy.md
 */
export class FileMemoryRepository implements MemoryRepository {
	private readonly itemsDir: string
	private readonly parser: MemoryFileParser
	private readonly writer: MemoryFileWriter

	constructor(cwd: string = process.cwd()) {
		this.itemsDir = join(cwd, '.vanguard', 'memory', 'items')
		this.parser = new MemoryFileParser()
		this.writer = new MemoryFileWriter()
	}

	async save(item: MemoryItem): Promise<void> {
		const dirPath = item.id.getDirectory(this.itemsDir)
		const filePath = item.id.getFilePath(this.itemsDir)

		// Ensure directory exists
		if (!existsSync(dirPath)) {
			mkdirSync(dirPath, { recursive: true })
		}

		// Serialize and write
		const content = this.writer.serialize(item)
		writeFileSync(filePath, content, 'utf-8')
	}

	async findById(id: MemoryId): Promise<MemoryItem | undefined> {
		const filePath = id.getFilePath(this.itemsDir)

		if (!existsSync(filePath)) {
			return undefined
		}

		try {
			const content = readFileSync(filePath, 'utf-8')
			const parsed = this.parser.parse(content, filePath)
			return parsed.item
		} catch {
			return undefined
		}
	}

	async findAll(options: MemoryQueryOptions = {}): Promise<readonly MemoryItem[]> {
		const items = await this.loadAllItems()
		let filtered = this.applyFilters(items, options)
		filtered = this.applyPagination(filtered, options)
		return filtered
	}

	async delete(id: MemoryId): Promise<void> {
		const filePath = id.getFilePath(this.itemsDir)

		if (existsSync(filePath)) {
			unlinkSync(filePath)
		}
	}

	async exists(id: MemoryId): Promise<boolean> {
		const filePath = id.getFilePath(this.itemsDir)
		return existsSync(filePath)
	}

	async saveAll(items: readonly MemoryItem[]): Promise<void> {
		for (const item of items) {
			await this.save(item)
		}
	}

	async findByDomain(domain: string): Promise<readonly MemoryItem[]> {
		return this.findAll({ domain })
	}

	async findByTag(tag: string): Promise<readonly MemoryItem[]> {
		return this.findAll({ tags: [tag] })
	}

	async findByConfidence(minConfidence: ConfidenceLevel): Promise<readonly MemoryItem[]> {
		const items = await this.loadAllItems()
		const minOrder = CONFIDENCE_ORDER[minConfidence]

		return items.filter((item) => CONFIDENCE_ORDER[item.confidence.level] >= minOrder)
	}

	async getContentHash(id: MemoryId): Promise<ContentHash | undefined> {
		const item = await this.findById(id)
		return item?.contentHash
	}

	async getAllIds(): Promise<readonly MemoryId[]> {
		const items = await this.loadAllItems()
		return items.map((item) => item.id)
	}

	async getDomains(): Promise<readonly string[]> {
		const items = await this.loadAllItems()
		const domains = new Set(items.map((item) => item.domain))
		return [...domains].sort()
	}

	async getTags(): Promise<readonly string[]> {
		const items = await this.loadAllItems()
		const tags = new Set(items.flatMap((item) => item.tags))
		return [...tags].sort()
	}

	async count(options: MemoryQueryOptions = {}): Promise<number> {
		const items = await this.loadAllItems()
		const { limit: _limit, offset: _offset, ...filterOptions } = options
		const filtered = this.applyFilters(items, filterOptions)
		return filtered.length
	}

	/**
	 * Load all memory items from disk.
	 */
	private async loadAllItems(): Promise<MemoryItem[]> {
		if (!existsSync(this.itemsDir)) {
			return []
		}

		const items: MemoryItem[] = []
		this.walkDirectory(this.itemsDir, items)
		return items
	}

	/**
	 * Recursively walk a directory and load all memory items.
	 */
	private walkDirectory(dir: string, items: MemoryItem[]): void {
		const entries = readdirSync(dir)

		for (const entry of entries) {
			const fullPath = join(dir, entry)
			const stat = statSync(fullPath)

			if (stat.isDirectory()) {
				this.walkDirectory(fullPath, items)
			} else if (entry.endsWith('.md')) {
				try {
					const content = readFileSync(fullPath, 'utf-8')
					const parsed = this.parser.parse(content, fullPath)
					items.push(parsed.item)
				} catch {
					// Skip files that fail to parse
				}
			}
		}
	}

	/**
	 * Apply filters to a list of items.
	 */
	private applyFilters(items: MemoryItem[], options: MemoryQueryOptions): MemoryItem[] {
		let result = [...items]

		if (options.domain !== undefined) {
			result = result.filter((item) => item.domain === options.domain)
		}

		if (options.topic !== undefined) {
			result = result.filter((item) => item.topic === options.topic)
		}

		if (options.tags !== undefined && options.tags.length > 0) {
			const tagSet = new Set(options.tags.map((t) => t.toLowerCase()))
			result = result.filter((item) => item.tags.some((t) => tagSet.has(t)))
		}

		if (options.confidence !== undefined && options.confidence.length > 0) {
			const confidenceSet = new Set(options.confidence)
			result = result.filter((item) => confidenceSet.has(item.confidence.level))
		}

		if (options.source !== undefined && options.source.length > 0) {
			const sourceSet = new Set(options.source)
			result = result.filter((item) => sourceSet.has(item.source.type))
		}

		return result
	}

	/**
	 * Apply pagination to a list of items.
	 */
	private applyPagination(items: MemoryItem[], options: MemoryQueryOptions): MemoryItem[] {
		const offset = options.offset ?? 0
		const limit = options.limit

		let result = items
		if (offset > 0) {
			result = result.slice(offset)
		}

		if (limit !== undefined && limit > 0) {
			result = result.slice(0, limit)
		}

		return result
	}
}

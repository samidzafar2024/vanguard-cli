/**
 * Memory File Parser.
 *
 * Parses memory item markdown files with YAML frontmatter.
 * File format:
 *
 * ```markdown
 * ---
 * id: domain/topic/item-title
 * title: Item Title
 * domain: domain
 * topic: topic
 * subtopic: subtopic
 * confidence: established
 * source: manual
 * author: Dave
 * tags:
 *   - tag1
 *   - tag2
 * relations:
 *   - domain/other-item
 * created_at: 2024-01-15T10:00:00Z
 * updated_at: 2024-01-15T10:00:00Z
 * ---
 *
 * Content goes here...
 * ```
 */

import { parse } from 'yaml'
import { z } from 'zod'
import { type CaptureContext, MemoryItem } from '../../domain/entities/memory-item.js'
import { Confidence, type ConfidenceLevel } from '../../domain/value-objects/confidence.js'
import { ContentHash } from '../../domain/value-objects/content-hash.js'
import { MemoryId } from '../../domain/value-objects/memory-id.js'
import { MemorySource, type MemorySourceType } from '../../domain/value-objects/memory-source.js'

/**
 * Zod schema for memory item frontmatter.
 */
const MemoryFrontmatterSchema = z.object({
	id: z.string(),
	title: z.string(),
	domain: z.string(),
	topic: z.string().optional(),
	subtopic: z.string().optional(),
	confidence: z.enum(['low', 'medium', 'high']).optional(),
	source: z.enum(['manual', 'auto-captured', 'imported']).optional(),
	author: z.string().optional(),
	tags: z.array(z.string()).optional(),
	relations: z.array(z.string()).optional(),
	capture_context: z
		.object({
			session_id: z.string().optional(),
			source_files: z.array(z.string()).optional(),
			confidence_score: z.number().optional(),
		})
		.optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
})

type MemoryFrontmatter = z.infer<typeof MemoryFrontmatterSchema>

/**
 * Result of parsing a memory file.
 */
export interface ParsedMemoryFile {
	readonly item: MemoryItem
	readonly rawFrontmatter: MemoryFrontmatter
	readonly rawContent: string
}

/**
 * Error thrown when parsing a memory file fails.
 */
export class MemoryFileParseError extends Error {
	constructor(
		public readonly filePath: string,
		public readonly reason: string,
		public readonly cause?: unknown,
	) {
		super(`Failed to parse memory file ${filePath}: ${reason}`)
		this.name = 'MemoryFileParseError'
	}
}

/**
 * Memory file parser.
 *
 * Parses markdown files with YAML frontmatter into MemoryItem entities.
 */
export class MemoryFileParser {
	/**
	 * Parse a memory file from its raw content.
	 */
	parse(fileContent: string, filePath: string): ParsedMemoryFile {
		const { frontmatter, content } = this.extractFrontmatter(fileContent, filePath)
		const validated = this.validateFrontmatter(frontmatter, filePath)
		const item = this.createMemoryItem(validated, content)

		return {
			item,
			rawFrontmatter: validated,
			rawContent: content,
		}
	}

	/**
	 * Parse the ID from a filename.
	 * Files are named: {slugified-id}.md
	 */
	parseIdFromFilename(filename: string): string {
		return filename.replace(/\.md$/, '')
	}

	/**
	 * Extract frontmatter and content from a markdown file.
	 */
	private extractFrontmatter(
		fileContent: string,
		filePath: string,
	): { frontmatter: unknown; content: string } {
		const trimmed = fileContent.trim()

		// Check for frontmatter delimiter
		if (!trimmed.startsWith('---')) {
			throw new MemoryFileParseError(filePath, 'File must start with YAML frontmatter (---)')
		}

		// Find the closing delimiter
		const endDelimiterIndex = trimmed.indexOf('---', 3)
		if (endDelimiterIndex === -1) {
			throw new MemoryFileParseError(filePath, 'Missing closing frontmatter delimiter (---)')
		}

		// Extract frontmatter YAML
		const frontmatterYaml = trimmed.slice(3, endDelimiterIndex).trim()

		// Extract content after frontmatter
		const content = trimmed.slice(endDelimiterIndex + 3).trim()

		// Parse YAML
		try {
			const frontmatter = parse(frontmatterYaml)
			return { frontmatter, content }
		} catch (error) {
			throw new MemoryFileParseError(filePath, 'Invalid YAML in frontmatter', error)
		}
	}

	/**
	 * Validate frontmatter against the schema.
	 */
	private validateFrontmatter(frontmatter: unknown, filePath: string): MemoryFrontmatter {
		const result = MemoryFrontmatterSchema.safeParse(frontmatter)

		if (!result.success) {
			const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
			throw new MemoryFileParseError(filePath, `Invalid frontmatter: ${errors}`)
		}

		return result.data
	}

	/**
	 * Create a MemoryItem from validated frontmatter and content.
	 */
	private createMemoryItem(frontmatter: MemoryFrontmatter, content: string): MemoryItem {
		const id = MemoryId.create(frontmatter.id)
		const confidence = Confidence.create((frontmatter.confidence ?? 'medium') as ConfidenceLevel)
		const source = MemorySource.create((frontmatter.source ?? 'manual') as MemorySourceType)
		const contentHash = ContentHash.fromContent(content)

		const captureContext = this.parseCaptureContext(frontmatter.capture_context)
		const createdAt = frontmatter.created_at ? new Date(frontmatter.created_at) : new Date()
		const updatedAt = frontmatter.updated_at ? new Date(frontmatter.updated_at) : new Date()

		return MemoryItem.reconstitute({
			id,
			title: frontmatter.title,
			content,
			contentHash,
			domain: frontmatter.domain,
			confidence,
			source,
			tags: frontmatter.tags ?? [],
			relations: frontmatter.relations ?? [],
			createdAt,
			updatedAt,
			...(frontmatter.topic !== undefined && { topic: frontmatter.topic }),
			...(frontmatter.subtopic !== undefined && { subtopic: frontmatter.subtopic }),
			...(frontmatter.author !== undefined && { author: frontmatter.author }),
			...(captureContext !== undefined && { captureContext }),
		})
	}

	/**
	 * Parse capture context from frontmatter.
	 */
	private parseCaptureContext(
		raw: MemoryFrontmatter['capture_context'],
	): CaptureContext | undefined {
		if (!raw) {
			return undefined
		}

		const context: CaptureContext = {
			...(raw.session_id !== undefined && { sessionId: raw.session_id }),
			...(raw.source_files !== undefined && { sourceFiles: raw.source_files }),
			...(raw.confidence_score !== undefined && { confidenceScore: raw.confidence_score }),
		}

		// Only return if there's at least one property
		if (Object.keys(context).length === 0) {
			return undefined
		}

		return context
	}
}

/**
 * Memory File Writer.
 *
 * Serializes MemoryItem entities to markdown files with YAML frontmatter.
 */

import { stringify } from 'yaml'
import type { CaptureContext, MemoryItem } from '../../domain/entities/memory-item.js'

/**
 * YAML frontmatter representation for a memory item.
 */
interface MemoryFileFrontmatter {
	id: string
	title: string
	domain: string
	topic?: string
	subtopic?: string
	confidence: string
	source: string
	author?: string
	tags: string[]
	relations: string[]
	capture_context?: {
		session_id?: string
		source_files?: string[]
		confidence_score?: number
	}
	created_at: string
	updated_at: string
}

/**
 * Memory file writer.
 *
 * Converts MemoryItem entities to markdown files with YAML frontmatter.
 */
export class MemoryFileWriter {
	/**
	 * Serialize a MemoryItem to markdown file content.
	 */
	serialize(item: MemoryItem): string {
		const frontmatter = this.buildFrontmatter(item)
		const yaml = stringify(frontmatter, {
			indent: 2,
			lineWidth: 0, // Disable line wrapping
		})

		return `---\n${yaml}---\n\n${item.content}\n`
	}

	/**
	 * Get the filename for a memory item.
	 * Files are named: {slug}.md
	 */
	getFilename(item: MemoryItem): string {
		return `${item.id.slug}.md`
	}

	/**
	 * Get the directory path for a memory item.
	 * Items are stored in: domain/topic/subtopic/
	 */
	getDirectoryPath(item: MemoryItem): string {
		const parts = [item.domain]
		if (item.topic) {
			parts.push(item.topic)
		}
		if (item.subtopic) {
			parts.push(item.subtopic)
		}
		return parts.join('/')
	}

	/**
	 * Get the full relative path for a memory item.
	 */
	getRelativePath(item: MemoryItem): string {
		const dir = this.getDirectoryPath(item)
		const filename = this.getFilename(item)
		return `${dir}/${filename}`
	}

	/**
	 * Build the YAML frontmatter object for a memory item.
	 */
	private buildFrontmatter(item: MemoryItem): MemoryFileFrontmatter {
		const frontmatter: MemoryFileFrontmatter = {
			id: item.id.toString(),
			title: item.title,
			domain: item.domain,
			confidence: item.confidence.level,
			source: item.source.type,
			tags: [...item.tags],
			relations: [...item.relations],
			created_at: item.createdAt.toISOString(),
			updated_at: item.updatedAt.toISOString(),
		}

		// Only include optional fields if defined
		if (item.topic !== undefined) {
			frontmatter.topic = item.topic
		}
		if (item.subtopic !== undefined) {
			frontmatter.subtopic = item.subtopic
		}
		if (item.author !== undefined) {
			frontmatter.author = item.author
		}

		// Include capture context if present
		const captureContext = this.buildCaptureContext(item.captureContext)
		if (captureContext !== undefined) {
			frontmatter.capture_context = captureContext
		}

		return frontmatter
	}

	/**
	 * Build the capture context for YAML.
	 */
	private buildCaptureContext(
		context: CaptureContext | undefined,
	): MemoryFileFrontmatter['capture_context'] | undefined {
		if (!context) {
			return undefined
		}

		const result: NonNullable<MemoryFileFrontmatter['capture_context']> = {}

		if (context.sessionId !== undefined) {
			result.session_id = context.sessionId
		}
		if (context.sourceFiles !== undefined) {
			result.source_files = [...context.sourceFiles]
		}
		if (context.confidenceScore !== undefined) {
			result.confidence_score = context.confidenceScore
		}

		// Only return if there's at least one property
		if (Object.keys(result).length === 0) {
			return undefined
		}

		return result
	}
}

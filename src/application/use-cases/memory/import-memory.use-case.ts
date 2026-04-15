/**
 * Import Memory Use Case.
 *
 * Imports knowledge from external sources (ADRs, CLAUDE.md, etc.)
 * into the memory system.
 */

import path from 'node:path'
import { MemoryItem } from '../../../domain/entities/memory-item.js'
import {
	DuplicateMemoryError,
	MemoryInitializationError,
} from '../../../domain/errors/memory-errors.js'
import type { ConfidenceLevel } from '../../../domain/value-objects/confidence.js'
import { FilePath } from '../../../domain/value-objects/file-path.js'
import { MemoryId } from '../../../domain/value-objects/memory-id.js'
import type { FileReader } from '../../ports/file-reader.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for importing memory items.
 */
export interface ImportMemoryInput {
	readonly source: 'adr' | 'claude-md' | 'markdown'
	readonly filePath: string
	readonly skipDuplicates?: boolean
}

/**
 * A parsed knowledge item from an import.
 */
export interface ParsedKnowledgeItem {
	readonly title: string
	readonly content: string
	readonly domain: string
	readonly topic?: string
	readonly confidence: ConfidenceLevel
	readonly tags: readonly string[]
}

/**
 * Output from importing memory items.
 */
export interface ImportMemoryOutput {
	readonly imported: number
	readonly skipped: number
	readonly items: readonly MemoryItem[]
	readonly errors: readonly string[]
}

/**
 * Use case for importing memory from external sources.
 */
export class ImportMemoryUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
		private readonly fileReader: FileReader,
	) {}

	async execute(input: ImportMemoryInput): Promise<ImportMemoryOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			throw new MemoryInitializationError(
				'Memory not initialized. Run "vanguard memory init" first.',
			)
		}

		// Read and parse the file
		const fp = FilePath.create(input.filePath)
		const fileExists = await this.fileReader.exists(fp)
		if (!fileExists) {
			throw new Error(`File not found: ${input.filePath}`)
		}

		const content = await this.fileReader.read(fp)

		// Parse based on source type
		let parsed: ParsedKnowledgeItem[]
		switch (input.source) {
			case 'adr':
				parsed = this.parseAdr(content, input.filePath)
				break
			case 'claude-md':
				parsed = this.parseClaudeMd(content)
				break
			case 'markdown':
				parsed = this.parseMarkdown(content, input.filePath)
				break
		}

		// Import each item
		const items: MemoryItem[] = []
		const errors: string[] = []
		let skipped = 0

		for (const item of parsed) {
			try {
				const id = MemoryId.generate(item.domain, item.topic, item.title)

				// Check for duplicates
				const exists = await this.memoryRepository.exists(id)
				if (exists) {
					if (input.skipDuplicates) {
						skipped++
						continue
					}
					throw new DuplicateMemoryError(id.toString())
				}

				// Create and save the item
				const memoryItem = MemoryItem.create({
					id,
					title: item.title,
					content: item.content,
					domain: item.domain,
					...(item.topic !== undefined && { topic: item.topic }),
					confidence: item.confidence,
					source: 'imported',
					tags: item.tags,
				})

				await this.memoryRepository.save(memoryItem)
				items.push(memoryItem)
			} catch (err) {
				if (err instanceof DuplicateMemoryError) {
					errors.push(`Duplicate: ${item.title}`)
					skipped++
				} else {
					errors.push(`Failed to import "${item.title}": ${err}`)
				}
			}
		}

		return {
			imported: items.length,
			skipped,
			items,
			errors,
		}
	}

	/**
	 * Parse an Architecture Decision Record (ADR).
	 */
	private parseAdr(content: string, filePath: string): ParsedKnowledgeItem[] {
		const items: ParsedKnowledgeItem[] = []

		// Extract ADR number and title from filename or content
		const filename = path.basename(filePath, '.md')

		// Try to parse ADR format: "# N. Title" or just "# Title"
		const titleMatch = content.match(/^#\s*(\d+\.)?\s*(.+)$/m)
		const title = titleMatch?.[2]?.trim() ?? filename

		// Extract status
		const statusMatch = content.match(/^\*?\*?Status:\*?\*?\s*(.+)$/im)
		const status = statusMatch?.[1]?.trim().toLowerCase() ?? 'accepted'

		// Map status to confidence
		let confidence: ConfidenceLevel = 'medium'
		if (status === 'accepted' || status === 'adopted') {
			confidence = 'high'
		} else if (status === 'proposed' || status === 'draft') {
			confidence = 'low'
		} else if (status === 'deprecated' || status === 'superseded') {
			confidence = 'low'
		}

		// Extract context and decision sections
		const sections = this.extractMarkdownSections(content)

		// Build content from relevant sections
		const contentParts: string[] = []
		if (sections.context) {
			contentParts.push(`**Context**: ${sections.context}`)
		}
		if (sections.decision) {
			contentParts.push(`**Decision**: ${sections.decision}`)
		}
		if (sections.consequences) {
			contentParts.push(`**Consequences**: ${sections.consequences}`)
		}

		const itemContent = contentParts.length > 0 ? contentParts.join('\n\n') : content.slice(0, 2000) // Fallback to truncated content

		items.push({
			title: `ADR: ${title}`,
			content: itemContent,
			domain: 'decisions',
			topic: 'architecture',
			confidence,
			tags: ['adr', 'architecture', 'decision'],
		})

		return items
	}

	/**
	 * Parse a CLAUDE.md file.
	 */
	private parseClaudeMd(content: string): ParsedKnowledgeItem[] {
		const items: ParsedKnowledgeItem[] = []

		// Extract project overview section
		const overviewMatch = content.match(/##\s*Project\s*Overview([\s\S]*?)(?=##|$)/i)
		if (overviewMatch?.[1]) {
			items.push({
				title: 'Project Overview',
				content: overviewMatch[1].trim(),
				domain: 'context',
				confidence: 'high',
				tags: ['project', 'overview'],
			})
		}

		// Extract code conventions section
		const conventionsMatch = content.match(/##\s*Code\s*Conventions?([\s\S]*?)(?=##|$)/i)
		if (conventionsMatch?.[1]) {
			items.push({
				title: 'Code Conventions',
				content: conventionsMatch[1].trim(),
				domain: 'conventions',
				confidence: 'high',
				tags: ['conventions', 'code-style'],
			})
		}

		// Extract commands section
		const commandsMatch = content.match(/##\s*Commands?([\s\S]*?)(?=##|$)/i)
		if (commandsMatch?.[1]) {
			items.push({
				title: 'Project Commands',
				content: commandsMatch[1].trim(),
				domain: 'operations',
				confidence: 'high',
				tags: ['commands', 'scripts'],
			})
		}

		// Extract architecture section
		const archMatch = content.match(/##\s*Architecture([\s\S]*?)(?=##|$)/i)
		if (archMatch?.[1]) {
			items.push({
				title: 'Architecture Overview',
				content: archMatch[1].trim(),
				domain: 'architecture',
				confidence: 'high',
				tags: ['architecture', 'structure'],
			})
		}

		// Extract workflow section
		const workflowMatch = content.match(/##\s*(?:Workflow|Task\s*Workflow)([\s\S]*?)(?=##|$)/i)
		if (workflowMatch?.[1]) {
			items.push({
				title: 'Task Workflow',
				content: workflowMatch[1].trim(),
				domain: 'processes',
				confidence: 'high',
				tags: ['workflow', 'process'],
			})
		}

		// If no sections found, import the whole file
		if (items.length === 0) {
			items.push({
				title: 'CLAUDE.md Context',
				content: content.slice(0, 4000), // Limit size
				domain: 'context',
				confidence: 'medium',
				tags: ['claude-md', 'context'],
			})
		}

		return items
	}

	/**
	 * Parse a generic markdown file.
	 */
	private parseMarkdown(content: string, filePath: string): ParsedKnowledgeItem[] {
		const filename = path.basename(filePath, '.md')

		// Try to extract title from first heading
		const titleMatch = content.match(/^#\s+(.+)$/m)
		const title = titleMatch?.[1]?.trim() ?? filename

		return [
			{
				title,
				content: content.slice(0, 4000), // Limit size
				domain: 'documentation',
				confidence: 'medium',
				tags: ['markdown', 'imported'],
			},
		]
	}

	/**
	 * Extract sections from a markdown document.
	 */
	private extractMarkdownSections(content: string): Record<string, string> {
		const sections: Record<string, string> = {}

		// Match ## headings and their content
		const sectionRegex = /##\s+([^\n]+)\n([\s\S]*?)(?=\n##\s+|$)/gi
		let match: RegExpExecArray | null = sectionRegex.exec(content)

		while (match !== null) {
			const sectionName = match[1]?.trim().toLowerCase() ?? ''
			const sectionContent = match[2]?.trim() ?? ''

			if (sectionName && sectionContent) {
				sections[sectionName] = sectionContent
			}

			match = sectionRegex.exec(content)
		}

		return sections
	}
}

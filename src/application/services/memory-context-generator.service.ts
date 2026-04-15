/**
 * Memory Context Generator Service.
 *
 * Generates a context file from memory items for projects
 * that want static context injection rather than dynamic hooks.
 */

import type { MemoryItem } from '../../domain/entities/memory-item.js'
import type { ConfidenceLevel } from '../../domain/value-objects/confidence.js'
import type { MemoryConfigRepository, MemoryRepository } from '../ports/memory-repository.js'

/**
 * Input for generating memory context.
 */
export interface MemoryContextGeneratorInput {
	readonly domains?: readonly string[]
	readonly minConfidence?: ConfidenceLevel
	readonly maxItems?: number
	readonly includeMetadata?: boolean
}

/**
 * Output from generating memory context.
 */
export interface MemoryContextGeneratorOutput {
	readonly content: string
	readonly itemCount: number
	readonly domains: readonly string[]
}

/**
 * Service for generating context files from memory.
 */
export class MemoryContextGeneratorService {
	constructor(
		private readonly configRepository: MemoryConfigRepository,
		private readonly memoryRepository: MemoryRepository,
	) {}

	async generate(input: MemoryContextGeneratorInput = {}): Promise<MemoryContextGeneratorOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			return {
				content: this.generateEmptyTemplate(),
				itemCount: 0,
				domains: [],
			}
		}

		// Load config
		const config = await this.configRepository.load()

		// Load items with filters
		const allItems = await this.memoryRepository.findAll()

		// Apply domain filter
		let items = input.domains
			? allItems.filter((item) => input.domains?.includes(item.domain))
			: [...allItems]

		// Apply confidence filter
		if (input.minConfidence) {
			const minOrder = this.getConfidenceOrder(input.minConfidence)
			items = items.filter((item) => this.getConfidenceOrder(item.confidence.level) >= minOrder)
		}

		// Sort by domain, then by confidence (highest first)
		items = items.sort((a, b) => {
			if (a.domain !== b.domain) {
				return a.domain.localeCompare(b.domain)
			}
			return (
				this.getConfidenceOrder(b.confidence.level) - this.getConfidenceOrder(a.confidence.level)
			)
		})

		// Apply max items limit
		if (input.maxItems && items.length > input.maxItems) {
			items = items.slice(0, input.maxItems)
		}

		// Group items by domain
		const byDomain = this.groupByDomain(items)
		const domains = Object.keys(byDomain).sort()

		// Generate content
		const content = this.generateContent(
			config?.project ?? 'Project',
			byDomain,
			input.includeMetadata ?? false,
		)

		return {
			content,
			itemCount: items.length,
			domains,
		}
	}

	/**
	 * Group items by domain.
	 */
	private groupByDomain(items: MemoryItem[]): Record<string, MemoryItem[]> {
		const groups: Record<string, MemoryItem[]> = {}

		for (const item of items) {
			const existing = groups[item.domain]
			if (existing) {
				existing.push(item)
			} else {
				groups[item.domain] = [item]
			}
		}

		return groups
	}

	/**
	 * Generate the context content.
	 */
	private generateContent(
		projectName: string,
		byDomain: Record<string, MemoryItem[]>,
		includeMetadata: boolean,
	): string {
		const sections: string[] = []

		// Header
		sections.push(`# ${projectName} - Project Knowledge`)
		sections.push('')
		sections.push('> This file is auto-generated from Vanguard Memory.')
		sections.push('> Run `vanguard memory context` to update.')
		sections.push('')

		// Domain sections
		const domains = Object.keys(byDomain).sort()

		if (domains.length === 0) {
			sections.push('*No memory items found. Add items with `vanguard memory add`.*')
		} else {
			for (const domain of domains) {
				const items = byDomain[domain]
				if (!items || items.length === 0) continue

				sections.push(`## ${this.formatDomainTitle(domain)}`)
				sections.push('')

				// Group by topic within domain
				const byTopic = this.groupByTopic(items)
				const topics = Object.keys(byTopic).sort()

				for (const topic of topics) {
					const topicItems = byTopic[topic]
					if (!topicItems || topicItems.length === 0) continue

					if (topic !== '_notopic') {
						sections.push(`### ${this.formatTopicTitle(topic)}`)
						sections.push('')
					}

					for (const item of topicItems) {
						sections.push(this.formatItem(item, includeMetadata))
						sections.push('')
					}
				}
			}
		}

		// Footer
		sections.push('---')
		sections.push('')
		sections.push(`*Generated: ${new Date().toISOString()}*`)

		return sections.join('\n')
	}

	/**
	 * Group items by topic.
	 */
	private groupByTopic(items: MemoryItem[]): Record<string, MemoryItem[]> {
		const groups: Record<string, MemoryItem[]> = {}

		for (const item of items) {
			const topic = item.topic ?? '_notopic'
			const existing = groups[topic]
			if (existing) {
				existing.push(item)
			} else {
				groups[topic] = [item]
			}
		}

		return groups
	}

	/**
	 * Format a single item.
	 */
	private formatItem(item: MemoryItem, includeMetadata: boolean): string {
		const lines: string[] = []

		lines.push(`#### ${item.title}`)

		if (includeMetadata) {
			const meta: string[] = []
			meta.push(`Confidence: ${item.confidence.level}`)
			if (item.tags.length > 0) {
				meta.push(`Tags: ${item.tags.join(', ')}`)
			}
			lines.push(`*${meta.join(' | ')}*`)
		}

		lines.push('')
		lines.push(item.content)

		return lines.join('\n')
	}

	/**
	 * Format a domain name as a title.
	 */
	private formatDomainTitle(domain: string): string {
		return domain
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	}

	/**
	 * Format a topic name as a title.
	 */
	private formatTopicTitle(topic: string): string {
		return topic
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	}

	/**
	 * Get numeric order for confidence level.
	 */
	private getConfidenceOrder(level: ConfidenceLevel): number {
		switch (level) {
			case 'low':
				return 0
			case 'medium':
				return 1
			case 'high':
				return 2
		}
	}

	/**
	 * Generate an empty template for uninitialized projects.
	 */
	private generateEmptyTemplate(): string {
		return `# Project Knowledge

> This file is auto-generated from Vanguard Memory.

Memory is not initialized. Run \`vanguard memory init\` to get started.

## Getting Started

1. Initialize memory: \`vanguard memory init\`
2. Add knowledge: \`vanguard memory add\`
3. Generate this file: \`vanguard memory context\`

---

*Generated: ${new Date().toISOString()}*
`
	}
}

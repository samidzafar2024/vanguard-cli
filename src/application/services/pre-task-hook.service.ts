/**
 * Pre-Task Hook Service.
 *
 * Queries memory for relevant context based on the user's prompt
 * and returns formatted context for injection into Claude Code sessions.
 *
 * Called by Claude Code's pre-task hook mechanism.
 */

import type { MemoryApiClient } from '../ports/memory-api-client.js'
import type { MemoryConfigRepository, MemoryRepository } from '../ports/memory-repository.js'

/**
 * Input for the pre-task hook.
 */
export interface PreTaskHookInput {
	readonly prompt: string
	readonly phase?: string
	readonly maxItems?: number
	readonly sessionId?: string
	readonly personaId?: string
	readonly projectName?: string
}

/**
 * Output from the pre-task hook.
 */
export interface PreTaskHookOutput {
	readonly context: string
	readonly itemCount: number
	readonly searchTimeMs: number
	readonly source: 'graph' | 'api' | 'local'
	readonly telemetryIds?: readonly string[]
}

/**
 * Detect the active persona from the VANGUARD_PERSONA environment variable.
 *
 * Returns undefined if the env var is not set or is empty/whitespace,
 * so the caller falls back to default (unfiltered) context.
 */
export function detectPersona(): string | undefined {
	const persona = process.env.VANGUARD_PERSONA
	if (!persona || persona.trim() === '') return undefined
	return persona.trim().toLowerCase()
}

/**
 * Service for handling pre-task hooks.
 *
 * Attempts to use the API for semantic search, falling back to
 * local keyword-based search if the API is unavailable.
 */
export class PreTaskHookService {
	constructor(
		private readonly configRepository: MemoryConfigRepository,
		private readonly memoryRepository: MemoryRepository,
		private readonly apiClient?: MemoryApiClient,
	) {}

	async execute(input: PreTaskHookInput): Promise<PreTaskHookOutput> {
		const startTime = Date.now()

		// Resolve persona: explicit input takes precedence, then env var
		const persona = input.personaId ?? detectPersona()

		// Try Graphiti knowledge graph context first (server-side, no local init needed)
		if (this.apiClient) {
			try {
				const isAvailable = await this.apiClient.isAvailable()
				if (isAvailable) {
					const result = await this.apiClient.queryForGraphContext({
						query: input.prompt,
						...(persona !== undefined && { persona }),
						...(input.projectName !== undefined && { projectName: input.projectName }),
					})

					if (result.context) {
						return {
							context: result.context,
							itemCount: 0,
							searchTimeMs: Date.now() - startTime,
							source: 'graph',
						}
					}
				}
			} catch {
				// Fall through to pgvector/local search
			}
		}

		// Check if local memory is initialized for remaining fallbacks
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			return {
				context: '',
				itemCount: 0,
				searchTimeMs: Date.now() - startTime,
				source: 'local',
			}
		}

		// Load config for search settings
		const config = await this.configRepository.load()
		const maxItems = input.maxItems ?? config?.search.defaultLimit ?? 5

		// Try pgvector-based semantic search
		if (this.apiClient) {
			try {
				const result = await this.apiClient.queryForContext({
					prompt: input.prompt,
					...(input.phase !== undefined && { phase: input.phase }),
					...(input.sessionId !== undefined && { sessionId: input.sessionId }),
					...(persona !== undefined && { personaId: persona }),
					...(input.projectName !== undefined && { projectName: input.projectName }),
					maxItems,
				})

				return {
					context: result.context,
					itemCount: result.itemCount,
					searchTimeMs: Date.now() - startTime,
					source: 'api',
					...(result.telemetryIds !== undefined && { telemetryIds: result.telemetryIds }),
				}
			} catch {
				// Fall through to local search
			}
		}

		// Fallback to local keyword-based search
		const context = await this.localSearch(input.prompt, maxItems)

		return {
			context: context.text,
			itemCount: context.count,
			searchTimeMs: Date.now() - startTime,
			source: 'local',
		}
	}

	/**
	 * Perform local keyword-based search as fallback.
	 */
	private async localSearch(
		prompt: string,
		maxItems: number,
	): Promise<{ text: string; count: number }> {
		// Extract keywords from prompt
		const keywords = this.extractKeywords(prompt)

		if (keywords.length === 0) {
			return { text: '', count: 0 }
		}

		// Load all items
		const allItems = await this.memoryRepository.findAll()

		// Score items by keyword matches
		const scored = allItems
			.map((item) => {
				const searchText = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase()
				const score = keywords.filter((kw) => searchText.includes(kw)).length
				return { item, score }
			})
			.filter((s) => s.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, maxItems)

		if (scored.length === 0) {
			return { text: '', count: 0 }
		}

		// Format context
		const context = this.formatContext(scored.map((s) => s.item))

		return { text: context, count: scored.length }
	}

	/**
	 * Extract keywords from a prompt.
	 */
	private extractKeywords(prompt: string): string[] {
		// Remove common stop words and extract meaningful keywords
		const stopWords = new Set([
			'a',
			'an',
			'the',
			'is',
			'are',
			'was',
			'were',
			'be',
			'been',
			'being',
			'have',
			'has',
			'had',
			'do',
			'does',
			'did',
			'will',
			'would',
			'could',
			'should',
			'may',
			'might',
			'must',
			'can',
			'to',
			'of',
			'in',
			'for',
			'on',
			'with',
			'at',
			'by',
			'from',
			'as',
			'into',
			'through',
			'during',
			'before',
			'after',
			'above',
			'below',
			'between',
			'under',
			'again',
			'further',
			'then',
			'once',
			'here',
			'there',
			'when',
			'where',
			'why',
			'how',
			'all',
			'each',
			'few',
			'more',
			'most',
			'other',
			'some',
			'such',
			'no',
			'nor',
			'not',
			'only',
			'own',
			'same',
			'so',
			'than',
			'too',
			'very',
			'just',
			'and',
			'but',
			'if',
			'or',
			'because',
			'until',
			'while',
			'i',
			'me',
			'my',
			'we',
			'our',
			'you',
			'your',
			'he',
			'him',
			'his',
			'she',
			'her',
			'it',
			'its',
			'they',
			'them',
			'their',
			'what',
			'which',
			'who',
			'whom',
			'this',
			'that',
			'these',
			'those',
			'am',
			'want',
			'need',
			'help',
			'please',
			'implement',
			'create',
			'add',
			'make',
			'build',
			'write',
			'fix',
			'update',
			'change',
		])

		return prompt
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, ' ')
			.split(/\s+/)
			.filter((word) => word.length > 2 && !stopWords.has(word))
	}

	/**
	 * Format memory items into context for injection.
	 */
	private formatContext(
		items: readonly import('../../domain/entities/memory-item.js').MemoryItem[],
	): string {
		if (items.length === 0) {
			return ''
		}

		const sections = items.map((item) => {
			const header = `### ${item.title}`
			const meta = `*Domain: ${item.domain}${item.topic ? ` > ${item.topic}` : ''} | Confidence: ${item.confidence.level}*`
			return `${header}\n${meta}\n\n${item.content}`
		})

		return `## Relevant Project Knowledge\n\n${sections.join('\n\n---\n\n')}`
	}
}

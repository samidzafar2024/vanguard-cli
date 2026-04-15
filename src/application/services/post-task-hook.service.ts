/**
 * Post-Task Hook Service.
 *
 * Analyzes completed Claude Code sessions and extracts potential
 * knowledge candidates for review and capture.
 *
 * Called by Claude Code's post-task hook mechanism.
 */

import type { GraphitiWritePort } from '../ports/graphiti-write.port.js'
import type { MemoryConfigRepository, MemoryRepository } from '../ports/memory-repository.js'

/**
 * Input for the post-task hook.
 */
export interface PostTaskHookInput {
	readonly sessionOutput: string
	readonly prompt: string
	readonly phase?: string
}

/**
 * A candidate knowledge item extracted from a session.
 */
export interface KnowledgeCandidate {
	readonly title: string
	readonly content: string
	readonly domain: string
	readonly topic?: string
	readonly confidence: number
	readonly extractionType: 'pattern' | 'decision' | 'error-solution' | 'convention'
	readonly sourceContext: string
}

/**
 * Output from the post-task hook.
 */
export interface PostTaskHookOutput {
	readonly candidates: readonly KnowledgeCandidate[]
	readonly skippedDuplicates: number
	readonly processingTimeMs: number
}

/**
 * Service for handling post-task hooks.
 *
 * Extracts potential knowledge from session output using
 * pattern matching and heuristics.
 */
export class PostTaskHookService {
	constructor(
		private readonly configRepository: MemoryConfigRepository,
		private readonly memoryRepository: MemoryRepository,
		private readonly graphitiPort?: GraphitiWritePort,
	) {}

	async execute(input: PostTaskHookInput): Promise<PostTaskHookOutput> {
		const startTime = Date.now()

		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			return {
				candidates: [],
				skippedDuplicates: 0,
				processingTimeMs: Date.now() - startTime,
			}
		}

		// Load config for extraction settings
		const config = await this.configRepository.load()
		if (!config?.autoCapture.enabled) {
			return {
				candidates: [],
				skippedDuplicates: 0,
				processingTimeMs: Date.now() - startTime,
			}
		}

		// Extract candidates from session output
		const rawCandidates = this.extractCandidates(input, config.autoCapture.extract)

		// Filter by confidence threshold
		const thresholdValue = this.getConfidenceThreshold(config.autoCapture.confidenceThreshold)
		const filteredCandidates = rawCandidates.filter((c) => c.confidence >= thresholdValue)

		// Check for duplicates
		const existingItems = await this.memoryRepository.findAll()
		const { unique, duplicateCount } = this.filterDuplicates(filteredCandidates, existingItems)

		// Route candidates to Graphiti (fire-and-forget, non-blocking)
		if (this.graphitiPort && unique.length > 0 && config.groupId) {
			await this.routeToGraphiti(unique, config.groupId)
		}

		return {
			candidates: unique,
			skippedDuplicates: duplicateCount,
			processingTimeMs: Date.now() - startTime,
		}
	}

	/**
	 * Extract knowledge candidates from session output.
	 */
	private extractCandidates(
		input: PostTaskHookInput,
		extractConfig: {
			patterns: boolean
			decisions: boolean
			errorSolutions: boolean
			conventions: boolean
		},
	): KnowledgeCandidate[] {
		const candidates: KnowledgeCandidate[] = []
		const output = input.sessionOutput

		// Extract patterns
		if (extractConfig.patterns) {
			candidates.push(...this.extractPatterns(output))
		}

		// Extract decisions
		if (extractConfig.decisions) {
			candidates.push(...this.extractDecisions(output))
		}

		// Extract error solutions
		if (extractConfig.errorSolutions) {
			candidates.push(...this.extractErrorSolutions(output))
		}

		// Extract conventions
		if (extractConfig.conventions) {
			candidates.push(...this.extractConventions(output))
		}

		return candidates
	}

	/**
	 * Extract pattern candidates from output.
	 */
	private extractPatterns(output: string): KnowledgeCandidate[] {
		const candidates: KnowledgeCandidate[] = []

		// Look for pattern indicators in the text
		const patternIndicators = [
			/(?:this|the|our|we use a?)\s+(\w+(?:\s+\w+)?)\s+pattern/gi,
			/pattern(?:s)?:\s*([^\n.]+)/gi,
			/following\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+approach/gi,
		]

		for (const regex of patternIndicators) {
			let match: RegExpExecArray | null = regex.exec(output)
			while (match !== null) {
				const patternName = match[1]?.trim()
				if (patternName && patternName.length > 3) {
					// Extract surrounding context
					const contextStart = Math.max(0, match.index - 200)
					const contextEnd = Math.min(output.length, match.index + match[0].length + 200)
					const context = output.slice(contextStart, contextEnd)

					candidates.push({
						title: `${this.capitalizeFirst(patternName)} Pattern`,
						content: this.cleanContent(context),
						domain: 'patterns',
						confidence: 0.6,
						extractionType: 'pattern',
						sourceContext: match[0],
					})
				}
				match = regex.exec(output)
			}
		}

		return candidates
	}

	/**
	 * Extract decision candidates from output.
	 */
	private extractDecisions(output: string): KnowledgeCandidate[] {
		const candidates: KnowledgeCandidate[] = []

		// Look for decision indicators
		const decisionIndicators = [
			/(?:decided|chose|choosing|decision)\s+to\s+([^.]+)/gi,
			/(?:we|i)\s+(?:will|should|chose to)\s+use\s+([^.]+?)(?:\s+because|\s+for|\s+since|\.)/gi,
			/(?:the\s+)?reason\s+(?:for|why)\s+([^.]+)/gi,
		]

		for (const regex of decisionIndicators) {
			let match: RegExpExecArray | null = regex.exec(output)
			while (match !== null) {
				const decision = match[1]?.trim()
				if (decision && decision.length > 10) {
					const contextStart = Math.max(0, match.index - 200)
					const contextEnd = Math.min(output.length, match.index + match[0].length + 200)
					const context = output.slice(contextStart, contextEnd)

					candidates.push({
						title: this.generateDecisionTitle(decision),
						content: this.cleanContent(context),
						domain: 'decisions',
						confidence: 0.5,
						extractionType: 'decision',
						sourceContext: match[0],
					})
				}
				match = regex.exec(output)
			}
		}

		return candidates
	}

	/**
	 * Extract error solution candidates from output.
	 */
	private extractErrorSolutions(output: string): KnowledgeCandidate[] {
		const candidates: KnowledgeCandidate[] = []

		// Look for error/fix indicators
		const errorIndicators = [
			/(?:error|issue|bug|problem):\s*([^\n]+).*?(?:fix|solution|resolve):\s*([^\n]+)/gis,
			/(?:fixed|resolved|solved)\s+(?:the\s+)?([^.]+?)(?:\s+by\s+)([^.]+)/gi,
			/the\s+(?:error|issue|problem)\s+was\s+([^.]+)/gi,
		]

		for (const regex of errorIndicators) {
			let match: RegExpExecArray | null = regex.exec(output)
			while (match !== null) {
				const errorDesc = match[1]?.trim()
				const solution = match[2]?.trim()

				if (errorDesc && errorDesc.length > 5) {
					const contextStart = Math.max(0, match.index - 100)
					const contextEnd = Math.min(output.length, match.index + match[0].length + 100)
					const context = output.slice(contextStart, contextEnd)

					candidates.push({
						title: `Fix: ${this.truncate(errorDesc, 50)}`,
						content: solution
							? `**Problem**: ${errorDesc}\n\n**Solution**: ${solution}\n\n${this.cleanContent(context)}`
							: this.cleanContent(context),
						domain: 'errors',
						confidence: 0.7,
						extractionType: 'error-solution',
						sourceContext: match[0],
					})
				}
				match = regex.exec(output)
			}
		}

		return candidates
	}

	/**
	 * Extract convention candidates from output.
	 */
	private extractConventions(output: string): KnowledgeCandidate[] {
		const candidates: KnowledgeCandidate[] = []

		// Look for convention indicators
		const conventionIndicators = [
			/(?:convention|standard|rule):\s*([^\n.]+)/gi,
			/(?:always|never|should always|should never)\s+([^.]+)/gi,
			/naming\s+convention:\s*([^\n.]+)/gi,
		]

		for (const regex of conventionIndicators) {
			let match: RegExpExecArray | null = regex.exec(output)
			while (match !== null) {
				const convention = match[1]?.trim()
				if (convention && convention.length > 10) {
					const contextStart = Math.max(0, match.index - 100)
					const contextEnd = Math.min(output.length, match.index + match[0].length + 100)
					const context = output.slice(contextStart, contextEnd)

					candidates.push({
						title: this.generateConventionTitle(convention),
						content: this.cleanContent(context),
						domain: 'conventions',
						confidence: 0.4,
						extractionType: 'convention',
						sourceContext: match[0],
					})
				}
				match = regex.exec(output)
			}
		}

		return candidates
	}

	/**
	 * Filter out duplicate candidates based on similarity to existing items.
	 */
	private filterDuplicates(
		candidates: KnowledgeCandidate[],
		existingItems: readonly import('../../domain/entities/memory-item.js').MemoryItem[],
	): { unique: KnowledgeCandidate[]; duplicateCount: number } {
		const unique: KnowledgeCandidate[] = []
		let duplicateCount = 0

		for (const candidate of candidates) {
			// Simple title-based duplicate detection
			const isDuplicate = existingItems.some((item) => {
				const titleSimilarity = this.calculateSimilarity(
					candidate.title.toLowerCase(),
					item.title.toLowerCase(),
				)
				return titleSimilarity > 0.8
			})

			if (isDuplicate) {
				duplicateCount++
			} else {
				unique.push(candidate)
			}
		}

		return { unique, duplicateCount }
	}

	/**
	 * Calculate simple string similarity (Jaccard index on words).
	 */
	private calculateSimilarity(a: string, b: string): number {
		const wordsA = new Set(a.split(/\s+/))
		const wordsB = new Set(b.split(/\s+/))

		const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
		const union = new Set([...wordsA, ...wordsB]).size

		return union > 0 ? intersection / union : 0
	}

	/**
	 * Get numeric threshold for confidence level.
	 */
	private getConfidenceThreshold(level: 'low' | 'medium' | 'high'): number {
		switch (level) {
			case 'low':
				return 0.3
			case 'medium':
				return 0.5
			case 'high':
				return 0.7
		}
	}

	/**
	 * Clean extracted content.
	 */
	private cleanContent(content: string): string {
		return content
			.replace(/\s+/g, ' ')
			.replace(/^\s+|\s+$/g, '')
			.substring(0, 2000)
	}

	/**
	 * Capitalize first letter.
	 */
	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1)
	}

	/**
	 * Truncate string with ellipsis.
	 */
	private truncate(str: string, maxLength: number): string {
		if (str.length <= maxLength) return str
		return `${str.substring(0, maxLength - 3)}...`
	}

	/**
	 * Generate a title for a decision.
	 */
	private generateDecisionTitle(decision: string): string {
		const cleaned = decision.replace(/^(to|that)\s+/i, '')
		return `Decision: ${this.truncate(this.capitalizeFirst(cleaned), 50)}`
	}

	/**
	 * Generate a title for a convention.
	 */
	private generateConventionTitle(convention: string): string {
		return `Convention: ${this.truncate(this.capitalizeFirst(convention), 50)}`
	}

	/**
	 * Route extracted candidates to Graphiti knowledge graph.
	 *
	 * Each candidate is mapped to a Graphiti episode with a prefix
	 * (Pattern:, Decision:, Solution:) matching the extraction type.
	 * Failures are silently swallowed — Graphiti is best-effort.
	 */
	private async routeToGraphiti(
		candidates: readonly KnowledgeCandidate[],
		groupId: string,
	): Promise<void> {
		if (!this.graphitiPort) return

		for (const candidate of candidates) {
			const prefix = PostTaskHookService.EXTRACTION_PREFIX[candidate.extractionType]
			const name = `${prefix} ${candidate.title.replace(/^(Pattern|Decision|Convention|Fix):\s*/i, '')}`

			try {
				await this.graphitiPort.addEpisode({
					name,
					episodeBody: candidate.content.substring(0, 2000),
					sourceDescription: `post-task-hook — auto-extracted ${candidate.extractionType}`,
					groupId,
				})
			} catch {
				// Graphiti write failed — non-critical, continue with remaining candidates
			}
		}
	}

	private static readonly EXTRACTION_PREFIX: Record<KnowledgeCandidate['extractionType'], string> =
		{
			pattern: 'Pattern:',
			decision: 'Decision:',
			'error-solution': 'Solution:',
			convention: 'Pattern:',
		}
}

import { describe, expect, it } from 'vitest'
import { MemoryItem } from '../../../../src/domain/entities/memory-item.js'
import {
	InvalidMemoryRelationError,
	MemoryContentTooLargeError,
} from '../../../../src/domain/errors/memory-errors.js'
import { Confidence } from '../../../../src/domain/value-objects/confidence.js'
import { MemoryId } from '../../../../src/domain/value-objects/memory-id.js'
import { MemorySource } from '../../../../src/domain/value-objects/memory-source.js'

describe('MemoryItem', () => {
	const createTestId = () => MemoryId.create('patterns/api-errors')

	describe('create', () => {
		it('should create a memory item with required fields', () => {
			const id = createTestId()
			const item = MemoryItem.create({
				id,
				title: 'API Error Handling',
				content: 'Use consistent error format',
				domain: 'patterns',
			})

			expect(item.id.equals(id)).toBe(true)
			expect(item.title).toBe('API Error Handling')
			expect(item.content).toBe('Use consistent error format')
			expect(item.domain).toBe('patterns')
			expect(item.confidence.level).toBe('medium') // default
			expect(item.source.type).toBe('manual') // default
			expect(item.tags).toEqual([])
			expect(item.relations).toEqual([])
		})

		it('should create with optional fields', () => {
			const id = createTestId()
			const item = MemoryItem.create({
				id,
				title: 'API Error Handling',
				content: 'Use consistent error format',
				domain: 'patterns',
				topic: 'error-handling',
				subtopic: 'api',
				confidence: 'high',
				source: 'imported',
				author: 'dave@example.com',
				tags: ['api', 'errors'],
				relations: ['decisions/001-error-format'],
				captureContext: { sessionId: 'sess-123' },
			})

			expect(item.topic).toBe('error-handling')
			expect(item.subtopic).toBe('api')
			expect(item.confidence.level).toBe('high')
			expect(item.source.type).toBe('imported')
			expect(item.author).toBe('dave@example.com')
			expect(item.tags).toContain('api')
			expect(item.tags).toContain('errors')
			expect(item.relations).toContain('decisions/001-error-format')
			expect(item.captureContext?.sessionId).toBe('sess-123')
		})

		it('should accept Confidence object', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				confidence: Confidence.create('high'),
			})

			expect(item.confidence.level).toBe('high')
		})

		it('should accept MemorySource object', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				source: MemorySource.AUTO_CAPTURED,
			})

			expect(item.source.type).toBe('auto-captured')
		})

		it('should generate content hash', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Test content',
				domain: 'patterns',
			})

			expect(item.contentHash.toString()).toHaveLength(64)
		})

		it('should normalize tags (lowercase, dedupe)', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				tags: ['API', 'api', 'Errors', '  errors  '],
			})

			expect(item.tags).toEqual(['api', 'errors'])
		})

		it('should normalize relations (lowercase, dedupe)', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				relations: ['Decisions/001', 'decisions/001', 'Decisions/002'],
			})

			expect(item.relations).toEqual(['decisions/001', 'decisions/002'])
		})

		it('should trim title and author', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: '  Test Title  ',
				content: 'Content',
				domain: 'patterns',
				author: '  dave@example.com  ',
			})

			expect(item.title).toBe('Test Title')
			expect(item.author).toBe('dave@example.com')
		})

		it('should reject content larger than 50KB', () => {
			const largeContent = 'x'.repeat(51 * 1024)
			expect(() =>
				MemoryItem.create({
					id: createTestId(),
					title: 'Test',
					content: largeContent,
					domain: 'patterns',
				}),
			).toThrow(MemoryContentTooLargeError)
		})

		it('should accept content exactly 50KB', () => {
			const maxContent = 'x'.repeat(50 * 1024)
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: maxContent,
				domain: 'patterns',
			})

			expect(item.content.length).toBe(50 * 1024)
		})
	})

	describe('updateContent', () => {
		it('should return new item with updated content', () => {
			const original = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Original content',
				domain: 'patterns',
			})

			const updated = original.updateContent('New content')

			expect(updated.content).toBe('New content')
			expect(original.content).toBe('Original content') // immutable
			expect(updated.contentHash.equals(original.contentHash)).toBe(false)
		})

		it('should update updatedAt timestamp', async () => {
			const original = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Original',
				domain: 'patterns',
			})

			await new Promise((resolve) => setTimeout(resolve, 10))
			const updated = original.updateContent('New content')

			expect(updated.updatedAt.getTime()).toBeGreaterThan(original.createdAt.getTime())
		})

		it('should reject content larger than 50KB', () => {
			const original = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Original',
				domain: 'patterns',
			})

			const largeContent = 'x'.repeat(51 * 1024)
			expect(() => original.updateContent(largeContent)).toThrow(MemoryContentTooLargeError)
		})
	})

	describe('updateTitle', () => {
		it('should return new item with updated title', () => {
			const original = MemoryItem.create({
				id: createTestId(),
				title: 'Original Title',
				content: 'Content',
				domain: 'patterns',
			})

			const updated = original.updateTitle('New Title')

			expect(updated.title).toBe('New Title')
			expect(original.title).toBe('Original Title')
		})
	})

	describe('updateConfidence', () => {
		it('should update with level string', () => {
			const original = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				confidence: 'low',
			})

			const updated = original.updateConfidence('high')

			expect(updated.confidence.level).toBe('high')
			expect(original.confidence.level).toBe('low')
		})

		it('should update with Confidence object', () => {
			const original = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				confidence: 'low',
			})

			const updated = original.updateConfidence(Confidence.create('medium'))

			expect(updated.confidence.level).toBe('medium')
		})
	})

	describe('addTag / removeTag', () => {
		it('should add a tag', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			const updated = item.addTag('api')

			expect(updated.tags).toContain('api')
			expect(item.tags).not.toContain('api')
		})

		it('should normalize tag when adding', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			const updated = item.addTag('  API  ')

			expect(updated.tags).toContain('api')
		})

		it('should not duplicate tags', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				tags: ['api'],
			})

			const updated = item.addTag('api')

			expect(updated.tags.filter((t) => t === 'api').length).toBe(1)
			expect(updated).toBe(item) // same instance if no change
		})

		it('should remove a tag', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				tags: ['api', 'errors'],
			})

			const updated = item.removeTag('api')

			expect(updated.tags).not.toContain('api')
			expect(updated.tags).toContain('errors')
		})

		it('should return same instance if tag does not exist', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				tags: ['api'],
			})

			const updated = item.removeTag('nonexistent')

			expect(updated).toBe(item)
		})
	})

	describe('addRelation / removeRelation', () => {
		it('should add a relation', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			const updated = item.addRelation('decisions/001-auth')

			expect(updated.relations).toContain('decisions/001-auth')
		})

		it('should reject self-relation', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			expect(() => item.addRelation('patterns/api-errors')).toThrow(InvalidMemoryRelationError)
		})

		it('should not duplicate relations', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				relations: ['decisions/001'],
			})

			const updated = item.addRelation('decisions/001')

			expect(updated.relations.length).toBe(1)
			expect(updated).toBe(item)
		})

		it('should remove a relation', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				relations: ['decisions/001', 'decisions/002'],
			})

			const updated = item.removeRelation('decisions/001')

			expect(updated.relations).not.toContain('decisions/001')
			expect(updated.relations).toContain('decisions/002')
		})
	})

	describe('hasRelationTo', () => {
		it('should return true if relation exists', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				relations: ['decisions/001'],
			})

			expect(item.hasRelationTo('decisions/001')).toBe(true)
		})

		it('should return false if relation does not exist', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			expect(item.hasRelationTo('decisions/001')).toBe(false)
		})
	})

	describe('matchesDomain', () => {
		it('should return true for matching domain', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			expect(item.matchesDomain('patterns')).toBe(true)
			expect(item.matchesDomain('PATTERNS')).toBe(true)
		})

		it('should return false for non-matching domain', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			expect(item.matchesDomain('decisions')).toBe(false)
		})
	})

	describe('hasTag', () => {
		it('should return true if tag exists', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				tags: ['api'],
			})

			expect(item.hasTag('api')).toBe(true)
			expect(item.hasTag('API')).toBe(true)
		})

		it('should return false if tag does not exist', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			expect(item.hasTag('api')).toBe(false)
		})
	})

	describe('hasContentChanged', () => {
		it('should return true if content differs', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Original content',
				domain: 'patterns',
			})

			expect(item.hasContentChanged('New content')).toBe(true)
		})

		it('should return false if content is same', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Same content',
				domain: 'patterns',
			})

			expect(item.hasContentChanged('Same content')).toBe(false)
		})
	})

	describe('getHierarchyPath', () => {
		it('should return domain only', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
			})

			expect(item.getHierarchyPath()).toBe('patterns')
		})

		it('should return domain/topic', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				topic: 'errors',
			})

			expect(item.getHierarchyPath()).toBe('patterns/errors')
		})

		it('should return domain/topic/subtopic', () => {
			const item = MemoryItem.create({
				id: createTestId(),
				title: 'Test',
				content: 'Content',
				domain: 'patterns',
				topic: 'errors',
				subtopic: 'api',
			})

			expect(item.getHierarchyPath()).toBe('patterns/errors/api')
		})
	})
})

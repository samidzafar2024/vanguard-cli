import { describe, expect, it } from 'vitest'
import { MemoryConfig } from '../../../../src/domain/entities/memory-config.js'
import { InvalidMemoryConfigError } from '../../../../src/domain/errors/memory-errors.js'

describe('MemoryConfig', () => {
	describe('DEFAULT', () => {
		it('should have default embedding config', () => {
			expect(MemoryConfig.DEFAULT.embeddings.model).toBe('text-embedding-3-large')
			expect(MemoryConfig.DEFAULT.embeddings.dimensions).toBe(1536)
		})

		it('should have default auto-capture config', () => {
			expect(MemoryConfig.DEFAULT.autoCapture.enabled).toBe(true)
			expect(MemoryConfig.DEFAULT.autoCapture.confidenceThreshold).toBe('medium')
			expect(MemoryConfig.DEFAULT.autoCapture.requireReview).toBe(true)
		})

		it('should have default search config', () => {
			expect(MemoryConfig.DEFAULT.search.defaultLimit).toBe(5)
			expect(MemoryConfig.DEFAULT.search.similarityThreshold).toBe(0.6)
			expect(MemoryConfig.DEFAULT.search.includeRelations).toBe(true)
			expect(MemoryConfig.DEFAULT.search.maxRelationDepth).toBe(2)
		})

		it('should have default hook config', () => {
			expect(MemoryConfig.DEFAULT.hooks.preTask.enabled).toBe(true)
			expect(MemoryConfig.DEFAULT.hooks.preTask.timeout).toBe(5000)
			expect(MemoryConfig.DEFAULT.hooks.postTask.enabled).toBe(true)
			expect(MemoryConfig.DEFAULT.hooks.postTask.timeout).toBe(10000)
		})
	})

	describe('create', () => {
		it('should create config with project name', () => {
			const config = MemoryConfig.create({ project: 'my-project' })

			expect(config.project).toBe('my-project')
			expect(config.version).toBe(1)
		})

		it('should use defaults for unspecified fields', () => {
			const config = MemoryConfig.create({ project: 'my-project' })

			expect(config.embeddings.model).toBe(MemoryConfig.DEFAULT.embeddings.model)
			expect(config.search.defaultLimit).toBe(MemoryConfig.DEFAULT.search.defaultLimit)
		})

		it('should override defaults with provided values', () => {
			const config = MemoryConfig.create({
				project: 'my-project',
				search: {
					defaultLimit: 10,
					similarityThreshold: 0.8,
					includeRelations: false,
					maxRelationDepth: 1,
				},
			})

			expect(config.search.defaultLimit).toBe(10)
			expect(config.search.similarityThreshold).toBe(0.8)
			expect(config.search.includeRelations).toBe(false)
		})

		it('should partially override nested configs', () => {
			const config = MemoryConfig.create({
				project: 'my-project',
				autoCapture: {
					enabled: false,
					confidenceThreshold: 'high',
					requireReview: false,
					extract: {
						patterns: true,
						decisions: true,
						errorSolutions: true,
						conventions: true,
					},
					excludePaths: [],
				},
			})

			expect(config.autoCapture.enabled).toBe(false)
			expect(config.autoCapture.extract.conventions).toBe(true) // overridden from false
		})

		it('should trim project name', () => {
			const config = MemoryConfig.create({ project: '  my-project  ' })
			expect(config.project).toBe('my-project')
		})

		it('should reject empty project name', () => {
			expect(() => MemoryConfig.create({ project: '' })).toThrow(InvalidMemoryConfigError)
			expect(() => MemoryConfig.create({ project: '   ' })).toThrow(InvalidMemoryConfigError)
		})

		it('should reject non-positive embedding dimensions', () => {
			expect(() =>
				MemoryConfig.create({
					project: 'test',
					embeddings: { model: 'test', dimensions: 0 },
				}),
			).toThrow(InvalidMemoryConfigError)

			expect(() =>
				MemoryConfig.create({
					project: 'test',
					embeddings: { model: 'test', dimensions: -1 },
				}),
			).toThrow(InvalidMemoryConfigError)
		})

		it('should reject non-positive search limit', () => {
			expect(() =>
				MemoryConfig.create({
					project: 'test',
					search: {
						defaultLimit: 0,
						similarityThreshold: 0.6,
						includeRelations: true,
						maxRelationDepth: 2,
					},
				}),
			).toThrow(InvalidMemoryConfigError)
		})

		it('should reject invalid similarity threshold', () => {
			expect(() =>
				MemoryConfig.create({
					project: 'test',
					search: {
						defaultLimit: 5,
						similarityThreshold: -0.1,
						includeRelations: true,
						maxRelationDepth: 2,
					},
				}),
			).toThrow(InvalidMemoryConfigError)

			expect(() =>
				MemoryConfig.create({
					project: 'test',
					search: {
						defaultLimit: 5,
						similarityThreshold: 1.1,
						includeRelations: true,
						maxRelationDepth: 2,
					},
				}),
			).toThrow(InvalidMemoryConfigError)
		})

		it('should reject negative max relation depth', () => {
			expect(() =>
				MemoryConfig.create({
					project: 'test',
					search: {
						defaultLimit: 5,
						similarityThreshold: 0.6,
						includeRelations: true,
						maxRelationDepth: -1,
					},
				}),
			).toThrow(InvalidMemoryConfigError)
		})

		it('should reject non-positive hook timeouts', () => {
			expect(() =>
				MemoryConfig.create({
					project: 'test',
					hooks: {
						preTask: { enabled: true, timeout: 0 },
						postTask: { enabled: true, timeout: 10000 },
					},
				}),
			).toThrow(InvalidMemoryConfigError)
		})
	})

	describe('merge', () => {
		it('should merge overrides into existing config', () => {
			const original = MemoryConfig.create({ project: 'original' })
			const merged = original.merge({ project: 'merged' })

			expect(merged.project).toBe('merged')
			expect(original.project).toBe('original') // immutable
		})

		it('should preserve non-overridden values', () => {
			const original = MemoryConfig.create({
				project: 'test',
				search: {
					defaultLimit: 10,
					similarityThreshold: 0.8,
					includeRelations: true,
					maxRelationDepth: 3,
				},
			})

			const merged = original.merge({
				search: {
					defaultLimit: 20,
					similarityThreshold: 0.8,
					includeRelations: true,
					maxRelationDepth: 3,
				},
			})

			expect(merged.search.defaultLimit).toBe(20)
			expect(merged.search.similarityThreshold).toBe(0.8) // preserved
		})
	})

	describe('toObject', () => {
		it('should return serializable object', () => {
			const config = MemoryConfig.create({ project: 'test' })
			const obj = config.toObject()

			expect(obj.project).toBe('test')
			expect(obj.embeddings).toBeDefined()
			expect(obj.autoCapture).toBeDefined()
			expect(obj.search).toBeDefined()
			expect(obj.hooks).toBeDefined()
		})

		it('should create deep copy', () => {
			const config = MemoryConfig.create({ project: 'test' })
			const obj = config.toObject()

			// Modify the object
			obj.embeddings.model = 'modified'

			// Original should be unchanged
			expect(config.embeddings.model).toBe('text-embedding-3-large')
		})
	})

	describe('isExtractionEnabled', () => {
		it('should return true when auto-capture is enabled and extraction type is enabled', () => {
			const config = MemoryConfig.create({
				project: 'test',
				autoCapture: {
					enabled: true,
					confidenceThreshold: 'medium',
					requireReview: true,
					extract: {
						patterns: true,
						decisions: false,
						errorSolutions: true,
						conventions: false,
					},
					excludePaths: [],
				},
			})

			expect(config.isExtractionEnabled('patterns')).toBe(true)
			expect(config.isExtractionEnabled('decisions')).toBe(false)
			expect(config.isExtractionEnabled('errorSolutions')).toBe(true)
			expect(config.isExtractionEnabled('conventions')).toBe(false)
		})

		it('should return false when auto-capture is disabled', () => {
			const config = MemoryConfig.create({
				project: 'test',
				autoCapture: {
					enabled: false,
					confidenceThreshold: 'medium',
					requireReview: true,
					extract: {
						patterns: true,
						decisions: true,
						errorSolutions: true,
						conventions: true,
					},
					excludePaths: [],
				},
			})

			expect(config.isExtractionEnabled('patterns')).toBe(false)
			expect(config.isExtractionEnabled('decisions')).toBe(false)
		})
	})

	describe('isPathExcluded', () => {
		it('should match glob patterns', () => {
			const config = MemoryConfig.create({
				project: 'test',
				autoCapture: {
					enabled: true,
					confidenceThreshold: 'medium',
					requireReview: true,
					extract: {
						patterns: true,
						decisions: true,
						errorSolutions: true,
						conventions: true,
					},
					excludePaths: ['node_modules/**', '*.test.ts', 'dist/**'],
				},
			})

			expect(config.isPathExcluded('node_modules/lodash/index.js')).toBe(true)
			expect(config.isPathExcluded('foo.test.ts')).toBe(true)
			expect(config.isPathExcluded('dist/index.js')).toBe(true)
			expect(config.isPathExcluded('src/index.ts')).toBe(false)
		})

		it('should handle empty exclude paths', () => {
			const config = MemoryConfig.create({
				project: 'test',
				autoCapture: {
					enabled: true,
					confidenceThreshold: 'medium',
					requireReview: true,
					extract: {
						patterns: true,
						decisions: true,
						errorSolutions: true,
						conventions: true,
					},
					excludePaths: [],
				},
			})

			expect(config.isPathExcluded('anything.ts')).toBe(false)
		})
	})
})

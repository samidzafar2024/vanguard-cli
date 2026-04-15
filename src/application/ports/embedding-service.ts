/**
 * Embedding Service Port.
 *
 * Abstracts the embedding provider for semantic search.
 * Implementations can use OpenAI, local models, etc.
 */

/**
 * Port interface for generating embeddings.
 */
export interface EmbeddingService {
	/**
	 * Generate embedding vector for a single text.
	 */
	generateEmbedding(text: string): Promise<readonly number[]>

	/**
	 * Generate embeddings for multiple texts in batch.
	 * More efficient than calling generateEmbedding multiple times.
	 */
	batchEmbeddings(texts: readonly string[]): Promise<readonly (readonly number[])[]>

	/**
	 * The model identifier being used.
	 */
	readonly model: string

	/**
	 * The dimension of the embedding vectors.
	 */
	readonly dimensions: number
}

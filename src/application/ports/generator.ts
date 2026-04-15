import type { Project } from '../../domain/entities/project.js'
import type { FilePath } from '../../domain/value-objects/file-path.js'

/**
 * Generated file representation.
 */
export interface GeneratedFile {
	readonly path: FilePath
	readonly content: string
}

/**
 * Port for generating project configuration.
 */
export interface ConfigGenerator {
	/**
	 * Generate .vanguard/config.yaml
	 */
	generate(project: Project): GeneratedFile
}

/**
 * Port for generating the project manifest.
 *
 * The manifest is the central registry for Vanguard project structure.
 * It enables:
 * - Context-efficient discovery (Claude reads one file to understand structure)
 * - Workflow state tracking (document and task status)
 * - Semantic lookup via summaries and keywords
 */
export interface ManifestGenerator {
	/**
	 * Generate initial manifest for a new project.
	 */
	generate(project: Project): GeneratedFile

	/**
	 * Generate manifest YAML content.
	 */
	generateContent(project: Project): string
}

/**
 * Composite generator that produces all Vanguard artifacts.
 */
export interface VanguardGenerator {
	/**
	 * Generate all artifacts for a project.
	 */
	generateAll(project: Project): GeneratedFile[]
}

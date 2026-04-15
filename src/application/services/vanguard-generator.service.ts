import { stringify } from 'yaml'
import type { Project } from '../../domain/entities/project.js'
import { FilePath } from '../../domain/value-objects/file-path.js'
import type { ConfigGenerator, GeneratedFile, VanguardGenerator } from '../ports/generator.js'
import { buildConfigFromSelections } from './config-from-selections.js'
import { ManifestGeneratorService } from './manifest-generator.service.js'

/**
 * Lightweight project summary for the dynamic init flow.
 * Replaces the full Project entity when generating local files from selections.
 */
export interface ProjectSummary {
	readonly name: string
	readonly type: 'greenfield' | 'brownfield'
	readonly track: 'solo' | 'team' | 'enterprise'
	readonly rootPath: string
	readonly selections: Readonly<Record<string, string>>
}

/**
 * Service that generates the config.yaml file.
 */
export class ConfigGeneratorService implements ConfigGenerator {
	generate(project: Project): GeneratedFile {
		const config = project.toConfig()
		const content = stringify(config, {
			indent: 2,
			lineWidth: 100,
		})

		return {
			path: project.getVanguardPath().join('config.yaml'),
			content: `# Vanguard Configuration\n# Generated: ${new Date().toISOString()}\n\n${content}`,
		}
	}

	/**
	 * Generate config.yaml from selections (dynamic init flow).
	 * Uses buildConfigFromSelections() to map slugs to the config shape.
	 */
	generateFromSelections(summary: ProjectSummary): GeneratedFile {
		const config = buildConfigFromSelections(summary.selections)
		const content = stringify(config, {
			indent: 2,
			lineWidth: 100,
		})

		return {
			path: FilePath.create(summary.rootPath).join('.vanguard', 'config.yaml'),
			content: `# Vanguard Configuration\n# Generated: ${new Date().toISOString()}\n\n${content}`,
		}
	}
}

/**
 * Composite service that generates local-only Vanguard artifacts.
 *
 * Generates manifest and config. CLAUDE.md is now rendered
 * server-side as part of the methodology bundle.
 */
export class VanguardGeneratorService implements VanguardGenerator {
	private readonly configGenerator: ConfigGeneratorService
	private readonly manifestGenerator: ManifestGeneratorService

	constructor() {
		this.configGenerator = new ConfigGeneratorService()
		this.manifestGenerator = new ManifestGeneratorService()
	}

	/**
	 * Generate local-only files (manifest, config).
	 *
	 * CLAUDE.md and methodology content (agents, commands, workflows,
	 * templates, constitution) come from the server-rendered bundle.
	 */
	generateLocalFiles(project: Project): GeneratedFile[] {
		return [this.manifestGenerator.generate(project), this.configGenerator.generate(project)]
	}

	/**
	 * Generate all artifacts for a project.
	 *
	 * Now identical to generateLocalFiles() — methodology content
	 * is always provided by the server bundle.
	 */
	generateAll(project: Project): GeneratedFile[] {
		return this.generateLocalFiles(project)
	}

	/**
	 * Generate local-only files from selections (dynamic init flow).
	 * Used when Project entity is not available — only selection slugs.
	 */
	generateLocalFilesFromSelections(summary: ProjectSummary): GeneratedFile[] {
		return [
			this.manifestGenerator.generateFromSummary(summary),
			this.configGenerator.generateFromSelections(summary),
		]
	}
}

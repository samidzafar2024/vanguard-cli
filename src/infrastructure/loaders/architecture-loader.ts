/**
 * Architecture YAML Loader.
 *
 * Loads architecture definitions from YAML files, enabling
 * extensibility without code changes.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import * as yaml from 'yaml'
import {
	type AntiPattern,
	Architecture,
	type ArchitectureLayer,
	type StackImplementation,
} from '../../domain/entities/architecture.js'
import { Identifier } from '../../domain/value-objects/identifier.js'

/**
 * YAML schema for architecture definition.
 */
export interface ArchitectureYaml {
	readonly id: string
	readonly name: string
	readonly abbreviation: string
	readonly complexity: 'low' | 'medium' | 'high'
	readonly description?: string | undefined
	readonly bestFor?: readonly string[] | undefined

	readonly principles: readonly string[]

	readonly layers: readonly {
		readonly name: string
		readonly description: string
		readonly contains: readonly string[]
		readonly rules: readonly string[]
	}[]

	readonly antiPatterns: readonly {
		readonly name: string
		readonly description: string
		readonly fix: string
	}[]

	readonly implementations?: Readonly<
		Record<
			string,
			{
				readonly structure: string
				readonly examples?: Readonly<Record<string, string>> | undefined
			}
		>
	>

	readonly requiredModules?: readonly string[] | undefined
	readonly optionalModules?: readonly string[] | undefined
}

/**
 * Result from loading an architecture.
 */
export interface LoadArchitectureResult {
	readonly success: boolean
	readonly architecture?: Architecture | undefined
	readonly error?: string | undefined
}

/**
 * Loads architecture definitions from YAML files.
 */
export class ArchitectureLoader {
	/**
	 * Load a single architecture from YAML file.
	 */
	loadFromFile(filePath: string): LoadArchitectureResult {
		try {
			if (!existsSync(filePath)) {
				return { success: false, error: `File not found: ${filePath}` }
			}

			const content = readFileSync(filePath, 'utf-8')
			const parsed = yaml.parse(content) as ArchitectureYaml

			const architecture = this.parseArchitecture(parsed)
			return { success: true, architecture }
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}
		}
	}

	/**
	 * Load all architectures from a directory.
	 */
	loadFromDirectory(dirPath: string): readonly LoadArchitectureResult[] {
		if (!existsSync(dirPath)) {
			return []
		}

		const files = readdirSync(dirPath).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))

		return files.map((file) => {
			const result = this.loadFromFile(join(dirPath, file))
			if (!result.success) {
				return { ...result, error: `${basename(file)}: ${result.error}` }
			}
			return result
		})
	}

	/**
	 * Parse YAML into Architecture entity.
	 */
	private parseArchitecture(data: ArchitectureYaml): Architecture {
		const layers: ArchitectureLayer[] = data.layers.map((layer) => ({
			name: layer.name,
			description: layer.description,
			contains: [...layer.contains],
			rules: [...layer.rules],
		}))

		const antiPatterns: AntiPattern[] = data.antiPatterns.map((ap) => ({
			name: ap.name,
			description: ap.description,
			fix: ap.fix,
		}))

		// Build implementations as Record<string, StackImplementation>
		const implementations: Record<string, StackImplementation> = {}
		if (data.implementations) {
			for (const [stackId, impl] of Object.entries(data.implementations)) {
				const examples = new Map<string, string>()
				if (impl.examples) {
					for (const [name, code] of Object.entries(impl.examples)) {
						examples.set(name, code)
					}
				}
				implementations[stackId] = {
					stackId: Identifier.fromString(stackId),
					structure: impl.structure,
					examples,
				}
			}
		}

		return Architecture.create({
			id: data.id,
			name: data.name,
			abbreviation: data.abbreviation,
			complexity: data.complexity,
			bestFor: data.bestFor ? [...data.bestFor] : [],
			principles: [...data.principles],
			layers,
			antiPatterns,
			implementations,
			description: data.description ?? '',
		})
	}
}

/**
 * Export a shared loader instance.
 */
export const architectureLoader = new ArchitectureLoader()

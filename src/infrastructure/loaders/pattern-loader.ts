/**
 * TechPattern YAML Loader.
 *
 * Loads tech pattern definitions from YAML files, enabling
 * stack-specific conventions like "Tao of React".
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import * as yaml from 'yaml'
import {
	type PatternAntiPattern,
	type PatternExample,
	type PatternPrinciple,
	TechPattern,
} from '../../domain/entities/tech-pattern.js'

/**
 * YAML schema for tech pattern definition.
 */
export interface TechPatternYaml {
	readonly id: string
	readonly name: string
	readonly description: string
	readonly source?: string | undefined

	readonly applicableStacks?: readonly string[] | undefined
	readonly applicableArchitectures?: readonly string[] | undefined

	readonly principles: readonly {
		readonly name: string
		readonly description: string
		readonly rationale?: string | undefined
	}[]

	readonly antiPatterns?: readonly {
		readonly name: string
		readonly description: string
		readonly badExample?: string | undefined
		readonly goodExample?: string | undefined
		readonly fix: string
	}[]

	readonly examples?: readonly {
		readonly name: string
		readonly description: string
		readonly code: string
		readonly filename?: string | undefined
	}[]

	readonly fileOrganization?: string | undefined
	readonly namingConventions?: Readonly<Record<string, string>> | undefined
}

/**
 * Result from loading a tech pattern.
 */
export interface LoadPatternResult {
	readonly success: boolean
	readonly pattern?: TechPattern | undefined
	readonly error?: string | undefined
}

/**
 * Loads tech pattern definitions from YAML files.
 */
export class PatternLoader {
	/**
	 * Load a single pattern from YAML file.
	 */
	loadFromFile(filePath: string): LoadPatternResult {
		try {
			if (!existsSync(filePath)) {
				return { success: false, error: `File not found: ${filePath}` }
			}

			const content = readFileSync(filePath, 'utf-8')
			const parsed = yaml.parse(content) as TechPatternYaml

			const pattern = this.parsePattern(parsed)
			return { success: true, pattern }
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}
		}
	}

	/**
	 * Load all patterns from a directory.
	 */
	loadFromDirectory(dirPath: string): readonly LoadPatternResult[] {
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
	 * Parse YAML into TechPattern entity.
	 */
	private parsePattern(data: TechPatternYaml): TechPattern {
		const principles: PatternPrinciple[] = data.principles.map((p) => ({
			name: p.name,
			description: p.description,
			rationale: p.rationale,
		}))

		const antiPatterns: PatternAntiPattern[] = (data.antiPatterns ?? []).map((ap) => ({
			name: ap.name,
			description: ap.description,
			badExample: ap.badExample,
			goodExample: ap.goodExample,
			fix: ap.fix,
		}))

		const examples: PatternExample[] = (data.examples ?? []).map((ex) => ({
			name: ex.name,
			description: ex.description,
			code: ex.code,
			filename: ex.filename,
		}))

		return TechPattern.create({
			id: data.id,
			name: data.name,
			description: data.description,
			source: data.source,
			applicableStacks: data.applicableStacks ? [...data.applicableStacks] : undefined,
			applicableArchitectures: data.applicableArchitectures
				? [...data.applicableArchitectures]
				: undefined,
			principles,
			antiPatterns,
			examples,
			fileOrganization: data.fileOrganization,
			namingConventions: data.namingConventions ? { ...data.namingConventions } : undefined,
		})
	}
}

/**
 * Export a shared loader instance.
 */
export const patternLoader = new PatternLoader()

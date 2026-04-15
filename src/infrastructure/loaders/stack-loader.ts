/**
 * Stack YAML Loader.
 *
 * Loads stack definitions from YAML files, enabling
 * extensibility without code changes.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import * as yaml from 'yaml'
import {
	type AuthConfig,
	type CodeExample,
	type DatabaseType,
	type Language,
	type OrmConfig,
	Stack,
	type StackCategory,
	type StackLayer,
} from '../../domain/entities/stack.js'
import { Identifier } from '../../domain/value-objects/identifier.js'
import { Version } from '../../domain/value-objects/version.js'

/**
 * YAML schema for stack definition.
 */
export interface StackYaml {
	readonly id: string
	readonly name: string
	readonly language: string
	readonly category: string
	readonly version?: string | undefined
	readonly description?: string | undefined

	readonly layers: Readonly<
		Record<
			string,
			{
				readonly framework: string
				readonly version?: string | undefined
				readonly dependencies: readonly string[]
			}
		>
	>

	readonly compatibleOrms?: readonly {
		readonly id: string
		readonly name: string
		readonly language?: string | undefined
		readonly migrationTool: string
		readonly supportedDatabases: readonly string[]
	}[]

	readonly compatibleAuths?: readonly {
		readonly strategy: string
		readonly provider?: string | undefined
		readonly patterns: readonly string[]
	}[]

	readonly fileStructure?: string | undefined

	readonly examples?: readonly {
		readonly name: string
		readonly description?: string | undefined
		readonly filename?: string | undefined
		readonly code: string
	}[]

	readonly conventions?: {
		readonly naming?: Readonly<Record<string, string>> | undefined
		readonly patterns?: readonly string[] | undefined
	}
}

/**
 * Result from loading a stack.
 */
export interface LoadStackResult {
	readonly success: boolean
	readonly stack?: Stack | undefined
	readonly error?: string | undefined
}

/**
 * Loads stack definitions from YAML files.
 */
export class StackLoader {
	/**
	 * Load a single stack from YAML file.
	 */
	loadFromFile(filePath: string): LoadStackResult {
		try {
			if (!existsSync(filePath)) {
				return { success: false, error: `File not found: ${filePath}` }
			}

			const content = readFileSync(filePath, 'utf-8')
			const parsed = yaml.parse(content) as StackYaml

			const stack = this.parseStack(parsed)
			return { success: true, stack }
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}
		}
	}

	/**
	 * Load all stacks from a directory.
	 */
	loadFromDirectory(dirPath: string): readonly LoadStackResult[] {
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
	 * Parse YAML into Stack entity.
	 */
	private parseStack(data: StackYaml): Stack {
		// Build layers as Record<string, StackLayer>
		const layers: Record<string, StackLayer> = {}
		for (const [name, layer] of Object.entries(data.layers)) {
			layers[name] = {
				framework: layer.framework,
				version: Version.create(layer.version ?? '1.0.0'),
				dependencies: [...layer.dependencies],
			}
		}

		// Parse language with validation
		const language = this.parseLanguage(data.language)

		// Parse compatible ORMs
		const compatibleOrms: OrmConfig[] = (data.compatibleOrms ?? []).map((orm) => ({
			id: Identifier.fromString(orm.id),
			name: orm.name,
			language: this.parseLanguage(orm.language ?? data.language),
			migrationTool: orm.migrationTool,
			supportedDatabases: orm.supportedDatabases as DatabaseType[],
		}))

		// Parse compatible auths
		const compatibleAuths: AuthConfig[] = (data.compatibleAuths ?? []).map((auth) => {
			const strategy = this.parseAuthStrategy(auth.strategy)
			const config: AuthConfig = {
				strategy,
				patterns: [...auth.patterns],
			}
			if (auth.provider !== undefined) {
				return { ...config, provider: auth.provider }
			}
			return config
		})

		// Parse examples
		const examples: CodeExample[] = (data.examples ?? []).map((ex) => ({
			name: ex.name,
			description: ex.description ?? '',
			filename: ex.filename ?? '',
			code: ex.code,
		}))

		return Stack.create({
			id: data.id,
			name: data.name,
			language,
			category: data.category as StackCategory,
			version: data.version ?? '1.0.0',
			layers,
			compatibleOrms,
			compatibleAuths,
			fileStructure: data.fileStructure ?? '',
			examples,
			description: data.description ?? '',
		})
	}

	/**
	 * Parse and validate language string.
	 */
	private parseLanguage(value: string): Language {
		const validLanguages: Language[] = [
			'typescript',
			'python',
			'csharp',
			'go',
			'rust',
			'java',
			'ruby',
		]
		const normalized = value.toLowerCase()
		if (validLanguages.includes(normalized as Language)) {
			return normalized as Language
		}
		throw new Error(`Invalid language: ${value}. Must be one of: ${validLanguages.join(', ')}`)
	}

	/**
	 * Parse and validate auth strategy.
	 */
	private parseAuthStrategy(value: string): 'session' | 'jwt' | 'oauth2' | 'none' {
		const validStrategies = ['session', 'jwt', 'oauth2', 'none'] as const
		const normalized = value.toLowerCase()
		if (validStrategies.includes(normalized as (typeof validStrategies)[number])) {
			return normalized as 'session' | 'jwt' | 'oauth2' | 'none'
		}
		throw new Error(
			`Invalid auth strategy: ${value}. Must be one of: ${validStrategies.join(', ')}`,
		)
	}
}

/**
 * Export a shared loader instance.
 */
export const stackLoader = new StackLoader()

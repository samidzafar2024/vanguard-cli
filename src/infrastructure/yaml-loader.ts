import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import {
	type AntiPattern,
	Architecture,
	type ArchitectureLayer,
	type StackImplementation,
} from '../domain/entities/architecture.js'
import {
	type AuthConfig,
	type OrmConfig,
	Stack,
	type StackLayer,
} from '../domain/entities/stack.js'
import { Identifier } from '../domain/value-objects/identifier.js'
import { Version } from '../domain/value-objects/version.js'

// ============================================================================
// Stack YAML Schema
// ============================================================================

const OrmSchema = z.object({
	id: z.string(),
	name: z.string(),
	migrationTool: z.string(),
	supportedDatabases: z.array(z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb', 'sqlserver'])),
})

const AuthSchema = z.object({
	strategy: z.enum(['session', 'jwt', 'oauth2', 'none']),
	provider: z.string().optional(),
	patterns: z.array(z.string()),
})

const ExampleSchema = z.object({
	name: z.string(),
	description: z.string(),
	filename: z.string(),
	code: z.string(),
})

const LayerSchema = z.object({
	framework: z.string(),
	version: z.string(),
	dependencies: z.array(z.string()),
})

const StackYamlSchema = z.object({
	id: z.string(),
	name: z.string(),
	language: z.enum(['typescript', 'python', 'csharp', 'go', 'rust', 'java']),
	category: z.enum(['frontend', 'backend', 'fullstack', 'database']),
	version: z.string(),
	description: z.string(),
	layers: z.record(LayerSchema),
	compatibleOrms: z.array(OrmSchema),
	compatibleAuths: z.array(AuthSchema),
	fileStructure: z.string(),
	examples: z.array(ExampleSchema),
})

// ============================================================================
// Architecture YAML Schema
// ============================================================================

const ArchLayerSchema = z.object({
	name: z.string(),
	description: z.string(),
	contains: z.array(z.string()),
	rules: z.array(z.string()),
})

const AntiPatternSchema = z.object({
	name: z.string(),
	description: z.string(),
	fix: z.string(),
})

const ImplementationSchema = z.object({
	structure: z.string(),
	examples: z.record(z.string()),
})

const ArchitectureYamlSchema = z.object({
	id: z.string(),
	name: z.string(),
	abbreviation: z.string(),
	complexity: z.enum(['low', 'medium', 'high']),
	description: z.string(),
	bestFor: z.array(z.string()),
	principles: z.array(z.string()),
	layers: z.array(ArchLayerSchema),
	antiPatterns: z.array(AntiPatternSchema),
	implementations: z.record(ImplementationSchema),
})

// ============================================================================
// Loaders
// ============================================================================

/**
 * Load a stack definition from a YAML file.
 */
export function loadStackFromYaml(filePath: string): Stack {
	const content = readFileSync(filePath, 'utf-8')
	const data = parse(content)
	const validated = StackYamlSchema.parse(data)

	const layers: Record<string, StackLayer> = {}
	for (const [key, layer] of Object.entries(validated.layers)) {
		layers[key] = {
			framework: layer.framework,
			version: Version.create(layer.version),
			dependencies: layer.dependencies,
		}
	}

	const compatibleOrms: OrmConfig[] = validated.compatibleOrms.map((orm) => ({
		id: Identifier.fromString(orm.id),
		name: orm.name,
		language: validated.language,
		migrationTool: orm.migrationTool,
		supportedDatabases: orm.supportedDatabases,
	}))

	const compatibleAuths: AuthConfig[] = validated.compatibleAuths.map((auth) =>
		auth.provider
			? { strategy: auth.strategy, provider: auth.provider, patterns: auth.patterns }
			: { strategy: auth.strategy, patterns: auth.patterns },
	)

	return Stack.create({
		id: validated.id,
		name: validated.name,
		category: validated.category,
		language: validated.language,
		version: validated.version,
		description: validated.description,
		layers,
		compatibleOrms,
		compatibleAuths,
		fileStructure: validated.fileStructure,
		examples: validated.examples,
	})
}

/**
 * Load an architecture definition from a YAML file.
 */
export function loadArchitectureFromYaml(filePath: string): Architecture {
	const content = readFileSync(filePath, 'utf-8')
	const data = parse(content)
	const validated = ArchitectureYamlSchema.parse(data)

	const layers: ArchitectureLayer[] = validated.layers.map((layer) => ({
		name: layer.name,
		description: layer.description,
		contains: layer.contains,
		rules: layer.rules,
	}))

	const antiPatterns: AntiPattern[] = validated.antiPatterns.map((ap) => ({
		name: ap.name,
		description: ap.description,
		fix: ap.fix,
	}))

	const implementations: Record<string, StackImplementation> = {}
	for (const [stackId, impl] of Object.entries(validated.implementations)) {
		implementations[stackId] = {
			stackId: Identifier.fromString(stackId),
			structure: impl.structure,
			examples: new Map(Object.entries(impl.examples)),
		}
	}

	return Architecture.create({
		id: validated.id,
		name: validated.name,
		abbreviation: validated.abbreviation,
		complexity: validated.complexity,
		description: validated.description,
		bestFor: validated.bestFor,
		principles: validated.principles,
		layers,
		antiPatterns,
		implementations,
	})
}

/**
 * Load all stacks from a directory.
 */
export function loadStacksFromDirectory(dirPath: string): Stack[] {
	const stacks: Stack[] = []

	try {
		const files = readdirSync(dirPath)
		for (const file of files) {
			const filePath = join(dirPath, file)
			if (statSync(filePath).isFile() && ['.yaml', '.yml'].includes(extname(file))) {
				try {
					stacks.push(loadStackFromYaml(filePath))
				} catch (error) {
					console.warn(`Warning: Failed to load stack from ${file}:`, error)
				}
			}
		}
	} catch {
		// Directory doesn't exist, return empty array
	}

	return stacks
}

/**
 * Load all architectures from a directory.
 */
export function loadArchitecturesFromDirectory(dirPath: string): Architecture[] {
	const architectures: Architecture[] = []

	try {
		const files = readdirSync(dirPath)
		for (const file of files) {
			const filePath = join(dirPath, file)
			if (statSync(filePath).isFile() && ['.yaml', '.yml'].includes(extname(file))) {
				try {
					architectures.push(loadArchitectureFromYaml(filePath))
				} catch (error) {
					console.warn(`Warning: Failed to load architecture from ${file}:`, error)
				}
			}
		}
	} catch {
		// Directory doesn't exist, return empty array
	}

	return architectures
}

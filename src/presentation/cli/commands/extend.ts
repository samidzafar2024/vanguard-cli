import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { FilePath } from '../../../domain/value-objects/file-path.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { requireAuth } from '../utils/require-auth.js'

export const extendCommand = new Command('extend')
	.description('Extend Vanguard with new stacks, architectures, or modules')
	.addCommand(createStackCommand())
	.addCommand(createArchitectureCommand())

function createStackCommand(): Command {
	return new Command('stack')
		.description('Create a new tech stack definition')
		.argument('<id>', 'Stack identifier (e.g., "remix", "nestjs")')
		.option('-n, --name <name>', 'Stack display name')
		.option('-l, --language <lang>', 'Programming language (typescript|python|csharp|go|rust|java)')
		.option('-c, --category <cat>', 'Stack category (frontend|backend|fullstack)')
		.option('-d, --description <desc>', 'Short description')
		.option('-y, --yes', 'Accept defaults without prompting')
		.action(async (id: string, options) => {
			// Require authentication
			await requireAuth()

			p.intro(pc.bgMagenta(pc.black(' Module Architect ')))

			const canceled = () => {
				p.cancel('Operation canceled.')
				process.exit(1)
			}

			let stackDetails: {
				name: string | symbol
				language: string | symbol
				category: string | symbol
				description: string | symbol
			}

			if (options.yes || !process.stdout.isTTY) {
				// Non-interactive mode
				stackDetails = {
					name: options.name ?? formatId(id),
					language: options.language ?? 'typescript',
					category: options.category ?? 'backend',
					description: options.description ?? `${formatId(id)} stack`,
				}
			} else {
				stackDetails = await p.group(
					{
						name: () =>
							p.text({
								message: 'Stack display name',
								defaultValue: options.name ?? formatId(id),
								validate: (v) => (!v ? 'Name is required' : undefined),
							}),
						language: () =>
							p.select({
								message: 'Programming language',
								initialValue: options.language ?? 'typescript',
								options: [
									{ value: 'typescript', label: 'TypeScript' },
									{ value: 'python', label: 'Python' },
									{ value: 'csharp', label: 'C#' },
									{ value: 'go', label: 'Go' },
									{ value: 'rust', label: 'Rust' },
									{ value: 'java', label: 'Java' },
								],
							}),
						category: () =>
							p.select({
								message: 'Stack category',
								initialValue: options.category ?? 'backend',
								options: [
									{ value: 'frontend', label: 'Frontend', hint: 'UI frameworks' },
									{ value: 'backend', label: 'Backend', hint: 'API/server frameworks' },
									{ value: 'fullstack', label: 'Full-stack', hint: 'Combined front+back' },
								],
							}),
						description: () =>
							p.text({
								message: 'Short description',
								defaultValue: options.description,
								placeholder: 'A brief description of this stack',
								validate: (v) => (!v ? 'Description is required' : undefined),
							}),
					},
					{ onCancel: canceled },
				)
			}

			const template = generateStackTemplate(
				id,
				stackDetails.name as string,
				stackDetails.language as string,
				stackDetails.category as string,
				stackDetails.description as string,
			)

			const outputPath = FilePath.create(process.cwd()).join('stacks', `${id}.yaml`)

			const writer = new FsFileWriter()
			await writer.ensureDirectory(outputPath.parent())
			const result = await writer.write({
				path: outputPath,
				content: template,
			})

			if (result.success) {
				p.note(
					`${pc.cyan('File created')}: ${outputPath.toString()}

${pc.bold('Next steps')}:
1. Edit the YAML file to add:
   - Compatible ORMs
   - Auth strategies
   - File structure
   - Code examples

2. Register the stack in your project:
   ${pc.cyan('import')} { loadStackFromYaml } from 'vanguard-cli'`,
					'Stack scaffolded',
				)
				p.outro(pc.green('Stack template created!'))
			} else {
				p.log.error(`Failed to create stack: ${result.error}`)
				process.exit(1)
			}
		})
}

function createArchitectureCommand(): Command {
	return new Command('architecture')
		.alias('arch')
		.description('Create a new architecture pattern definition')
		.argument('<id>', 'Architecture identifier (e.g., "hexagonal", "vertical-slice")')
		.option('-n, --name <name>', 'Architecture display name')
		.option('-a, --abbrev <abbrev>', 'Abbreviation')
		.option('-c, --complexity <level>', 'Complexity level (low|medium|high)')
		.option('-d, --description <desc>', 'Short description')
		.option('-y, --yes', 'Accept defaults without prompting')
		.action(async (id: string, options) => {
			// Require authentication
			await requireAuth()

			p.intro(pc.bgMagenta(pc.black(' Module Architect ')))

			const canceled = () => {
				p.cancel('Operation canceled.')
				process.exit(1)
			}

			let archDetails: {
				name: string | symbol
				abbreviation: string | symbol
				complexity: string | symbol
				description: string | symbol
			}

			if (options.yes || !process.stdout.isTTY) {
				// Non-interactive mode
				archDetails = {
					name: options.name ?? formatId(id),
					abbreviation: options.abbrev ?? id.slice(0, 4).toUpperCase(),
					complexity: options.complexity ?? 'medium',
					description: options.description ?? `${formatId(id)} architecture pattern`,
				}
			} else {
				archDetails = await p.group(
					{
						name: () =>
							p.text({
								message: 'Architecture display name',
								defaultValue: options.name ?? formatId(id),
								validate: (v) => (!v ? 'Name is required' : undefined),
							}),
						abbreviation: () =>
							p.text({
								message: 'Abbreviation (2-6 chars)',
								defaultValue: options.abbrev ?? id.slice(0, 4).toUpperCase(),
								validate: (v) => {
									if (!v) return 'Abbreviation is required'
									if (v.length > 6) return 'Max 6 characters'
									return undefined
								},
							}),
						complexity: () =>
							p.select({
								message: 'Complexity level',
								initialValue: options.complexity ?? 'medium',
								options: [
									{ value: 'low', label: 'Low', hint: 'Simple, few layers' },
									{ value: 'medium', label: 'Medium', hint: 'Moderate structure' },
									{ value: 'high', label: 'High', hint: 'Complex, many patterns' },
								],
							}),
						description: () =>
							p.text({
								message: 'Short description',
								defaultValue: options.description,
								placeholder: 'A brief description of this architecture',
								validate: (v) => (!v ? 'Description is required' : undefined),
							}),
					},
					{ onCancel: canceled },
				)
			}

			const template = generateArchitectureTemplate(
				id,
				archDetails.name as string,
				archDetails.abbreviation as string,
				archDetails.complexity as string,
				archDetails.description as string,
			)

			const outputPath = FilePath.create(process.cwd()).join('architectures', `${id}.yaml`)

			const writer = new FsFileWriter()
			await writer.ensureDirectory(outputPath.parent())
			const result = await writer.write({
				path: outputPath,
				content: template,
			})

			if (result.success) {
				p.note(
					`${pc.cyan('File created')}: ${outputPath.toString()}

${pc.bold('Next steps')}:
1. Edit the YAML file to add:
   - Core principles
   - Layer definitions
   - Anti-patterns
   - Stack implementations with examples

2. Register the architecture in your project:
   ${pc.cyan('import')} { loadArchitectureFromYaml } from 'vanguard-cli'`,
					'Architecture scaffolded',
				)
				p.outro(pc.green('Architecture template created!'))
			} else {
				p.log.error(`Failed to create architecture: ${result.error}`)
				process.exit(1)
			}
		})
}

function formatId(id: string): string {
	return id
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

function generateStackTemplate(
	id: string,
	name: string,
	language: string,
	category: string,
	description: string,
): string {
	return `# Stack Definition: ${name}
# Generated by Vanguard Module Architect

id: ${id}
name: "${name}"
language: ${language}
category: ${category}
version: "1.0.0"
description: "${description}"

# Layer configuration
layers:
  main:
    framework: "${name}"
    version: "1.0.0"
    dependencies:
      - "${id}"
      # Add more dependencies

# Compatible ORMs (must match language)
compatibleOrms:
  - id: prisma
    name: Prisma
    migrationTool: prisma migrate
    supportedDatabases:
      - postgresql
      - mysql
      - sqlite
  # Add more ORMs

# Authentication strategies
compatibleAuths:
  - strategy: jwt
    patterns:
      - "Bearer token in Authorization header"
  - strategy: session
    provider: "custom"
    patterns:
      - "Session cookie authentication"
  # Add more auth strategies

# Project file structure (for display/guidance)
fileStructure: |
  src/
  ├── routes/                 # Route handlers
  ├── services/               # Business logic
  ├── models/                 # Data models
  ├── middleware/             # Custom middleware
  ├── utils/                  # Helper functions
  └── types/                  # Type definitions

# Code examples for few-shot prompting
examples:
  - name: "Basic Route Handler"
    description: "Example of a route handler pattern"
    filename: "routes/user.ts"
    code: |
      // TODO: Add example code that demonstrates
      // the idiomatic patterns for this stack

      export async function getUser(id: string) {
        // Your implementation here
      }

  - name: "Service Pattern"
    description: "Example of a service class"
    filename: "services/user.service.ts"
    code: |
      // TODO: Add service pattern example

      export class UserService {
        async findById(id: string) {
          // Implementation
        }
      }

# Stack-specific conventions
conventions:
  naming:
    files: kebab-case
    classes: PascalCase
    functions: camelCase
  patterns:
    - "Route handlers should be thin"
    - "Business logic belongs in services"
`
}

function generateArchitectureTemplate(
	id: string,
	name: string,
	abbreviation: string,
	complexity: string,
	description: string,
): string {
	return `# Architecture Definition: ${name}
# Generated by Vanguard Module Architect

id: ${id}
name: "${name}"
abbreviation: "${abbreviation}"
complexity: ${complexity}
description: "${description}"

# When to use this architecture
bestFor:
  - "TODO: Describe ideal use cases"
  - "Complex business logic"
  - "Long-lived applications"

# Core principles (injected into all agents)
principles:
  - "TODO: Add core principle 1"
  - "TODO: Add core principle 2"
  - "Dependencies should point inward"
  - "Business logic is isolated from frameworks"

# Layer definitions
layers:
  - name: "Core/Domain"
    description: "Business logic and domain rules"
    contains:
      - entities
      - value-objects
      - domain-services
    rules:
      - "No dependencies on other layers"
      - "Pure business logic only"
      - "Framework-agnostic"

  - name: "Application"
    description: "Use cases and orchestration"
    contains:
      - use-cases
      - ports
      - interfaces
    rules:
      - "Depends only on Core layer"
      - "Defines port interfaces"
      - "Contains application services"

  - name: "Infrastructure"
    description: "External concerns"
    contains:
      - repositories
      - external-services
      - adapters
    rules:
      - "Implements port interfaces"
      - "Database and API integrations"
      - "Framework-specific code"

  - name: "Presentation"
    description: "User interface layer"
    contains:
      - controllers
      - views
      - api-routes
    rules:
      - "Handles HTTP/UI concerns"
      - "Depends on Application layer"
      - "Input validation"

# Anti-patterns to avoid
antiPatterns:
  - name: "TODO: Anti-pattern name"
    description: "Brief description of the anti-pattern"
    fix: "How to fix or avoid this pattern"

  - name: "Fat Controller"
    description: "Controllers with too much business logic"
    fix: "Extract business logic into use cases or services"

# Stack-specific implementations
implementations:
  # TypeScript/Next.js implementation
  nextjs-app-router:
    structure: |
      src/
      ├── domain/           # Core business logic
      ├── application/      # Use cases
      ├── infrastructure/   # External concerns
      └── presentation/     # API routes, components
    examples:
      Entity: |
        // domain/entities/user.ts
        export class User {
          constructor(
            public readonly id: string,
            public readonly email: string
          ) {}

          // Business logic methods here
        }

      UseCase: |
        // application/use-cases/create-user.ts
        export class CreateUserUseCase {
          constructor(private userRepo: UserRepository) {}

          async execute(input: CreateUserInput) {
            // Implementation
          }
        }

  # Python/FastAPI implementation (optional)
  # fastapi:
  #   structure: |
  #     app/
  #     ├── domain/
  #     ├── application/
  #     └── infrastructure/
  #   examples:
  #     Entity: |
  #       # Python example

# Module dependencies (optional)
# If this architecture requires specific modules
requiredModules: []

# Optional extensions
optionalModules:
  - cqrs
  - event-sourcing
`
}

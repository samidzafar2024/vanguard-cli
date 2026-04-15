import * as fs from 'node:fs'
import * as path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import gradient from 'gradient-string'
import pc from 'picocolors'
import { HookWiringService } from '../../../application/services/hook-wiring.service.js'
import { InitSchemaService } from '../../../application/services/init-schema.service.js'
import { McpWiringService } from '../../../application/services/mcp-wiring.service.js'
import type { MethodologyInstallResult } from '../../../application/services/methodology.service.js'
import { MethodologyService } from '../../../application/services/methodology.service.js'
import { ProjectRegistrationService } from '../../../application/services/project-registration.service.js'
import {
	type ProjectSummary,
	VanguardGeneratorService,
} from '../../../application/services/vanguard-generator.service.js'
import { InitMemoryUseCase } from '../../../application/use-cases/memory/init-memory.use-case.js'
import type { BundlePhase } from '../../../domain/entities/methodology-bundle.js'
import { InitSchemaAdapter } from '../../../infrastructure/api/init-schema.adapter.js'
import { MethodologyBundleAdapter } from '../../../infrastructure/api/methodology-bundle.adapter.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { GitService } from '../../../infrastructure/git.service.js'
import { type DetectedProject, ProjectDetector } from '../../../infrastructure/project-detector.js'
import { authRepository } from '../../../infrastructure/repositories/auth.repository.js'
import { FileMemoryConfigRepository } from '../../../infrastructure/repositories/memory-config.repository.js'
import type { SmartDefaults } from '../../cli/prompts/dynamic-prompt-renderer.js'
import { DynamicPromptRenderer } from '../../cli/prompts/dynamic-prompt-renderer.js'
import { requireAuth } from '../utils/require-auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Map ProjectDetector stackIds to server-side choice slugs.
 * Keys are detector stackIds, values are server choice slugs.
 */
const DETECTOR_TO_SERVER_SLUG: Record<string, string> = {
	'nextjs-typescript': 'nextjs-app-router',
	'nestjs-typescript': 'nestjs',
	'fastapi-python': 'fastapi',
	'django-python': 'django',
	'flask-python': 'flask',
	'aspnet-csharp': 'aspnet-webapi',
}

/**
 * Convert ProjectDetector results to server-compatible SmartDefaults.
 */
function mapDetectedToServerSlugs(detected: DetectedProject): SmartDefaults {
	const defaults: Record<string, string> = {}
	if (detected.language) defaults.language = detected.language
	if (detected.stackId) {
		defaults.stack = DETECTOR_TO_SERVER_SLUG[detected.stackId] ?? detected.stackId
	}
	if (detected.orm) defaults.orm = detected.orm
	if (detected.database) defaults.database = detected.database
	if (detected.testFramework) defaults['unit-test'] = detected.testFramework
	return defaults
}

/**
 * Map CLI flags to server group slugs for the renderer's flagOverrides.
 */
function buildFlagOverrides(options: Record<string, unknown>): Record<string, string> {
	const overrides: Record<string, string> = {}
	if (typeof options.stack === 'string') overrides.stack = options.stack
	if (typeof options.architecture === 'string') overrides.architecture = options.architecture
	if (typeof options.type === 'string') overrides['project-type'] = options.type
	if (typeof options.track === 'string') overrides.track = options.track
	return overrides
}

/**
 * Sanitize a directory name into a valid project name.
 */
function sanitizeProjectName(dirName: string): string {
	let name = dirName
		.toLowerCase()
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')

	if (!/^[a-z0-9]/.test(name)) {
		name = `project-${name}`
	}

	return name || 'my-project'
}

/**
 * Check if a directory appears to be an existing project (brownfield).
 */
function detectProjectType(rootPath: string): 'greenfield' | 'brownfield' {
	const indicators = [
		'package.json',
		'requirements.txt',
		'pyproject.toml',
		'Cargo.toml',
		'go.mod',
		'pom.xml',
		'build.gradle',
		'.git',
		'src',
		'lib',
		'app',
	]

	for (const indicator of indicators) {
		if (fs.existsSync(path.join(rootPath, indicator))) {
			return 'brownfield'
		}
	}

	try {
		const files = fs.readdirSync(rootPath)
		if (files.some((f: string) => f.endsWith('.csproj') || f.endsWith('.sln'))) {
			return 'brownfield'
		}
	} catch {
		// Ignore errors
	}

	return 'greenfield'
}

// Custom Vanguard gradient (cyan to purple)
const vanguardGradient = gradient(['#00d4ff', '#7c3aed', '#c026d3'])

function getCliVersion(): string {
	const pkgPath = path.join(__dirname, '..', '..', '..', '..', 'package.json')
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
	return pkg.version ?? '0.0.0'
}

function showBanner(): void {
	const logo = `
██╗   ██╗ █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
██║   ██║██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
██║   ██║███████║██╔██╗ ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║
╚██╗ ██╔╝██╔══██║██║╚██╗██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
 ╚████╔╝ ██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝`

	console.log(vanguardGradient.multiline(logo))
	console.log(pc.dim(`    v${getCliVersion()}`))
	console.log(pc.dim('    Discover → Specify → Architect → Plan → Implement'))
	console.log(pc.dim('    by Vanguard AI'))
	console.log('')
}

// ============================================================================
// Init Step Functions
// ============================================================================

interface InitContext {
	rootPath: string
	cliVersion: string
	registrationService: ProjectRegistrationService
	gitService: GitService
	options: Record<string, unknown>
	canceled: () => never
}

async function promptProjectName(ctx: InitContext, defaultProjectName: string): Promise<string> {
	if (ctx.options.yes) {
		return (ctx.options.name ?? defaultProjectName) as string
	}
	const result = await p.text({
		message: 'Project name',
		defaultValue: (ctx.options.name ?? defaultProjectName) as string,
		placeholder: defaultProjectName,
		validate: (value) => {
			if (!value) return 'Name is required'
			if (!/^[a-z0-9-]+$/.test(value)) {
				return 'Name must be lowercase alphanumeric with hyphens'
			}
			return undefined
		},
	})
	if (p.isCancel(result)) ctx.canceled()
	return result as string
}

function runSmartDetection(
	ctx: InitContext,
	detectedProjectType: 'greenfield' | 'brownfield',
): SmartDefaults {
	if (detectedProjectType !== 'brownfield') return {}

	const detector = new ProjectDetector()
	const detected = detector.detect(ctx.rootPath)
	const smartDefaults = mapDetectedToServerSlugs(detected)

	if (!ctx.options.yes && Object.keys(smartDefaults).length > 0) {
		const detectedItems: string[] = []
		if (detected.language) detectedItems.push(`Language: ${detected.language}`)
		if (detected.framework) detectedItems.push(`Framework: ${detected.framework}`)
		if (detected.orm) detectedItems.push(`ORM: ${detected.orm}`)
		if (detected.database) detectedItems.push(`Database: ${detected.database}`)
		if (detected.testFramework) detectedItems.push(`Testing: ${detected.testFramework}`)
		p.note(detectedItems.join('\n'), 'Detected from existing project')
	}

	return smartDefaults
}

async function confirmSelections(
	ctx: InitContext,
	projectName: string,
	entries: ReadonlyArray<{ groupName: string; choiceLabel: string }>,
): Promise<void> {
	const summaryLines = [
		`${pc.bold('Project')}: ${projectName}`,
		...entries.map((e) => `${pc.bold(e.groupName)}: ${e.choiceLabel}`),
	]
	p.note(summaryLines.join('\n'), 'Configuration')

	if (!ctx.options.yes) {
		const confirmed = await p.confirm({
			message: 'Create project with these settings?',
			initialValue: true,
		})
		if (p.isCancel(confirmed) || !confirmed) ctx.canceled()
	}
}

async function registerProject(
	ctx: InitContext,
	projectName: string,
	selections: Record<string, string>,
	detectedProjectType: 'greenfield' | 'brownfield',
): Promise<{ projectId: string | undefined; orgSlug: string | undefined }> {
	const registerSpinner = p.spinner()
	registerSpinner.start('Registering project')

	let projectId: string | undefined
	let orgSlug: string | undefined

	try {
		const result = await ctx.registrationService.register({
			name: projectName,
			type: (selections['project-type'] ?? detectedProjectType) as ProjectSummary['type'],
			track: (selections.track ?? 'team') as ProjectSummary['track'],
			projectPath: ctx.rootPath,
			gitRemoteUrl: ctx.gitService.getRemoteUrl(),
			defaultBranch: ctx.gitService.getDefaultBranch(),
			selections,
		})

		if (result.success && result.projectId) {
			projectId = result.projectId
			orgSlug = result.orgSlug
			registerSpinner.stop(
				result.isNew
					? 'Project registered with Vanguard'
					: 'Project linked to existing registration',
			)
		} else {
			registerSpinner.stop(`Could not register project: ${result.error ?? 'unknown'}`)
		}
	} catch (_error) {
		registerSpinner.stop('Could not register project (network error)')
	}

	return { projectId, orgSlug }
}

async function fetchBundle(
	projectId: string,
	cliVersion: string,
	writer: FsFileWriter,
	rootPath: string,
): Promise<{ phases: readonly BundlePhase[]; result: MethodologyInstallResult }> {
	const bundleSpinner = p.spinner()
	bundleSpinner.start('Fetching methodology from server')

	try {
		const methodologyService = new MethodologyService(
			new MethodologyBundleAdapter(cliVersion),
			writer,
			new FsFileReader(),
		)
		const result = await methodologyService.install(projectId, rootPath)
		bundleSpinner.stop(`Wrote ${result.filesWritten} methodology files from server`)
		return { phases: result.phases, result }
	} catch (error) {
		bundleSpinner.stop('Failed to fetch methodology bundle')
		p.log.error(
			error instanceof Error
				? `Could not fetch methodology: ${error.message}`
				: 'Could not reach Vanguard server',
		)
		p.log.info('The methodology bundle is required. Please check your connection and try again.')
		process.exit(1)
	}
}

async function generateLocalFiles(
	writer: FsFileWriter,
	projectName: string,
	selections: Record<string, string>,
	detectedProjectType: 'greenfield' | 'brownfield',
	rootPath: string,
): Promise<{ ok: number; failed: Array<{ path: { toString(): string }; error?: string }> }> {
	const generateSpinner = p.spinner()
	generateSpinner.start('Generating Vanguard artifacts')

	const generator = new VanguardGeneratorService()
	const summary: ProjectSummary = {
		name: projectName,
		type: (selections['project-type'] ?? detectedProjectType) as ProjectSummary['type'],
		track: (selections.track ?? 'team') as ProjectSummary['track'],
		rootPath,
		selections,
	}
	const localFiles = generator.generateLocalFilesFromSelections(summary)
	const allWriteResults = await writer.writeAll(localFiles)
	const ok = allWriteResults.filter((r) => r.success).length
	generateSpinner.stop(`Generated ${ok} local files`)

	return { ok, failed: allWriteResults.filter((r) => !r.success) }
}

async function wireMcp(
	writer: FsFileWriter,
	rootPath: string,
	projectId: string | undefined,
): Promise<void> {
	const mcpSpinner = p.spinner()
	mcpSpinner.start('Configuring MCP')

	try {
		const token = await authRepository.getAccessToken()
		const mcpEndpoint = await authRepository.getApiEndpoint()

		if (token && mcpEndpoint) {
			const mcpWiring = new McpWiringService(writer, new FsFileReader())
			const mcpResult = await mcpWiring.wire({
				projectRoot: rootPath,
				token,
				mcpUrl: `${mcpEndpoint}/api/mcp`,
				...(projectId !== undefined && { projectId }),
			})

			const mcpParts: string[] = []
			if (mcpResult.mcpJsonWritten) mcpParts.push('.mcp.json')
			if (mcpResult.settingsWritten) mcpParts.push('settings.local.json')
			if (mcpResult.gitignoreUpdated) mcpParts.push('.gitignore updated')

			mcpSpinner.stop(
				mcpResult.connectivityOk
					? `MCP configured (${mcpParts.join(', ')})`
					: `MCP configured locally (${mcpParts.join(', ')}) — connectivity check failed`,
			)
		} else {
			mcpSpinner.stop('MCP skipped (no credentials)')
		}
	} catch {
		mcpSpinner.stop('MCP configuration skipped')
	}
}

async function wireHooks(
	writer: FsFileWriter,
	rootPath: string,
	methodologyResult: MethodologyInstallResult,
): Promise<void> {
	if (!methodologyResult.hookConfig) return

	try {
		const hookWiring = new HookWiringService(writer, new FsFileReader())
		const hookResult = await hookWiring.wire({
			projectRoot: rootPath,
			hookConfig: methodologyResult.hookConfig,
			executableFiles: methodologyResult.executableFiles,
		})

		if (hookResult.settingsMerged || hookResult.executableCount > 0) {
			const parts: string[] = []
			if (hookResult.settingsMerged) parts.push('settings.json')
			if (hookResult.executableCount > 0) parts.push(`${hookResult.executableCount} hook script(s)`)
			p.log.success(`Hooks configured (${parts.join(', ')})`)
		}
	} catch {
		// Hook wiring is non-critical
	}
}

function showNextSteps(rootPath: string, bundlePhases: readonly BundlePhase[]): void {
	const commandLines =
		bundlePhases.length > 0
			? bundlePhases.map((phase) => {
					const cmd = `/vanguard.${phase.slug}`
					return `  ${cmd.padEnd(21)} - ${phase.description}`
				})
			: [
					'  /vanguard.discover   - Analyze codebase or problem space',
					'  /vanguard.brainstorm - Creative ideation session',
					'  /vanguard.constitute - Review project principles',
					'  /vanguard.specify    - Create feature specification',
					'  /vanguard.design     - Create UX/UI design',
					'  /vanguard.clarify    - Resolve spec ambiguities',
					'  /vanguard.architect  - Design technical architecture',
					'  /vanguard.plan       - Break into granular tasks',
					'  /vanguard.implement  - Write code following patterns',
					'  /vanguard.review     - QA review implementation',
					'  /vanguard.extend     - Add stacks, architectures, or modules',
				]

	p.note(
		`${pc.cyan('cd')} ${rootPath === process.cwd() ? '.' : rootPath}
${pc.cyan('cat')} .vanguard/constitution.md  ${pc.dim('# Read project principles')}
${pc.cyan('cat')} CLAUDE.md                   ${pc.dim('# Claude Code context')}

${pc.bold('Available commands')}:
${commandLines.join('\n')}`,
		'Next steps',
	)
}

// ============================================================================
// Command Definition
// ============================================================================

export const initCommand = new Command('init')
	.description('Initialize a new Vanguard project')
	.argument('[path]', 'Project path', '.')
	.option('-n, --name <name>', 'Project name')
	.option('-t, --type <type>', 'Project type (greenfield|brownfield)')
	.option('--track <track>', 'Project scale (solo|team|enterprise)')
	.option('-s, --stack <stack>', 'Tech stack ID')
	.option('-a, --architecture <arch>', 'Architecture pattern ID')
	.option('-y, --yes', 'Accept all defaults')
	.option('--dev', 'Use development server (localhost:3000)')
	.action(async (targetPath: string, options) => {
		await requireAuth({ dev: options.dev })

		const rootPath = targetPath === '.' ? process.cwd() : targetPath

		showBanner()
		p.intro(pc.bgCyan(pc.black(' Initialize Project ')))

		const canceled = (): never => {
			p.cancel('Operation canceled.')
			process.exit(1)
		}

		const cliVersion = getCliVersion()
		const accessToken = await authRepository.getAccessToken()
		const apiEndpoint = await authRepository.getApiEndpoint()

		if (!apiEndpoint || !accessToken) {
			p.log.error('Missing credentials. Please run `vanguard login` first.')
			process.exit(1)
		}

		const ctx: InitContext = {
			rootPath,
			cliVersion,
			registrationService: new ProjectRegistrationService(apiEndpoint, accessToken, cliVersion),
			gitService: new GitService(rootPath),
			options,
			canceled,
		}

		// Fetch schema from server (FR-001)
		const schemaSpinner = p.spinner()
		schemaSpinner.start('Fetching options from server')

		try {
			const schemaService = new InitSchemaService(new InitSchemaAdapter(cliVersion))
			const schema = await schemaService.fetch()
			const orderedGroups = schemaService.getOrderedGroups(schema)
			schemaSpinner.stop(`Loaded ${orderedGroups.length} option groups from server`)

			const dirName = rootPath.split('/').pop() ?? 'my-project'
			const defaultProjectName = sanitizeProjectName(dirName)
			const detectedProjectType = detectProjectType(rootPath)

			const projectName = await promptProjectName(ctx, defaultProjectName)
			const smartDefaults = runSmartDetection(ctx, detectedProjectType)

			const renderer = new DynamicPromptRenderer()
			const promptResult = await renderer.render(
				orderedGroups,
				smartDefaults,
				{ yes: !!options.yes, flagOverrides: buildFlagOverrides(options) },
				canceled,
			)

			await confirmSelections(ctx, projectName, promptResult.entries)

			const selections = Object.fromEntries(Object.entries(promptResult.selections)) as Record<
				string,
				string
			>

			const { projectId, orgSlug } = await registerProject(
				ctx,
				projectName,
				selections,
				detectedProjectType,
			)

			if (!projectId) {
				p.log.error(
					'Project registration failed — cannot fetch methodology bundle without a project ID.',
				)
				p.log.info('Please check your connection and try again.')
				process.exit(1)
			}

			const writer = new FsFileWriter()
			const bundle = await fetchBundle(projectId, cliVersion, writer, rootPath)
			const writeResults = await generateLocalFiles(
				writer,
				projectName,
				selections,
				detectedProjectType,
				rootPath,
			)

			await wireMcp(writer, rootPath, projectId)
			await wireHooks(writer, rootPath, bundle.result)

			try {
				const memoryConfigRepo = new FileMemoryConfigRepository(rootPath)
				const initMemory = new InitMemoryUseCase(memoryConfigRepo)
				await initMemory.execute({
					projectName,
					...(orgSlug !== undefined && { orgSlug }),
				})
			} catch {
				// Memory init is non-critical
			}

			if (writeResults.failed.length > 0) {
				p.log.warn(`${writeResults.failed.length} files failed to write:`)
				for (const f of writeResults.failed) {
					p.log.error(`  ${f.path.toString()}: ${f.error}`)
				}
			}

			showNextSteps(rootPath, bundle.phases)
			p.outro(pc.green('Vanguard initialized successfully!'))
		} catch (error) {
			schemaSpinner.stop('Failed to fetch options from server')
			p.log.error(
				error instanceof Error
					? error.message
					: 'Could not reach Vanguard server. Please check your connection.',
			)
			process.exit(1)
		}
	})

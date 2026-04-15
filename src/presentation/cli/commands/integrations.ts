import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { IntegrationService } from '../../../application/services/integration.service.js'
import type { IntegrationConfig } from '../../../domain/entities/integration.js'
import { FsFileReader } from '../../../infrastructure/file-reader.js'
import { FsFileWriter } from '../../../infrastructure/file-writer.js'
import { CliGitService } from '../../../infrastructure/git-service.js'
import { DefaultIntegrationProviderFactory } from '../../../infrastructure/integrations/index.js'
import { generateEnvVarName } from '../../../infrastructure/utils/env-token.js'
import { requireAuth } from '../utils/require-auth.js'

const factory = new DefaultIntegrationProviderFactory()
const service = new IntegrationService(
	factory,
	new FsFileReader(),
	new FsFileWriter(),
	new CliGitService(),
)

function canceled(): never {
	p.cancel('Operation canceled.')
	process.exit(1)
}

/**
 * Command to add a new integration.
 */
const addCommand = new Command('add')
	.description('Add a new PM tool integration')
	.option('-t, --type <type>', 'Integration type (clickup, jira, etc.)')
	.option('-n, --name <name>', 'Integration name')
	.option('--token <token>', 'API token')
	.action(async (options) => {
		// Require authentication
		await requireAuth()

		p.intro(pc.bgCyan(pc.black(' Add Integration ')))

		const supportedTypes = service.getSupportedTypes()

		// Select type
		const type = options.type
			? options.type
			: await p.select({
					message: 'Integration type',
					options: supportedTypes.map((t) => ({
						value: t,
						label: t.charAt(0).toUpperCase() + t.slice(1),
					})),
				})

		if (p.isCancel(type)) canceled()

		// Enter API token
		const apiToken = options.token
			? options.token
			: await p.password({
					message: `Enter your ${type} API token`,
					validate: (value) => {
						if (!value) return 'API token is required'
						return undefined
					},
				})

		if (p.isCancel(apiToken)) canceled()

		// Test connection and get workspaces
		const spinner = p.spinner()
		spinner.start('Connecting...')

		let workspaces: ReadonlyArray<{ id: string; name: string }>
		try {
			workspaces = await service.listWorkspaces(type as string, apiToken as string)
			spinner.stop('Connected successfully')
		} catch (err) {
			spinner.stop('Connection failed')
			p.log.error(`Failed to connect: ${err}`)
			process.exit(1)
		}

		if (workspaces.length === 0) {
			p.log.error('No workspaces found. Please check your permissions.')
			process.exit(1)
		}

		// Select workspace
		const workspaceId = await p.select({
			message: 'Select workspace',
			options: workspaces.map((w) => ({
				value: w.id,
				label: w.name,
			})),
		})

		if (p.isCancel(workspaceId)) canceled()

		// Get projects in workspace
		spinner.start('Loading projects...')
		const projects = await service.listProjects(
			type as string,
			apiToken as string,
			workspaceId as string,
		)
		spinner.stop(`Found ${projects.length} projects`)

		if (projects.length === 0) {
			p.log.error('No projects found in this workspace.')
			process.exit(1)
		}

		// Select project
		const projectId = await p.select({
			message: 'Select project/list',
			options: projects.map((proj) => {
				const option: { value: string; label: string; hint?: string } = {
					value: proj.id,
					label: proj.name,
				}
				if (proj.description) {
					option.hint = proj.description
				}
				return option
			}),
		})

		if (p.isCancel(projectId)) canceled()

		const selectedProject = projects.find((proj) => proj.id === projectId)

		// Build status mapping from project statuses
		const statusMapping = service.buildDefaultStatusMapping(
			type as string,
			selectedProject?.statuses ?? [],
		)

		// Enter name for this integration
		const workspace = workspaces.find((w) => w.id === workspaceId)
		const defaultName = `${type}-${workspace?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'default'}`

		const name = options.name
			? options.name
			: await p.text({
					message: 'Name for this integration',
					defaultValue: defaultName,
					placeholder: defaultName,
					validate: (value) => {
						if (!value) return 'Name is required'
						if (!/^[a-z0-9-]+$/.test(value)) {
							return 'Name must be lowercase alphanumeric with hyphens'
						}
						return undefined
					},
				})

		if (p.isCancel(name)) canceled()

		// Create configuration
		const config: IntegrationConfig = {
			type: type as IntegrationConfig['type'],
			name: name as string,
			apiToken: apiToken as string,
			workspaceId: workspaceId as string,
			projectId: projectId as string,
			statusMapping,
			enabled: true,
		}

		// Save integration
		spinner.start('Saving integration...')
		try {
			await service.addIntegration(config)
			spinner.stop('Integration saved')
		} catch (err) {
			spinner.stop('Failed to save')
			p.log.error(`${err}`)
			process.exit(1)
		}

		const envVarName = generateEnvVarName(name as string)
		p.note(
			`${pc.bold('Name')}: ${name}
${pc.bold('Type')}: ${type}
${pc.bold('Workspace')}: ${workspace?.name}
${pc.bold('Project')}: ${selectedProject?.name}
${pc.bold('Token')}: Stored as ${pc.cyan(envVarName)} in ${pc.dim('.env')}`,
			'Integration configured',
		)

		p.outro(pc.green('Integration added successfully!'))
	})

/**
 * Command to list configured integrations.
 */
const listCommand = new Command('list')
	.description('List configured integrations')
	.action(async () => {
		// Require authentication
		await requireAuth()

		await service.initialize()
		const integrations = await service.getIntegrations()

		if (integrations.length === 0) {
			p.log.info('No integrations configured. Run "vanguard integrations add" to add one.')
			return
		}

		console.log(pc.bold('\nConfigured Integrations:\n'))

		for (const config of integrations) {
			const status = config.enabled ? pc.green('enabled') : pc.dim('disabled')
			console.log(`  ${pc.cyan(config.name)} (${config.type}) - ${status}`)
			if (config.lastSyncAt) {
				console.log(pc.dim(`    Last sync: ${config.lastSyncAt}`))
			}
		}
		console.log()
	})

/**
 * Command to remove an integration.
 */
const removeCommand = new Command('remove')
	.description('Remove an integration')
	.argument('<name>', 'Integration name to remove')
	.action(async (name: string) => {
		// Require authentication
		await requireAuth()

		const confirm = await p.confirm({
			message: `Are you sure you want to remove "${name}"?`,
		})

		if (p.isCancel(confirm) || !confirm) canceled()

		const removed = await service.removeIntegration(name)

		if (removed) {
			p.log.success(`Removed integration: ${name}`)
		} else {
			p.log.error(`Integration not found: ${name}`)
		}
	})

/**
 * Command to test an integration connection.
 */
const testCommand = new Command('test')
	.description('Test integration connection')
	.argument('<name>', 'Integration name to test')
	.action(async (name: string) => {
		// Require authentication
		await requireAuth()

		await service.initialize()
		const provider = service.getProvider(name)

		if (!provider) {
			p.log.error(`Integration not found: ${name}`)
			process.exit(1)
		}

		const spinner = p.spinner()
		spinner.start('Testing connection...')

		const connected = await provider.testConnection()

		if (connected) {
			spinner.stop(pc.green('Connection successful'))
		} else {
			spinner.stop(pc.red('Connection failed'))
			process.exit(1)
		}
	})

/**
 * Main integrations command group.
 */
export const integrationsCommand = new Command('integrations')
	.description('Manage PM tool integrations')
	.addCommand(addCommand)
	.addCommand(listCommand)
	.addCommand(removeCommand)
	.addCommand(testCommand)

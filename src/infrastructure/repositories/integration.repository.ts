/**
 * Integration Repository Implementation.
 *
 * Manages PM tool integration configurations stored in
 * .vanguard/integrations/ directory.
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IntegrationRepository } from '../../application/ports/repositories.js'
import type { IntegrationConfig } from '../../domain/entities/integration.js'

/**
 * File-based integration configuration repository.
 */
export class FileIntegrationRepository implements IntegrationRepository {
	private readonly integrationsDir: string

	constructor(cwd: string = process.cwd()) {
		this.integrationsDir = join(cwd, '.vanguard', 'integrations')
	}

	async findByName(name: string): Promise<IntegrationConfig | undefined> {
		const configs = await this.findAll()
		return configs.find((c) => c.name === name)
	}

	async findAll(): Promise<readonly IntegrationConfig[]> {
		if (!existsSync(this.integrationsDir)) {
			return []
		}

		const files = readdirSync(this.integrationsDir).filter(
			(f) => f.endsWith('.json') && !f.startsWith('LEARNINGS'),
		)

		const configs: IntegrationConfig[] = []

		for (const file of files) {
			try {
				const content = readFileSync(join(this.integrationsDir, file), 'utf-8')
				const config = JSON.parse(content) as IntegrationConfig
				configs.push(config)
			} catch {
				// Skip invalid files
			}
		}

		return configs
	}

	async save(config: IntegrationConfig): Promise<void> {
		const filePath = join(this.integrationsDir, `${config.name}.json`)
		writeFileSync(filePath, JSON.stringify(config, null, '\t'), 'utf-8')
	}

	async delete(name: string): Promise<void> {
		const filePath = join(this.integrationsDir, `${name}.json`)
		if (existsSync(filePath)) {
			unlinkSync(filePath)
		}
	}

	async findDefault(): Promise<IntegrationConfig | undefined> {
		const configs = await this.findAll()

		// If only one integration, it's the default
		if (configs.length === 1) {
			return configs[0]
		}

		// Look for one marked as enabled
		const enabled = configs.filter((c) => c.enabled !== false)
		if (enabled.length === 1) {
			return enabled[0]
		}

		return undefined
	}
}

/**
 * Design System Registry.
 *
 * Loads and provides access to available design systems.
 */

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DesignSystem } from '../../../domain/entities/design-system.js'
import { designSystemLoader } from '../../../infrastructure/loaders/design-system-loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Design System Registry - provides access to available design systems.
 */
class DesignSystemRegistry {
	private systems = new Map<string, DesignSystem>()

	/**
	 * Load all design systems from the data directory.
	 */
	loadAll(): void {
		const results = designSystemLoader.loadFromDirectory(__dirname)

		for (const result of results) {
			if (result.success && result.designSystem) {
				this.systems.set(result.designSystem.id.toString(), result.designSystem)
			} else if (result.error) {
				console.warn(`Failed to load design system: ${result.error}`)
			}
		}
	}

	/**
	 * Get a design system by ID.
	 */
	get(id: string): DesignSystem | undefined {
		return this.systems.get(id)
	}

	/**
	 * Get all available design systems.
	 */
	getAll(): readonly DesignSystem[] {
		return Array.from(this.systems.values())
	}

	/**
	 * Get design systems filtered by theme (light/dark).
	 */
	getByTheme(isDark: boolean): readonly DesignSystem[] {
		return Array.from(this.systems.values()).filter((ds) => ds.isDark === isDark)
	}

	/**
	 * Get the default design system (Copoint Professional).
	 */
	getDefault(): DesignSystem | undefined {
		return this.get('vanguard-professional')
	}
}

/**
 * Shared design system registry instance.
 */
export const designSystemRegistry = new DesignSystemRegistry()

// Load all design systems on module initialization
designSystemRegistry.loadAll()

/**
 * Design System YAML Loader.
 *
 * Loads design system definitions from YAML files.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import * as yaml from 'yaml'
import {
	type ColorPalette,
	type ColorScale,
	type ComponentRecipes,
	DesignSystem,
	type RadiusScale,
	type SemanticColor,
	type ShadowScale,
	type SpacingScale,
	type Typography,
} from '../../domain/entities/design-system.js'

/**
 * YAML schema for design system definition.
 */
export interface DesignSystemYaml {
	readonly id: string
	readonly name: string
	readonly version?: string
	readonly description: string
	readonly isDark?: boolean

	readonly colors: {
		readonly primary: Record<string, string>
		readonly secondary?: Record<string, string>
		readonly accent?: Record<string, string>
		readonly neutral: Record<string, string>
		readonly semantic: {
			readonly success: { light: string; base: string; dark: string }
			readonly warning: { light: string; base: string; dark: string }
			readonly error: { light: string; base: string; dark: string }
			readonly info: { light: string; base: string; dark: string }
		}
	}

	readonly typography: {
		readonly fontFamilies: {
			readonly sans: readonly string[]
			readonly serif?: readonly string[]
			readonly mono: readonly string[]
		}
		readonly scale: Record<string, string>
		readonly weights: Record<string, number>
		readonly lineHeights: Record<string, string>
	}

	readonly spacing: Record<string, string>
	readonly radii: Record<string, string>
	readonly shadows: Record<string, string>
	readonly components?: Record<string, Record<string, string>>
}

/**
 * Result from loading a design system.
 */
export interface LoadDesignSystemResult {
	readonly success: boolean
	readonly designSystem?: DesignSystem
	readonly error?: string
}

/**
 * Loads design system definitions from YAML files.
 */
export class DesignSystemLoader {
	/**
	 * Load a single design system from YAML file.
	 */
	loadFromFile(filePath: string): LoadDesignSystemResult {
		try {
			if (!existsSync(filePath)) {
				return { success: false, error: `File not found: ${filePath}` }
			}

			const content = readFileSync(filePath, 'utf-8')
			const parsed = yaml.parse(content) as DesignSystemYaml

			const designSystem = this.parseDesignSystem(parsed)
			return { success: true, designSystem }
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}
		}
	}

	/**
	 * Load all design systems from a directory.
	 */
	loadFromDirectory(dirPath: string): readonly LoadDesignSystemResult[] {
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
	 * Parse YAML into DesignSystem entity.
	 */
	private parseDesignSystem(data: DesignSystemYaml): DesignSystem {
		// Parse color palette
		const colors: ColorPalette = {
			primary: data.colors.primary as unknown as ColorScale,
			...(data.colors.secondary && { secondary: data.colors.secondary as unknown as ColorScale }),
			...(data.colors.accent && { accent: data.colors.accent as unknown as ColorScale }),
			neutral: data.colors.neutral as unknown as ColorScale,
			semantic: {
				success: data.colors.semantic.success as SemanticColor,
				warning: data.colors.semantic.warning as SemanticColor,
				error: data.colors.semantic.error as SemanticColor,
				info: data.colors.semantic.info as SemanticColor,
			},
		}

		// Parse typography
		const typography: Typography = {
			fontFamilies: {
				sans: [...data.typography.fontFamilies.sans],
				...(data.typography.fontFamilies.serif && {
					serif: [...data.typography.fontFamilies.serif],
				}),
				mono: [...data.typography.fontFamilies.mono],
			},
			scale: data.typography.scale as unknown as Typography['scale'],
			weights: data.typography.weights as Typography['weights'],
			lineHeights: data.typography.lineHeights as Typography['lineHeights'],
		}

		// Parse spacing, radii, shadows
		const spacing = data.spacing as unknown as SpacingScale
		const radii = data.radii as unknown as RadiusScale
		const shadows = data.shadows as unknown as ShadowScale

		// Parse component recipes
		const components: ComponentRecipes = {}
		const componentsBuilder: Record<string, unknown> = {}
		if (data.components?.button) {
			componentsBuilder.button = data.components.button as ComponentRecipes['button']
		}
		if (data.components?.card) {
			componentsBuilder.card = data.components.card as ComponentRecipes['card']
		}
		if (data.components?.input) {
			componentsBuilder.input = data.components.input as ComponentRecipes['input']
		}
		Object.assign(components, componentsBuilder)

		return DesignSystem.create({
			id: data.id,
			name: data.name,
			version: data.version ?? '1.0.0',
			description: data.description,
			colors,
			typography,
			spacing,
			radii,
			shadows,
			components,
			isDark: data.isDark ?? false,
		})
	}
}

/**
 * Export a shared loader instance.
 */
export const designSystemLoader = new DesignSystemLoader()

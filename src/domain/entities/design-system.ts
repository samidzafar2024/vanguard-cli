import { Identifier } from '../value-objects/identifier.js'
import { Version } from '../value-objects/version.js'

/**
 * Color scale (50-900 for primary/secondary/accent colors).
 */
export interface ColorScale {
	readonly 50: string
	readonly 100: string
	readonly 200: string
	readonly 300: string
	readonly 400: string
	readonly 500: string // Base color
	readonly 600: string
	readonly 700: string
	readonly 800: string
	readonly 900: string
	readonly 950?: string // Optional darkest shade
}

/**
 * Semantic color (single color for success/warning/error/info).
 */
export interface SemanticColor {
	readonly light: string // Background/subtle
	readonly base: string // Default
	readonly dark: string // Hover/active
}

/**
 * Color palette for the design system.
 */
export interface ColorPalette {
	readonly primary: ColorScale
	readonly secondary?: ColorScale
	readonly accent?: ColorScale
	readonly neutral: ColorScale
	readonly semantic: {
		readonly success: SemanticColor
		readonly warning: SemanticColor
		readonly error: SemanticColor
		readonly info: SemanticColor
	}
}

/**
 * Typography configuration.
 */
export interface Typography {
	readonly fontFamilies: {
		readonly sans: readonly string[]
		readonly serif?: readonly string[]
		readonly mono: readonly string[]
	}
	readonly scale: {
		readonly xs: string
		readonly sm: string
		readonly base: string
		readonly lg: string
		readonly xl: string
		readonly '2xl': string
		readonly '3xl': string
		readonly '4xl': string
		readonly '5xl': string
		readonly '6xl': string
		readonly '7xl': string
		readonly '8xl': string
		readonly '9xl': string
	}
	readonly weights: {
		readonly light: number
		readonly normal: number
		readonly medium: number
		readonly semibold: number
		readonly bold: number
		readonly extrabold?: number
	}
	readonly lineHeights: {
		readonly tight: string
		readonly snug: string
		readonly normal: string
		readonly relaxed: string
		readonly loose: string
	}
}

/**
 * Spacing scale (0-96).
 */
export type SpacingScale = {
	readonly 0: string
	readonly 0.5: string
	readonly 1: string
	readonly 1.5: string
	readonly 2: string
	readonly 2.5: string
	readonly 3: string
	readonly 3.5: string
	readonly 4: string
	readonly 5: string
	readonly 6: string
	readonly 7: string
	readonly 8: string
	readonly 9: string
	readonly 10: string
	readonly 11: string
	readonly 12: string
	readonly 14: string
	readonly 16: string
	readonly 20: string
	readonly 24: string
	readonly 28: string
	readonly 32: string
	readonly 36: string
	readonly 40: string
	readonly 44: string
	readonly 48: string
	readonly 52: string
	readonly 56: string
	readonly 60: string
	readonly 64: string
	readonly 72: string
	readonly 80: string
	readonly 96: string
}

/**
 * Border radius scale.
 */
export interface RadiusScale {
	readonly none: string
	readonly sm: string
	readonly base: string
	readonly md: string
	readonly lg: string
	readonly xl: string
	readonly '2xl': string
	readonly '3xl': string
	readonly full: string
}

/**
 * Shadow scale.
 */
export interface ShadowScale {
	readonly sm: string
	readonly base: string
	readonly md: string
	readonly lg: string
	readonly xl: string
	readonly '2xl': string
	readonly inner: string
	readonly none: string
}

/**
 * Component style variants.
 */
export interface ComponentRecipes {
	readonly button?: {
		readonly primary: string
		readonly secondary: string
		readonly ghost: string
		readonly destructive: string
	}
	readonly card?: {
		readonly default: string
		readonly elevated: string
		readonly bordered: string
	}
	readonly input?: {
		readonly default: string
		readonly error: string
	}
}

/**
 * Design System Entity.
 * Represents a complete design system with colors, typography, spacing, and component styles.
 */
export class DesignSystem {
	private constructor(
		public readonly id: Identifier,
		public readonly name: string,
		public readonly version: Version,
		public readonly description: string,
		public readonly colors: ColorPalette,
		public readonly typography: Typography,
		public readonly spacing: SpacingScale,
		public readonly radii: RadiusScale,
		public readonly shadows: ShadowScale,
		public readonly components: ComponentRecipes,
		public readonly isDark: boolean,
	) {}

	static create(params: {
		id: string
		name: string
		version: string
		description: string
		colors: ColorPalette
		typography: Typography
		spacing: SpacingScale
		radii: RadiusScale
		shadows: ShadowScale
		components?: ComponentRecipes
		isDark?: boolean
	}): DesignSystem {
		return new DesignSystem(
			Identifier.create(params.id),
			params.name,
			Version.create(params.version),
			params.description,
			params.colors,
			params.typography,
			params.spacing,
			params.radii,
			params.shadows,
			params.components ?? {},
			params.isDark ?? false,
		)
	}

	/**
	 * Get the primary color value.
	 */
	getPrimaryColor(shade: keyof ColorScale = 500): string {
		const color = this.colors.primary[shade]
		return color ?? this.colors.primary[500]
	}

	/**
	 * Get the font family string for a given type.
	 */
	getFontFamily(type: 'sans' | 'serif' | 'mono' = 'sans'): string {
		if (type === 'serif') {
			return this.typography.fontFamilies.serif
				? this.typography.fontFamilies.serif.join(', ')
				: this.typography.fontFamilies.sans.join(', ')
		}
		return this.typography.fontFamilies[type].join(', ')
	}

	/**
	 * Generate CSS custom properties for this design system.
	 */
	toCSSVariables(): string {
		const vars: string[] = [':root {']

		// Colors - Primary
		for (const [shade, value] of Object.entries(this.colors.primary)) {
			vars.push(`  --color-primary-${shade}: ${value};`)
		}

		// Colors - Neutral
		for (const [shade, value] of Object.entries(this.colors.neutral)) {
			vars.push(`  --color-neutral-${shade}: ${value};`)
		}

		// Colors - Semantic
		for (const [name, colors] of Object.entries(this.colors.semantic)) {
			vars.push(`  --color-${name}-light: ${colors.light};`)
			vars.push(`  --color-${name}: ${colors.base};`)
			vars.push(`  --color-${name}-dark: ${colors.dark};`)
		}

		// Typography
		vars.push(`  --font-sans: ${this.getFontFamily('sans')};`)
		vars.push(`  --font-mono: ${this.getFontFamily('mono')};`)

		// Spacing (sample - most commonly used)
		const commonSpacing = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64] as const
		for (const size of commonSpacing) {
			const key = size as keyof SpacingScale
			vars.push(`  --spacing-${size}: ${this.spacing[key]};`)
		}

		vars.push('}')
		return vars.join('\n')
	}

	/**
	 * Generate Tailwind-compatible configuration.
	 */
	toTailwindConfig(): Record<string, unknown> {
		return {
			colors: {
				primary: this.colors.primary,
				neutral: this.colors.neutral,
				success: this.colors.semantic.success.base,
				warning: this.colors.semantic.warning.base,
				error: this.colors.semantic.error.base,
				info: this.colors.semantic.info.base,
			},
			fontFamily: {
				sans: this.typography.fontFamilies.sans,
				mono: this.typography.fontFamilies.mono,
			},
			spacing: this.spacing,
			borderRadius: this.radii,
			boxShadow: this.shadows,
		}
	}

	/**
	 * Generate a prompt-friendly summary of this design system.
	 */
	toPromptSummary(): string {
		return `Design System: ${this.name}

Colors:
- Primary: ${this.colors.primary[500]} (base), ${this.colors.primary[700]} (dark)
- Neutral: ${this.colors.neutral[500]} (base)
- Success: ${this.colors.semantic.success.base}
- Error: ${this.colors.semantic.error.base}

Typography:
- Sans: ${this.getFontFamily('sans')}
- Mono: ${this.getFontFamily('mono')}
- Base size: ${this.typography.scale.base}

Spacing: ${this.spacing[4]} (4), ${this.spacing[8]} (8), ${this.spacing[16]} (16)
Border radius: ${this.radii.base} (base), ${this.radii.lg} (large)
Theme: ${this.isDark ? 'Dark' : 'Light'}`
	}
}

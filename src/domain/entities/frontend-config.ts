/**
 * Frontend framework configuration.
 * Represents the UI layer choice for backend-focused stacks.
 */
export interface FrontendConfig {
	readonly framework: FrontendFramework
	readonly uiLibrary?: string // e.g., "shadcn/ui", "Material-UI", "Chakra UI"
	readonly styling?: StylingApproach
}

/**
 * Supported frontend frameworks.
 */
export type FrontendFramework =
	| 'hotwire' // Rails Turbo + Stimulus
	| 'react' // React library
	| 'vue' // Vue.js
	| 'nextjs' // Next.js framework
	| 'svelte' // Svelte
	| 'htmx' // HTMX with server-side rendering
	| 'templates' // Server-side templates (ERB, Jinja, etc.)
	| 'none' // API-only, no frontend

/**
 * CSS/styling approach.
 */
export type StylingApproach =
	| 'tailwind'
	| 'css-modules'
	| 'styled-components'
	| 'sass'
	| 'plain-css'

/**
 * Frontend option - available choice for a stack.
 */
export interface FrontendOption {
	readonly framework: FrontendFramework
	readonly name: string
	readonly description: string
	readonly defaultUiLibrary?: string
	readonly defaultStyling?: StylingApproach
}

/**
 * Get display name for frontend framework.
 */
export function getFrontendFrameworkName(framework: FrontendFramework): string {
	switch (framework) {
		case 'hotwire':
			return 'Hotwire (Turbo + Stimulus)'
		case 'react':
			return 'React'
		case 'vue':
			return 'Vue.js'
		case 'nextjs':
			return 'Next.js'
		case 'svelte':
			return 'Svelte'
		case 'htmx':
			return 'HTMX'
		case 'templates':
			return 'Server-side Templates'
		case 'none':
			return 'None (API only)'
	}
}

/**
 * Get description for frontend framework.
 */
export function getFrontendFrameworkDescription(framework: FrontendFramework): string {
	switch (framework) {
		case 'hotwire':
			return 'Rails native: Turbo for SPA-like experience, Stimulus for sprinkles'
		case 'react':
			return 'Component-based UI library with large ecosystem'
		case 'vue':
			return 'Progressive framework for building user interfaces'
		case 'nextjs':
			return 'React framework with SSR, SSG, and API routes'
		case 'svelte':
			return 'Compiler-based framework with no virtual DOM'
		case 'htmx':
			return 'HTML-over-the-wire for dynamic UIs without JavaScript frameworks'
		case 'templates':
			return 'Traditional server-rendered HTML (ERB, Jinja, etc.)'
		case 'none':
			return 'Backend API only - no frontend provided'
	}
}

/**
 * Common frontend options for backend stacks.
 */
export const COMMON_FRONTEND_OPTIONS: Record<string, FrontendOption> = {
	hotwire: {
		framework: 'hotwire',
		name: 'Hotwire (Turbo + Stimulus)',
		description: 'Rails native: Turbo for SPA-like experience, Stimulus for sprinkles',
		defaultStyling: 'tailwind',
	},
	react: {
		framework: 'react',
		name: 'React',
		description: 'Component-based UI library with large ecosystem',
		defaultStyling: 'tailwind',
	},
	reactShadcn: {
		framework: 'react',
		name: 'React + shadcn/ui',
		description: 'React with beautifully designed components (Radix UI + Tailwind)',
		defaultUiLibrary: 'shadcn/ui',
		defaultStyling: 'tailwind',
	},
	vue: {
		framework: 'vue',
		name: 'Vue.js',
		description: 'Progressive framework for building user interfaces',
		defaultStyling: 'tailwind',
	},
	htmx: {
		framework: 'htmx',
		name: 'HTMX',
		description: 'HTML-over-the-wire for dynamic UIs without JavaScript frameworks',
		defaultStyling: 'tailwind',
	},
	templates: {
		framework: 'templates',
		name: 'Server-side Templates',
		description: 'Traditional server-rendered HTML (ERB, Jinja, etc.)',
		defaultStyling: 'sass',
	},
	none: {
		framework: 'none',
		name: 'None (API only)',
		description: 'Backend API only - no frontend provided',
	},
}

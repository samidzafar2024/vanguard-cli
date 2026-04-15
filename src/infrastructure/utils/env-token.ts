/**
 * Env var token utilities for integration API key obfuscation.
 *
 * Instead of storing raw API tokens in .vanguard/integrations/*.json,
 * we store references like "env:VANGUARD_CLICKUP_COPOINT_AI_TOKEN"
 * and resolve them from the environment at runtime.
 */

const ENV_VAR_PREFIX = 'env:'

/**
 * Generate an environment variable name from an integration config name.
 *
 * Convention: VANGUARD_{NAME}_TOKEN
 * - Name is uppercased
 * - Hyphens replaced with underscores
 *
 * Example: "clickup-vanguard" → "VANGUARD_CLICKUP_COPOINT_AI_TOKEN"
 */
export function generateEnvVarName(name: string): string {
	const normalized = name.toUpperCase().replace(/-/g, '_')
	return `VANGUARD_${normalized}_TOKEN`
}

/**
 * Check if a value is an env var reference (starts with "env:").
 */
export function isEnvVarReference(value: string): boolean {
	return value.startsWith(ENV_VAR_PREFIX)
}

/**
 * Extract the env var name from a reference string.
 *
 * Example: "env:VANGUARD_CLICKUP_COPOINT_AI_TOKEN" → "VANGUARD_CLICKUP_COPOINT_AI_TOKEN"
 */
export function extractEnvVarName(reference: string): string {
	return reference.slice(ENV_VAR_PREFIX.length)
}

/**
 * Resolve an env var reference to its value from process.env.
 *
 * @param reference - A string like "env:VANGUARD_CLICKUP_COPOINT_AI_TOKEN"
 * @returns The resolved value from process.env
 * @throws Error if the env var is not set
 */
export function resolveEnvVarReference(reference: string): string {
	const varName = extractEnvVarName(reference)
	const value = process.env[varName]

	if (value === undefined || value === '') {
		throw new Error(
			`Environment variable ${varName} is not set. Set it in your .env file or environment.`,
		)
	}

	return value
}

/**
 * Create an env var reference string from a variable name.
 *
 * Example: "VANGUARD_CLICKUP_COPOINT_AI_TOKEN" → "env:VANGUARD_CLICKUP_COPOINT_AI_TOKEN"
 */
export function createEnvVarReference(varName: string): string {
	return `${ENV_VAR_PREFIX}${varName}`
}

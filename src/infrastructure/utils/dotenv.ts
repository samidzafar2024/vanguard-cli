/**
 * Simple .env file read/write utilities.
 *
 * No external dependencies — implements a minimal .env parser
 * that handles the standard KEY=VALUE format.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Parse a .env file into key-value pairs.
 *
 * Handles:
 * - KEY=VALUE pairs
 * - Quoted values (single and double quotes, stripped)
 * - Comments (lines starting with #)
 * - Empty lines
 * - Inline comments after unquoted values
 */
export function readEnvFile(filePath: string): Record<string, string> {
	if (!existsSync(filePath)) {
		return {}
	}

	const content = readFileSync(filePath, 'utf-8')
	return parseEnvContent(content)
}

/**
 * Parse .env content string into key-value pairs.
 */
export function parseEnvContent(content: string): Record<string, string> {
	const result: Record<string, string> = {}

	for (const line of content.split('\n')) {
		const trimmed = line.trim()

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#')) {
			continue
		}

		const eqIndex = trimmed.indexOf('=')
		if (eqIndex === -1) {
			continue
		}

		const key = trimmed.slice(0, eqIndex).trim()
		let value = trimmed.slice(eqIndex + 1).trim()

		// Strip inline comments
		const isQuoted =
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		const commentIndex = value.indexOf(' #')
		if (commentIndex !== -1 && !isQuoted) {
			value = value.slice(0, commentIndex).trimEnd()
		}

		// Strip surrounding quotes
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}

		result[key] = value
	}

	return result
}

/**
 * Write or update a single entry in a .env file.
 *
 * - Creates the file if it doesn't exist
 * - Updates the value if the key already exists
 * - Appends a new entry if the key is new
 * - Preserves existing comments and formatting
 */
export function writeEnvEntry(filePath: string, key: string, value: string): void {
	// Ensure parent directory exists
	mkdirSync(dirname(filePath), { recursive: true })

	if (!existsSync(filePath)) {
		writeFileSync(filePath, `${key}=${value}\n`, 'utf-8')
		return
	}

	const content = readFileSync(filePath, 'utf-8')
	const lines = content.split('\n')
	let found = false

	const updatedLines = lines.map((line) => {
		const trimmed = line.trim()
		if (trimmed.startsWith('#') || !trimmed) {
			return line
		}

		const eqIndex = trimmed.indexOf('=')
		if (eqIndex === -1) {
			return line
		}

		const lineKey = trimmed.slice(0, eqIndex).trim()
		if (lineKey === key) {
			found = true
			return `${key}=${value}`
		}

		return line
	})

	if (!found) {
		// Ensure there's a newline before appending
		const lastLine = updatedLines[updatedLines.length - 1]
		if (lastLine !== undefined && lastLine.trim() !== '') {
			updatedLines.push(`${key}=${value}`)
		} else {
			// Replace trailing empty line with the new entry
			updatedLines[updatedLines.length - 1] = `${key}=${value}`
		}
		updatedLines.push('')
	}

	writeFileSync(filePath, updatedLines.join('\n'), 'utf-8')
}

/**
 * Load a .env file into process.env.
 *
 * Only sets variables that are not already defined in process.env,
 * so explicit environment variables always take precedence.
 */
export function loadEnvFile(filePath: string): void {
	const vars = readEnvFile(filePath)

	for (const [key, value] of Object.entries(vars)) {
		if (process.env[key] === undefined) {
			process.env[key] = value
		}
	}
}

/**
 * Check if .env is listed in the project's .gitignore.
 * If not, append it to prevent accidental commits of secrets.
 *
 * @returns true if .gitignore was modified, false if already covered
 */
export function ensureEnvInGitignore(projectRoot: string): boolean {
	const gitignorePath = `${projectRoot}/.gitignore`

	if (!existsSync(gitignorePath)) {
		writeFileSync(gitignorePath, '.env\n', 'utf-8')
		return true
	}

	const content = readFileSync(gitignorePath, 'utf-8')
	const lines = content.split('\n').map((l) => l.trim())

	// Check if .env is already covered
	if (lines.some((line) => line === '.env' || line === '.env*' || line === '*.env')) {
		return false
	}

	// Append .env to gitignore
	const separator = content.endsWith('\n') ? '' : '\n'
	writeFileSync(gitignorePath, `${content}${separator}.env\n`, 'utf-8')
	return true
}

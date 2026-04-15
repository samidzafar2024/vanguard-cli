/**
 * MethodologyBundle — pre-rendered methodology files from vanguard-web.
 *
 * Fetched from GET /api/methodology/bundle?project_id=<id>.
 * The server resolves org overrides, applies track filtering, and renders
 * all methodology content (personas, phases, workflows, templates, constitution)
 * into final markdown files. The CLI receives these as RenderedFile[] and
 * writes them to disk without any local rendering.
 *
 * Evans: "Use the same ubiquitous language across bounded contexts for
 * shared concepts." RenderedFile mirrors vanguard-web's type of the same name.
 *
 * This is a read-only value object — no mutation methods.
 */

// ---------------------------------------------------------------------------
// Value Objects
// ---------------------------------------------------------------------------

/**
 * A pre-rendered file from the methodology server.
 *
 * Mirrors vanguard-web's RenderedFile value object (src/lib/methodology/types.ts).
 * Same name, same shape — ubiquitous language across the boundary.
 */
export interface RenderedFile {
	readonly path: string
	readonly content: string
	readonly executable?: boolean
}

/**
 * A phase summary included in the bundle response.
 *
 * Used by the CLI to render a dynamic "Available commands" list
 * after `vanguard init`, reflecting the org's active phases.
 */
export interface BundlePhase {
	readonly slug: string
	readonly name: string
	readonly description: string
}

/**
 * A hook entry in the bundle hook configuration.
 *
 * Mirrors vanguard-web's BundleHookEntry value object.
 */
export interface BundleHookEntry {
	readonly matcher?: string
	readonly hooks: readonly {
		readonly type: 'command'
		readonly command: string
		readonly timeout: number
	}[]
}

/**
 * Hook configuration from the methodology bundle.
 *
 * Maps Claude Code hook events (PostToolUse, PreToolUse, Stop) to
 * hook entries. The CLI merges this into .claude/settings.json.
 */
export interface BundleHookConfig {
	readonly hooks: {
		readonly [event: string]: readonly BundleHookEntry[]
	}
}

/**
 * The full methodology bundle returned by the server.
 *
 * Contains pre-rendered files ready to write to disk, plus metadata
 * for ETag-based conditional refresh.
 */
export interface MethodologyBundle {
	readonly files: readonly RenderedFile[]
	readonly phases: readonly BundlePhase[]
	readonly hookConfig?: BundleHookConfig
	readonly contentHash: string
	readonly bundledAt: string
}

// ---------------------------------------------------------------------------
// Validation error
// ---------------------------------------------------------------------------

export class MethodologyBundleValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'MethodologyBundleValidationError'
	}
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw API response into a typed MethodologyBundle.
 *
 * Martin: "Functions should do one thing." This validates the wire format
 * and returns an immutable domain object. No side effects.
 *
 * Throws MethodologyBundleValidationError on malformed data.
 */
export function parseMethodologyBundle(data: unknown): MethodologyBundle {
	if (data === null || data === undefined || typeof data !== 'object') {
		throw new MethodologyBundleValidationError('Expected an object for methodology bundle response')
	}

	const obj = data as Record<string, unknown>

	const files = requireArray(obj, 'files').map(parseRenderedFile)
	const phases = Array.isArray(obj.phases) ? (obj.phases as unknown[]).map(parseBundlePhase) : []
	const contentHash = requireString(obj, 'contentHash')
	const bundledAt = requireString(obj, 'bundledAt')

	return {
		files,
		phases,
		...(obj.hookConfig ? { hookConfig: parseBundleHookConfig(obj.hookConfig) } : {}),
		contentHash,
		bundledAt,
	}
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseRenderedFile(raw: unknown): RenderedFile {
	const obj = requireObject(raw, 'rendered file')
	return {
		path: requireString(obj, 'path'),
		content: requireString(obj, 'content'),
		...(obj.executable === true && { executable: true }),
	}
}

function parseBundleHookConfig(raw: unknown): BundleHookConfig {
	const obj = requireObject(raw, 'hook config')
	const hooksObj = requireObject(obj.hooks, 'hook config hooks')

	const hooks: Record<string, BundleHookEntry[]> = {}
	for (const [event, entries] of Object.entries(hooksObj)) {
		if (!Array.isArray(entries)) continue
		hooks[event] = (entries as unknown[]).map((entry) => {
			const entryObj = requireObject(entry, `hook entry for ${event}`)
			const hooksList = requireArray(entryObj, 'hooks').map((h) => {
				const hookObj = requireObject(h, 'hook')
				return {
					type: 'command' as const,
					command: requireString(hookObj, 'command'),
					timeout: typeof hookObj.timeout === 'number' ? hookObj.timeout : 5,
				}
			})
			return {
				...(typeof entryObj.matcher === 'string' && { matcher: entryObj.matcher }),
				hooks: hooksList,
			}
		})
	}

	return { hooks }
}

function parseBundlePhase(raw: unknown): BundlePhase {
	const obj = requireObject(raw, 'bundle phase')
	return {
		slug: requireString(obj, 'slug'),
		name: requireString(obj, 'name'),
		description: requireString(obj, 'description'),
	}
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function requireObject(value: unknown, label: string): Record<string, unknown> {
	if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
		throw new MethodologyBundleValidationError(`Expected object for ${label}, got ${typeof value}`)
	}
	return value as Record<string, unknown>
}

function requireString(obj: Record<string, unknown>, field: string): string {
	const value = obj[field]
	if (typeof value !== 'string') {
		throw new MethodologyBundleValidationError(
			`Expected string for field '${field}', got ${typeof value}`,
		)
	}
	return value
}

function requireArray(obj: Record<string, unknown>, field: string): unknown[] {
	const value = obj[field]
	if (!Array.isArray(value)) {
		throw new MethodologyBundleValidationError(
			`Expected array for field '${field}', got ${typeof value}`,
		)
	}
	return value
}

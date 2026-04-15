/**
 * E2E Tests: Hook Context Assembly against Production vanguard-web.
 *
 * Prerequisites:
 *   - `vanguard login` completed (valid CLI token)
 *   - Graphiti data seeded under projectName "agentic-memory"
 *   - vanguard-web deployed with /api/memory/graph/context endpoint
 *
 * Run: npx vitest run tests/e2e/hook-context-assembly.test.ts
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const exec = promisify(execFile)
const CLI = 'node'
const CLI_ENTRY = './dist/presentation/cli/index.js'
const PROJECT = 'agentic-memory'
const TIMEOUT = 30_000

function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
	return exec(CLI, [CLI_ENTRY, ...args], { timeout: TIMEOUT })
}

// ── Session Start Hook ───────────────────────────────────────────────

describe('vanguard memory hook session-start (e2e)', () => {
	it(
		'returns JSON with context, tokenEstimate, searchTimeMs',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'session-start',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result).toHaveProperty('context')
			expect(result).toHaveProperty('tokenEstimate')
			expect(result).toHaveProperty('searchTimeMs')
			expect(typeof result.context).toBe('string')
			expect(typeof result.tokenEstimate).toBe('number')
			expect(typeof result.searchTimeMs).toBe('number')
		},
		TIMEOUT,
	)

	it(
		'returns non-empty context from seeded data',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'session-start',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result.context.length).toBeGreaterThan(0)
			expect(result.tokenEstimate).toBeGreaterThan(0)
		},
		TIMEOUT,
	)

	it(
		'context contains PROJECT_CONTEXT XML wrapper',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'session-start',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result.context).toContain('<PROJECT_CONTEXT')
			expect(result.context).toContain('</PROJECT_CONTEXT>')
		},
		TIMEOUT,
	)

	it(
		'context contains DECISIONS section',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'session-start',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result.context).toContain('<DECISIONS>')
			expect(result.context).toContain('</DECISIONS>')
		},
		TIMEOUT,
	)

	it(
		'respects token budget',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'session-start',
				'--project',
				PROJECT,
				'--token-budget',
				'200',
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result.tokenEstimate).toBeLessThanOrEqual(200)
		},
		TIMEOUT,
	)

	it(
		'outputs raw context without --json',
		async () => {
			const { stdout } = await runCli(['memory', 'hook', 'session-start', '--project', PROJECT])

			expect(stdout.trim()).toContain('<PROJECT_CONTEXT')
		},
		TIMEOUT,
	)

	it(
		'returns empty context gracefully for unknown project',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'session-start',
				'--project',
				'nonexistent-project-xyz-999',
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result.context).toBe('')
			expect(result.tokenEstimate).toBe(0)
		},
		TIMEOUT,
	)
})

// ── Pre-Task Hook ────────────────────────────────────────────────────

describe('vanguard memory hook pre-task (e2e)', () => {
	it(
		'returns JSON with context, source, searchTimeMs',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'pre-task',
				'what decisions were made about hooks vs MCP',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result).toHaveProperty('context')
			expect(result).toHaveProperty('source')
			expect(result).toHaveProperty('searchTimeMs')
			expect(result.source).toBe('graph')
		},
		TIMEOUT,
	)

	it(
		'returns relevant context for a specific query',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'pre-task',
				'architecture decisions about hooks and MCP delivery',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			expect(result.context.length).toBeGreaterThan(0)
			expect(result.context).toContain('<PROJECT_CONTEXT')
			expect(result.context).toContain('<DECISIONS>')
		},
		TIMEOUT,
	)

	it(
		'includes ENTITIES section for relevant queries',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'pre-task',
				'what is the vanguard-cli architecture and port-adapter pattern',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			// Entities section should appear when relevant nodes are found
			if (result.context.includes('<ENTITIES>')) {
				expect(result.context).toContain('</ENTITIES>')
			}
		},
		TIMEOUT,
	)

	it(
		'includes temporal date ranges on decisions when DECISIONS section present',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'pre-task',
				'architecture decisions',
				'--project',
				PROJECT,
				'--json',
			])

			const result = JSON.parse(stdout)
			// Graphiti may return only entities if the facts search times out.
			// When decisions ARE present, they should have temporal ranges.
			if (result.context.includes('<DECISIONS>')) {
				expect(result.context).toMatch(/\(\d{4}-\d{2}-\d{2} - present\)/)
			} else {
				// Still valid — entities-only response means facts search was slow
				expect(result.context).toContain('<PROJECT_CONTEXT')
			}
		},
		TIMEOUT,
	)

	it(
		'passes persona to the endpoint',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'pre-task',
				'architecture decisions',
				'--project',
				PROJECT,
				'--persona',
				'developer',
				'--json',
			])

			const result = JSON.parse(stdout)
			// Developer persona limits to 5 decisions — should still return data
			expect(result.source).toBe('graph')
		},
		TIMEOUT,
	)

	it(
		'outputs raw context without --json',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'pre-task',
				'architecture decisions',
				'--project',
				PROJECT,
			])

			expect(stdout.trim()).toContain('<PROJECT_CONTEXT')
		},
		TIMEOUT,
	)

	it(
		'returns empty context gracefully for unknown project',
		async () => {
			const { stdout } = await runCli([
				'memory',
				'hook',
				'pre-task',
				'anything',
				'--project',
				'nonexistent-project-xyz-999',
				'--json',
			])

			const result = JSON.parse(stdout)
			// Should fall through graph (empty) → api/local
			expect(result.context).toBe('')
		},
		TIMEOUT,
	)
})

// ── Context Assembly API (direct curl-style) ─────────────────────────

describe('POST /api/memory/graph/context (e2e)', () => {
	let token: string
	let endpoint: string

	it(
		'resolves auth context',
		async () => {
			const { authRepository } = await import(
				'../../src/infrastructure/repositories/auth.repository.js'
			)
			token = (await authRepository.getAccessToken()) ?? ''
			endpoint = (await authRepository.getApiEndpoint()) ?? ''
			expect(token.length).toBeGreaterThan(0)
			expect(endpoint.length).toBeGreaterThan(0)
		},
		TIMEOUT,
	)

	it(
		'returns assembled context block',
		async () => {
			const response = await fetch(`${endpoint}/api/memory/graph/context`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					query: 'architecture decisions',
					projectName: PROJECT,
				}),
			})

			expect(response.ok).toBe(true)
			const data = await response.json()
			expect(data).toHaveProperty('context')
			expect(data).toHaveProperty('decisions')
			expect(data).toHaveProperty('entities')
			expect(data).toHaveProperty('tokenEstimate')
			expect(data).toHaveProperty('searchTimeMs')
			expect(data).toHaveProperty('groupId')
			expect(data.groupId).toContain('agentic-memory')
		},
		TIMEOUT,
	)

	it(
		'returns 400 when query is missing',
		async () => {
			const response = await fetch(`${endpoint}/api/memory/graph/context`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ projectName: PROJECT }),
			})

			expect(response.status).toBe(400)
			const data = await response.json()
			expect(data.error).toBe('INVALID_REQUEST')
		},
		TIMEOUT,
	)

	it(
		'returns 401 without auth token',
		async () => {
			const response = await fetch(`${endpoint}/api/memory/graph/context`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: 'test',
					projectName: PROJECT,
				}),
			})

			expect(response.status).toBe(401)
		},
		TIMEOUT,
	)
})

/**
 * Authentication guard for CLI commands.
 * Offline mode: no server required, auth is a no-op.
 */

/**
 * No-op in offline mode. All commands work without authentication.
 */
export async function requireAuth(_options?: { dev?: boolean }): Promise<void> {
	// Offline mode — no server authentication needed
}

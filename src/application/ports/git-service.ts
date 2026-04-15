/**
 * Port for git operations.
 *
 * Abstracts git CLI access so application services don't depend
 * on child_process directly.
 */
export interface GitService {
	/**
	 * Get the current branch name.
	 * Returns undefined if not in a git repository.
	 */
	getCurrentBranch(): Promise<string | undefined>

	/**
	 * Check if a branch exists locally.
	 */
	branchExists(branchName: string): Promise<boolean>

	/**
	 * Checkout an existing branch.
	 */
	checkoutBranch(branchName: string): Promise<void>

	/**
	 * Create and checkout a new branch.
	 */
	createBranch(branchName: string): Promise<void>

	/**
	 * Get git log with numstat (additions/deletions per file).
	 * Returns the raw git log output.
	 */
	getLogWithNumstat(): Promise<string>
}

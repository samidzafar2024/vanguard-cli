import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Result of a git command execution.
 */
export interface GitResult {
	readonly success: boolean
	readonly output: string
	readonly error?: string
}

/**
 * Review result for a task.
 */
export interface ReviewResult {
	readonly taskId: string
	readonly branchName: string
	readonly status: 'approved' | 'changes_requested' | 'pending'
	readonly reviewedAt: string
	readonly findings?: {
		critical: number
		major: number
		minor: number
	}
	readonly comment?: string
}

/**
 * Branch information.
 */
export interface BranchInfo {
	readonly name: string
	readonly isDetached: boolean
	readonly trackingRemote?: string | undefined
	readonly ahead: number
	readonly behind: number
}

/**
 * Service for git operations.
 *
 * Provides methods to detect branch state, merge status, and extract
 * task information from branch names.
 */
export class GitService {
	private readonly cwd: string

	constructor(cwd: string = process.cwd()) {
		this.cwd = cwd
	}

	/**
	 * Check if the current directory is a git repository.
	 */
	isGitRepo(): boolean {
		try {
			this.exec('git rev-parse --git-dir')
			return true
		} catch {
			return false
		}
	}

	/**
	 * Get the current branch name.
	 *
	 * Returns undefined if in detached HEAD state.
	 */
	getCurrentBranch(): string | undefined {
		try {
			const result = this.exec('git rev-parse --abbrev-ref HEAD')
			const branch = result.trim()
			return branch === 'HEAD' ? undefined : branch
		} catch {
			return undefined
		}
	}

	/**
	 * Get detailed information about the current branch.
	 */
	getBranchInfo(): BranchInfo | undefined {
		const branch = this.getCurrentBranch()

		if (!branch) {
			// Check if detached HEAD
			try {
				this.exec('git rev-parse HEAD')
				return {
					name: 'HEAD',
					isDetached: true,
					ahead: 0,
					behind: 0,
				}
			} catch {
				return undefined
			}
		}

		// Get tracking info
		let trackingRemote: string | undefined
		let ahead = 0
		let behind = 0

		try {
			trackingRemote = this.exec(`git config branch.${branch}.remote`).trim()
		} catch {
			// No tracking remote
		}

		if (trackingRemote) {
			try {
				const status = this.exec('git status --porcelain -b')
				const match = status.match(/\[(?:ahead (\d+))?(?:, )?(?:behind (\d+))?\]/)
				if (match) {
					ahead = Number.parseInt(match[1] ?? '0', 10)
					behind = Number.parseInt(match[2] ?? '0', 10)
				}
			} catch {
				// Ignore status errors
			}
		}

		return {
			name: branch,
			isDetached: false,
			trackingRemote,
			ahead,
			behind,
		}
	}

	/**
	 * Check if a branch exists locally.
	 */
	branchExists(branchName: string): boolean {
		try {
			this.exec(`git rev-parse --verify ${branchName}`)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Check if a branch exists on the remote.
	 */
	remoteBranchExists(branchName: string, remote = 'origin'): boolean {
		try {
			this.exec(`git ls-remote --heads ${remote} ${branchName}`)
			const result = this.exec(`git ls-remote --heads ${remote} ${branchName}`)
			return result.trim().length > 0
		} catch {
			return false
		}
	}

	/**
	 * Check if a branch has been merged into another branch.
	 *
	 * @param branchName - The branch to check
	 * @param targetBranch - The branch to check if merged into (default: main or master)
	 */
	isBranchMerged(branchName: string, targetBranch?: string): boolean {
		const target = targetBranch ?? this.getDefaultBranch()
		if (!target) {
			return false
		}

		try {
			// Get list of branches merged into target
			const merged = this.exec(`git branch --merged ${target}`)
			const branches = merged
				.split('\n')
				.map((b) => b.trim().replace(/^\* /, ''))
				.filter((b) => b.length > 0)

			return branches.includes(branchName)
		} catch {
			return false
		}
	}

	/**
	 * Get the remote URL for a given remote.
	 *
	 * @param remote - Remote name (default: origin)
	 * @returns The remote URL or undefined if not found
	 */
	getRemoteUrl(remote = 'origin'): string | undefined {
		try {
			const result = this.exec(`git remote get-url ${remote}`)
			return result.trim() || undefined
		} catch {
			return undefined
		}
	}

	/**
	 * Get the default branch (main or master).
	 */
	getDefaultBranch(): string | undefined {
		// Try to get from remote HEAD
		try {
			const result = this.exec('git symbolic-ref refs/remotes/origin/HEAD')
			const match = result.match(/refs\/remotes\/origin\/(.+)/)
			if (match?.[1]) {
				return match[1].trim()
			}
		} catch {
			// Ignore
		}

		// Fall back to checking common names
		if (this.branchExists('main')) {
			return 'main'
		}
		if (this.branchExists('master')) {
			return 'master'
		}

		return undefined
	}

	/**
	 * Extract task ID from a branch name.
	 *
	 * Supports common patterns:
	 * - feature/86aefjr5b-description
	 * - feature/CU-abc123-description
	 * - fix/JIRA-123-description
	 * - 86aefjr5b-description
	 */
	extractTaskFromBranch(branchName: string): string | undefined {
		// Pattern 1: feature/86aefjr5b-... or fix/86aefjr5b-...
		const fullIdPattern = /(?:feature|fix|bugfix|hotfix)\/([a-z0-9]+)-/i
		let match = branchName.match(fullIdPattern)
		if (match) {
			return match[1]
		}

		// Pattern 2: feature/CU-xxx-... (ClickUp display format)
		const cuPattern = /(?:feature|fix|bugfix|hotfix)\/CU-([a-z0-9]+)-/i
		match = branchName.match(cuPattern)
		if (match) {
			// Note: This is truncated format, may not work for API lookups
			return match[1]
		}

		// Pattern 3: feature/JIRA-123-... or similar
		const jiraPattern = /(?:feature|fix|bugfix|hotfix)\/([A-Z]+-\d+)/i
		match = branchName.match(jiraPattern)
		if (match) {
			return match[1]
		}

		// Pattern 4: Just the ID at the start (no prefix)
		const barePattern = /^([a-z0-9]+)-/i
		match = branchName.match(barePattern)
		if (match?.[1] && match[1].length >= 6) {
			return match[1]
		}

		return undefined
	}

	/**
	 * Get task ID from current branch.
	 */
	getCurrentTaskId(): string | undefined {
		const branch = this.getCurrentBranch()
		if (!branch) {
			return undefined
		}
		return this.extractTaskFromBranch(branch)
	}

	/**
	 * Check if there are uncommitted changes.
	 */
	hasUncommittedChanges(): boolean {
		try {
			const status = this.exec('git status --porcelain')
			return status.trim().length > 0
		} catch {
			return false
		}
	}

	/**
	 * Check if current branch is up to date with remote.
	 */
	isUpToDate(): boolean {
		try {
			// Fetch latest
			this.exec('git fetch --quiet')

			const info = this.getBranchInfo()
			if (!info || !info.trackingRemote) {
				return true // No remote to compare
			}

			return info.ahead === 0 && info.behind === 0
		} catch {
			return true
		}
	}

	/**
	 * Get the merge base between two branches.
	 */
	getMergeBase(branch1: string, branch2: string): string | undefined {
		try {
			const result = this.exec(`git merge-base ${branch1} ${branch2}`)
			return result.trim()
		} catch {
			return undefined
		}
	}

	/**
	 * Check if current branch is on main/master.
	 */
	isOnDefaultBranch(): boolean {
		const current = this.getCurrentBranch()
		const defaultBranch = this.getDefaultBranch()
		return current === defaultBranch
	}

	/**
	 * Create a new branch and switch to it.
	 */
	createBranch(branchName: string): GitResult {
		try {
			if (this.branchExists(branchName)) {
				// Branch exists, just checkout
				this.exec(`git checkout ${branchName}`)
				return { success: true, output: `Switched to branch '${branchName}'` }
			}
			const output = this.exec(`git checkout -b ${branchName}`)
			return { success: true, output }
		} catch (err) {
			return {
				success: false,
				output: '',
				error: `Failed to create branch: ${err}`,
			}
		}
	}

	/**
	 * Switch to a branch.
	 */
	checkout(branchName: string): GitResult {
		try {
			const output = this.exec(`git checkout ${branchName}`)
			return { success: true, output }
		} catch (err) {
			return {
				success: false,
				output: '',
				error: `Failed to checkout: ${err}`,
			}
		}
	}

	/**
	 * Check if a task has passed review.
	 */
	hasPassedReview(taskId: string): boolean {
		const review = this.getReviewResult(taskId)
		return review?.status === 'approved'
	}

	/**
	 * Get review result for a task.
	 */
	getReviewResult(taskId: string): ReviewResult | undefined {
		const reviewPath = this.getReviewPath(taskId)
		if (!existsSync(reviewPath)) {
			return undefined
		}

		try {
			const content = readFileSync(reviewPath, 'utf-8')
			return JSON.parse(content) as ReviewResult
		} catch {
			return undefined
		}
	}

	/**
	 * Save review result for a task.
	 */
	saveReviewResult(result: ReviewResult): void {
		const reviewDir = join(this.cwd, '.vanguard', 'reviews')
		if (!existsSync(reviewDir)) {
			mkdirSync(reviewDir, { recursive: true })
		}

		const reviewPath = this.getReviewPath(result.taskId)
		writeFileSync(reviewPath, JSON.stringify(result, null, '\t'), 'utf-8')
	}

	/**
	 * Check if current branch can be merged (has passed review).
	 *
	 * Returns an object with canMerge status and reason.
	 */
	canMerge(): { canMerge: boolean; reason?: string; taskId?: string } {
		const branch = this.getCurrentBranch()
		if (!branch) {
			return { canMerge: false, reason: 'Not on a branch' }
		}

		const defaultBranch = this.getDefaultBranch()
		if (branch === defaultBranch) {
			return { canMerge: true } // Already on default branch
		}

		const taskId = this.extractTaskFromBranch(branch)
		if (!taskId) {
			// Non-task branch, allow merge with warning
			return { canMerge: true, reason: 'Non-task branch, review recommended' }
		}

		const review = this.getReviewResult(taskId)
		if (!review) {
			return {
				canMerge: false,
				reason: 'No review found. Run /vanguard.review first',
				taskId,
			}
		}

		if (review.status === 'approved') {
			return { canMerge: true, taskId }
		}

		if (review.status === 'changes_requested') {
			return {
				canMerge: false,
				reason: 'Changes were requested in review. Address feedback first',
				taskId,
			}
		}

		return {
			canMerge: false,
			reason: 'Review is pending. Complete the review first',
			taskId,
		}
	}

	/**
	 * Get the path to a review result file.
	 */
	private getReviewPath(taskId: string): string {
		return join(this.cwd, '.vanguard', 'reviews', `${taskId}.json`)
	}

	/**
	 * Execute a git command and return output.
	 */
	private exec(command: string): string {
		return execSync(command, {
			cwd: this.cwd,
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		})
	}
}

import { execSync } from 'node:child_process'
import type { GitService } from '../application/ports/git-service.js'

/**
 * Git service adapter using child_process execSync.
 */
export class CliGitService implements GitService {
	constructor(private readonly cwd: string = process.cwd()) {}

	async getCurrentBranch(): Promise<string | undefined> {
		try {
			const branch = execSync('git rev-parse --abbrev-ref HEAD', {
				cwd: this.cwd,
				stdio: 'pipe',
				encoding: 'utf-8',
			}).trim()
			return branch
		} catch {
			return undefined
		}
	}

	async branchExists(branchName: string): Promise<boolean> {
		try {
			execSync(`git rev-parse --verify ${branchName}`, {
				cwd: this.cwd,
				stdio: 'pipe',
			})
			return true
		} catch {
			return false
		}
	}

	async checkoutBranch(branchName: string): Promise<void> {
		execSync(`git checkout ${branchName}`, {
			cwd: this.cwd,
			stdio: 'pipe',
		})
	}

	async createBranch(branchName: string): Promise<void> {
		execSync(`git checkout -b ${branchName}`, {
			cwd: this.cwd,
			stdio: 'pipe',
		})
	}

	async getLogWithNumstat(): Promise<string> {
		return execSync('git log --format="%H|%aI|%an|%ae|%s" --numstat', {
			cwd: this.cwd,
			encoding: 'utf-8',
			maxBuffer: 10 * 1024 * 1024,
		})
	}
}

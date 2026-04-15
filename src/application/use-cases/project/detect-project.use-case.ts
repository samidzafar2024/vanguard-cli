/**
 * Detect Project Use Case.
 *
 * Analyzes an existing codebase to detect language, framework,
 * ORM, database, and testing configuration.
 */

/**
 * Detected project information.
 */
export interface DetectedProjectInfo {
	readonly language?: string | undefined
	readonly framework?: string | undefined
	readonly stackId?: string | undefined
	readonly orm?: string | undefined
	readonly database?: string | undefined
	readonly testFramework?: string | undefined
	readonly packageManager?: string | undefined
	readonly hasGit: boolean
}

/**
 * Project detector port for analyzing codebases.
 */
export interface ProjectDetectorPort {
	detect(rootPath: string): DetectedProjectInfo
}

/**
 * Output from detecting project settings.
 */
export interface DetectProjectOutput {
	readonly detected: DetectedProjectInfo
	readonly suggestions: readonly string[]
}

/**
 * Use case for detecting existing project configuration.
 *
 * Responsibilities:
 * - Analyzes file structure for language/framework hints
 * - Detects ORM and database from config files
 * - Identifies testing framework
 * - Provides smart defaults for brownfield projects
 */
export class DetectProjectUseCase {
	constructor(private readonly detector: ProjectDetectorPort) {}

	execute(rootPath: string): DetectProjectOutput {
		const detected = this.detector.detect(rootPath)
		const suggestions = this.generateSuggestions(detected)

		return {
			detected,
			suggestions,
		}
	}

	private generateSuggestions(detected: DetectedProjectInfo): string[] {
		const suggestions: string[] = []

		if (detected.language) {
			suggestions.push(`Detected language: ${detected.language}`)
		}

		if (detected.framework) {
			suggestions.push(`Detected framework: ${detected.framework}`)
		}

		if (detected.orm) {
			suggestions.push(`Detected ORM: ${detected.orm}`)
		}

		if (detected.database) {
			suggestions.push(`Detected database: ${detected.database}`)
		}

		if (detected.testFramework) {
			suggestions.push(`Detected testing: ${detected.testFramework}`)
		}

		if (!detected.hasGit) {
			suggestions.push('Consider initializing git for version control')
		}

		return suggestions
	}
}

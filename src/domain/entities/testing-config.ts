import type { Identifier } from '../value-objects/identifier.js'
import type { Language } from './stack.js'

/**
 * Testing framework category.
 */
export type TestCategory = 'unit' | 'integration' | 'e2e' | 'component'

/**
 * Linting tool category.
 */
export type LintCategory = 'linter' | 'formatter' | 'type-checker'

/**
 * Testing framework definition.
 */
export interface TestFramework {
	readonly id: Identifier
	readonly name: string
	readonly category: TestCategory
	readonly language: Language
	readonly command: string
	readonly configFile?: string
	readonly description: string
}

/**
 * Linting tool definition.
 */
export interface LintTool {
	readonly id: Identifier
	readonly name: string
	readonly category: LintCategory
	readonly language: Language
	readonly command: string
	readonly configFile?: string
	readonly description: string
}

/**
 * Testing Configuration Entity - represents testing and linting setup for a project.
 * Selected based on stack language during init.
 */
export class TestingConfig {
	private constructor(
		public readonly language: Language,
		public readonly unitFramework: TestFramework,
		public readonly integrationFramework: TestFramework | undefined,
		public readonly e2eFramework: TestFramework | undefined,
		public readonly componentFramework: TestFramework | undefined,
		public readonly linter: LintTool,
		public readonly formatter: LintTool,
		public readonly typeChecker: LintTool | undefined,
	) {}

	static create(params: {
		language: Language
		unitFramework: TestFramework
		integrationFramework?: TestFramework
		e2eFramework?: TestFramework
		componentFramework?: TestFramework
		linter: LintTool
		formatter: LintTool
		typeChecker?: LintTool
	}): TestingConfig {
		return new TestingConfig(
			params.language,
			params.unitFramework,
			params.integrationFramework,
			params.e2eFramework,
			params.componentFramework,
			params.linter,
			params.formatter,
			params.typeChecker,
		)
	}

	/**
	 * Get all test commands for CI/CD.
	 */
	getAllTestCommands(): readonly string[] {
		const commands: string[] = [this.unitFramework.command]

		if (this.integrationFramework) {
			commands.push(this.integrationFramework.command)
		}
		if (this.e2eFramework) {
			commands.push(this.e2eFramework.command)
		}
		if (this.componentFramework) {
			commands.push(this.componentFramework.command)
		}

		return commands
	}

	/**
	 * Get all lint commands for pre-commit hooks.
	 */
	getAllLintCommands(): readonly string[] {
		const commands: string[] = [this.linter.command, this.formatter.command]

		if (this.typeChecker) {
			commands.push(this.typeChecker.command)
		}

		return commands
	}

	/**
	 * Get the complete check command (lint + test).
	 */
	getCheckCommand(): string {
		const lintCmds = this.getAllLintCommands().join(' && ')
		const testCmds = this.getAllTestCommands().join(' && ')
		return `${lintCmds} && ${testCmds}`
	}

	/**
	 * Get config files that need to be generated.
	 */
	getConfigFiles(): readonly string[] {
		const files: string[] = []

		if (this.unitFramework.configFile) files.push(this.unitFramework.configFile)
		if (this.integrationFramework?.configFile) files.push(this.integrationFramework.configFile)
		if (this.e2eFramework?.configFile) files.push(this.e2eFramework.configFile)
		if (this.linter.configFile) files.push(this.linter.configFile)
		if (this.formatter.configFile) files.push(this.formatter.configFile)
		if (this.typeChecker?.configFile) files.push(this.typeChecker.configFile)

		return [...new Set(files)] // Deduplicate
	}

	/**
	 * Generate prompt context for development agents.
	 */
	toPromptContext(): string {
		const lines = [
			'## Testing & Quality Configuration',
			'',
			`**Unit Testing**: ${this.unitFramework.name} (\`${this.unitFramework.command}\`)`,
		]

		if (this.integrationFramework) {
			lines.push(
				`**Integration Testing**: ${this.integrationFramework.name} (\`${this.integrationFramework.command}\`)`,
			)
		}
		if (this.e2eFramework) {
			lines.push(`**E2E Testing**: ${this.e2eFramework.name} (\`${this.e2eFramework.command}\`)`)
		}
		if (this.componentFramework) {
			lines.push(
				`**Component Testing**: ${this.componentFramework.name} (\`${this.componentFramework.command}\`)`,
			)
		}

		lines.push('')
		lines.push(`**Linting**: ${this.linter.name} (\`${this.linter.command}\`)`)
		lines.push(`**Formatting**: ${this.formatter.name} (\`${this.formatter.command}\`)`)

		if (this.typeChecker) {
			lines.push(`**Type Checking**: ${this.typeChecker.name} (\`${this.typeChecker.command}\`)`)
		}

		lines.push('')
		lines.push(`**Before committing, always run**: \`${this.getCheckCommand()}\``)

		return lines.join('\n')
	}
}

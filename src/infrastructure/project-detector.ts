import * as fs from 'node:fs'
import * as path from 'node:path'

export interface DetectedProject {
	language?: 'typescript' | 'javascript' | 'python' | 'csharp'
	framework?: string
	stackId?: string
	orm?: string
	database?: string
	hasTests?: boolean
	testFramework?: string
}

interface PackageJson {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

/**
 * Detects project characteristics from existing files in a directory.
 * Used to provide smart defaults for brownfield projects.
 */
export class ProjectDetector {
	detect(rootPath: string): DetectedProject {
		const result: DetectedProject = {}

		// Check for Node.js/TypeScript/JavaScript project
		const packageJsonPath = path.join(rootPath, 'package.json')
		if (fs.existsSync(packageJsonPath)) {
			this.detectFromPackageJson(packageJsonPath, result)
		}

		// Check for Python project
		const requirementsPath = path.join(rootPath, 'requirements.txt')
		const pyprojectPath = path.join(rootPath, 'pyproject.toml')
		if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath)) {
			this.detectFromPython(rootPath, result)
		}

		// Check for C# project
		const csprojFiles = this.findFiles(rootPath, '.csproj')
		if (csprojFiles.length > 0) {
			this.detectFromCsharp(csprojFiles, result)
		}

		return result
	}

	private detectFromPackageJson(packageJsonPath: string, result: DetectedProject): void {
		try {
			const content = fs.readFileSync(packageJsonPath, 'utf-8')
			const pkg: PackageJson = JSON.parse(content)
			const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

			result.language = allDeps.typescript ? 'typescript' : 'javascript'
			this.detectJsFramework(allDeps, result)
			this.detectJsOrm(allDeps, result)
			this.detectJsDatabase(allDeps, result)
			this.detectJsTestFramework(allDeps, result)
		} catch {
			// Ignore parse errors
		}
	}

	private detectJsFramework(allDeps: Record<string, string>, result: DetectedProject): void {
		const isTs = result.language === 'typescript'
		const plainStack = isTs ? 'plain-typescript' : 'plain-javascript'

		const frameworks: Array<{
			deps: string[]
			framework: string
			stackId: string | (() => string)
		}> = [
			{ deps: ['next'], framework: 'next', stackId: 'nextjs-typescript' },
			{ deps: ['@nestjs/core'], framework: 'nestjs', stackId: 'nestjs-typescript' },
			{
				deps: ['express'],
				framework: 'express',
				stackId: () => (isTs ? 'express-typescript' : plainStack),
			},
			{
				deps: ['fastify'],
				framework: 'fastify',
				stackId: () => (isTs ? 'fastify-typescript' : plainStack),
			},
			{ deps: ['hono'], framework: 'hono', stackId: () => (isTs ? 'hono-typescript' : plainStack) },
		]

		for (const fw of frameworks) {
			if (fw.deps.some((dep) => allDeps[dep])) {
				result.framework = fw.framework
				result.stackId = typeof fw.stackId === 'function' ? fw.stackId() : fw.stackId
				return
			}
		}
		result.stackId = plainStack
	}

	private detectJsOrm(allDeps: Record<string, string>, result: DetectedProject): void {
		const orms: Array<{ deps: string[]; orm: string }> = [
			{ deps: ['prisma', '@prisma/client'], orm: 'prisma' },
			{ deps: ['drizzle', 'drizzle-orm'], orm: 'drizzle' },
			{ deps: ['typeorm'], orm: 'typeorm' },
		]

		for (const o of orms) {
			if (o.deps.some((dep) => allDeps[dep])) {
				result.orm = o.orm
				return
			}
		}
	}

	private detectJsDatabase(allDeps: Record<string, string>, result: DetectedProject): void {
		const databases: Array<{ deps: string[]; database: string }> = [
			{ deps: ['pg', '@neondatabase/serverless'], database: 'postgresql' },
			{ deps: ['mysql2', 'mysql'], database: 'mysql' },
			{ deps: ['better-sqlite3', 'sqlite3'], database: 'sqlite' },
			{ deps: ['mongodb', 'mongoose'], database: 'mongodb' },
		]

		for (const db of databases) {
			if (db.deps.some((dep) => allDeps[dep])) {
				result.database = db.database
				return
			}
		}
	}

	private detectJsTestFramework(allDeps: Record<string, string>, result: DetectedProject): void {
		const testFrameworks: Array<{ dep: string; framework: string }> = [
			{ dep: 'vitest', framework: 'vitest' },
			{ dep: 'jest', framework: 'jest' },
		]

		for (const tf of testFrameworks) {
			if (allDeps[tf.dep]) {
				result.hasTests = true
				result.testFramework = tf.framework
				return
			}
		}
	}

	private detectFromPython(rootPath: string, result: DetectedProject): void {
		result.language = 'python'

		// Read requirements.txt if exists
		const requirementsPath = path.join(rootPath, 'requirements.txt')
		let requirements = ''
		if (fs.existsSync(requirementsPath)) {
			requirements = fs.readFileSync(requirementsPath, 'utf-8').toLowerCase()
		}

		// Read pyproject.toml if exists
		const pyprojectPath = path.join(rootPath, 'pyproject.toml')
		let pyproject = ''
		if (fs.existsSync(pyprojectPath)) {
			pyproject = fs.readFileSync(pyprojectPath, 'utf-8').toLowerCase()
		}

		const allDeps = requirements + pyproject

		// Detect framework
		if (allDeps.includes('fastapi')) {
			result.framework = 'fastapi'
			result.stackId = 'fastapi-python'
		} else if (allDeps.includes('django')) {
			result.framework = 'django'
			result.stackId = 'django-python'
		} else if (allDeps.includes('flask')) {
			result.framework = 'flask'
			result.stackId = 'flask-python'
		} else {
			result.stackId = 'plain-python'
		}

		// Detect ORM
		if (allDeps.includes('sqlalchemy')) {
			result.orm = 'sqlalchemy'
		} else if (allDeps.includes('prisma')) {
			result.orm = 'prisma'
		}

		// Detect database
		if (allDeps.includes('psycopg') || allDeps.includes('asyncpg')) {
			result.database = 'postgresql'
		} else if (allDeps.includes('pymysql') || allDeps.includes('mysqlclient')) {
			result.database = 'mysql'
		} else if (allDeps.includes('sqlite')) {
			result.database = 'sqlite'
		}

		// Detect test framework
		if (allDeps.includes('pytest')) {
			result.hasTests = true
			result.testFramework = 'pytest'
		}
	}

	private detectFromCsharp(csprojFiles: string[], result: DetectedProject): void {
		result.language = 'csharp'

		// Read first csproj file
		let csprojContent = ''
		const firstCsproj = csprojFiles[0]
		if (firstCsproj) {
			try {
				csprojContent = fs.readFileSync(firstCsproj, 'utf-8').toLowerCase()
			} catch {
				// Ignore read errors
			}
		}

		// Detect framework
		if (csprojContent.includes('microsoft.aspnetcore')) {
			result.framework = 'aspnet'
			result.stackId = 'aspnet-csharp'
		} else {
			result.stackId = 'plain-csharp'
		}

		// Detect ORM
		if (csprojContent.includes('entityframeworkcore') || csprojContent.includes('efcore')) {
			result.orm = 'efcore'
		}

		// Detect database
		if (csprojContent.includes('npgsql') || csprojContent.includes('postgresql')) {
			result.database = 'postgresql'
		} else if (csprojContent.includes('mysql')) {
			result.database = 'mysql'
		} else if (csprojContent.includes('sqlite')) {
			result.database = 'sqlite'
		} else if (csprojContent.includes('sqlserver') || csprojContent.includes('mssql')) {
			result.database = 'sqlserver'
		}

		// Detect test framework
		if (csprojContent.includes('xunit')) {
			result.hasTests = true
			result.testFramework = 'xunit'
		} else if (csprojContent.includes('nunit')) {
			result.hasTests = true
			result.testFramework = 'nunit'
		}
	}

	private findFiles(rootPath: string, extension: string): string[] {
		const results: string[] = []
		this.collectFilesWithExtension(rootPath, extension, results, 0, 2)
		return results
	}

	private collectFilesWithExtension(
		dirPath: string,
		extension: string,
		results: string[],
		depth: number,
		maxDepth: number,
	): void {
		if (depth > maxDepth) return

		let entries: fs.Dirent[]
		try {
			entries = fs.readdirSync(dirPath, { withFileTypes: true })
		} catch {
			return
		}

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name)

			if (entry.isFile() && entry.name.endsWith(extension)) {
				results.push(fullPath)
				continue
			}

			const shouldDescend =
				entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules'

			if (shouldDescend) {
				this.collectFilesWithExtension(fullPath, extension, results, depth + 1, maxDepth)
			}
		}
	}
}

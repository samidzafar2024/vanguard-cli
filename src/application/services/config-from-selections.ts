/**
 * Build a vanguardConfig object from group→choice selections.
 *
 * This is a client-side port of the server's buildVanguardConfigFromSelections()
 * used to generate a local .vanguard/config.yaml that matches the server-derived config.
 *
 * Source: vanguard-web/src/lib/agent-framework/build-vanguard-config-from-selections.ts
 */

/** Metadata lookup for choices that need enriched config objects (name + command). */
const TOOL_METADATA: Record<string, Record<string, { name: string; command: string }>> = {
	'unit-test': {
		vitest: { name: 'Vitest', command: 'npx vitest run' },
		jest: { name: 'Jest', command: 'npx jest' },
		pytest: { name: 'pytest', command: 'pytest' },
		unittest: { name: 'unittest', command: 'python -m unittest' },
		xunit: { name: 'xUnit', command: 'dotnet test' },
		nunit: { name: 'NUnit', command: 'dotnet test' },
		rspec: { name: 'RSpec', command: 'bundle exec rspec' },
		minitest: { name: 'Minitest', command: 'bundle exec rails test' },
	},
	linter: {
		biome: { name: 'Biome', command: 'npx biome check .' },
		eslint: { name: 'ESLint', command: 'npx eslint .' },
		ruff: { name: 'Ruff', command: 'ruff check .' },
		flake8: { name: 'Flake8', command: 'flake8 .' },
		'dotnet-format': { name: 'dotnet format', command: 'dotnet format --verify-no-changes' },
		rubocop: { name: 'RuboCop', command: 'rubocop' },
	},
	formatter: {
		'biome-format': { name: 'Biome', command: 'npx biome format .' },
		prettier: { name: 'Prettier', command: 'npx prettier --check .' },
		'ruff-format': { name: 'Ruff', command: 'ruff format --check .' },
		black: { name: 'Black', command: 'black --check .' },
		'dotnet-format-fix': { name: 'dotnet format', command: 'dotnet format' },
		'rubocop-fix': { name: 'RuboCop', command: 'rubocop -a' },
	},
	'e2e-test': {
		playwright: { name: 'Playwright', command: 'npx playwright test' },
		cypress: { name: 'Cypress', command: 'npx cypress run' },
		'playwright-python': { name: 'Playwright', command: 'pytest --browser chromium' },
		'playwright-dotnet': { name: 'Playwright', command: 'dotnet test --filter Playwright' },
	},
}

const ORM_METADATA: Record<string, { name: string; migrationTool: string }> = {
	prisma: { name: 'Prisma', migrationTool: 'prisma migrate dev' },
	drizzle: { name: 'Drizzle', migrationTool: 'drizzle-kit push' },
	typeorm: { name: 'TypeORM', migrationTool: 'typeorm migration:run' },
	sqlalchemy: { name: 'SQLAlchemy', migrationTool: 'alembic upgrade head' },
	tortoise: { name: 'Tortoise ORM', migrationTool: 'aerich upgrade' },
	'django-orm': { name: 'Django ORM', migrationTool: 'python manage.py migrate' },
	efcore: { name: 'Entity Framework Core', migrationTool: 'dotnet ef database update' },
	dapper: { name: 'Dapper', migrationTool: 'manual SQL' },
	activerecord: { name: 'Active Record', migrationTool: 'rails db:migrate' },
}

const STACK_NAMES: Record<string, string> = {
	'nextjs-app-router': 'Next.js (App Router)',
	'express-typescript': 'Express (TypeScript)',
	'plain-typescript': 'Plain TypeScript',
	'plain-javascript': 'Plain JavaScript',
	fastapi: 'FastAPI',
	django: 'Django',
	'plain-python': 'Plain Python',
	'aspnet-webapi': 'ASP.NET Web API',
	'plain-csharp': 'Plain C#',
	rails: 'Ruby on Rails',
}

const AUTH_METADATA: Record<string, { strategy: string; provider?: string }> = {
	nextauth: { strategy: 'session', provider: 'NextAuth.js' },
	clerk: { strategy: 'session', provider: 'Clerk' },
	jwt: { strategy: 'jwt' },
	oauth2: { strategy: 'oauth2' },
	devise: { strategy: 'session', provider: 'Devise' },
	'aspnet-identity': { strategy: 'session', provider: 'ASP.NET Identity' },
}

/** Map tool group slugs to vanguardConfig keys. */
const TOOL_GROUP_CONFIG_KEYS: Record<string, string> = {
	'unit-test': 'unitTest',
	linter: 'linter',
	formatter: 'formatter',
	'e2e-test': 'e2eTest',
}

/** Apply simple string mappings from selections to config. */
function applySimpleMappings(
	config: Record<string, unknown>,
	selections: Record<string, string>,
): void {
	if (selections['project-type']) config.type = selections['project-type']
	if (selections.track) config.track = selections.track
	if (selections.language) config.language = selections.language
	if (selections.database) config.database = selections.database
	if (selections.architecture) config.architecture = selections.architecture
	if (selections['deploy-target']) {
		config.deployment = {
			primary: selections['deploy-target'],
			targets: [selections['deploy-target']],
			environments: ['development', 'production'],
		}
	}
}

/** Apply enriched object mappings (stack, orm, auth, frontend). */
function applyObjectMappings(
	config: Record<string, unknown>,
	selections: Record<string, string>,
): void {
	if (selections.stack) {
		config.stackId = selections.stack
		config.stackName = STACK_NAMES[selections.stack] ?? selections.stack
	}

	if (selections.orm) {
		config.orm = ORM_METADATA[selections.orm] ?? { name: selections.orm, migrationTool: '' }
	}

	if (selections['auth-strategy']) {
		config.auth = AUTH_METADATA[selections['auth-strategy']] ?? {
			strategy: selections['auth-strategy'],
		}
	}

	// Frontend — skip 'none' (C20: replicate server logic exactly)
	if (selections.frontend && selections.frontend !== 'none') {
		config.frontend = { framework: selections.frontend }
	}
}

/** Apply tool group mappings (unit-test, linter, formatter, e2e-test). */
function applyToolMappings(
	config: Record<string, unknown>,
	selections: Record<string, string>,
): void {
	for (const [group, configKey] of Object.entries(TOOL_GROUP_CONFIG_KEYS)) {
		const choice = selections[group]
		if (!choice) continue

		const meta = TOOL_METADATA[group]?.[choice]
		config[configKey] = meta ?? { name: choice, command: '' }
	}
}

/**
 * Build a backward-compatible vanguardConfig from group→choice selections.
 *
 * Replicates the server's buildVanguardConfigFromSelections() exactly,
 * including the frontend 'none' skip (C20).
 */
export function buildConfigFromSelections(
	selections: Record<string, string>,
): Record<string, unknown> {
	const config: Record<string, unknown> = {}

	applySimpleMappings(config, selections)
	applyObjectMappings(config, selections)
	applyToolMappings(config, selections)

	return config
}

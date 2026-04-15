import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProjectDetector } from '../../../src/infrastructure/project-detector.js'

describe('ProjectDetector', () => {
	let testDir: string
	let detector: ProjectDetector

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanguard-test-'))
		detector = new ProjectDetector()
	})

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true })
	})

	describe('detect', () => {
		it('should return empty object for empty directory', () => {
			const result = detector.detect(testDir)
			expect(result).toEqual({})
		})

		describe('Node.js/TypeScript projects', () => {
			it('should detect plain JavaScript project', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						dependencies: {
							lodash: '4.17.21',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.language).toBe('javascript')
				expect(result.stackId).toBe('plain-javascript')
			})

			it('should detect TypeScript project', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						devDependencies: {
							typescript: '5.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.language).toBe('typescript')
				expect(result.stackId).toBe('plain-typescript')
			})

			it('should detect Express framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						dependencies: {
							express: '4.18.0',
						},
						devDependencies: {
							typescript: '5.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.framework).toBe('express')
				expect(result.stackId).toBe('express-typescript')
			})

			it('should detect Next.js framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						dependencies: {
							next: '14.0.0',
							react: '18.0.0',
						},
						devDependencies: {
							typescript: '5.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.framework).toBe('next')
				expect(result.stackId).toBe('nextjs-typescript')
			})

			it('should detect NestJS framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						dependencies: {
							'@nestjs/core': '10.0.0',
						},
						devDependencies: {
							typescript: '5.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.framework).toBe('nestjs')
				expect(result.stackId).toBe('nestjs-typescript')
			})

			it('should detect Prisma ORM', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						devDependencies: {
							typescript: '5.0.0',
							prisma: '5.0.0',
						},
						dependencies: {
							'@prisma/client': '5.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.orm).toBe('prisma')
			})

			it('should detect Drizzle ORM', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						devDependencies: {
							typescript: '5.0.0',
						},
						dependencies: {
							'drizzle-orm': '0.29.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.orm).toBe('drizzle')
			})

			it('should detect PostgreSQL database', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						dependencies: {
							pg: '8.11.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.database).toBe('postgresql')
			})

			it('should detect MySQL database', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						dependencies: {
							mysql2: '3.6.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.database).toBe('mysql')
			})

			it('should detect Vitest framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						devDependencies: {
							typescript: '5.0.0',
							vitest: '1.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.hasTests).toBe(true)
				expect(result.testFramework).toBe('vitest')
			})

			it('should detect Jest framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						devDependencies: {
							jest: '29.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.hasTests).toBe(true)
				expect(result.testFramework).toBe('jest')
			})
		})

		describe('Python projects', () => {
			it('should detect Python project from requirements.txt', () => {
				fs.writeFileSync(path.join(testDir, 'requirements.txt'), 'requests==2.28.0\n')

				const result = detector.detect(testDir)
				expect(result.language).toBe('python')
				expect(result.stackId).toBe('plain-python')
			})

			it('should detect FastAPI framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'requirements.txt'),
					'fastapi==0.100.0\nuvicorn==0.23.0\n',
				)

				const result = detector.detect(testDir)
				expect(result.framework).toBe('fastapi')
				expect(result.stackId).toBe('fastapi-python')
			})

			it('should detect Django framework', () => {
				fs.writeFileSync(path.join(testDir, 'requirements.txt'), 'django==4.2.0\n')

				const result = detector.detect(testDir)
				expect(result.framework).toBe('django')
				expect(result.stackId).toBe('django-python')
			})

			it('should detect SQLAlchemy ORM', () => {
				fs.writeFileSync(path.join(testDir, 'requirements.txt'), 'sqlalchemy==2.0.0\n')

				const result = detector.detect(testDir)
				expect(result.orm).toBe('sqlalchemy')
			})

			it('should detect pytest framework', () => {
				fs.writeFileSync(path.join(testDir, 'requirements.txt'), 'pytest==7.4.0\n')

				const result = detector.detect(testDir)
				expect(result.hasTests).toBe(true)
				expect(result.testFramework).toBe('pytest')
			})

			it('should detect from pyproject.toml', () => {
				fs.writeFileSync(
					path.join(testDir, 'pyproject.toml'),
					`[project]
name = "my-app"
dependencies = ["fastapi"]
`,
				)

				const result = detector.detect(testDir)
				expect(result.language).toBe('python')
				expect(result.framework).toBe('fastapi')
			})
		})

		describe('C# projects', () => {
			it('should detect C# project from .csproj file', () => {
				fs.writeFileSync(
					path.join(testDir, 'MyApp.csproj'),
					`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`,
				)

				const result = detector.detect(testDir)
				expect(result.language).toBe('csharp')
				expect(result.stackId).toBe('plain-csharp')
			})

			it('should detect ASP.NET framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'MyApp.csproj'),
					`<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
  </ItemGroup>
</Project>`,
				)

				const result = detector.detect(testDir)
				expect(result.framework).toBe('aspnet')
				expect(result.stackId).toBe('aspnet-csharp')
			})

			it('should detect Entity Framework Core ORM', () => {
				fs.writeFileSync(
					path.join(testDir, 'MyApp.csproj'),
					`<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
  </ItemGroup>
</Project>`,
				)

				const result = detector.detect(testDir)
				expect(result.orm).toBe('efcore')
			})

			it('should detect xUnit test framework', () => {
				fs.writeFileSync(
					path.join(testDir, 'MyApp.Tests.csproj'),
					`<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="xunit" Version="2.6.0" />
  </ItemGroup>
</Project>`,
				)

				const result = detector.detect(testDir)
				expect(result.hasTests).toBe(true)
				expect(result.testFramework).toBe('xunit')
			})
		})

		describe('Complex projects', () => {
			it('should detect full TypeScript + Express + Prisma + PostgreSQL stack', () => {
				fs.writeFileSync(
					path.join(testDir, 'package.json'),
					JSON.stringify({
						dependencies: {
							express: '4.18.0',
							'@prisma/client': '5.0.0',
							pg: '8.11.0',
						},
						devDependencies: {
							typescript: '5.0.0',
							prisma: '5.0.0',
							vitest: '1.0.0',
						},
					}),
				)

				const result = detector.detect(testDir)
				expect(result.language).toBe('typescript')
				expect(result.framework).toBe('express')
				expect(result.stackId).toBe('express-typescript')
				expect(result.orm).toBe('prisma')
				expect(result.database).toBe('postgresql')
				expect(result.hasTests).toBe(true)
				expect(result.testFramework).toBe('vitest')
			})
		})
	})
})

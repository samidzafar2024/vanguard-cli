# Discovery Document: vanguard-cli

> **Agent**: Analyst
> **Phase**: Discover
> **Date**: 2026-01-12
> **Project Type**: Brownfield

---

## Executive Summary

vanguard-cli is a well-structured TypeScript CLI tool for initializing AI-assisted development projects. It implements Clean Architecture with Domain-Driven Design (DDD) principles, providing interactive project scaffolding with opinionated tech stack selections, architectural patterns, and agent personas.

The codebase demonstrates strong architectural discipline with clear layer separation, but has opportunities for improvement in test coverage, dependency injection, and repository pattern implementation.

---

## 1. Problem Statement

vanguard-cli solves the challenge of **bootstrapping AI-assisted development workflows** by:
- Generating structured project configurations for Claude Code integration
- Providing agent personas for different development phases
- Creating templates for specifications and planning
- Supporting multiple tech stacks (TypeScript, Python, C#) and architectural patterns (DDD, Clean Architecture, MVC, CQRS)

---

## 2. Current Architecture

### 2.1 Layer Structure

```
src/
├── domain/           # 983 lines - Pure business logic
│   ├── entities/     # Project, Stack, Architecture, Agent, TestingConfig
│   ├── value-objects/# Identifier, Version, FilePath
│   ├── interfaces/   # Repository port definitions
│   └── errors/       # Domain-specific exceptions
│
├── application/      # 1,547 lines - Use cases and services
│   ├── ports/        # Generator interfaces
│   └── services/     # 6 generator services
│
├── infrastructure/   # Adapters and external concerns
│   ├── file-writer.ts
│   ├── project-detector.ts
│   └── yaml-loader.ts
│
└── presentation/     # CLI and data registries
    ├── cli/          # Commands (init, extend)
    └── data/         # Stack, Architecture, Testing registries
```

### 2.2 DDD Pattern Implementation

| Pattern | Status | Notes |
|---------|--------|-------|
| **Aggregate Root** | Implemented | `Project` entity serves as aggregate root |
| **Value Objects** | Implemented | `Identifier`, `Version`, `FilePath` - immutable, value equality |
| **Entities** | Implemented | `Stack`, `Architecture`, `Agent`, `TestingConfig` |
| **Repository Interfaces** | Defined | Interfaces exist but NOT implemented |
| **Domain Errors** | Implemented | Custom error hierarchy |
| **Domain Events** | Not Implemented | No event sourcing |

### 2.3 Dependency Flow

```
Presentation → Application → Domain ← Infrastructure
     │              │           ↑           │
     │              │           │           │
     └──────────────┴───────────┴───────────┘
                 (correct direction)
```

**Current Flow Analysis**:
- Domain layer has NO external dependencies (correct)
- Application layer depends only on Domain (correct)
- Presentation imports from Domain and Application (correct)
- Infrastructure implements ports from Application (partially correct)

---

## 3. Technical Debt Identified

### 3.1 High Priority

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| **Repository interfaces not implemented** | `src/domain/interfaces/` | Unused abstractions | Either implement repositories or remove interfaces |
| **Hard-coded dependencies in services** | `VanguardGeneratorService` constructor | Difficult to test, violates DI | Inject dependencies via constructor |
| **In-memory registries in Presentation** | `src/presentation/data/` | Tightly coupled, not testable | Implement as Repository pattern |
| **No integration tests** | `tests/integration/` | Empty placeholder | Add integration tests for CLI commands |
| **No E2E tests** | `tests/e2e/` | Empty placeholder | Add E2E tests for full workflows |

### 3.2 Medium Priority

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| **init.ts is 620 lines** | `presentation/cli/commands/init.ts` | Complex, hard to maintain | Extract prompt logic into separate modules |
| **Zod not used for validation** | Throughout codebase | Inconsistent validation | Leverage zod dependency for runtime validation |
| **No domain events** | Domain layer | Limited observability | Consider adding domain events for audit/logging |
| **Unused dependencies** | `package.json` | `ora`, `listr2` imported but unused | Remove or utilize |

### 3.3 Low Priority

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| **Magic strings** | `NONE_VALUE = '__none__'` | Could cause subtle bugs | Use Symbol or enum |
| **Inconsistent error handling** | Various | Some errors logged, some thrown | Standardize error handling strategy |

---

## 4. Deviations from DDD Principles

### 4.1 Repository Pattern

**Expected**: Domain defines repository interfaces, Infrastructure implements them.

**Actual**:
- Repository interfaces ARE defined in `src/domain/interfaces/`
- BUT no implementations exist
- Data is stored in mutable registries in Presentation layer (`StackRegistry`, `ArchitectureRegistry`)

**Impact**:
- Registries are singletons with mutable state
- Cannot easily swap data sources
- Harder to test in isolation

### 4.2 Dependency Injection

**Expected**: Services receive dependencies through constructor injection.

**Actual** (in `VanguardGeneratorService`):
```typescript
constructor() {
  this.agentGenerator = new AgentGeneratorService()  // Hard-coded
  this.templateGenerator = new TemplateGeneratorService()
  // ...
}
```

**Impact**:
- Cannot mock dependencies in tests
- Tight coupling between services

### 4.3 Anemic Domain Model Tendency

**Status**: Mostly avoided. Entities have behavior methods:
- `Project.create()` - Factory method with validation
- `Project.generateAgentContext()` - Domain logic
- `Stack.isOrmCompatible()` - Business rules
- `Architecture.hasImplementationFor()` - Compatibility logic

**Minor Issue**: Some entities could have more behavior moved into them from services.

---

## 5. Constraints Identified

### 5.1 Technical Constraints

| Constraint | Details |
|------------|---------|
| **Node.js >= 20** | Required for ES modules and modern features |
| **ESM Only** | No CommonJS support |
| **TypeScript Strict Mode** | All strict checks enabled |
| **80% Test Coverage** | Configured threshold in vitest.config.ts |

### 5.2 External Constraints

| Constraint | Details |
|------------|---------|
| **Claude Code Integration** | Generates `.claude/commands/` for slash commands |
| **Agent Personas** | Specialized personas for each development phase |
| **Templates** | Structured templates for specifications and planning |

---

## 6. Risks and Dependencies

### 6.1 Dependency Analysis

| Package | Risk Level | Notes |
|---------|------------|-------|
| `@clack/prompts` | Low | Stable, well-maintained |
| `commander` | Low | Industry standard CLI framework |
| `yaml` | Low | Standard YAML parser |
| `zod` | Low | Type-safe validation (underutilized) |
| `fs-extra` | Low | Extended fs utilities |
| `gradient-string` | Medium | Aesthetic only, could be removed |
| `listr2` | Medium | Imported but appears unused |
| `ora` | Medium | Imported but appears unused |

### 6.2 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Breaking changes in dependencies** | Low | Medium | Lock versions, regular updates |
| **Test coverage below threshold** | Medium | High | Add missing integration/E2E tests |
| **Complex init command** | Medium | Medium | Refactor into smaller modules |
| **Registry mutation** | Low | Medium | Make registries immutable |

---

## 7. Test Coverage Analysis

### 7.1 Current Coverage

| Area | Files | Coverage | Notes |
|------|-------|----------|-------|
| **Value Objects** | 3 tests | High | `identifier.test.ts`, `version.test.ts`, `file-path.test.ts` |
| **Domain Errors** | 1 test | High | `domain-error.test.ts` |
| **Entities** | 1 test | Medium | Only `stack.test.ts`, missing Project/Architecture |
| **Services** | 1 test | Low | Only `generator.test.ts` |
| **Infrastructure** | 1 test | Medium | `project-detector.test.ts` |
| **CLI Commands** | 0 tests | None | No tests for init/extend |
| **Integration** | 0 tests | None | Placeholder directory |
| **E2E** | 0 tests | None | Placeholder directory |

### 7.2 Recommended Test Additions

1. **Entity tests**: `project.test.ts`, `architecture.test.ts`, `agent.test.ts`
2. **CLI command tests**: `init.test.ts`, `extend.test.ts`
3. **Integration tests**: Full generation workflow
4. **E2E tests**: End-to-end project initialization

---

## 8. Open Questions

1. **Should repository pattern be fully implemented?** The interfaces exist but have no implementations. Should we:
   - Implement them properly with the current registries as adapters?
   - Remove the interfaces if they're not needed?

2. **How should dependency injection be handled?** Options:
   - Simple constructor injection (no framework)
   - Use a lightweight DI container (e.g., `tsyringe`)
   - Keep current approach for simplicity

3. **What level of test coverage is acceptable?** Currently configured for 80%, but integration and E2E tests are missing.

4. **Should unused dependencies be removed?** `ora` and `listr2` appear unused.

5. **Is the init command complexity acceptable?** 620 lines is substantial for a single command file.

---

## 9. Recommendations for Next Steps

### Immediate (Before Next Feature)

1. **Add Project entity tests** - Critical for confidence in aggregate root behavior
2. **Remove or implement repository pattern** - Reduce architectural confusion
3. **Audit unused dependencies** - Clean up `ora` and `listr2` if unused

### Short-term

1. **Refactor init command** - Extract prompt logic into separate modules
2. **Add integration tests** - Test full generation workflow
3. **Implement constructor DI** - Make services testable

### Long-term

1. **Add domain events** - For audit logging and extensibility
2. **Full E2E test suite** - Test complete user journeys
3. **Consider schema validation** - Leverage Zod for all external input

---

## 10. Architecture Compliance Summary

| Principle | Status | Notes |
|-----------|--------|-------|
| Domain layer has no dependencies | PASS | Pure business logic |
| Entities encapsulate business rules | PASS | Validation and behavior in entities |
| Value objects are immutable | PASS | `Identifier`, `Version`, `FilePath` |
| Repositories abstract persistence | PARTIAL | Interfaces exist, no implementations |
| Domain services for cross-entity logic | PASS | Properly separated |
| No framework code in domain | PASS | Clean domain layer |
| Infrastructure implements ports | PARTIAL | `FsFileWriter` only |

---

## Appendix A: File Metrics

| Layer | Files | Lines | % of Total |
|-------|-------|-------|------------|
| Domain | 12 | 983 | 14% |
| Application | 8 | 1,547 | 22% |
| Infrastructure | 4 | ~400 | 6% |
| Presentation | 8 | ~4,000 | 58% |
| **Total** | **32** | **~6,900** | 100% |

## Appendix B: Dependency Graph

```
@clack/prompts  ←─── presentation/cli/commands/init.ts
commander       ←─── presentation/cli/index.ts
yaml            ←─── application/services/vanguard-generator.service.ts
                     infrastructure/yaml-loader.ts
zod             ←─── (imported but underutilized)
fs-extra        ←─── infrastructure/file-writer.ts
picocolors      ←─── presentation/cli/commands/init.ts
gradient-string ←─── presentation/cli/commands/init.ts
```

---

*Generated by Analyst Agent during Discovery Phase*
*Project: vanguard-cli | Stack: Plain TypeScript | Architecture: DDD*

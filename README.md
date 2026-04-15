# Vanguard

```
██╗    ██╗ █████╗ ██╗   ██╗██████╗  ██████╗ ██╗███╗   ██╗████████╗
██║    ██║██╔══██╗╚██╗ ██╔╝██╔══██╗██╔═══██╗██║████╗  ██║╚══██╔══╝
██║ █╗ ██║███████║ ╚████╔╝ ██████╔╝██║   ██║██║██╔██╗ ██║   ██║
██║███╗██║██╔══██║  ╚██╔╝  ██╔═══╝ ██║   ██║██║██║╚██╗██║   ██║
╚███╔███╔╝██║  ██║   ██║   ██║     ╚██████╔╝██║██║ ╚████║   ██║
 ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝
```

**AI-driven development framework for Claude Code**

Vanguard bridges the gap between product vision and working code by combining structured specification workflows with AI agent personas. It generates project scaffolding, Claude Code slash commands, and specialized agents that guide you through discovery, specification, architecture, planning, implementation, and review.

---

## Why Vanguard?

Modern AI coding assistants are powerful but lack context. They don't know your architecture patterns, testing conventions, or quality standards. Every conversation starts from scratch.

Vanguard solves this by:

- **Generating a project constitution** that captures your stack, architecture, and quality standards
- **Creating specialized agent personas** that embody different roles (analyst, architect, developer, QA)
- **Providing slash commands** for each phase of development
- **Embedding few-shot examples** so Claude writes code that matches your patterns

The result: Claude Code sessions that understand your project from the first prompt.

---

## Features

### Workflow Phases

Vanguard structures development into clear phases, each with a dedicated slash command:

| Phase | Command | Agent | Purpose |
|-------|---------|-------|---------|
| Discover | `/vanguard.discover` | Analyst | Explore requirements, risks, constraints |
| Brainstorm | `/vanguard.brainstorm` | Brainstorm Coach | Creative ideation with proven techniques |
| Constitute | `/vanguard.constitute` | Architect | Review project principles |
| Specify | `/vanguard.specify` | Product Manager | Create feature specifications |
| Clarify | `/vanguard.clarify` | Analyst | Resolve ambiguities |
| Architect | `/vanguard.architect` | Architect | Design technical solutions |
| Plan | `/vanguard.plan` | Scrum Master | Break into executable tasks |
| Implement | `/vanguard.implement` | Developer | Write code following patterns |
| Review | `/vanguard.review` | QA | Verify quality and compliance |

### Agent Personas

Each agent has a distinct personality, responsibilities, and commands:

| Agent | ID | Role |
|-------|-----|------|
| Analyst | `/vanguard.agents.analyst` | Requirements discovery and risk identification |
| Brainstorm Coach | `/vanguard.agents.brainstorm` | Creative ideation and innovation facilitation |
| Product Manager | `/vanguard.agents.pm` | Specifications and user stories |
| Architect | `/vanguard.agents.architect` | System design and ADRs |
| Scrum Master | `/vanguard.agents.sm` | Task breakdown and dependencies |
| Developer | `/vanguard.agents.dev` | Implementation following patterns |
| QA Engineer | `/vanguard.agents.qa` | Code review and quality gates |
| Module Architect | `/vanguard.agents.modarch` | Extending Vanguard itself |

### Supported Stacks

**Full-Stack Frameworks**
- Next.js (App Router) - TypeScript
- Express.js + TypeScript
- FastAPI - Python
- Django - Python
- ASP.NET Core Web API - C#

**Libraries / Plain Languages**
- Plain TypeScript
- Plain JavaScript
- Plain Python
- Plain C#

### Architecture Patterns

- **Clean Architecture** - Onion-style with domain at center
- **Domain-Driven Design (DDD)** - Tactical patterns with aggregates
- **MVC with Interactors** - Classic MVC enhanced with use cases
- **Simple Layered** - Routes → Services → Data

---

## Installation

### For Internal Users (GitHub Packages)

See [Internal Installation Guide](INTERNAL_INSTALLATION.md) for one-time authentication setup.

```bash
npx @vanguard-data/vanguard-cli@alpha init
```

### For Development

```bash
git clone https://github.com/vanguard-cli.git
cd vanguard-cli
npm install
npm run build
npm link
```

---

## Quick Start

### 1. Initialize a new project

```bash
npx @vanguard-data/vanguard-cli@alpha init
```

This launches an interactive wizard that asks about:
- Project name and type (greenfield/brownfield)
- Technology stack (Next.js, FastAPI, etc.)
- Architecture pattern (Clean, DDD, MVC, Simple)
- Database and ORM
- Testing frameworks

### 2. Explore generated files

```
your-project/
├── .claude/
│   └── commands/           # Claude Code slash commands
│       ├── vanguard.discover.md
│       ├── vanguard.specify.md
│       ├── vanguard.architect.md
│       └── ...
│       └── vanguard/
│           └── agents/     # Agent personas
│               ├── dev.md
│               ├── pm.md
│               └── ...
├── .vanguard/
│   ├── constitution.md     # Project principles (READ FIRST)
│   ├── config.yaml         # Project configuration
│   ├── templates/          # Document templates
│   ├── specs/              # Generated specifications
│   ├── plans/              # Technical plans
│   └── tasks/              # Executable tasks
└── CLAUDE.md               # Project memory for Claude
```

### 3. Start a Claude Code session

```bash
claude
```

Claude automatically reads `CLAUDE.md` and understands your project context.

### 4. Use workflow commands

```
> /vanguard.discover

I'll adopt the Analyst persona and help explore your requirements...
```

### 5. Activate agent personas

```
> /vanguard.agents.dev

🎭 Developer Agent Activated

I'm now operating as your Senior Developer. I'll implement features
following Clean Architecture patterns and write tests with Vitest.

Available commands:
- implement {task}: Implement a specific task
- test: Run tests for current work
- lint: Run linter and fix issues
- refactor {target}: Refactor following patterns
- exit: Exit developer persona
```

---

## How It Works

### The Constitution

Every Vanguard project has a constitution (`.vanguard/constitution.md`) that defines:

- **Technical stack** - Framework, language, database, ORM
- **Architecture principles** - Layer rules, dependency direction
- **Quality standards** - Testing requirements, linting, type checking
- **Security principles** - Input validation, secrets management
- **Anti-patterns** - What to avoid and how to fix violations

All agents reference this constitution, ensuring consistent guidance.

### Few-Shot Examples

Agent files include code examples specific to your stack + architecture combination:

```markdown
## Code Examples

### Entity (Domain Layer)
\`\`\`typescript
// domain/entities/user.ts
export class User {
  constructor(
    public readonly id: UserId,
    public readonly email: Email,
    private passwordHash: string
  ) {}

  verifyPassword(password: string): boolean {
    return bcrypt.compareSync(password, this.passwordHash)
  }
}
\`\`\`
```

These examples teach Claude your exact patterns.

### Template-Driven Documents

Vanguard generates templates for specifications, plans, and tasks:

- **Spec Template** - User scenarios, requirements, acceptance criteria
- **Plan Template** - Architecture alignment, component design, API contracts
- **Task Template** - Context, objective, acceptance checklist
- **Story Template** - User story format with testing requirements

---

## Commands Reference

### CLI Commands

```bash
npx @vanguard-data/vanguard-cli@alpha init        # Initialize new project
npx @vanguard-data/vanguard-cli@alpha init --yes  # Use defaults (detect from directory)
npx @vanguard-data/vanguard-cli@alpha extend      # Add new stacks/architectures (coming soon)
```

### Claude Code Slash Commands

| Command | Description |
|---------|-------------|
| `/vanguard.discover` | Start discovery phase with Analyst |
| `/vanguard.constitute` | Review project constitution |
| `/vanguard.specify` | Create feature specification |
| `/vanguard.clarify` | Resolve specification ambiguities |
| `/vanguard.architect` | Create technical design |
| `/vanguard.plan` | Break design into tasks |
| `/vanguard.implement` | Implement a task |
| `/vanguard.review` | QA review implementation |
| `/vanguard.extend` | Add new modules to Vanguard |

### Agent Commands

Each agent supports these commands when activated:

| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `exit` | Exit current persona |

Plus role-specific commands like `discover`, `spec`, `design`, `implement`, `review`, etc.

---

## Configuration

### config.yaml

```yaml
project:
  name: my-project
  type: greenfield
  track: standard

stack:
  id: nextjs-app-router
  language: typescript

database:
  type: postgresql
  orm: prisma
  migrations: prisma migrate dev

auth:
  strategy: jwt
  provider: custom

architecture:
  primary: clean-architecture

testing:
  unit: vitest
  e2e: playwright
  linter: biome
  formatter: biome
  typeChecker: tsc
```

---

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Full check (typecheck + lint + test)
npm run check
```

### Project Structure

```
src/
├── domain/              # Core business logic
│   ├── entities/        # Project, Stack, Architecture, Agent
│   ├── value-objects/   # FilePath, Identifier, Version
│   └── interfaces/      # Repository interfaces
├── application/         # Use cases and services
│   ├── ports/           # Generator interfaces
│   └── services/        # Generator implementations
├── infrastructure/      # External concerns
│   └── file-writer.ts   # File system operations
└── presentation/        # CLI and data
    ├── cli/             # Commander.js CLI
    └── data/            # Stack/Architecture registries
```

---

## Extending Vanguard

Vanguard is designed to be extended with new stacks, architectures, and modules.

### Adding a New Stack

1. Add stack definition to `src/presentation/data/stacks/index.ts`
2. Include compatible ORMs and auth strategies
3. Provide few-shot code examples
4. Define file structure conventions

### Adding a New Architecture

1. Add architecture definition to `src/presentation/data/architectures/index.ts`
2. Define layers with rules and responsibilities
3. List anti-patterns with fixes
4. Provide stack-specific implementations with examples

---

## Philosophy

Vanguard is built on these beliefs:

1. **Context is king** - AI assistants need project context to be useful
2. **Patterns over prompts** - Few-shot examples beat lengthy instructions
3. **Phases structure thinking** - Discovery → Specification → Architecture → Implementation
4. **Agents embody expertise** - Different roles bring different perspectives
5. **Constitutions ensure consistency** - Shared principles across all interactions

---

<p align="center">
  <strong>Discover → Specify → Architect → Plan → Implement → Review</strong>
  <br>
  <em>by Vanguard AI</em>
</p>

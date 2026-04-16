# Vanguard CLI

AI-driven development framework with agent personas for Claude Code. Vanguard brings structured workflows — specs, plans, tasks, memory, and integrations — to any codebase.

## Installation

### From npm (global)

```bash
npm install -g @samidzafar/vanguard-cli
```

### From GitHub (direct)

```bash
npm install -g github:samidzafar2024/vanguard-cli
```

### From source (local development)

```bash
git clone https://github.com/samidzafar2024/vanguard-cli.git
cd vanguard-cli
npm install
npm run build
npm link
```

After installation, the `vanguard` command is available globally.

## Quick Start

```bash
cd your-project
vanguard init
```

The interactive setup will ask for:
- Project name
- Project type (greenfield / brownfield)
- Development track (solo / team / enterprise)
- Language (TypeScript, Python, C#, Go, Rust, Java)
- Tech stack (Next.js, NestJS, FastAPI, Django, Spring Boot, etc.)
- Architecture pattern (Clean Architecture, DDD, MVC, Layered, Simple)
- Database & ORM
- Test framework

For existing projects, Vanguard auto-detects your stack from `package.json`, `requirements.txt`, etc.

This creates a `.vanguard/` directory with project config, constitution, templates, and memory storage.

## Commands

### Core

| Command | Description |
|---------|-------------|
| `vanguard init` | Initialize a new Vanguard project (interactive setup) |
| `vanguard status` | Project dashboard — config, artifact counts, task progress |

### Development Workflow

| Command | Description |
|---------|-------------|
| `vanguard spec create` | Create a feature specification (title, overview, user story, priority) |
| `vanguard spec list` | List all specs with status and priority |
| `vanguard plan create` | Create an implementation plan linked to a spec |
| `vanguard plan list` | List all plans with status |
| `vanguard task create` | Create a task linked to a plan (auto-sequenced) |
| `vanguard task list` | List tasks with status icons (filterable: `-s todo`, `-s done`) |
| `vanguard task start [seq]` | Mark task in-progress and create a git branch (`feature/task-NNN-slug`) |
| `vanguard task done [seq]` | Mark task as done |
| `vanguard task review [seq]` | Mark task as in-review |
| `vanguard memory add` | Save project knowledge (patterns, decisions, architecture) |
| `vanguard memory list` | List memory items (filterable: `-d patterns`, `-c high`) |
| `vanguard memory search <query>` | Search across all memory items |

### Claude Code Integration

| Command | Description |
|---------|-------------|
| `vanguard agents generate` | Generate 6 Claude Code agent personas (Analyst, PM, Architect, Scrum Master, Dev, QA) with slash commands, rules, and `CLAUDE.md` |
| `vanguard agents list` | List generated agents |
| `vanguard mcp add` | Configure MCP servers (HTTP, stdio, or vanguard-memory preset) |
| `vanguard mcp list` | List configured MCP servers |
| `vanguard mcp status` | Check MCP server connectivity |
| `vanguard mcp remove <name>` | Remove an MCP server |
| `vanguard hooks install` | Install Claude Code hooks (pre-task, post-task, session-start) |
| `vanguard hooks list` | List installed hooks |
| `vanguard hooks remove` | Remove all hooks |

### Integrations

| Command | Description |
|---------|-------------|
| `vanguard integrations add` | Connect a PM tool (Jira supported; ClickUp, Linear, GitHub Issues coming soon) |
| `vanguard integrations list` | List configured integrations |
| `vanguard integrations tasks` | Fetch issues from connected PM tool |
| `vanguard integrations sync` | Sync PM issues into `.vanguard/tasks/` as markdown |
| `vanguard integrations remove <name>` | Remove an integration |

### Sync & Maintenance

| Command | Description |
|---------|-------------|
| `vanguard pull` | Verify local setup after cloning (checks agents, MCP, constitution) |
| `vanguard refresh` | Regenerate all derived artifacts from current config (`--dry-run` to preview) |

## Project Structure

After `vanguard init`, your project gets:

```
your-project/
├── .vanguard/
│   ├── config.yaml          # Project configuration (stack, arch, db)
│   ├── constitution.md      # Project principles and conventions
│   ├── specs/               # Feature specifications
│   ├── plans/               # Implementation plans
│   ├── tasks/               # Task tracking
│   ├── templates/           # Spec, plan, task templates
│   ├── memory/              # Project knowledge base
│   │   ├── config.yaml
│   │   └── items/
│   │       ├── patterns/
│   │       └── decisions/
│   ├── workflows/
│   ├── integrations/        # PM tool configs
│   └── reviews/
└── vanguard.manifest.yaml   # Project manifest
```

After `vanguard agents generate`:

```
your-project/
├── .claude/
│   ├── agents/              # 6 agent personas
│   ├── commands/            # 6 slash commands
│   ├── rules/               # Project rules
│   ├── hooks/               # Automation hooks (after hooks install)
│   └── settings.json
└── CLAUDE.md                # Claude Code project instructions
```

## Typical Workflow

```bash
# 1. Initialize in any project
vanguard init

# 2. Generate Claude Code agents
vanguard agents generate

# 3. Write a feature spec
vanguard spec create

# 4. Plan the implementation
vanguard plan create

# 5. Break into tasks
vanguard task create

# 6. Start working (creates git branch)
vanguard task start 1

# 7. Mark done when finished
vanguard task done 1

# 8. Save learnings
vanguard memory add
```

## Using on a New Machine

```bash
# Install the CLI
npm install -g @samidzafar/vanguard-cli

# Clone your project
git clone https://github.com/your-org/your-project.git
cd your-project

# Verify and restore Vanguard setup
vanguard pull

# You're ready to go
vanguard status
```

## Supported Stacks

| Language | Frameworks |
|----------|-----------|
| TypeScript | Next.js (App Router / Pages), NestJS, Express, React + Vite |
| Python | FastAPI, Django, Flask |
| C# | ASP.NET Web API, ASP.NET MVC |
| Go | Chi, Gin |
| Rust | Actix Web, Axum |
| Java | Spring Boot |

## Requirements

- Node.js >= 20.0.0
- Git (for `task start` branch creation)
- Claude Code (for agents, MCP, and hooks features)

## License

Private

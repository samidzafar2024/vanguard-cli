---
description: "Add new stacks, architectures, or modules to Vanguard"
---

# Vanguard: Extend Phase

**Project**: vanguard-cli
**Agent**: module-architect (`.vanguard/agents/module-architect.md`)

## Extension Phase

Load the Module Architect Agent persona from `.vanguard/agents/module-architect.md`.

### Your Task

Extend Vanguard with new capabilities.

#### Adding a New Stack

1. Create stack definition in `stacks/[stack-name].yaml`
2. Include:
   - Layer configurations
   - Compatible ORMs
   - Compatible auth strategies
   - File structure conventions
   - Few-shot code examples

#### Adding a New Architecture

1. Create architecture definition in `architectures/[arch-name].yaml`
2. Include:
   - Core principles
   - Layer definitions with rules
   - Anti-patterns to avoid
   - Stack-specific implementations
   - Few-shot examples per stack

#### Adding a New Module

1. Create module definition
2. Define compatibility constraints
3. Provide example implementations

### Output

New module files with complete documentation and examples.

---

## Arguments

$ARGUMENTS

---

_Vanguard Extend command for Plain TypeScript + Domain-Driven Design_

# Memory at Phase Boundaries

At the end of each Vanguard phase, store knowledge that would otherwise be lost. Use the Memory Protocol in CLAUDE.md for the specific tool calls.

## Phase-Boundary Triggers

| Phase | Agent | What to Store |
|-------|-------|---------------|
| `/vanguard.architect` | Architect | **Decision**: architectural choices with rationale; **Requirement**: non-functional requirements |
| `/vanguard.discover` | Analyst | **Context**: discoveries, risks, unknowns found during exploration |
| `/vanguard.implement` | Developer | **Pattern**: reusable patterns discovered; **Solution**: non-obvious bug fixes |
| `/vanguard.plan` | SM | **Context**: task breakdown linkage and sequencing rationale |
| `/vanguard.review` | QA | **Pattern**: quality checks that should be standard; **Solution**: defect patterns found |
| `/vanguard.specify` | PM | **Requirement**: MUST-HAVE requirements identified; **Decision**: scope choices made |

## When to Trigger

- Before the phase's output document is finalized
- When the session is wrapping up after significant phase work
- When you've made decisions or discoveries that a future session would benefit from

## What NOT to Store at Boundaries

- Routine progress updates (the output document captures this)
- Content that's already in the spec, plan, or task file
- Implementation details that belong in code comments

---
description: "Implement a Vanguard task following project conventions"
---

# WayPoint: Implement Action

**Project**: vanguard-security

## Before You Begin

1. **Read the manifest** at `vanguard-security/waypoint.manifest.yaml`
2. **Read the task file** at `.waypoint/tasks/{feature}/task-NNN.md`
3. **Read `vanguard-security/CLAUDE.md`** — architecture patterns, code style, adding new agents

## Implementation Steps

1. **Read the task file** — understand exactly what to build and acceptance criteria
2. **Read relevant source files** — understand existing patterns before writing new code
3. **Follow Vanguard architecture**:
   - Business logic → `apps/worker/src/services/{name}.ts`
   - Activities are thin wrappers → `apps/worker/src/temporal/activities.ts`
   - No Temporal imports in services
   - Use `Result<T,E>` for fallible operations, not throw
   - Use `ActivityLogger`, not `console.log`
4. **Write the implementation**
5. **Verify acceptance criteria**:
   ```bash
   cd vanguard-security
   pnpm run check
   pnpm biome
   ```
6. **Create git branch** — `git checkout -b task/{issue-number}-{short-description}`
7. **Commit** — conventional commit format

## Adding a New Agent (Checklist)

```
[ ] Create prompt: apps/worker/prompts/{agent-name}.txt
    - Include <brain_hints> block (reads shared/_brain-hints.txt)
    - Include <findings_output> block (reads shared/_finding-output.txt)
    - End with "EMIT FINDINGS JSON (MANDATORY)" step

[ ] Register agent: apps/worker/src/session-manager.ts
    - Add to AGENTS record with name + deliverableFilename

[ ] Add to type union: apps/worker/src/types/agents.ts
    - Add to AgentName union type

[ ] Add activity: apps/worker/src/temporal/activities.ts
    - Thin wrapper: heartbeat loop + error classification only

[ ] Wire into workflow: apps/worker/src/temporal/workflows.ts
    - Add to correct phase (pre-recon / recon / vuln / exploit / report)
```

## Code Style (from CLAUDE.md)

- Single quotes, semicolons, 2-space indent, 120 char line width
- `function` keyword for top-level (not arrow functions)
- Explicit return types on exported functions
- `exactOptionalPropertyTypes` — use spread for optional props
- No nested ternaries — use if/else or switch
- No comments that explain WHAT — only WHY (hidden constraints, workarounds)
- No `console.log` in services — use `ActivityLogger`

## After Completion

1. Run `/review` in IDE (reads `vanguard-security/.claude/commands/review.md`)
2. Create PR with `/pr` command
3. Update `vanguard-security/waypoint.manifest.yaml` — set task to `in-review`
4. Close GitHub Issue when PR merges

---

## Arguments

$ARGUMENTS

---

_WayPoint Implement command for Vanguard Security — TypeScript + Temporal + Claude Agent SDK_

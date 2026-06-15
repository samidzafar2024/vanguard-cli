---
description: "Execute all tasks for a spec/plan in parallel waves using developer agents"
---

# WayPoint: Team Execute

**Project**: bonuscompplatform

## Overview

Orchestrates parallel execution of all tasks for a spec/plan by spawning `waypoint-dev` subagents in dependency waves. Independent tasks run simultaneously; dependent tasks wait for prerequisites.

Each subagent gets a fresh context window with the developer persona as its system prompt (defined in `.claude/agents/waypoint-dev.md`). Agents write to non-overlapping files — no worktrees, no branches to merge.

## Arguments

$ARGUMENTS

Parse the argument for:
- **Feature name** (required): e.g., `ux-overhaul`, `compensation-data-model`
- **`--wave N`** (optional): Resume from wave N
- **`--dry-run`** (optional): Show execution plan without running

## Execution Protocol

### Step 1: Load Context

1. Read `waypoint.manifest.yaml`
2. Identify the spec/plan matching the feature name argument
3. Read ALL task files from `.waypoint/tasks/{feature}/`
4. For each task, extract: status, depends, Files to Modify table, summary

### Step 2: Build Dependency Graph & Validate File Ownership

**Build the DAG:**
- Skip tasks with status `done`
- For each remaining task, parse `depends` from the task header

**Compute waves:**
```
wave 0: tasks with no dependencies (or all deps already done)
wave 1: tasks whose deps are all in wave 0 or done
wave 2: tasks whose deps are all in wave 0, wave 1, or done
... continue until all tasks assigned
```

**File overlap check:** For each wave, verify no two tasks modify the same file. If overlap detected:
- Move the overlapping task to the next wave
- Warn the user about the adjustment

### Step 3: Display Execution Plan

Show the user:

```
## Execution Plan: {feature}

### Wave 1 ({n} parallel agents)
- [ ] task-001: {summary}  →  files: a.ts, b.ts
- [ ] task-002: {summary}  →  files: c.ts, d.ts

### Wave 2 ({n} parallel agents, after wave 1)
- [ ] task-004: {summary}  →  files: e.ts [depends: task-001]

Skipped (done): task-006, task-007
Total: {n} tasks in {w} waves
```

If `--dry-run`, stop here. Otherwise, ask the user to confirm.

### Step 4: Execute Waves

For each wave, in order:

#### 4a. Spawn Parallel Subagents

For each task in the wave, spawn an Agent:

```
Agent(
  subagent_type: "waypoint-dev",
  run_in_background: true,
  prompt: "
    ## Task Assignment

    Implement: .waypoint/tasks/{feature}/{task-file}.md

    Context files:
    - Plan: .waypoint/plans/{feature}.md
    - Spec: .waypoint/specs/{feature}.md

    Your owned files (from task's Files to Modify):
    - {file1}
    - {file2}
    - ...

    Read your task file first, then implement following your system prompt instructions.
  "
)
```

Key points:
- `subagent_type: "waypoint-dev"` loads the dev persona as the agent's system prompt
- `run_in_background: true` on ALL agents in the wave (parallel execution)
- The prompt is minimal — just the task path, context paths, and owned files
- The agent's system prompt (from `.claude/agents/waypoint-dev.md`) handles all architecture rules, conventions, and protocols
- Maximum **5 agents per wave** — split larger waves into sub-waves of 5

#### 4b. Wait for Wave Completion

All agents run in background. You'll be notified as each completes. Wait for ALL agents in the wave before proceeding.

#### 4c. Post-Wave Integration

After all agents complete:

1. **Wire cross-task exports**: Add barrel exports or cross-references that span task boundaries
2. **Verify**:
   ```bash
   npx tsc --noEmit
   npx vitest run
   ```
3. **Fix integration issues**: Cross-task wiring problems (missing imports, type mismatches) are expected — fix them
4. **Commit the wave**:
   ```bash
   git add -A
   git commit -m "Wave {n}: {summary of completed tasks}"
   ```

#### 4d. Update Status

- Update completed task statuses to `done` in `waypoint.manifest.yaml`
- Mark blocked tasks as `blocked`

#### 4e. Next Wave

Repeat from 4a with the next wave.

### Step 5: Summary

After all waves:

```
## Execution Complete: {feature}

### Results
- Waves executed: {w}/{total}
- Tasks completed: {n}/{total}
- Tasks blocked: {list}

### Next Steps
- Review changes: git diff main...HEAD
- Run full test suite: npx vitest run
- Create PR: /waypoint.pr
```

## Error Handling

| Scenario | Action |
|----------|--------|
| Agent failure | Mark task `blocked`, continue with remaining agents in wave |
| File ownership violation | Revert unauthorized changes before committing |
| tsc/test failure after wave | Attempt auto-fix; if unfixable, ask user to continue or stop |
| All agents in wave fail | Stop execution, show summary of what succeeded |

---

_WayPoint Team Execute — parallel task execution with waypoint-dev subagents_

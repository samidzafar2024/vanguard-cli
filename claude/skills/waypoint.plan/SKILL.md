---
description: "Break down a Vanguard technical plan into executable tasks"
---

# WayPoint: Plan Action

**Project**: vanguard-security

## Before You Begin

1. **Read the manifest** at `vanguard-security/waypoint.manifest.yaml` to understand:
   - Current project state and active documents
   - What specs, plans, and tasks exist
   - Document summaries for quick context

2. **Check document status** in the manifest:
   - `specs`: Feature specifications
   - `plans`: Technical designs
   - `tasks`: Implementation tasks with status

3. **Check for in-progress workflows** in the manifest under `workflows.active`
   - If resuming, continue from the current step
   - If starting fresh, begin at Step 1

## Workflow: Step-by-Step

### Step Overview

   1. **Review Plan** - Read technical plan, understand scope and dependencies
   2. **Identify Tasks** - Break plan into atomic tasks (one session = one task)
   3. **Sequence Tasks** - Order tasks respecting dependencies
   4. **Write Task Files** - Create detailed, self-contained task files

### Task Sizing Rules (Vanguard-specific)

- **One session = one task** — if it takes more than one Claude Code session, split it
- **One file change cluster** — a task touches one service, or one agent, or one prompt set
- **Independent where possible** — tasks should be startable without waiting for others except declared dependencies
- **Has acceptance criteria** — TypeScript compiles, pipeline-testing passes, deliverable created

### Task File Format

Each task file in `.waypoint/tasks/{feature}/task-NNN.md`:

```markdown
# Task NNN: {title}

**Phase**: Phase {1|2|3|4}
**Depends on**: Task NNN (or none)
**Estimated**: 1 session
**Label**: phase{1|2|3|4}, {agent|brain|opsec|workflow|prompt}

## What to build

{clear description}

## Files to change

- `apps/worker/src/services/{name}.ts` — create
- `apps/worker/src/temporal/activities.ts` — add activity
- `apps/worker/src/temporal/workflows.ts` — wire into phase N

## Acceptance Criteria

- [ ] TypeScript compiles (`pnpm run check`)
- [ ] Pipeline-testing passes (`./vanguard start -u <url> -r repo --pipeline-testing`)
- [ ] Deliverable file created in `deliverables/`
- [ ] No console.log in services (use ActivityLogger)
- [ ] Result<T,E> used for all fallible operations

## Notes

{architecture decisions, gotchas, references to research docs}
```

### Checkpoints

- **Step 1**: Do I understand what needs to be built and in what order?
- **Step 2**: Is each task small enough to complete in one session?
- **Step 3**: Can each task be started once its dependencies are done?
- **Step 4**: Can a developer pick up any task and know exactly what to do?

### Entry Conditions

- Approved technical plan from `/waypoint.architect`

### Final Outputs

- `vanguard-security/.waypoint/tasks/{feature}/task-*.md`

## After Completion

Update `vanguard-security/waypoint.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_WayPoint Plan command for Vanguard Security — TypeScript + Temporal + Claude Agent SDK_

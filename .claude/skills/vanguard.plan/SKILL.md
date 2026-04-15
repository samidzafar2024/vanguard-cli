---
description: "Break down a plan into executable tasks"
---

# Vanguard: Plan Action

**Project**: vanguard-cli

## Before You Begin

1. **Read the manifest** at `vanguard.manifest.yaml` to understand:
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

This action uses a **step-file workflow** for better control and checkpointing.

**Flow file**: `.vanguard/workflows/plan/_flow.yaml`
**Steps**: 4

### Step Overview

   1. **Review Plan** - Understand implementation scope and dependencies
   2. **Identify Tasks** - Break plan into atomic, completable tasks
   3. **Sequence Tasks** - Order tasks respecting dependencies
   4. **Write Task Files** - Create detailed, self-contained task files

### How to Execute

**Option A: Follow steps interactively**
1. Read each step file in `.vanguard/workflows/plan/`
2. Complete the step's objective
3. Confirm the checkpoint before proceeding
4. Move to the next step

**Option B: Quick reference (experienced users)**
- Step 1: `.vanguard/workflows/plan/review-plan.md`
- Step 2: `.vanguard/workflows/plan/identify-tasks.md`
- Step 3: `.vanguard/workflows/plan/sequence-tasks.md`
- Step 4: `.vanguard/workflows/plan/write-tasks.md`

### Checkpoints

Each step has a checkpoint question. Only proceed when you can answer "yes":

- **Step 1**: Do I understand what needs to be built and in what order?
- **Step 2**: Is each task small enough to complete in one session?
- **Step 3**: Can each task be started once its dependencies are done?
- **Step 4**: Can a developer pick up any task and know exactly what to do?

### Entry Conditions

- Approved technical plan from /vanguard.architect

### Final Outputs

- .vanguard/tasks/{feature}/task-*.md

Load the **Scrum Master Agent** from `.claude/agents/sm.md`.

Break down the technical plan into tasks:
1. Review the architecture plan
2. Identify atomic, completable tasks
3. Sequence tasks respecting dependencies
4. Write detailed task files with acceptance criteria

Output to `.vanguard/tasks/{feature}/task-*.md`.

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Plan command for unknown stack + MVC with Interactors_

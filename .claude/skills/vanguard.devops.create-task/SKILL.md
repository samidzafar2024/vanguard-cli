---
description: "Create a Task work item in Azure DevOps under a parent User Story for hour tracking, with proper parent linkage."
---

# Vanguard: Create Task Action

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


## Usage

Create a Task under a User Story for hour tracking.

## Usage
`/devops.create-task --story US-057 --title "Task description"`

## CLI Pattern
```bash
# Step 1: Create the task
az boards work-item create --type Task \
  --title "{title}" \
  --iteration "Ignite\Iteration 6" \
  --area "Ignite\Commissions" \
  --org https://dev.azure.com/Meriton365 --project Ignite

# Step 2: Link parent (REQUIRED)
az boards work-item relation add --id {new_task_id} --relation-type parent --target-id {story_devops_id} \
  --org https://dev.azure.com/Meriton365 --project Ignite
```

## Rules
- Tasks are for hour tracking only — they live in DevOps, not in docs/
- Cross-reference Vanguard task files where applicable
- Always link to parent story after creation

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Create Task command for unknown stack + MVC with Interactors_

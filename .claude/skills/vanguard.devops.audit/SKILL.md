---
description: "Audit Azure DevOps work items under Ignite\Commissions for staleness, orphaned stories, ID gaps, and items stuck in wrong iterations."
---

# Vanguard: Audit Work Items Action

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

Audit all work items under Ignite\Commissions for issues.

## Usage
`/devops.audit`

## Checks
1. **Stale items**: Items in "New" or "Active" state in past iterations
2. **Orphaned stories**: User Stories without a parent Feature link
3. **ID gaps**: Missing IDs in EPIC/FT/US sequences
4. **State inconsistency**: Features marked Closed but with open child stories
5. **Unassigned items**: Items in "Ignite" backlog that should be in a sprint

## CLI Pattern
```bash
# Query all items under area path
az boards query --wiql "SELECT [System.Id], [System.Title], [System.State], [System.IterationPath], [System.WorkItemType] FROM workitems WHERE [System.AreaPath] UNDER 'Ignite\Commissions' ORDER BY [System.Id]" --org https://dev.azure.com/Meriton365 --project Ignite
```

## Output
Grouped report by issue type with recommended actions.

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Audit Work Items command for unknown stack + MVC with Interactors_

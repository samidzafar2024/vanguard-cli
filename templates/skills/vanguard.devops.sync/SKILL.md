---
description: "Read devops-sync.yaml, query Azure DevOps for current work item states, and report any drift between local tracking and actual DevOps state."
---

# Vanguard: Sync Status Action

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

Check sync state between local devops-sync.yaml and Azure DevOps.

## Usage
`/devops.sync`

## Steps
1. Read `.vanguard/devops-sync.yaml` for tracked items and lastSync timestamp
2. Query Azure DevOps for current state of all tracked items:
   ```bash
   az boards work-item show --id {ID} --fields "System.State,System.IterationPath" --org https://dev.azure.com/Meriton365 --project Ignite
   ```
3. Compare local expected state vs actual DevOps state
4. Report drift: items that changed state, moved iterations, or were modified externally
5. Update lastSync timestamp in devops-sync.yaml

## Output
Table showing: ID | Title | Expected State | Actual State | Drift?

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Sync Status command for unknown stack + Agent + Tools + Gateway_

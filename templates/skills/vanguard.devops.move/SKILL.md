---
description: "Move Azure DevOps work items to a target sprint iteration. Optionally activates items (transitions from New to Active)."
---

# Vanguard: Move to Sprint Action

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

Move work items to a target iteration and optionally activate them.

## Usage
`/devops.move --iteration 6 --activate <id1> <id2> ...`

## CLI Pattern
```bash
# Move and activate
az boards work-item update --id {ID} --state Active --iteration "Ignite\Iteration {N}" --org https://dev.azure.com/Meriton365 --project Ignite

# Move only (keep current state)
az boards work-item update --id {ID} --iteration "Ignite\Iteration {N}" --org https://dev.azure.com/Meriton365 --project Ignite
```

## Sprint Iterations
- Iteration 6: Mar 9 – Apr 3, 2026 (current)
- Use "Ignite\Iteration {N}" format for the --iteration flag

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Move to Sprint command for unknown stack + Agent + Tools + Gateway_

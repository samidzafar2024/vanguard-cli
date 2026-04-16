---
description: "Create a User Story in Azure DevOps under a parent Feature, with Gherkin acceptance criteria and proper parent linkage."
---

# Vanguard: Create Story Action

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

Create a User Story under a Feature with Gherkin acceptance criteria.

## Usage
`/devops.create-story --feature FT-013 --title "Story title" --priority P0`

## CLI Pattern
```bash
# Step 1: Create the story
az boards work-item create --type "User Story" \
  --title "US-{NNN}: {title}" \
  --iteration "Ignite\Iteration 6" \
  --area "Ignite\Commissions" \
  --fields "Microsoft.VSTS.Common.Priority={1|2|3}" \
  --org https://dev.azure.com/Meriton365 --project Ignite

# Step 2: Link parent (REQUIRED — create does NOT support --parent)
az boards work-item relation add --id {new_story_id} --relation-type parent --target-id {feature_devops_id} \
  --org https://dev.azure.com/Meriton365 --project Ignite
```

## Rules
- Next available story ID: US-075 (check devops-sync.yaml for current max)
- Description must be HTML format: <p>, <h4>, <ol>, <li> tags
- Acceptance criteria must use Gherkin: Given/When/Then
- Priority mapping: P0→1, P1→2, P2→3
- Always update devops-sync.yaml with new story ID and devopsId
- Always update docs/user_stories/ markdown files

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Create Story command for unknown stack + Agent + Tools + Gateway_

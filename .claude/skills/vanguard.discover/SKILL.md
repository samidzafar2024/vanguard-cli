---
description: "Analyze existing codebase or explore problem space"
---

# Vanguard: Discover Action

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

**Flow file**: `.vanguard/workflows/discover/_flow.yaml`
**Steps**: 4

### Step Overview

   1. **Understand Context** - Understand scope and goals of the discovery session
   2. **Explore Landscape** - Build a mental map of the territory being explored
   3. **Identify Risks** - Uncover potential problems before they become blockers
   4. **Document Findings** - Compile discovery into an actionable document

### How to Execute

**Option A: Follow steps interactively**
1. Read each step file in `.vanguard/workflows/discover/`
2. Complete the step's objective
3. Confirm the checkpoint before proceeding
4. Move to the next step

**Option B: Quick reference (experienced users)**
- Step 1: `.vanguard/workflows/discover/understand-context.md`
- Step 2: `.vanguard/workflows/discover/explore-landscape.md`
- Step 3: `.vanguard/workflows/discover/identify-risks.md`
- Step 4: `.vanguard/workflows/discover/document-findings.md`

### Checkpoints

Each step has a checkpoint question. Only proceed when you can answer "yes":

- **Step 1**: Do I understand what we are trying to discover?
- **Step 2**: Do I have a high-level map of the territory?
- **Step 3**: Have I surfaced key risks and constraints?
- **Step 4**: Does this give a clear picture and actionable next steps?

### Entry Conditions

- New project or feature area to explore

### Final Outputs

- .vanguard/specs/discovery.md

Load the **Analyst Agent** from `.claude/agents/analyst.md`.

If the project appears to be brownfield (existing codebase):
- Analyze the architecture, patterns, and tech debt
- Map domain boundaries and dependencies
- Identify risks and constraints

If greenfield (new project):
- Explore the problem space
- Identify constraints and assumptions
- Research similar solutions

Output discovery findings to `.vanguard/specs/discovery.md`.

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Discover command for unknown stack + MVC with Interactors_

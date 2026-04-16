---
description: "Create a specification document for a feature"
---

# Vanguard: Specify Action

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

**Flow file**: `.vanguard/workflows/specify/_flow.yaml`
**Steps**: 7

### Step Overview

   1. **Gather Context** - Understand feature scope, target users, and business value
   2. **Define Personas** - Create user personas that guide requirement decisions
   3. **User Scenarios** - Create concrete scenarios showing user interactions
   4. **Functional Requirements** - Create prioritized list of functional requirements
   5. **Non-Functional Requirements** - Identify performance, security, and quality requirements
   6. **Finalize Specification** - Compile everything into the final specification document
   7. **Compliance Review** - Review specification for compliance and security requirements

### How to Execute

**Option A: Follow steps interactively**
1. Read each step file in `.vanguard/workflows/specify/`
2. Complete the step's objective
3. Confirm the checkpoint before proceeding
4. Move to the next step

**Option B: Quick reference (experienced users)**
- Step 1: `.vanguard/workflows/specify/gather-context.md`
- Step 2: `.vanguard/workflows/specify/define-personas.md`
- Step 3: `.vanguard/workflows/specify/user-scenarios.md`
- Step 4: `.vanguard/workflows/specify/functional-requirements.md`
- Step 5: `.vanguard/workflows/specify/non-functional-requirements.md`
- Step 6: `.vanguard/workflows/specify/finalize-spec.md`
- Step 7: `.vanguard/workflows/specify/compliance-review.md`

### Checkpoints

Each step has a checkpoint question. Only proceed when you can answer "yes":

- **Step 1**: Do I understand what we are building and why?
- **Step 2**: Are personas realistic? Do they cover all user types?
- **Step 3**: Do scenarios cover main use cases? Any gaps?
- **Step 4**: Does each requirement trace back to a user scenario?
- **Step 5**: Are quality attributes measurable?
- **Step 6**: Is spec complete? Ready for architecture phase?
- **Step 7**: Have all compliance requirements been addressed?

### Entry Conditions

- Feature request or idea from user
- Optional discovery document

### Final Outputs

- .vanguard/specs/{feature}.md

Load the **Product Manager Agent** from `.claude/agents/pm.md`.

Create a feature specification:
1. Gather context and understand scope
2. Define user personas and scenarios
3. Write functional requirements (must/should/could)
4. Identify non-functional requirements
5. Document open questions and out-of-scope items

Output to `.vanguard/specs/{feature}.md`.

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Specify command for unknown stack + Agent + Tools + Gateway_

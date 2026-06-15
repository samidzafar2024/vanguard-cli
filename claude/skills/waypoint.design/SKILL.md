---
description: "Create UX/UI design from a specification"
---

# WayPoint: Design Action

**Project**: bonuscompplatform

## Before You Begin

1. **Read the manifest** at `waypoint.manifest.yaml` to understand:
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

**Flow file**: `.waypoint/workflows/design/_flow.yaml`
**Steps**: 7

### Step Overview

   1. **Understand Users** - Understand emotional user needs, not just functional
   2. **Define Experience Principles** - Define 3-5 experience principles that guide all design decisions
   3. **Map User Journeys** - Create Mermaid journey diagrams for key user interactions
   4. **Visual Foundation** - Establish color, typography, and spacing philosophy
   5. **Component Strategy** - Plan reusable component library approach
   6. **Accessibility Audit** - Ensure WCAG 2.1 AA compliance by design
   7. **Finalize Frontend Spec** - Compile into complete frontend specification document

### How to Execute

**Option A: Follow steps interactively**
1. Read each step file in `.waypoint/workflows/design/`
2. Complete the step's objective
3. Confirm the checkpoint before proceeding
4. Move to the next step

**Option B: Quick reference (experienced users)**
- Step 1: `.waypoint/workflows/design/understand-users.md`
- Step 2: `.waypoint/workflows/design/define-experience.md`
- Step 3: `.waypoint/workflows/design/map-user-journeys.md`
- Step 4: `.waypoint/workflows/design/visual-foundation.md`
- Step 5: `.waypoint/workflows/design/component-strategy.md`
- Step 6: `.waypoint/workflows/design/accessibility-audit.md`
- Step 7: `.waypoint/workflows/design/finalize-frontend-spec.md`

### Checkpoints

Each step has a checkpoint question. Only proceed when you can answer "yes":

- **Step 1**: Do I understand how users should FEEL using this?
- **Step 2**: Do principles capture the essence of the desired experience?
- **Step 3**: Do journeys cover all key interactions?
- **Step 4**: Does visual foundation support experience principles?
- **Step 5**: Are components reusable across the application?
- **Step 6**: Does every interaction meet WCAG 2.1 AA?
- **Step 7**: Is the frontend spec complete and actionable?

### Entry Conditions

- Approved specification from /waypoint.specify
- User personas and scenarios defined

### Final Outputs

- .waypoint/specs/{feature}-frontend-spec.md

Load the **UX Designer Agent** from `.claude/agents/ux.md`.

Facilitate design discovery:
1. Understand emotional user needs (not just functional)
2. Define 3-5 experience principles
3. Create Mermaid user journey diagrams
4. Establish visual foundation (color, typography, spacing)
5. Plan reusable component strategy
6. Ensure WCAG 2.1 AA accessibility from the start

Output to `.waypoint/specs/{feature}-frontend-spec.md`.

## After Completion

Update `waypoint.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_WayPoint Design command for unknown stack + MVC with Interactors_

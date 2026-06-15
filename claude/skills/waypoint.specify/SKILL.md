---
description: "Create a specification document for a Vanguard feature or phase"
---

# WayPoint: Specify Action

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

   1. **Gather Context** - Understand what we're building and why (reference research docs in `docs/research/`)
   2. **Define Users** - Who uses this? (security researchers, red teamers, enterprise customers)
   3. **Security Scenarios** - What attack flows does this enable or protect?
   4. **Functional Requirements** - Must/should/could requirements with acceptance criteria
   5. **Non-Functional Requirements** - OPSEC constraints, token budget, latency, legal/ethical limits
   6. **Finalize Specification** - Compile into spec document

### Checkpoints

- **Step 1**: Do I understand what we are building and why?
- **Step 2**: Are user types realistic? (solo researcher, enterprise pentest team, bug bounty hunter)
- **Step 3**: Do scenarios cover main attack/defense flows? Any gaps?
- **Step 4**: Does each requirement trace back to a research doc or user scenario?
- **Step 5**: Are OPSEC and ethical constraints explicitly stated?
- **Step 6**: Is spec complete? Ready for architecture phase?

### Entry Conditions

- Feature request, research doc reference, or phase from `docs/research/99-architectural-review.md`
- Optional: reference to specific research doc (e.g. `docs/research/02-opsec-industry-standards.md`)

### Final Outputs

- `vanguard-security/.waypoint/specs/{feature}.md`

## How to Execute

1. Read research docs relevant to the feature from `vanguard-security/docs/research/`
2. Read `vanguard-security/CLAUDE.md` for architecture patterns
3. Write spec to `vanguard-security/.waypoint/specs/{feature}.md`
4. Update `vanguard-security/waypoint.manifest.yaml`

## After Completion

Update `vanguard-security/waypoint.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_WayPoint Specify command for Vanguard Security — TypeScript + Temporal + Claude Agent SDK_

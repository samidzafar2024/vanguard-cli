---
description: "Create a technical plan for a Vanguard specification"
---

# WayPoint: Architect Action

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

   1. **Review Specification** - Read spec from `.waypoint/specs/` and research docs
   2. **Design Components** - Break feature into components following Vanguard architecture:
      - CLI layer (`apps/cli/src/`)
      - Worker services (`apps/worker/src/services/`)
      - Temporal activities (`apps/worker/src/temporal/activities.ts`)
      - Temporal workflow (`apps/worker/src/temporal/workflows.ts`)
      - Prompts (`apps/worker/prompts/`)
      - Brain scripts (`apps/worker/dist/scripts/`)
   3. **Define Data Models** - TypeScript interfaces, `Result<T,E>`, graph node schemas
   4. **Define APIs** - Service interfaces, activity signatures, agent prompt contracts
   5. **Finalize Plan** - Compile architecture decisions into technical plan

### Architecture Pattern (Vanguard)

```
New feature flow:
1. Prompt template → apps/worker/prompts/{agent-name}.txt
2. Agent definition → apps/worker/src/session-manager.ts (AGENTS record)
3. Activity wrapper → apps/worker/src/temporal/activities.ts (heartbeat + error classification)
4. Service logic → apps/worker/src/services/{feature}.ts (Result<T,E>, ActivityLogger)
5. Workflow wire-up → apps/worker/src/temporal/workflows.ts (correct phase)
6. Types → apps/worker/src/types/agents.ts (AgentName union)
```

### Checkpoints

- **Step 1**: Do I understand the technical implications of each requirement?
- **Step 2**: Do components follow Vanguard's layered architecture (services ≠ activities)?
- **Step 3**: Are TypeScript interfaces complete? `Result<T,E>` used for fallible ops?
- **Step 4**: Are agent prompt contracts clean? Brain hints included?
- **Step 5**: Is the plan complete enough for task breakdown?

### Entry Conditions

- Approved specification from `/waypoint.specify`

### Final Outputs

- `vanguard-security/.waypoint/plans/{feature}.md`

## How to Execute

1. Read spec from `vanguard-security/.waypoint/specs/{feature}.md`
2. Read `vanguard-security/CLAUDE.md` for patterns (especially "Adding a New Agent" section)
3. Design components respecting the services-boundary pattern
4. Write plan to `vanguard-security/.waypoint/plans/{feature}.md`
5. Update `vanguard-security/waypoint.manifest.yaml`

## After Completion

Update `vanguard-security/waypoint.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_WayPoint Architect command for Vanguard Security — TypeScript + Temporal + Claude Agent SDK_

---
name: waypoint.plan-gaps
description: |
  Create implementation task files from UAT report gaps and issues. Use this skill whenever the user wants to:
  convert UAT findings into fix tasks, plan gap remediation from test results, create tasks from UAT issues,
  bridge UAT reports to the implement pipeline, generate bug-fix tasks from test failures, or turn test gaps
  into actionable work items. Trigger on phrases like "plan gaps", "fix gaps", "create tasks from UAT",
  "turn these issues into tasks", "plan fixes for UAT", "gaps to tasks", or when the user provides a
  .waypoint/uat/*.md file path and wants tasks created from it.
---

# WayPoint: Plan Gaps

**Project**: bonuscompplatform
**Purpose**: Convert UAT report issues into implementation task files compatible with `/waypoint.implement`

## What This Skill Does

Given a UAT report file (`.waypoint/uat/*.md`), this skill:
1. Reads the report and extracts all entries from the "Issues Found" section
2. Identifies the associated spec(s) and determines the target tasks folder
3. Explores the codebase to understand the root cause of each issue
4. Presents a summary table for user approval
5. Generates properly formatted task files in `.waypoint/tasks/{feature}/`
6. Updates `waypoint.manifest.yaml` with the new task entries

## Before You Begin

1. **Read the manifest** at `waypoint.manifest.yaml` to understand current project state
2. **Confirm the UAT report path** — the user must provide a `.waypoint/uat/*.md` file path as an argument
3. If no path is provided, list available UAT reports from `.waypoint/uat/` and ask the user to pick one

## Workflow

### Step 1: Parse the UAT Report

Read the UAT report file and extract:

- **Spec references** from the header (lines starting with `**Spec 1**:`, `**Spec 2**:`, etc.) — these determine which feature folder to target
- **All issues** from the `## Issues Found` section. Each issue follows this structure:
  ```
  ### Issue N: [Title] (Severity — Category)
  - **Scenario**: TS-NNN
  - **Severity**: Critical | Major | Minor
  - **Expected**: [what should happen]
  - **Actual**: [what actually happens]
  - **Impact**: [business impact]
  - **Recommendation**: [suggested fix approach]
  - **Status**: [new | gap persists from Run N]
  ```

Also read the referenced test scenario (TS-NNN) from earlier in the report for additional context about reproduction steps and the role/page involved.

### Step 2: Determine the Target Tasks Folder

Map the spec reference(s) to an existing tasks folder:

1. Read the spec file paths from the UAT header
2. Look up those specs in `waypoint.manifest.yaml` under `documents.specs`
3. Check if a corresponding tasks folder exists under `documents.tasks` with the same feature key
4. If a tasks folder exists, new tasks will be added there
5. If no tasks folder exists, create a new one. Derive the folder name from the spec filename (e.g., `compensation-dashboard-overview.md` becomes `compensation-dashboard-overview/`)

Find the highest existing task number in the target folder to determine where numbering should continue from.

### Step 3: Explore Root Causes

For each issue, investigate the codebase:

1. Read the **Recommendation** field from the issue — it often points to specific files or patterns
2. Search for the relevant source files (components, handlers, queries) mentioned in the test scenario
3. Identify the specific function, component, or logic that needs to change
4. Note the exact file paths and line numbers where changes are needed

This step is what makes the generated tasks actionable — rather than just restating the UAT issue, the task file will contain specific implementation guidance.

### Step 4: Present Summary for Approval

Display a table to the user and **wait for explicit approval** before creating any files:

```
| # | Issue | Severity | Proposed Task Name | Target File(s) | Effort |
|---|-------|----------|--------------------|----------------|--------|
| 1 | [title] | Minor | task-NNN-[slug] | path/to/file.tsx | Small |
| 2 | [title] | Minor | task-NNN-[slug] | path/to/file.ts  | Small |
```

Include:
- **Priority mapping**: Critical issue = P0, Major = P1, Minor = P2
- **Effort estimate**: Based on root cause complexity (Small < 2hrs, Medium 2-4hrs, Large 4+ hrs)
- **Task slug**: kebab-case derived from the issue title (e.g., `hide-approve-buttons-wrong-approver`)

Ask: "Does this look right? Want to add, remove, or reprioritize anything before I create the task files?"

### Step 5: Generate Task Files

For each approved issue, create a task file at `.waypoint/tasks/{feature}/task-{NNN}-{slug}.md` using this format:

```markdown
# Task NNN: [Task Name]

**Plan**: [path to plan if exists, or "N/A — UAT gap fix"]
**Spec**: [path to spec from UAT report header]
**UAT Report**: [path to UAT report file]
**UAT Issue**: Issue N — [title]
**UAT Scenario**: TS-NNN
**Phase**: Fix
**FR**: [FR references if applicable, or "N/A"]
**Depends**: none
**Estimated effort**: Small | Medium | Large

## Context

This task addresses a gap identified during UAT Run N.

- **UAT Report**: `[path to report]`
- **Issue**: #N — [title]
- **Severity**: [severity]
- **Original Scenario**: TS-NNN — [scenario name]

## Objective

[Clear 1-2 sentence description of what needs to change, derived from the Issue's Expected vs Actual]

## Acceptance Criteria

- [ ] [Derived from Expected behavior in the UAT issue]
- [ ] [Additional criteria based on root cause analysis]
- [ ] Existing tests continue to pass
- [ ] Re-run UAT scenario TS-NNN confirms the fix

## Files to Modify

- `[path/to/file.ts]` — [what to change and why]

## Implementation Notes

[Specific guidance based on the root cause exploration in Step 3. Include:
- The function/component that needs changing
- What the current behavior is and why
- The recommended fix approach
- Any patterns from the codebase to follow]

## Testing Requirements

- [ ] [Unit/integration test for the fix]
- [ ] Re-run UAT scenario TS-NNN to verify
```

The task file should be **self-contained** — a developer in a fresh context window should be able to read just this file and implement the fix without needing to read the full UAT report.

### Step 6: Update Manifest

Add new task entries to `waypoint.manifest.yaml` under `documents.tasks.{feature}`:

```yaml
- path: .waypoint/tasks/{feature}/task-{NNN}-{slug}.md
  status: pending
  summary: "[One-line description of the fix]"
  depends: []
  fr: []
```

## Reference

For the full task file format specification with examples from this project, read `references/task-format.md`.

## Arguments

The skill accepts a UAT report file path as its argument:
```
/waypoint.plan-gaps .waypoint/uat/comp-dashboard-lifecycle-2026-04-09-1600.md
```

If no argument is provided, list available UAT reports and ask the user to select one.

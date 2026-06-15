---
description: "Sync WayPoint specs and tasks to Azure DevOps as User Stories and Tasks"
---

# WayPoint: ADO Sync Phase

**Project**: bonuscompplatform

## Before You Begin

1. **Read the manifest** at `waypoint.manifest.yaml` to understand:
   - Current project state and active documents
   - What specs, plans, and tasks exist
   - Document summaries for quick context

2. **Check document status** in the manifest:
   - `specs`: Feature specifications to sync as User Stories
   - `tasks`: Implementation tasks to sync as ADO Tasks

3. **Verify Azure DevOps access**:
   - Run `az account show` to confirm login
   - Run `az devops configure --defaults organization=https://dev.azure.com/Meriton365 project="DevOps Projects and Support"` if not set

## Workflow: Step-by-Step

This phase syncs WayPoint specs and tasks to Azure DevOps work items.
Specs can be synced at any stage — even as drafts before architect/plan phases.
Re-syncing enriches the User Story with plan details as they become available.

### Step 1: Inventory WayPoint State

1. Read `waypoint.manifest.yaml` to get all specs and their associated tasks
2. For each spec, read the spec file header to check for existing `**Ticket**:` field
3. For each task, read the task file metadata to check for existing `**Ticket**:` field
4. Classify each item as **new** (no ticket) or **existing** (has ticket ID)
5. Check if a plan exists for the spec (to enrich description on re-sync)

### Step 2: Query ADO Features

1. Fetch all BCP-tagged Features:
   ```bash
   az boards query --wiql "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Feature' AND [System.Tags] CONTAINS 'BCP' AND [System.State] <> 'Closed'" --output json
   ```

2. Build a Feature map:
   ```
   #29393: Bonus Comp - Submission - Phase 2
   #29429: Bonus Comp - Tech Debt
   #29659: Bonus Comp - Ops & Infrastructure Phase 2
   #31137: Bonus Comp - Assignments Management
   #31195: Bonus Comp - Phase 2 - Misc Updates and Bug Fixes
   #31235: Bonus Comp - User Management
   ```

### Step 3: Match Specs to Features

For each spec, determine the best-fit Feature based on:
- Spec title, keywords, and domain area from the manifest
- Spec content (functional requirements, problem statement)
- Semantic similarity to Feature titles

**Matching heuristics:**
- Auth/identity/login/user specs → #31235 User Management
- Deployment/docker/infra/ops specs → #29659 Ops & Infrastructure Phase 2
- Submission/workflow specs → #29393 Submission - Phase 2
- Assignment specs → #31137 Assignments Management
- General fixes/improvements → #31195 Misc Updates and Bug Fixes
- Technical debt items → #29429 Tech Debt
- No match → Create new Feature: `Bonus Comp - {Category}`

### Step 4: Preview & Confirm

Display the full sync plan to the user:

```
═══════════════════════════════════════════════════
  ADO SYNC PREVIEW
═══════════════════════════════════════════════════

Spec: auth-resolution-hardening (status: draft)
  → Feature: #31235 "Bonus Comp - User Management"
  → CREATE User Story: "BCP - Auth - Auth Resolution Hardening"
  → Plan: exists ✓ (will enrich description)
  → Tasks:
    ├── CREATE Task: "BCP - Profile Sync Enhancement"
    ├── CREATE Task: "BCP - Shared Auth Resolver"
    ├── CREATE Task: "BCP - Refactor Call Sites"
    ├── CREATE Task: "BCP - Env Var Hardening"
    ├── CREATE Task: "BCP - Last Login and Warning Log"
    └── CREATE Task: "BCP - Unit Tests"

───────────────────────────────────────────────────
  Summary: 1 User Story + 6 Tasks to CREATE
═══════════════════════════════════════════════════
```

Note: Tasks are only synced if they exist. A spec can be synced before
the plan/task phase — the User Story is created with just spec content.

**Wait for explicit user confirmation before proceeding.**

### Step 5: Create Work Items

For each confirmed spec:

1. **Create the User Story**:
   ```bash
   az boards work-item create \
     --type "User Story" \
     --title "BCP - {Category} - {Spec Title}" \
     --area "DevOps Projects and Support\CoPointData" \
     --iteration "DevOps Projects and Support" \
     --fields "System.Tags=BCP" "Microsoft.VSTS.Common.AcceptanceCriteria={AC HTML from spec}" \
     --description "<div>{HTML description from spec, enriched with plan if available}</div>" \
     --output json
   ```

2. **Link Story to Feature**:
   ```bash
   az boards work-item relation add \
     --id {story-id} \
     --relation-type parent \
     --target-id {feature-id}
   ```

3. **Create each Task**:
   ```bash
   az boards work-item create \
     --type "Task" \
     --title "BCP - {Task Title}" \
     --area "DevOps Projects and Support\CoPointData" \
     --iteration "DevOps Projects and Support" \
     --fields "System.Tags=BCP" \
     --description "<div>{HTML description from task}</div>" \
     --output json
   ```

4. **Link Task to Story**:
   ```bash
   az boards work-item relation add \
     --id {task-id} \
     --relation-type parent \
     --target-id {story-id}
   ```

### Step 6: Write Back ADO IDs

After successful creation, update WayPoint files:

**Spec file** — add `**Ticket**:` to the header block:
```markdown
**Ticket**: #12345
```

**Task file** — add `**Ticket**:` to the metadata line:
```markdown
> **Ticket**: #12346
```

### Step 7: Report Results

Show a summary:
```
═══════════════════════════════════════════════════
  ADO SYNC COMPLETE
═══════════════════════════════════════════════════

  Created: 1 User Story, 6 Tasks
  Updated: 0 items
  Errors:  0

  User Story #12345: BCP - Auth - Auth Resolution Hardening
    → Feature #31235: Bonus Comp - User Management
    ├── Task #12346: BCP - Profile Sync Enhancement
    ├── Task #12347: BCP - Shared Auth Resolver
    ├── Task #12348: BCP - Refactor Call Sites
    ├── Task #12349: BCP - Env Var Hardening
    ├── Task #12350: BCP - Last Login and Warning Log
    └── Task #12351: BCP - Unit Tests

  WayPoint files updated with ticket IDs. ✓
═══════════════════════════════════════════════════
```

## ADO Defaults

| Field | Value |
|-------|-------|
| Organization | `Meriton365` |
| Project | `DevOps Projects and Support` |
| Area Path | `DevOps Projects and Support\CoPointData` |
| Iteration Path | `DevOps Projects and Support` |
| Tags | `BCP` |

## Work Item Type Mapping

| WayPoint | ADO Type | Title Format |
|----------|----------|-------------|
| Spec | User Story | `BCP - {Category} - {Spec Title}` |
| Task | Task | `BCP - {Task Title}` |

## Status Mapping

| WayPoint Status | ADO State |
|-----------------|-----------|
| `draft` / `pending` | `New` |
| `in-progress` | `Active` |
| `approved` / `complete` | `Resolved` |

## Description Templates

### User Story Description (HTML)

The description is built in layers. On initial sync only spec content is used.
On re-sync, plan details are appended if a plan exists.

**Initial sync (spec only):**

```html
<div>
  <h3>Problem Statement</h3>
  <p>{Spec overview / problem statement}</p>

  <h3>Success Metrics</h3>
  <ul>
    <li>{Metric 1}</li>
    <li>{Metric 2}</li>
  </ul>

  <h3>Functional Requirements</h3>
  <ul>
    <li><b>FR-1</b>: {Must Have requirement}</li>
    <li><b>FR-2</b>: {Must Have requirement}</li>
  </ul>

  <h3>User Scenarios</h3>
  <ul>
    <li>{Given/When/Then scenario 1}</li>
    <li>{Given/When/Then scenario 2}</li>
  </ul>

  <h3>Non-Functional Requirements</h3>
  <p>{Performance, security, reliability constraints}</p>

  <h3>Open Questions</h3>
  <ul>
    <li><b>OQ-1</b>: {Question with assumption/recommendation}</li>
    <li><b>OQ-2</b>: {Question with assumption/recommendation}</li>
  </ul>

  <hr/>
  <p><i>Synced from WayPoint spec: {spec-file-path}</i></p>
</div>
```

**Acceptance Criteria field** (`Microsoft.VSTS.Common.AcceptanceCriteria`):

Populate the ADO Acceptance Criteria field separately from the description.
Derive from the spec's **Must Have** functional requirements and **Success Metrics**:

```html
<ul>
  <li>{Testable acceptance criterion derived from FR-1}</li>
  <li>{Testable acceptance criterion derived from FR-2}</li>
  <li>{Measurable success metric}</li>
</ul>
```

Each criterion should be a concrete, verifiable statement (not a requirement ID).

**Re-sync (spec + plan available):**

```html
<div>
  <h3>Problem Statement</h3>
  <p>{Spec overview / problem statement}</p>

  <h3>Success Metrics</h3>
  <ul>
    <li>{Metric 1}</li>
    <li>{Metric 2}</li>
  </ul>

  <h3>Functional Requirements</h3>
  <ul>
    <li><b>FR-1</b>: {Must Have requirement}</li>
    <li><b>FR-2</b>: {Must Have requirement}</li>
  </ul>

  <h3>Architecture Decisions</h3>
  <ul>
    <li><b>AD1</b>: {Decision summary from plan}</li>
    <li><b>AD2</b>: {Decision summary from plan}</li>
  </ul>

  <h3>Implementation Phases</h3>
  <ol>
    <li><b>{Phase 1 title}</b>: {Phase 1 goal}</li>
    <li><b>{Phase 2 title}</b>: {Phase 2 goal}</li>
  </ol>

  <h3>Testing Strategy</h3>
  <p>{Brief testing approach from plan}</p>

  <h3>Open Questions</h3>
  <ul>
    <li><b>OQ-1</b>: {Question with assumption/recommendation}</li>
    <li><b>OQ-2</b>: {Question with assumption/recommendation}</li>
  </ul>

  <hr/>
  <p><i>Synced from WayPoint spec: {spec-file-path}</i></p>
  <p><i>Enriched from WayPoint plan: {plan-file-path}</i></p>
</div>
```

### Task Description (HTML)

```html
<div>
  <h3>Objective</h3>
  <p>{Task objective}</p>

  <h3>Acceptance Criteria</h3>
  <ul>
    <li>☐ {Criterion 1}</li>
    <li>☐ {Criterion 2}</li>
  </ul>

  <h3>Implementation Notes</h3>
  <p><b>Files:</b></p>
  <ul>
    <li><code>{file-path}</code> — {description}</li>
  </ul>

  <p><b>Dependencies:</b> {upstream task references}</p>

  <hr/>
  <p><i>Synced from WayPoint task: {task-file-path}</i></p>
</div>
```

## Pull Request Creation

The `pr` command creates a PR from the current branch linked to an ADO User Story.

### PR Title Format

```
{story-id} - {story-title}
```

Example: `37968 - BCP - Tooling - WayPoint ADO Sync Agent`

### PR Workflow

1. **Fetch the User Story** to get its title:
   ```bash
   az boards work-item show --id {story-id} --output json
   ```
   Extract `System.Title` from the response.

2. **Check current branch state**:
   ```bash
   git branch --show-current
   git log main..HEAD --oneline
   ```
   Abort if no commits ahead of main.

3. **Push the branch** if needed:
   ```bash
   git push -u origin {branch-name}
   ```

4. **Get the repository name**:
   ```bash
   basename $(git remote get-url origin) .git
   ```

5. **Create the PR**:
   ```bash
   az repos pr create \
     --title "{story-id} - {story-title}" \
     --description "## Summary\n- {commit summaries}\n\n## Linked Work Item\n- US#{story-id}: {story-title}\n\n## Test Plan\n- [ ] Verify changes\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)" \
     --source-branch {current-branch} \
     --target-branch main \
     --repository {repo-name} \
     --work-items {story-id} \
     --output json
   ```

6. **Report** the PR URL and linked work item.

### PR Error Handling

- No commits ahead of main → warn and abort
- PR already exists for branch → show existing PR URL
- Push fails → report error, do not create PR
- Invalid story ID → report and abort

## Re-Sync Behavior

When a work item already has a `**Ticket**:` field:

1. Read the existing ADO item: `az boards work-item show --id {ticket-id}`
2. Compare title and description for changes
3. If changed, update: `az boards work-item update --id {ticket-id} --title "..." --description "..."`
4. If status changed, update state: `az boards work-item update --id {ticket-id} --state "{New|Active|Resolved}"`
5. Skip if no changes detected

## Error Handling

- If `az` CLI is not logged in → prompt user to run `az login`
- If work item creation fails → stop, report error, do NOT continue with children
- If file write-back fails → report ADO ID so user can manually record it
- If a Feature match is ambiguous → ask the user to choose

## Entry Conditions

- At least one spec exists in `.waypoint/specs/`
- Azure CLI is authenticated (`az account show` succeeds)
- ADO project defaults are configured

## Final Outputs

- ADO work items (User Stories + Tasks) created in Azure DevOps
- WayPoint spec/task files updated with `**Ticket**:` references

Load the **ADO Sync Agent** from `.claude/agents/sync.md`.

Sync WayPoint specs and tasks to Azure DevOps:
1. Read manifest and inventory specs/tasks
2. Query existing BCP Features
3. Auto-match specs to Features
4. Preview and confirm with user
5. Create/update work items (enrich with plan if available)
6. Write back ADO IDs to WayPoint files

## After Completion

Update `waypoint.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_WayPoint Sync command for nextjs-app-router stack + Domain-Driven Design_

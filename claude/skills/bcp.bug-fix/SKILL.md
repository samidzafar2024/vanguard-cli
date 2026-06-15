---
name: bcp.bug-fix
description: "Guided bug-fix workflow driven by an Azure DevOps Bug work item ID. Use this skill whenever the user provides an ADO work item ID and wants to fix a bug, or says things like 'fix bug 12345', 'work on ADO 12345', 'pick up bug #12345', 'let me fix this bug', or pastes a Bug work item ID. Also triggers when the user references an ADO Bug URL or says 'resolve this bug'. This is the companion to bcp.bug-intake — intake creates the bug, this skill drives the fix."
---

# Bug Fix

Walk a developer through fixing a Bug work item from Azure DevOps — from triage through resolution. The dev owns all code edits; this skill orchestrates the process, keeps things structured, and updates ADO when the fix is verified.

## Workflow

### Step 1 — Fetch and display the bug

Extract the numeric work item ID from `$ARGUMENTS`. It might be a bare number (`42301`), prefixed (`ADO-42301`, `#42301`), or embedded in a URL — pull out just the digits.

```bash
az boards work-item show --id {id} \
  --org https://dev.azure.com/Meriton365 \
  --project "DevOps Projects and Support" \
  --output json
```

Parse the JSON and display a clean summary:

```
## Bug #{id}: {System.Title}

**Severity:** {Microsoft.VSTS.Common.Severity}
**State:** {System.State}
**Assigned To:** {System.AssignedTo.displayName} (if present)
**Area Path:** {System.AreaPath}

### Steps to Reproduce
{Microsoft.VSTS.TCM.ReproSteps — strip HTML tags for readability}

### Expected Behaviour
{extracted from ReproSteps or Description}

### Actual Behaviour
{extracted from ReproSteps or Description}

### Additional Context
{System.Description — strip HTML tags, omit if empty}
```

If the work item type is not `Bug`, warn the dev: "This is a {type}, not a Bug. Do you still want to proceed with a fix workflow?"

### Step 2 — Confirm reproduction

Ask the dev:

> **Can you reproduce this bug locally?**
> If you haven't tried yet, give it a go now — I'll wait.

Wait for an explicit response.

- **Yes / confirmed** — proceed to Step 3.
- **No / cannot reproduce** — display the ADO item URL and stop:
  ```
  Could not reproduce locally. Here's the work item for further triage:
  https://dev.azure.com/Meriton365/DevOps%20Projects%20and%20Support/_workitems/edit/{id}
  ```
  Add a comment suggesting the dev update the work item with reproduction notes and stop the workflow.

### Step 3 — Root cause investigation

Guide the dev through a structured diagnosis. Ask all questions in a single grouped message:

```
Before we start fixing, let's pin down the root cause:

1. **Codebase area** — What part of the codebase does this touch? (e.g., interactors, controllers, UI components, database layer)
2. **Recent changes** — Any recent commits or PRs that might have introduced this? (`git log --oneline -20` in the relevant area can help)
3. **Error signal** — What does the error message, stack trace, or unexpected behaviour point to?
4. **Bug type** — Would you classify this as:
   - **Logic** — wrong conditional, bad calculation, missing edge case
   - **Data** — schema mismatch, bad migration, stale cache, missing seed data
   - **Integration** — API contract changed, auth issue, timing/race condition
```

Wait for the dev's responses. Summarise the root cause assessment back to them in a sentence or two so you're aligned before moving on.

### Step 4 — Create the fix branch

Derive a short slug from the bug title — lowercase, hyphens, max ~4 words, no special characters. Then create the branch:

```bash
git checkout -b fix/ADO-{id}-{short-slug}
```

Example: `fix/ADO-42301-merit-calc-off-by-one`

If the branch already exists (the dev may have started earlier), just check it out instead of failing:

```bash
git checkout fix/ADO-{id}-{short-slug}
```

Confirm the branch to the dev: "On branch `fix/ADO-{id}-{short-slug}` — ready to work."

### Step 5 — Work through the fix (as Developer agent)

Adopt the Developer agent persona from `.claude/agents/dev.md` for this step. This means you follow the MVC with Interactors architecture patterns, understand the layer responsibilities, and avoid the documented anti-patterns (fat controllers, interactor-calling-interactor).

This step is interactive and collaborative:

- **Investigate first.** Use the root cause from Step 3 to locate relevant files — Grep for error messages, Glob for the affected area, Read the surrounding code. Understand the full call chain (controller -> interactor -> model) before suggesting changes.
- **Explain what you find.** Walk the dev through the code path that produces the bug. Show them the specific lines and explain the logic.
- **Suggest fix approaches** that respect the architecture. If the bug is in business logic, the fix belongs in an interactor. If it's a data issue, it may be a migration or model validation problem. If it's a view rendering issue, keep the fix presentational.
- **The dev owns the edits.** Default to guidance over action. If the dev asks you to make edits, do so — but always explain what you changed and why.
- **Keep the scope tight.** Fix the bug, don't refactor the neighbourhood. No drive-by cleanups.

There is no fixed end to this step — it continues until the dev says the fix is in place.

### Step 6 — Verify the fix (UAT + unit tests)

Once the dev says the code changes are done, verify the fix through two layers: targeted browser tests and unit tests.

#### 6a. Generate UAT verification scenarios

Using the bug details from Step 1 and the root cause from Step 3, generate 3-6 targeted test scenarios following the Bug Verification mode from `bcp.uat`. Read `.claude/skills/bcp.uat/SKILL.md` (Mode 2: Bug Verification) for the full pattern. In brief:

1. **Repro confirmation** — Follow the exact repro steps from the bug. The bug should no longer occur.
2. **Fix verification** — Verify the expected behaviour now works correctly.
3. **Edge case** — Test a boundary condition related to the fix.
4. **Regression check** — Test a closely related workflow that could be affected.
5. **Permission boundary** (if applicable) — Verify security boundaries still hold.
6. **Negative test** (if applicable) — Confirm the error state is truly gone.

Present the scenarios to the dev and wait for a quick confirmation before executing.

#### 6b. Execute browser tests

Use Playwright MCP tools to run each scenario through the live UI:

1. Impersonate the appropriate role via `browser_evaluate`
2. Navigate to the affected page
3. Follow the scenario steps
4. **Verify via `browser_snapshot`** — never mark PASS without visual confirmation
5. Check `browser_console_messages` for JS errors
6. Check `browser_network_requests` for failed API calls

If a scenario **fails, stop immediately** and report — loop back to Step 5 to address it.

#### 6c. Run unit tests and lint

After browser tests pass:

```bash
cd bcp-web && npm test
cd bcp-web && npm run lint
```

#### 6d. Report results

Present a summary table:

```
## Bug Verification Results — #{id}

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Repro check | PASS | Bug no longer reproduces |
| 2 | Fix verification | PASS | Expected behaviour confirmed |
| 3 | Edge case | PASS | Boundary handled correctly |
| 4 | Regression | PASS | Related workflow unaffected |

Unit tests: PASS
Lint: PASS

All checks passed — ready to resolve.
```

- **All green** — proceed to Step 7.
- **Any failure** — help the dev diagnose. Loop back through Step 5/6 until everything passes.

### Step 7 — Resolve the ADO work item

Once the dev confirms the fix is verified:

```bash
az boards work-item update --id {id} \
  --state "Resolved" \
  --org https://dev.azure.com/Meriton365 \
  --project "DevOps Projects and Support" \
  --output json
```

Report the result:

```
Bug #{id} marked as Resolved.
https://dev.azure.com/Meriton365/DevOps%20Projects%20and%20Support/_workitems/edit/{id}

Next steps:
- Commit your changes and push the branch
- Run `/bcp.pr` to create a pull request linked to the parent story
```

## Important rules

- **No files written to disk.** No markdown, no temp files, no YAML updates. The workflow is entirely conversational plus `az` CLI and `git` commands.
- **No commits, no PRs.** The dev commits when ready; `/bcp.pr` handles the pull request.
- **Dev owns the edits.** Suggest, don't commandeer. If the dev asks for help with the code, help — but default to guidance over action.
- **All follow-ups in one shot.** Never drip-feed questions — batch them (see Step 3).
- **Wait for confirmation** at Steps 2, 5 (implicitly), and 6 before advancing.
- **Branch naming:** Always `fix/ADO-{id}-{short-slug}`. Keep the slug short and descriptive.

## ADO Defaults

| Field | Value |
|-------|-------|
| Organization | `Meriton365` |
| Project | `DevOps Projects and Support` |
| Area Path | `DevOps Projects and Support\CoPointData` |

## Arguments

$ARGUMENTS

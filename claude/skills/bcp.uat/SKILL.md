---
name: bcp.uat
description: "BCP UAT testing engine — validates features and bug fixes through Playwright browser tests with role impersonation. Use this skill whenever the user wants to validate a feature, run acceptance tests, test approval workflows, verify role-based security, execute end-to-end scenarios, or verify a bug fix through the browser. Also triggers when the user mentions UAT, end-to-end testing, Playwright testing, impersonation testing, security boundary testing, regression testing, or asks to test as different users. Supports two modes: full spec-driven UAT for features, and targeted verification for bug fixes."
---

# BCP UAT Engine

**Project**: bonuscompplatform
**Agent**: UAT Engineer (`.claude/agents/uat.md`)
**Base URL**: `http://localhost:4000` (dev-auth-proxy)

## What This Skill Does

Two modes of operation:

- **Full UAT** — Spec-driven, comprehensive test plans with human review gates. Use for feature validation.
- **Bug Verification** — Lightweight, targeted tests generated from a bug description and fix. Use from `bcp.bug-fix` or when verifying a specific defect.

The `$ARGUMENTS` or conversation context determines which mode. If a spec path is provided, use Full UAT. If a bug ID, bug description, or "verify fix" context is provided, use Bug Verification.

### Full UAT mode:

1. **Generates a comprehensive test plan** from acceptance criteria, security boundaries, and workflow scenarios
2. **Resets and seeds test data** so every run starts from a known state
3. **Impersonates different users** (HR Admin, Manager, no-role, custom) to test role-based access and multi-user workflows
4. **Executes Playwright-based browser tests** through the live UI
5. **Produces a detailed markdown report** saved to `.waypoint/uat/`

### Bug Verification mode:

1. **Generates 3-6 targeted test scenarios** from the bug report and fix description
2. **Executes them through the browser** using Playwright MCP tools
3. **Reports results inline** — no separate file needed

## Before You Begin

1. **Ensure the dev server is running** at `http://localhost:4000`
   - If not: `cd bcp-web && npm run dev` (starts proxy on 4000 + Next.js on 3000)
2. **Read the manifest** at `waypoint.manifest.yaml` for current project state
3. **Read the spec/task** that defines what to test

---

## Mode 1: Full UAT (Feature Validation)

Use when the user provides a spec file, task reference, or asks for comprehensive testing of a feature.

### Core Workflow

```
PLAN  →  CLARIFY  →  HUMAN REVIEW  →  RESET DATA  →  SEED DATA  →  EXECUTE TESTS  →  REPORT
             ↑               |
             └── feedback ───┘
```

**The CLARIFY and HUMAN REVIEW gates are mandatory.** Never skip ahead to data reset or test execution without explicit user approval of the test plan. The user may have context about known issues, incomplete features, or priorities that fundamentally change what should be tested.

### Phase 1: Generate Test Plan

When given a spec file path or task reference:

1. **Read and analyze** the spec/task file — extract ALL acceptance criteria, user stories, and non-functional requirements
2. **Identify personas and roles** involved — which presets or custom identities are needed
3. **Ask clarifying questions** before drafting the plan. Common questions to consider:
   - Are there specific edge cases or failure modes the user is most concerned about?
   - Should testing focus on a particular role's perspective, or cover all roles?
   - Is there existing data in the database that should be preserved, or should we do a full reset?
   - Are there any features or pages that are known to be incomplete or intentionally skipped?
   - What browser viewport/resolution matters (desktop only, or responsive)?
   - Are there external integrations (email notifications, exports) that should be verified or mocked?
   - How thorough should security boundary testing be — just page access, or also API-level probing?
4. **Wait for answers** — do not proceed until the user has responded to your questions
5. For each criterion, design test scenarios covering:
   - **Happy path**: The expected behavior works correctly
   - **Permission boundaries**: The right roles can access it, wrong roles cannot
   - **Edge cases**: Empty states, maximum values, boundary conditions
   - **Multi-user workflows**: Scenarios requiring role-switching (e.g., manager submits, approver approves)
   - **Data protection**: Salary/compensation data is only visible to authorized roles
6. **Write the test plan** to `.waypoint/uat/{feature-name}-{timestamp}.md` using the Test Plan Format below
7. **Present the plan for human review** — display a summary of:
   - Total scenario count by category (Functional / Security / Workflow / Edge Cases)
   - Which user roles will be impersonated and in what order
   - What data reset/seed strategy will be used
   - Any assumptions made
   - Estimated number of impersonation switches
8. **Wait for explicit approval** — the user must confirm the plan before any test execution begins. They may:
   - Approve as-is
   - Request additions, removals, or priority changes to scenarios
   - Ask to skip certain categories (e.g., "skip security testing, focus on the workflow")
   - Adjust the data setup strategy
9. **Incorporate feedback** — update the test plan file with any changes and re-present if the changes are significant

### Phase 2: Reset and Seed Data

Before executing tests, ensure a clean, predictable state. You have authority to reset local data.

**Quick reset** (clears transactional data, keeps roles/users/cycles):
```bash
cd bcp-web && npm run db:reset-uat-data
```

**Full reset** (nuclear option - drops and recreates everything):
```bash
cd bcp-web && npm run db:migrate:reset && npm run db:setup
```

**Sync system roles** (ensures HR Admin and Manager roles exist with correct Entra group mappings):
```bash
cd bcp-web && npm run db:sync-system-data:dev
```

**Load test fixtures** via the UI (as HR Admin):
Upload CSVs from `bcp-web/prisma/fixtures/uat/` in this order:
1. `account-executives.csv` (via Imports > Account Executives)
2. `employees-with-allocations.csv` (via Imports > Employees — requires an active review cycle)
3. `historical-snapshots.csv` (via Imports > Historical Snapshots)
4. `actuals.csv` (via Imports > Actuals)

To upload via the UI, impersonate as `hr-admin`, navigate to `/hr/data-upload`, and use the file upload forms.

For programmatic fixture loading, you can also use the import API endpoints directly:
- `POST /api/imports/account-executives` (multipart form with CSV)
- `POST /api/imports/employees` (multipart form with CSV)
- `POST /api/imports/historical-snapshots` (multipart form with CSV)
- `POST /api/imports/actuals` (multipart form with CSV)

### Phase 3: Impersonate Users

The impersonation system lets you switch user roles instantly without restarting anything. This is how you test multi-user workflows and security boundaries.

**API endpoint**: `http://localhost:4000/.auth/impersonate`

#### Available Presets

| Preset | Email | Role | Permissions | Use For |
|--------|-------|------|-------------|---------|
| `hr-admin` | hr-admin@test.local | HR Admin | MANAGE_EMPLOYEE_DATA, MANAGE_REVIEW_CYCLES, EXPONENT_HR_EXPORT | Importing data, managing review cycles, viewing HR dashboard |
| `manager` | manager@test.local | Manager | MANAGE_COMPENSATION, APPROVE_COMPENSATION | Creating/editing/submitting compensation proposals |
| `both-roles` | superuser@test.local | HR Admin + Manager | All permissions | Full workflow testing, end-to-end scenarios |
| `no-role` | norole@test.local | None | None | Testing unauthorized access, 403 pages |

#### Switching Users

```typescript
// Switch to a preset
async function impersonate(preset: string) {
  const res = await fetch('http://localhost:4000/.auth/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset }),
  });
  if (!res.ok) throw new Error(`Impersonation failed: ${res.status}`);
  return res.json();
}

// Switch to a custom user (for approval chain testing)
async function impersonateCustom(identity: { oid: string; email: string; name?: string; groups?: string[] }) {
  const res = await fetch('http://localhost:4000/.auth/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
  if (!res.ok) throw new Error(`Impersonation failed: ${res.status}`);
  return res.json();
}

// Clear impersonation
async function clearImpersonation() {
  await fetch('http://localhost:4000/.auth/impersonate', { method: 'DELETE' });
}
```

**Using Playwright MCP tools for impersonation**: Since Playwright MCP operates through the browser, use `browser_evaluate` to call the impersonation API:

```javascript
// In browser_evaluate:
await fetch('http://localhost:4000/.auth/impersonate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ preset: 'hr-admin' })
}).then(r => r.json())
```

After switching users, **always reload the page** — the impersonation state is server-side and the browser needs a fresh request to pick up the new headers.

#### Custom Users for Approval Testing

The approval chain uses real email addresses from the employee CSV data. The fixture data defines approval chains like:
- Level 1 Approver: `copoint.justin.finch@meriton.com`
- Level 2 Approver: (optional, varies by employee)

To test as a specific approver, impersonate with their exact email:
```javascript
await fetch('http://localhost:4000/.auth/impersonate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    oid: 'test-approver-001',
    email: 'copoint.justin.finch@meriton.com',
    name: 'Justin Finch',
    groups: ['875b5dff-8d28-480a-a146-cd76afd0dafb']  // Manager group
  })
}).then(r => r.json())
```

### Phase 4: Execute Tests

For each test scenario in the plan, follow this pattern:

1. **Set the user** — Impersonate the role needed for this scenario
2. **Navigate** — Go to the relevant page
3. **Wait for load** — Use `browser_wait_for` to ensure content is ready
4. **Interact** — Fill forms, click buttons, select options as the scenario requires
5. **Verify** — Check that the expected outcome occurred (element exists, text matches, redirect happened)
6. **Check for errors** — Inspect `browser_console_messages` and `browser_network_requests`
7. **Record result** — PASS, FAIL, or BLOCKED with details

#### Playwright MCP Tools Quick Reference

| Tool | Use For |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_snapshot` | Get accessibility tree (use before any interaction to get `ref` values, and to verify outcomes) |
| `browser_click` | Click element by `ref` from snapshot |
| `browser_type` | Type into an input field |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_select_option` | Select from dropdowns |
| `browser_wait_for` | Wait for text/element to appear/disappear |
| `browser_console_messages` | Check for JS errors |
| `browser_network_requests` | Check for failed API calls |
| `browser_evaluate` | Run JS in the page (used for impersonation API calls) |
| `browser_file_upload` | Upload CSV fixtures via the UI |
| `browser_press_key` | Keyboard interactions |

**Always `browser_snapshot` before interacting** — snapshots provide the `ref` attribute IDs needed for `browser_click` and `browser_type`.

### Phase 5: Generate Report

After all tests complete, update the test plan file with results and write the final report to:
```
.waypoint/uat/{feature-name}-{YYYY-MM-DD-HHmm}.md
```

Do NOT create evidence subdirectories or save screenshot files. All results go in the single markdown report file.

## Multiple Runs Per Spec

Each UAT run produces its own timestamped file, so the same spec can be tested repeatedly with full history preserved.

### Directory Structure

```
.waypoint/uat/
├── approval-workflow-2026-04-09-1430.md      # Run 1 — initial test
├── approval-workflow-2026-04-10-0900.md      # Run 2 — regression after fix
├── approval-workflow-2026-04-11-1100.md      # Run 3 — re-test after rework
├── compensation-dashboard-2026-04-09-1500.md # Different spec
└── ...
```

Keep it flat — just markdown files, no subdirectories.

### Run Metadata

Every test plan and report includes metadata at the top to make runs traceable:

```markdown
**Spec**: .waypoint/specs/approval-workflow.md
**Run**: 3 of 3 for this spec
**Previous Run**: approval-workflow-2026-04-10-0900.md
**Generated**: 2026-04-11 11:00
**Status**: COMPLETE
**Trigger**: Re-test after fixing Issue #2 from Run 2
```

### Comparing Runs

When a previous run exists for the same spec, the skill should:
1. **Read the previous report** to understand what passed, failed, or was blocked
2. **Highlight regressions** — scenarios that previously passed but now fail
3. **Highlight fixes** — scenarios that previously failed but now pass
4. **Carry forward known issues** — if a scenario was blocked or deferred, note it in the new plan
5. **Include a delta summary** at the end of the report:

```markdown
## Delta from Previous Run (approval-workflow-2026-04-10-0900.md)

| Scenario | Previous | Current | Notes |
|----------|----------|---------|-------|
| TS-003 | FAIL | PASS | Fixed in commit abc123 |
| TS-007 | PASS | FAIL | Regression — new sidebar broke layout |
| TS-012 | BLOCKED | PASS | Dependency resolved |
```

### When to Create a New Run vs. Continue

- **New run**: After code changes, bug fixes, or when the user explicitly asks for a fresh test pass
- **Continue existing**: If the user says "keep going" or "test the remaining scenarios" — append results to the current file rather than creating a new one

---

## Mode 2: Bug Verification (Targeted Testing)

Use when verifying a specific bug fix. This mode is called from `bcp.bug-fix` or when someone says "verify this fix" with a bug description. It's faster — no human review gate on the test plan, no full data reset unless the bug requires it.

### Inputs

Bug Verification needs context about:
- **Bug description** — title, repro steps, expected vs actual behaviour
- **Fix description** — what was changed (affected files, logic changed)
- **Affected area** — which part of the app (routes, roles, data involved)

These typically come from the `bcp.bug-fix` conversation (Steps 1-3 and 5).

### Workflow

```
GENERATE SCENARIOS  →  SHOW DEV  →  EXECUTE  →  REPORT
```

### BV Step 1: Generate Targeted Test Scenarios

Create 3-6 focused scenarios based on the bug context:

1. **Repro confirmation** — Follow the exact reproduction steps from the bug report. The bug should no longer occur. This is the most important test.
2. **Fix verification** — Verify the positive case: the expected behaviour now works correctly.
3. **Edge case** — Test a boundary condition related to the fix (e.g., if the bug was an off-by-one, test the boundary values; if a display bug, test with empty/long/special-character data).
4. **Regression check** — Test a closely related workflow that wasn't broken but could be affected by the fix. If the bug was in a specific role's view, check the same page as a different role.
5. **Permission boundary** (if applicable) — If the bug involved authorization or role-specific data, verify the security boundary still holds.
6. **Negative test** (if applicable) — Confirm the error state the bug produced is truly gone (no console errors, no failed API calls).

Not every bug needs all 6 — use judgment. A simple UI display bug might need only 1-3. An approval workflow bug or security issue needs all 6.

### BV Step 2: Show the Dev

Present the scenarios as a brief numbered list:

```
Here are the verification tests I'll run:

1. **Repro check** — {exact steps from bug report}, verify {expected behaviour}
2. **Fix verification** — {positive case test}
3. **Edge case** — {boundary condition}
4. **Regression** — {related workflow check}

I'll also run unit tests and lint after the browser tests. Ready to go?
```

Wait for a quick confirmation. The dev may add, remove, or adjust scenarios.

### BV Step 3: Execute

Use the same Playwright MCP tools as Full UAT mode:

1. Determine which role is needed — impersonate via `browser_evaluate`
2. Navigate to the affected page
3. Follow the scenario steps
4. **Verify via `browser_snapshot`** — never mark PASS without visual confirmation
5. Check `browser_console_messages` for errors
6. Check `browser_network_requests` for failed API calls
7. Record PASS / FAIL with notes

If a scenario **fails, stop and report immediately** — the fix may need more work. Don't continue running remaining scenarios when a critical one fails.

After browser tests, run unit tests and lint:
```bash
cd bcp-web && npm test
cd bcp-web && npm run lint
```

### BV Step 4: Report

Report results inline in the conversation (no separate file):

```
## Bug Verification Results — #{bug-id}

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Repro check | PASS | Bug no longer reproduces |
| 2 | Fix verification | PASS | Expected behaviour confirmed |
| 3 | Edge case | PASS | Boundary values handled correctly |
| 4 | Regression | PASS | Related workflow unaffected |

Unit tests: PASS (47 passed, 0 failed)
Lint: PASS (no warnings)

All checks passed. The fix is verified.
```

If any scenario fails:
```
Scenario 3 (edge case) FAILED:
- Expected: {x}
- Actual: {y}
- Console errors: {if any}

The fix needs more work before we can close this out.
```

---

## Application Knowledge

### Page Routes

| Route | Required Permission | Role |
|-------|-------------------|------|
| `/` | Any authenticated | Dashboard (content varies by role) |
| `/manager/compensation` | MANAGE_COMPENSATION | Manager |
| `/manager/submissions` | MANAGE_COMPENSATION | Manager |
| `/manager/submissions/create` | MANAGE_COMPENSATION | Manager |
| `/manager/submissions/[id]/edit` | MANAGE_COMPENSATION | Manager |
| `/hr/review-cycles` | MANAGE_REVIEW_CYCLES | HR Admin |
| `/hr/review-cycles/new` | MANAGE_REVIEW_CYCLES | HR Admin |
| `/hr/review-cycles/[id]/details` | MANAGE_REVIEW_CYCLES | HR Admin |
| `/hr/review-cycles/[id]/edit` | MANAGE_REVIEW_CYCLES | HR Admin |
| `/hr/data-upload` | MANAGE_EMPLOYEE_DATA | HR Admin |
| `/hr/change-preview` | MANAGE_EMPLOYEE_DATA | HR Admin |
| `/hr/exponent-exports` | EXPONENT_HR_EXPORT | HR Admin |
| `/approvals` | APPROVE_COMPENSATION | Manager |
| `/approvals/[workflowId]` | APPROVE_COMPENSATION | Manager |
| `/profile` | Any authenticated | User profile |
| `/unauthorized` | None | 403 error page |

### Submission Status Lifecycle

```
DRAFT  -->  READY  -->  SUBMITTED  -->  APPROVED
                                   \-->  RETURNED  -->  (resubmit) --> SUBMITTED
```

- **DRAFT**: Manager is editing the comp proposal
- **READY**: Manager marked it ready (can still edit)
- **SUBMITTED**: Sent for approval — creates an ApprovalWorkflow with steps from the assignment's `approvalChainEmails`
- **APPROVED**: All approval steps completed
- **RETURNED**: Approver sent it back with comments (manager can edit and resubmit)

### Approval Workflow

- Each submission gets a multi-step ApprovalWorkflow when submitted
- Steps are derived from the assignment's `approvalChainEmails` (Level 1, Level 2, etc.)
- Only the **current step's approver** (matched by email, case-insensitive) can approve or return
- Approving the final step completes the workflow and moves the submission to APPROVED
- Returning requires comments and pauses the workflow
- Resubmitting a returned submission cancels the old workflow and creates a new one

### Sensitive Data Fields

These fields contain compensation data that should only be visible to authorized roles:
- `currentSalary`, `newAnnualSalary`, `currentHourlyRate`, `newHourlyRate`
- `annualBonusPercentage`, `quarterlyBonusAmount`, `yearEndBonusAmount`
- `teamLeadBonusAmount`, `meritIncreaseAmount`, `meritIncreasePercent`
- All fields in CompensationSnapshot (historical earnings, bonuses, commissions)

### Entra Group IDs (Dev)

| Role | Group ID |
|------|----------|
| HR Admin | `254a4461-f993-401a-bb0e-44f9ce70a58a` |
| Manager | `875b5dff-8d28-480a-a146-cd76afd0dafb` |

## Test Plan Format

Save test plans to `.waypoint/uat/{feature-name}-{YYYY-MM-DD-HHmm}.md`:

```markdown
# UAT Test Plan: {Feature Name}

**Spec**: {path to spec file}
**Generated**: {date}
**Status**: PENDING | IN PROGRESS | COMPLETE

## Prerequisites
- [ ] Dev server running at http://localhost:4000
- [ ] Database reset (`npm run db:reset-uat-data`)
- [ ] System data synced (`npm run db:sync-system-data:dev`)
- [ ] Fixtures loaded (list which CSVs)

## Test Scenarios

### TS-001: {Scenario Name}
**Role**: {preset or custom identity}
**Acceptance Criterion**: {text from spec}
**Priority**: Critical | High | Medium | Low

#### Steps
1. Impersonate as `{preset}`
2. Navigate to `{url}`
3. {interaction steps}
4. Verify: {expected outcome}

#### Expected Result
{description}

#### Actual Result
- **Status**: PASS | FAIL | BLOCKED
- **Notes**: {observations}

### TS-002: Security - {Role} Cannot Access {Page}
**Role**: {preset}
**Type**: Permission Boundary

#### Steps
1. Impersonate as `{preset}`
2. Navigate to `{protected url}`
3. Verify: Redirected to `/unauthorized` OR receives 403

...

## Summary

| Category | Total | Pass | Fail | Blocked |
|----------|-------|------|------|---------|
| Functional | | | | |
| Security | | | | |
| Workflow | | | | |
| Edge Cases | | | | |
| **Total** | | | | |

## Issues Found

### Issue 1: {title}
- **Scenario**: TS-{n}
- **Severity**: Critical | Major | Minor
- **Expected**: {what should happen}
- **Actual**: {what happened}
- **Console Errors**: {if any}
```

## Standard Test Categories

When generating a test plan from a spec, always include these categories:

### 1. Functional Tests
- Every acceptance criterion gets at least one happy-path test
- Include edge cases (empty data, max-length inputs, special characters, zero values)

### 2. Permission Boundary Tests
For every page/action the feature touches, verify:
- **Authorized role CAN access** the page and perform the action
- **Unauthorized roles CANNOT access** — test with `no-role`, and any role that shouldn't have access
- **API endpoints return 401/403** for unauthorized access (check via `browser_network_requests`)

### 3. Multi-User Workflow Tests
For features involving hand-offs between users:
- Manager creates and submits compensation proposal
- Switch to approver (impersonate with the approver's email from the assignment data)
- Approver approves or returns
- If returned: switch back to manager, verify returned state, edit and resubmit
- Verify final state after full workflow completion

### 4. Data Protection Tests
- Impersonate as `no-role` and verify compensation data is not exposed in any UI or API response
- Impersonate as `hr-admin` (no MANAGE_COMPENSATION) and verify they cannot see manager-specific comp views
- Impersonate as `manager` and verify they cannot see HR-specific pages (review cycle management, data upload)
- Check that API responses don't leak salary data in `browser_network_requests`

### 5. State Integrity Tests
- Actions should not be possible on wrong statuses (e.g., cannot approve a DRAFT submission)
- Verify optimistic locking prevents duplicate approvals
- Check audit trail entries are created for important actions

## Anti-Patterns to AVOID

- **Blind Pass**: Never mark PASS without verifying via `browser_snapshot` — confirm the UI actually shows the expected state
- **Stale State**: Always reload after impersonation changes
- **Assumption-Based Testing**: Verify through the UI, not by reading code
- **Missing Cleanup**: Clear impersonation between unrelated scenarios
- **Incomplete Security Testing**: Every permission-gated page needs a negative test
- **Ignoring Console Errors**: Always check `browser_console_messages` — errors may indicate hidden failures
- **Skipping Network Checks**: Failed API calls can be masked by the UI

## Reference Files

For deeper details, read these reference files in the skill's `references/` directory:
- `references/impersonation-details.md` — Full impersonation API reference and advanced patterns
- `references/data-management.md` — Database reset scripts, fixture details, and data setup recipes
- `references/app-domain-model.md` — Prisma schema, enums, status lifecycles, and domain rules

## Arguments

$ARGUMENTS

---

_BCP UAT Engine — Next.js (App Router) + MVC with Interactors_

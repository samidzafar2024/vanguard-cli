# Application Domain Model — Reference

## Core Entities

### User
- `id`, `email` (unique), `name`, `image`
- Auto-created on first login via `SyncEasyAuthUserCommand`
- Roles resolved at request time via Entra group membership (not stored on user)

### Role
- `name`: "HR Admin" or "Manager"
- `entraGroupId`: Maps to Entra AD group
- `isSystem`: true for system-defined roles
- Has many `RolePermission`

### Permission Enum
```
MANAGE_COMPENSATION      — Create/edit/submit compensation proposals (Manager)
MANAGE_EMPLOYEE_DATA     — Import employees, manage assignments (HR Admin)
MANAGE_REVIEW_CYCLES     — Create/edit review cycles (HR Admin)
EXPONENT_HR_EXPORT       — Export data to Exponent HR (HR Admin)
APPROVE_COMPENSATION     — Approve/return submissions (Manager)
```

### ReviewCycle
- `name`, `type` (ANNUAL | MID_YEAR | QUARTERLY)
- `startDate`, `endDate`, `isActive`
- `effectivePayChangeDate`
- Soft-deleted via `deletedAt`
- Has many Assignments and Submissions

### Assignment
- Represents an employee assigned to a review cycle
- Imported via CSV by HR Admin
- Key fields: `exponentHrId`, `managerEmail`, `currentSalary`, employee info
- `approvalChainEmails`: String[] defining the approval chain for this employee
- Has AE allocations via `AssignmentAEAllocation`
- One-to-one optional link to `Submission` via `submissionId`

### Submission
- A manager's compensation proposal for an employee
- Created from an Assignment
- **Status lifecycle**: DRAFT → READY → SUBMITTED → APPROVED | RETURNED
- Contains all proposed changes: `newAnnualSalary`, `annualBonusPercentage`, `yearEndBonusAmount`, etc.
- `salaryAdjustmentType`: MERIT | PROMOTION | MARKET | OTHER
- `meritIncreaseReason`: MERIT | PROMOTION (when applicable)
- Has AE allocations via `SubmissionAEAllocation`
- Has `ApprovalWorkflow` when submitted
- Has `CompensationChange` records tracking what changed

### ApprovalWorkflow
- Multi-step approval chain for a submission
- **Status**: PENDING → IN_PROGRESS → COMPLETED | CANCELLED
- `currentStepIndex`: Which step is currently active (1-based)
- `version`: Optimistic locking to prevent duplicate approvals
- Has ordered `ApprovalStep` entries

### ApprovalStep
- One step in the approval chain
- `sequence`: 1, 2, 3... (matches currentStepIndex)
- `approverEmail`, `approverDisplayName`
- **Status**: PENDING → APPROVED | RETURNED | SKIPPED
- `comments`: Optional for approval, required for return
- `actedAt`: Timestamp when the step was acted upon

### CompensationChange
- Records individual field-level changes from a submission
- `changeType`: SALARY, HOURLY_RATE, AE_ASSIGNMENT, ALLOCATION_PERCENT, etc.
- `previousValue`, `newValue` (JSON)
- **Status**: PENDING → APPROVED → EFFECTIVE | SUPERSEDED | CANCELLED
- Links to both submission and employee

### CompensationSnapshot
- Historical point-in-time compensation record per employee per year
- Contains: annualRate, hourlyRate, bonusTotal, quarterlyIncentiveTotal, yearEndBonusTotal, etc.
- Imported via CSV

### AccountExecutive
- `exponentHrId`, `firstName`, `lastName`, `isActive`
- Linked to submissions and assignments via allocation tables

## Employee Types and Pay Types

| Employee Type | Pay Type | Key Fields |
|--------------|----------|------------|
| FULL_TIME + SALARY | Standard salaried | currentSalary, newAnnualSalary, annualBonusPercentage |
| FULL_TIME + HOURLY | Hourly full-time | currentHourlyRate, newHourlyRate (salary = hourly * 2080) |
| PART_TIME + HOURLY | Part-time hourly | currentHourlyRate, newHourlyRate |
| PART_TIME + SALARY | Part-time salaried | currentSalary, newAnnualSalary |

## Bonus Types

| Bonus | Who Gets It | Field |
|-------|-------------|-------|
| Annual Bonus % | Most employees | `annualBonusPercentage` |
| Quarterly Bonus | Some employees | `quarterlyBonusAmount` |
| Year-End Bonus | Some employees | `yearEndBonusAmount` with allocation type |
| Team Lead Bonus | Team leads | `teamLeadBonusAmount` |
| Merit Increase | Via merit/promotion | `meritIncreaseAmount`, `meritIncreasePercent` |

## YE Bonus Allocation Types

When year-end bonus exists:
- **FULL_AE**: 100% allocated to AEs
- **SPLIT_60_40**: 60% salary, 40% hourly
- **CUSTOM**: Custom AE share percentage via `yeBonusAeSharePercent`

## Authorization Model

### How Auth Resolution Works
1. Request arrives with Azure Easy Auth headers (X-MS-CLIENT-PRINCIPAL, etc.)
2. `parseEasyAuthHeaders()` extracts identity: oid, email, name, groups[]
3. `SyncEasyAuthUserCommand` upserts the User record
4. `roleRepo.findByEntraGroupIds(groups)` resolves roles from Entra group membership
5. Permissions are flattened from all matching roles
6. `AuthenticatedUser` object attached to request: `{ id, email, name, roles, permissions }`

### Page Protection
- Server components use `requireAuth()`, `requirePermissionPage()`, `requireAnyPermissionPage()`
- Missing auth → redirect to `/.auth/login/aad`
- Missing permission → redirect to `/unauthorized`

### API Protection
- Route handlers wrapped with `withAuth()`, `withPermission()`, `withAnyPermission()`, `withAllPermissions()`
- Missing auth → 401 `UNAUTHENTICATED`
- Missing permission → 403 `PERMISSION_DENIED`

### Approval-Specific Authorization
- The `ApprovalWorkflow` aggregate enforces that only the current step's approver (by email, case-insensitive) can approve or return
- This is a **domain-level guard**, not just middleware — even with the right role, you can't approve someone else's step
- Wrong approver gets `NotCurrentApproverError`
- Return requires comments — empty comments get `CommentsRequiredError`
- Terminal states (COMPLETED, CANCELLED) reject further actions with `WorkflowNotActiveError`

## Audit Trail

All significant actions create `AuditLog` entries:
- `entityType`: "Submission", "ApprovalWorkflow", etc.
- `action`: CREATE, UPDATE, DELETE, STATUS_CHANGE, BULK_DELETE, EXPORT
- `oldData`, `newData`: JSON snapshots
- `userId`: Who performed the action
- `metadata`: Additional context

Testing should verify audit entries are created for important operations.

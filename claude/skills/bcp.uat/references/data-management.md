# Data Management — Detailed Reference

## Database Architecture

- **Database**: PostgreSQL
- **ORM**: Prisma
- **Schema**: `bcp-web/prisma/schema.prisma`
- **Location**: Working directory is `bcp-web/` for all npm commands

## Reset Strategies

### Quick Reset (Recommended for UAT)

Clears all transactional data while preserving infrastructure (ReviewCycle, User, Role, RolePermission):

```bash
cd bcp-web && npm run db:reset-uat-data
```

This deletes (in FK-safe order):
1. ApprovalStep
2. ApprovalWorkflow
3. CompensationChange
4. SubmissionAEAllocation
5. Submission
6. AssignmentAEAllocation
7. Assignment
8. CompensationSnapshot
9. AccountExecutive
10. ImportLog
11. AuditLog

It also ensures at least one active ReviewCycle exists (creates one if none found).

**Safety**: Refuses to run if DATABASE_URL looks like a production database.

### Full Reset (Nuclear)

Drops the entire database and rebuilds from scratch:

```bash
cd bcp-web && npm run db:migrate:reset
```

Then set up fresh:
```bash
cd bcp-web && npm run db:setup
```

`db:setup` runs: `prisma generate` → `prisma migrate deploy` → `db:sync-system-data:dev` → `db:seed:dev`

### Sync System Data Only

Ensures roles and permissions exist with correct Entra group mappings:

```bash
cd bcp-web && npm run db:sync-system-data:dev
```

This upserts:
- **HR Admin** role with permissions: MANAGE_EMPLOYEE_DATA, MANAGE_REVIEW_CYCLES, EXPONENT_HR_EXPORT
  - Entra Group: `254a4461-f993-401a-bb0e-44f9ce70a58a`
- **Manager** role with permissions: MANAGE_COMPENSATION, APPROVE_COMPENSATION
  - Entra Group: `875b5dff-8d28-480a-a146-cd76afd0dafb`

## Test Fixtures

Located in `bcp-web/prisma/fixtures/uat/`:

### 1. account-executives.csv
4 AEs: Brian Miller, Justin Foster, Jim Hart, Sarah Thompson

### 2. employees-with-allocations.csv
~15+ employees across Equipment Sales department. Key fields:
- Manager: Samid Zafar (`copoint.samid.zafar@meriton.com`)
- Business Entity: TAS
- Mix of Full-Time/Part-Time, Salary/Hourly employees
- AE allocations (up to 4 AEs per employee with allocation % and QI %)
- Approval chain emails (Level 1: typically `copoint.justin.finch@meriton.com`)
- Salary ranges from $40k-$150k+
- Various bonus types: Team Lead Bonus, Quarterly Bonus, Annual Bonus Potential %

### 3. historical-snapshots.csv
Historical compensation data (annual rates, bonus totals, etc.) for comp history views.

### 4. actuals.csv
Actual earnings data (YTD gross, overtime, commissions, etc.) for the current year.

## Loading Fixtures via UI

The recommended approach for UAT is to load fixtures through the UI as an HR Admin:

1. **Impersonate as hr-admin**
2. **Navigate to `/hr/data-upload`**
3. **Upload in order**:
   - Account Executives CSV
   - Employees CSV (select the active review cycle)
   - Historical Snapshots CSV (enter the year)
   - Actuals CSV (enter the year)

Each import shows a results summary with accepted/rejected/flagged counts.

## Loading Fixtures via API

For faster setup, use the import API endpoints directly. These require HR Admin authentication (the impersonation headers handle this).

```bash
# Account Executives
curl -X POST http://localhost:4000/api/imports/account-executives \
  -F "file=@bcp-web/prisma/fixtures/uat/account-executives.csv"

# Employees (requires reviewCycleId as query param or in the form)
curl -X POST http://localhost:4000/api/imports/employees \
  -F "file=@bcp-web/prisma/fixtures/uat/employees-with-allocations.csv"
```

## Download Templates

The app provides CSV templates for each import type:
- `GET /api/imports/account-executives/template`
- `GET /api/imports/employees/template`
- `GET /api/imports/historical-snapshots/template`
- `GET /api/imports/actuals/template`

## Creating Review Cycles

If you need a fresh review cycle (e.g., after a full reset):

1. Impersonate as `hr-admin`
2. Navigate to `/hr/review-cycles/new`
3. Fill in: Name, Type (ANNUAL/MID_YEAR/QUARTERLY), Start Date, End Date
4. Save

Or the `db:reset-uat-data` script auto-creates one if none exists.

## Recommended UAT Data Setup Sequence

```
1. npm run db:reset-uat-data              # Clean slate
2. npm run db:sync-system-data:dev        # Ensure roles exist
3. Impersonate hr-admin                    # Switch to HR Admin
4. Visit app once (creates User record)   # Important for FK references
5. Upload account-executives.csv          # AEs first
6. Upload employees-with-allocations.csv  # Employees (needs review cycle)
7. Upload historical-snapshots.csv        # Historical data (optional)
8. Upload actuals.csv                     # Current year actuals (optional)
```

## Direct Database Queries

For advanced scenarios, you can run Prisma queries. Open Prisma Studio for a visual interface:

```bash
cd bcp-web && npx prisma studio
```

This opens a web UI at `http://localhost:5555` where you can browse and edit all tables.

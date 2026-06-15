# Project Constitution

> This document defines the non-negotiable principles and governance rules for **bonuscompplatform**.
> All agents and workflows must respect these principles.

## Project Overview

- **Name**: bonuscompplatform
- **Type**: greenfield
- **Track**: team

## Architecture: MVC with Interactors

### Core Principles
- Controllers are thin -- delegate to interactors
- Each interactor handles one use case
- Interactors are stateless and composable
- Models contain data and validation
- Views are presentational only

### Layer Responsibilities

**Models**: Data structures and business logic
- Contains: models, validators
- Data and validation only

**Views**: UI representation
- Contains: templates, components
- Presentational only
- No business logic

**Controllers**: Coordinate models and views
- Contains: controllers, routes
- Thin -- delegate to interactors

**Interactors**: Business logic extracted from controllers
- Contains: interactors, services
- Stateless
- One use case per interactor
- Composable

## Anti-Patterns to AVOID

- **Fat Controller**: Controller with too much business logic
  - Fix: Extract business logic into interactors

- **Interactor Calling Interactor**: Complex interdependencies between interactors
  - Fix: Have controllers compose interactors instead

## Security Principles

### Security

- Never commit secrets, API keys, or credentials to source control
- Validate all inputs at system boundaries (user input, external APIs)
- Use parameterized queries to prevent SQL injection
- Apply principle of least privilege for all access controls
- Sanitize output to prevent XSS attacks

## Quality Principles

### Code Quality

- Write self-documenting code with clear naming
- Keep functions focused and small (single responsibility)
- Prefer composition over inheritance
- Avoid premature optimization
- Delete dead code rather than commenting it out

### Testing

- Write tests for all new functionality
- Test behavior, not implementation details
- Maintain meaningful test coverage
- Use descriptive test names that explain the expected behavior
- Keep tests independent and isolated

### Error Handling

- Handle errors at appropriate boundaries
- Provide meaningful error messages to users
- Log errors with sufficient context for debugging
- Use structured error types (not generic Error)
- Never swallow errors silently

### Database Migrations

- **Each migration file must be atomic -- all-or-nothing.** A single migration
  must not contain multiple independent `BEGIN`/`COMMIT` blocks. If any
  statement fails, no statement in that file may be left committed.
- **Each migration file must be idempotent on re-run.** Re-applying an already-
  applied migration must be a no-op, not an error. Use `IF NOT EXISTS` on
  `CREATE INDEX`, `ADD VALUE IF NOT EXISTS` on enums, conditional `DO` blocks
  for `CREATE TYPE`, etc. Idempotence is what makes manual recovery safe when
  a failed migration has to be re-executed via `prisma migrate resolve
  --rolled-back` + redeploy.
- Prisma's generator sometimes emits multi-transaction files (commonly for enum
  swaps, or when an enum `ALTER` is mixed with other DDL that can't share a
  transaction). When that happens, **split the generated output into separate
  migration files** -- one per transaction boundary -- rather than shipping a
  single file with multiple commits. Each resulting file then succeeds or fails
  as a unit.
- Data preconditions required by a schema change (e.g. dedup before adding a
  unique constraint) must be enforced in a migration that runs **before** the
  constraining migration, not mixed into it.
- Rationale: atomic + idempotent migrations mean a failure leaves no partial
  state and retrying via the documented Prisma recovery flow is always safe.
  Recovery from a failed migration is manual and per-incident: fix the file,
  then trigger the pipeline with the `resolveRolledBackMigration` parameter
  set to the failed migration's name so Prisma re-runs it on the next deploy.
  See the `20260410085521_add_quarterly_bonus_enum` incident and
  <https://www.prisma.io/docs/guides/migrate/production-troubleshooting>.

## Governance Principles

### Governance

- All architecture decisions require team review
- Breaking changes require ADR documentation
- Security issues take priority over feature work
- Code review required before merging to main
- Document non-obvious design decisions
- This constitution is **immutable** during the project lifecycle
- All architectural decisions must reference this document
- Exceptions require explicit documentation and approval

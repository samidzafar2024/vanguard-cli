# Project Constitution: vanguard-cli

> This is your project's constitution — customize it to match your team's principles.
> Vanguard will not overwrite this file after initial creation.

## Project Overview

- **Name**: vanguard-cli
- **Type**: greenfield
- **Track**: team

## Architecture: MVC with Interactors

### Principles

- Controllers are thin -- delegate to interactors
- Each interactor handles one use case
- Interactors are stateless and composable
- Models contain data and validation
- Views are presentational only

### Layer Responsibilities

**Models**: Data structures and business logic
- Data and validation only

**Views**: UI representation
- Presentational only
- No business logic

**Controllers**: Coordinate models and views
- Thin -- delegate to interactors

**Interactors**: Business logic extracted from controllers
- Stateless
- One use case per interactor
- Composable

### Anti-Patterns to Avoid

- **Fat Controller**: Controller with too much business logic
- **Interactor Calling Interactor**: Complex interdependencies between interactors

## Quality Standards

- Write tests for all new functionality
- Keep functions focused and small
- Prefer composition over inheritance
- Delete dead code rather than commenting it out

## Security Principles

1. **No secrets in code** — Use environment variables
2. **Validate all inputs** — At system boundaries
3. **Parameterized queries only** — Never concatenate SQL
4. **Principle of least privilege** — Minimal permissions

## Governance

- All architecture decisions require documentation
- Breaking changes require team review
- Exceptions require explicit approval

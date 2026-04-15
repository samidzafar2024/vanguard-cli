# Specification: GitHub Packages Publishing

> Private npm distribution via GitHub Packages for internal team use.

## Overview

### Problem Statement

Vanguard CLI currently cannot be distributed to team members without manual setup. Developers need a simple `npx` command to install and run the CLI, but the tool must remain private/internal (not published to public npm registry).

### Success Metrics

- [x] Team members can run `npx @vanguard-data/vanguard-cli@alpha init` after one-time auth setup
- [x] Release process takes < 5 minutes from trigger to published package
- [x] Zero manual steps required during release (fully automated)
- [x] Support for alpha, beta, and stable release channels

## User Scenarios

### Persona: Internal Developer

**Goal**: Quickly initialize Vanguard in a new project without cloning repos or manual setup.

#### Scenario: First-Time Setup

1. Developer creates GitHub Personal Access Token with `read:packages` scope
2. Developer adds to `~/.npmrc`:
   ```
   //npm.pkg.github.com/:_authToken=TOKEN
   @vanguard-data:registry=https://npm.pkg.github.com
   ```
3. Developer runs `npx @vanguard-data/vanguard-cli@alpha init`
4. Vanguard initializes in their project directory
5. Developer can now use all Vanguard commands

#### Scenario: Subsequent Usage

1. Developer (already configured) runs `npx @vanguard-data/vanguard-cli@alpha init`
2. Latest alpha version is fetched and executed
3. Vanguard initializes in their project directory

#### Scenario: Version Pinning

1. Developer wants reproducible builds
2. Developer runs `npm install -D @vanguard-data/vanguard-cli@0.1.0-alpha.5`
3. Specific version is locked in package.json
4. Team uses consistent version across environments

### Persona: Release Manager

**Goal**: Publish new versions with minimal friction and clear versioning.

#### Scenario: Automatic Release on Push

1. Developer merges PR to main (or pushes directly)
2. GitHub Actions workflow triggers automatically
3. Quality checks (lint, typecheck, test) run
4. Workflow reads release channel from `RELEASE_CHANNEL` file (e.g., `alpha`)
5. Version auto-bumps (e.g., `0.1.0-alpha.1` to `0.1.0-alpha.2`)
6. Package publishes to GitHub Packages with appropriate tag
7. GitHub Release is created with auto-generated notes

#### Scenario: Transition Release Channel

1. Release manager edits `RELEASE_CHANNEL` file from `alpha` to `beta`
2. Release manager commits and pushes to main
3. Next release publishes as `0.1.0-beta.1` with `beta` tag
4. Previous alpha versions remain available for users who need them

#### Scenario: Failed Quality Check

1. Developer pushes to main
2. Tests fail in CI
3. Workflow stops before version bump or publish
4. No partial release; system remains in consistent state
5. Developer is notified of failure via GitHub Actions

## Functional Requirements

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-001 | Package published to GitHub Packages under `@vanguard-data` scope | Must | All |
| FR-002 | Support `npx @vanguard-data/vanguard-cli@alpha <command>` execution | Must | Internal Developer |
| FR-003 | NPX execution preserves user's working directory context | Must | Internal Developer |
| FR-004 | Support alpha, beta, and stable (latest) npm tags | Must | Release Manager |
| FR-005 | Automatic release triggered on push/merge to main | Must | Release Manager |
| FR-006 | Quality gates (lint, typecheck, test) run before publish | Must | Release Manager |
| FR-007 | GitHub Release created automatically on publish | Should | Release Manager |
| FR-008 | Release channel controlled via `RELEASE_CHANNEL` file | Must | Release Manager |
| FR-009 | Expose both `vanguard` and `vanguard-cli` as bin commands | Should | Internal Developer |
| FR-010 | Clear documentation for user authentication setup | Must | Internal Developer |

## Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Release workflow execution time | < 5 minutes |
| NFR-002 | NPX cold-start execution time | < 30 seconds |
| NFR-003 | Package size | < 5MB |
| NFR-004 | Node.js version support | >= 20.0.0 |

## Out of Scope

- Public npm registry publishing (explicitly private only)
- Docker/container distribution via GHCR.io
- Conventional commits for version bump determination (channel-based instead)
- Multiple organization support (single `@vanguard-data` scope)
- Windows-specific installation scripts
- GUI or web-based release management
- Manual release triggering (fully automated)

## Open Questions

- [x] Which registry? **Resolved: GitHub Packages (npm.pkg.github.com)**
- [x] Package scope? **Resolved: @vanguard-data**
- [x] Release trigger? **Resolved: Automatic on push/merge to main**
- [x] Version bumping? **Resolved: Channel file + auto-increment**

## Dependencies

- GitHub organization `Vanguard` must exist
- Repository must be under `vanguard-cli`
- Workflow permissions must allow packages:write

## References

- Technical Design: Completed in Architect phase (this conversation)
- Similar Implementation: [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)

---
_Generated by Vanguard for vanguard-cli_
_Architecture: Domain-Driven Design_

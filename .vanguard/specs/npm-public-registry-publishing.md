# Specification: Public npm Registry Publishing

> Open-source npm distribution via the public npm registry for community adoption.

## Overview

### Problem Statement

Vanguard CLI is currently configured for GitHub Packages (private registry), which requires authentication setup for every user. This creates friction for adoption:
- Users must create GitHub Personal Access Tokens
- Users must configure `.npmrc` with authentication
- Users must be part of the organization or have explicit access

By publishing to the public npm registry, any developer can install Vanguard globally and use it across all their projects - no authentication, no configuration, no barriers to entry.

### Success Metrics

- [ ] Anyone can install via `npm install -g vanguard-cli` without any prior setup
- [ ] After installation, `vanguard init` works in any project directory
- [ ] Package discoverable via `npm search vanguard-cli`
- [ ] Release process takes < 5 minutes from trigger to published package
- [ ] Zero manual steps required during release (fully automated)

## User Scenarios

### Persona: Community Developer

**Goal**: Install Vanguard once and use it across all projects.

#### Scenario: First-Time Installation (Happy Path)

1. Developer discovers Vanguard via documentation or recommendation
2. Developer runs `npm install -g vanguard-cli`
3. Package installs globally (no auth required)
4. Developer navigates to their project directory
5. Developer runs `vanguard init`
6. Vanguard initializes in their project
7. Developer can use `vanguard` commands in any project going forward

#### Scenario: Installing Specific Version

1. Developer needs a specific version for compatibility
2. Developer runs `npm install -g vanguard-cli@1.2.3`
3. Specified version installs globally
4. Developer runs `vanguard --version` to confirm

#### Scenario: Upgrading to New Version

1. Developer learns a new version is available
2. Developer runs `npm install -g vanguard-cli`
3. CLI updates to latest version
4. All projects now use the updated CLI

### Persona: Open Source Contributor

**Goal**: Contribute to Vanguard and see changes published.

#### Scenario: Contribution Published

1. Contributor opens PR with improvement
2. PR is reviewed and merged to main
3. GitHub Actions workflow triggers automatically
4. Quality checks pass
5. New version publishes to npm
6. Contributor can verify their change is live via `npm info vanguard-cli`

### Persona: Release Manager

**Goal**: Publish new versions with minimal friction and clear versioning.

#### Scenario: Automatic Release on Push

1. Developer merges PR to main (or pushes directly)
2. GitHub Actions workflow triggers automatically
3. Quality checks (lint, typecheck, test) run
4. Version auto-increments patch number (e.g., `1.2.3` to `1.2.4`)
5. Package publishes to npm registry
6. GitHub Release is created with auto-generated notes

#### Scenario: Manual Version Bump (Major/Minor)

1. Developer wants to release a new minor or major version
2. Developer updates version in `package.json` (e.g., `1.2.3` to `1.3.0` or `2.0.0`)
3. Developer commits and pushes to main
4. Workflow detects version already bumped, skips auto-increment
5. Package publishes with the specified version

#### Scenario: Failed Quality Check

1. Developer pushes to main
2. Tests fail in CI
3. Workflow stops before version bump or publish
4. No partial release; system remains in consistent state
5. Developer is notified of failure via GitHub Actions

## Functional Requirements

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-001 | Package published to public npm registry under `@vanguard` scope | Must | All |
| FR-002 | Support global installation via `npm install -g vanguard-cli` | Must | Community Developer |
| FR-003 | After installation, `vanguard` command available globally | Must | Community Developer |
| FR-004 | Semantic versioning (major.minor.patch) | Must | All |
| FR-005 | Automatic release triggered on push/merge to main | Must | Release Manager |
| FR-006 | Quality gates (lint, typecheck, test) run before publish | Must | Release Manager |
| FR-007 | GitHub Release created automatically on publish | Should | Release Manager |
| FR-008 | Auto-increment patch version on release | Must | Release Manager |
| FR-009 | Expose both `vanguard` and `vanguard-cli` as bin commands | Should | Community Developer |
| FR-010 | Package includes meaningful README for npm listing | Should | Community Developer |
| FR-011 | NPM_TOKEN secret used for publishing authentication | Must | Release Manager |

## Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Release workflow execution time | < 5 minutes |
| NFR-002 | CLI startup time | < 500ms |
| NFR-003 | Package size (excluding devDependencies) | < 5MB |
| NFR-004 | Node.js version support | >= 20.0.0 |
| NFR-005 | License | MIT (OSI approved) |

## Out of Scope

- GitHub Packages publishing (replaced by public npm)
- Private registry authentication setup documentation (no longer needed)
- Docker/container distribution via GHCR.io
- Conventional commits for automatic version determination
- Release channels (alpha/beta/latest dist-tags)
- Multiple organization support (single `@vanguard` scope)
- Windows-specific installation scripts
- GUI or web-based release management
- Manual release triggering (fully automated)
- npm organization setup (prerequisite)

## Open Questions

- [x] Which registry? **Resolved: Public npm registry (registry.npmjs.org)**
- [x] Package scope? **Resolved: @vanguard**
- [x] Release trigger? **Resolved: Automatic on push/merge to main**
- [x] Version bumping? **Resolved: Semantic versioning with auto-increment patch**
- [x] npm organization ownership? **Resolved: @vanguard (being created)**
- [x] NPM_TOKEN setup? **Resolved: User will configure GitHub secret**

## Dependencies

- npm organization `@vanguard` must exist on npmjs.com (being created)
- GitHub repository must have `NPM_TOKEN` secret configured (user responsibility)
- Token must have publish permissions for `@vanguard` scope

## Migration from GitHub Packages

This specification supersedes the GitHub Packages publishing spec. Required changes:

1. Update package name from `@vanguard-data/vanguard-cli` to `vanguard-cli`
2. Remove `publishConfig.registry` pointing to GitHub Packages
3. Change `publishConfig.access` from `restricted` to `public`
4. Update GitHub Actions workflow to use `NPM_TOKEN` instead of `GITHUB_TOKEN`
5. Remove `RELEASE_CHANNEL` file (no longer needed)

## References

- Previous Spec: `.vanguard/specs/github-packages-publishing.md` (superseded)
- Previous Plan: `.vanguard/plans/github-packages-publishing.md` (superseded)
- npm Scoped Packages: https://docs.npmjs.com/about-scopes

---
_Generated by Vanguard for vanguard-cli_
_Architecture: Domain-Driven Design_

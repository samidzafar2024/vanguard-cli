# Technical Plan: Public npm Registry Publishing

> Migrate Vanguard CLI distribution from GitHub Packages (private) to the public npm registry for frictionless community adoption.

**Specification**: `.vanguard/specs/npm-public-registry-publishing.md`

## Architecture Alignment

This plan follows **Domain-Driven Design** principles. While this feature is primarily infrastructure/CI-focused (not domain logic), we ensure:

1. No changes to domain layer required
2. Package metadata accurately reflects the project's domain terminology
3. Build and distribution remain decoupled from business logic

## Scope Summary

This is a **configuration-only change** with no TypeScript code modifications. All changes are to:
- `package.json` - Package metadata and registry configuration
- `.github/workflows/release.yml` - CI/CD pipeline
- `RELEASE_CHANNEL` - File removal

## Component Design

### Package Configuration Changes

**Layer**: Infrastructure (npm/package configuration)

**Responsibility**: Define package identity, registry target, and access level for npm publishing.

**Changes Required**:

| Field | Current Value | New Value |
|-------|---------------|-----------|
| `name` | `@vanguard-data/vanguard-cli` | `vanguard-cli` |
| `publishConfig.registry` | `https://npm.pkg.github.com` | *(removed - defaults to npmjs.org)* |
| `publishConfig.access` | `restricted` | `public` |

**Interface** (package.json structure):
```json
{
  "name": "vanguard-cli",
  "publishConfig": {
    "access": "public"
  }
}
```

### GitHub Actions Workflow

**Layer**: Infrastructure (CI/CD)

**Responsibility**: Automate quality checks, version management, and publishing to npm registry.

**Changes Required**:

1. **Registry URL**: Change from GitHub Packages to npm public registry
2. **Scope**: Update from `@vanguard-data` to `@vanguard`
3. **Authentication**: Use `NPM_TOKEN` secret instead of `GITHUB_TOKEN`
4. **Version Logic**: Simplify to auto-increment patch (remove channel complexity)
5. **Remove RELEASE_CHANNEL dependency**: No longer needed for public releases

**Interface** (workflow structure):
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    registry-url: "https://registry.npmjs.org"
    scope: "@vanguard"

- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Files to Remove

| File | Reason |
|------|--------|
| `RELEASE_CHANNEL` | No longer needed - public registry uses simple semver |

## Data Model

No domain entities affected. Package metadata is external configuration.

### Package Metadata (package.json)

| Field | Type | Purpose |
|-------|------|---------|
| name | string | Scoped package identifier |
| version | string | Semantic version (MAJOR.MINOR.PATCH) |
| publishConfig.access | `"public"` | Registry visibility |
| bin | object | CLI command mappings |
| engines.node | string | Node.js version constraint |

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Registry | registry.npmjs.org | Public access without authentication for consumers |
| Versioning | Auto-increment patch | Simplest approach per spec; major/minor bumps are manual |
| Authentication | NPM_TOKEN secret | Standard npm publishing credential (automation token) |
| Workflow Trigger | Push to main | Fully automated releases per FR-005 |
| Tag Format | `latest` only | Out of scope: no alpha/beta channels |

## Implementation Phases

### Phase 1: Package Configuration

Update `package.json` to target public npm registry.

- [ ] Change package name from `@vanguard-data/vanguard-cli` to `vanguard-cli`
- [ ] Remove `publishConfig.registry` (defaults to npmjs.org)
- [ ] Change `publishConfig.access` from `restricted` to `public`
- [ ] Update `repository.url` to correct GitHub URL (if needed)

**Files Modified**: `package.json`

### Phase 2: Workflow Simplification

Rewrite release workflow for public npm publishing.

- [ ] Change `registry-url` from GitHub Packages to `https://registry.npmjs.org`
- [ ] Change `scope` from `@vanguard-data` to `@vanguard`
- [ ] Replace `GITHUB_TOKEN` with `NPM_TOKEN` for authentication
- [ ] Remove "Read Release Channel" step
- [ ] Simplify "Calculate Version" to auto-increment patch only
- [ ] Update "Check Version Availability" to query npm registry (not GitHub)
- [ ] Update "Publish" step to use `--tag latest` (no channel logic)
- [ ] Remove prerelease logic from GitHub Release step

**Files Modified**: `.github/workflows/release.yml`

### Phase 3: Cleanup

Remove deprecated files and validate configuration.

- [ ] Delete `RELEASE_CHANNEL` file
- [ ] Verify workflow syntax with `yamllint` or similar
- [ ] Document `NPM_TOKEN` secret requirement in workflow comments

**Files Removed**: `RELEASE_CHANNEL`

## Detailed Workflow Design

The new release workflow will follow this sequence:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Checkout  │────▶│  Setup Node  │────▶│ npm install │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                    ┌──────────────────────────────────────┐
                    ▼                                      │
              ┌───────────┐                                │
              │  Quality  │  lint, typecheck, test         │
              │   Gates   │                                │
              └─────┬─────┘                                │
                    │ (fail = abort)                       │
                    ▼                                      │
        ┌────────────────────┐                             │
        │ Calculate Version  │  increment patch from       │
        │  (patch increment) │  current package.json       │
        └─────────┬──────────┘                             │
                  ▼                                        │
        ┌────────────────────┐                             │
        │ Check Availability │  npm view @vanguard/...   │
        │  (npm registry)    │                             │
        └─────────┬──────────┘                             │
                  │ (exists = abort)                       │
                  ▼                                        │
        ┌────────────────────┐                             │
        │  Update Version    │  npm version --no-git-tag   │
        │  in package.json   │                             │
        └─────────┬──────────┘                             │
                  ▼                                        │
        ┌────────────────────┐                             │
        │      Build         │  npm run build              │
        └─────────┬──────────┘                             │
                  ▼                                        │
        ┌────────────────────┐                             │
        │  Publish to npm    │  npm publish --tag latest   │
        │  (NPM_TOKEN)       │                             │
        └─────────┬──────────┘                             │
                  ▼                                        │
        ┌────────────────────┐                             │
        │  Create GitHub     │  softprops/action-gh-release│
        │  Release           │  (prerelease: false)        │
        └─────────┬──────────┘                             │
                  ▼                                        │
        ┌────────────────────┐                             │
        │  Commit Version    │  push version bump to main  │
        │  Bump              │                             │
        └─────────┬──────────┘                             │
                  ▼                                        │
              [Complete]
```

### Version Calculation Logic

```bash
# Get current version from package.json
CURRENT=$(node -p "require('./package.json').version")

# Check if this is a manual version bump (version changed in this push)
git diff HEAD~1 package.json | grep '"version"' && MANUAL_BUMP=true || MANUAL_BUMP=false

if [ "$MANUAL_BUMP" = "true" ]; then
  # Use the version from package.json as-is (developer manually bumped)
  NEW_VERSION="$CURRENT"
else
  # Auto-increment patch version
  # e.g., 1.2.3 -> 1.2.4
  NEW_VERSION=$(echo $CURRENT | awk -F. '{$NF = $NF + 1} 1' OFS=.)
fi
```

This supports:
- **Automatic patch bumps**: Default behavior on every push to main
- **Manual major/minor bumps**: Developer changes version in package.json before pushing

## Testing Strategy

### Manual Verification (Pre-Merge)

Since this is CI/CD configuration, automated tests don't apply. Instead:

1. **Workflow Syntax**: Validate YAML syntax
   ```bash
   # Install act for local workflow testing (optional)
   act -n push  # Dry-run the workflow
   ```

2. **Package Configuration**: Verify with npm pack
   ```bash
   npm pack --dry-run
   # Verify output shows correct package name and files
   ```

3. **Version Calculation**: Test script logic locally
   ```bash
   CURRENT="1.2.3"
   NEW_VERSION=$(echo $CURRENT | awk -F. '{$NF = $NF + 1} 1' OFS=.)
   echo $NEW_VERSION  # Should output 1.2.4
   ```

### Post-Deployment Verification

After the first release:

- [ ] Verify package exists: `npm view vanguard-cli`
- [ ] Test installation: `npm install -g vanguard-cli`
- [ ] Verify CLI works: `vanguard --version`
- [ ] Verify CLI alias works: `vanguard-cli --version`
- [ ] Check npm search: `npm search vanguard-cli`

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| NPM_TOKEN not configured | Publish fails | Medium | Document secret requirement; workflow fails fast with clear error |
| npm org `@vanguard` not created | Publish fails | Low | Pre-requisite documented in spec; check before merge |
| Package name collision | Cannot publish | Very Low | Scoped packages are namespaced; `vanguard-cli` is unique |
| Version already exists | Publish fails | Low | Check version availability before publish; fail gracefully |
| Accidental publish of breaking change | User impact | Medium | Quality gates run before publish; recommend semantic versioning discipline |
| GitHub Actions concurrent runs | Race condition on version | Low | GitHub Actions serializes pushes to same branch by default |

## Security Considerations

1. **NPM_TOKEN Secret**: Must be an automation token (not granular) with publish access to `@vanguard` scope only
2. **Token Permissions**: Token should have minimal scope - only `publish` for the specific package
3. **No Secrets in Code**: All credentials remain in GitHub Secrets
4. **Public Access**: Package contents will be publicly visible - ensure no secrets in source

## Prerequisites (External)

Before this plan can be executed:

1. **npm Organization**: `@vanguard` must exist on npmjs.com
2. **npm Token**: Automation token with publish access must be created
3. **GitHub Secret**: `NPM_TOKEN` must be added to repository secrets

## Rollback Plan

If issues arise after implementation:

1. **Revert Workflow**: Restore previous `release.yml` from git history
2. **Unpublish (if needed)**: `npm unpublish vanguard-cli@<version>` (within 72 hours only)
3. **Revert package.json**: Restore previous name and publishConfig

Note: npm has strict policies on unpublishing. If a version is published, it generally cannot be reused even after unpublishing.

## Acceptance Criteria Mapping

| Requirement ID | Implementation |
|----------------|----------------|
| FR-001 | `package.json` name and publishConfig |
| FR-002 | `bin` field in package.json (already exists) |
| FR-003 | `bin` field in package.json (already exists) |
| FR-004 | Version calculation logic in workflow |
| FR-005 | Workflow trigger on push to main |
| FR-006 | Quality Gates step in workflow |
| FR-007 | `softprops/action-gh-release` step |
| FR-008 | Patch auto-increment in Calculate Version step |
| FR-009 | `bin` field already has both commands |
| FR-010 | Package already includes README via npm default |
| FR-011 | `NPM_TOKEN` environment variable in publish step |

---
_Generated by Vanguard for vanguard-cli_
_Stack: Plain TypeScript_
_Architecture: Domain-Driven Design_

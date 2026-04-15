# Task: Cleanup and Verification

> Self-contained task with full context for removing deprecated files and verifying the complete implementation.

## Context

**Spec**: `.vanguard/specs/npm-public-registry-publishing.md`
**Plan**: `.vanguard/plans/npm-public-registry-publishing.md`
**Epic**: Public npm Registry Publishing

## Objective

Remove the deprecated `RELEASE_CHANNEL` file and perform comprehensive verification that all changes work together correctly.

## Acceptance Criteria

- [ ] `RELEASE_CHANNEL` file deleted from repository root
- [ ] `npm pack --dry-run` produces valid output with correct package name
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] Workflow YAML syntax is valid
- [ ] All quality gates pass: `npm run check`

## Implementation Notes

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `RELEASE_CHANNEL` | Delete | No longer needed for public registry |

### Architecture Guidance

**Layer**: Infrastructure (cleanup)

**Pattern**: N/A - file deletion and verification only

### Why RELEASE_CHANNEL is No Longer Needed

The `RELEASE_CHANNEL` file was used to control npm dist-tags for GitHub Packages:
- `alpha` -> publishes with `--tag alpha`
- `beta` -> publishes with `--tag beta`
- `latest` -> publishes with `--tag latest`

For public npm registry publishing, we're simplifying to always use `--tag latest`. Per the specification, release channels (alpha/beta/latest dist-tags) are explicitly out of scope.

### Verification Checklist

#### 1. Package Configuration
```bash
# Verify package name is correct
npm pack --dry-run 2>&1 | grep "name:"
# Expected: npm notice name: vanguard-cli

# Verify publishConfig
node -p "JSON.stringify(require('./package.json').publishConfig, null, 2)"
# Expected: { "access": "public" }
```

#### 2. Quality Gates
```bash
# Run all checks
npm run lint
npm run typecheck
npm run test

# Or use the combined check command
npm run check
```

#### 3. Workflow Syntax
```bash
# Option 1: Basic YAML validation
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/release.yml', 'utf8'))"

# Option 2: Use yamllint if available
yamllint .github/workflows/release.yml

# Option 3: GitHub CLI (if authenticated)
gh workflow view release.yml
```

#### 4. RELEASE_CHANNEL Removal
```bash
# Verify file is deleted
ls RELEASE_CHANNEL 2>&1
# Expected: ls: cannot access 'RELEASE_CHANNEL': No such file or directory

# Verify no references remain in workflow
grep -r "RELEASE_CHANNEL" .github/workflows/ || echo "No references found (good)"
```

## Dependencies

- [ ] Depends on: task-001 (Update package.json)
- [ ] Depends on: task-002 (Rewrite release workflow)
- [ ] Blocks: None (final task)

## Testing Requirements

No new automated tests required. This task runs existing tests to verify nothing was broken.

### Full Verification Script

```bash
#!/bin/bash
set -e

echo "=== Verifying npm Public Registry Publishing Implementation ==="

echo ""
echo "1. Checking RELEASE_CHANNEL is deleted..."
if [ -f "RELEASE_CHANNEL" ]; then
  echo "ERROR: RELEASE_CHANNEL still exists"
  exit 1
fi
echo "   OK: RELEASE_CHANNEL deleted"

echo ""
echo "2. Checking package.json configuration..."
PKG_NAME=$(node -p "require('./package.json').name")
if [ "$PKG_NAME" != "vanguard-cli" ]; then
  echo "ERROR: Package name is '$PKG_NAME', expected 'vanguard-cli'"
  exit 1
fi
echo "   OK: Package name is correct"

PKG_ACCESS=$(node -p "require('./package.json').publishConfig.access")
if [ "$PKG_ACCESS" != "public" ]; then
  echo "ERROR: publishConfig.access is '$PKG_ACCESS', expected 'public'"
  exit 1
fi
echo "   OK: publishConfig.access is 'public'"

PKG_REGISTRY=$(node -p "require('./package.json').publishConfig.registry || 'not set'")
if [ "$PKG_REGISTRY" != "not set" ]; then
  echo "ERROR: publishConfig.registry should not be set, found '$PKG_REGISTRY'"
  exit 1
fi
echo "   OK: publishConfig.registry not set (defaults to npmjs.org)"

echo ""
echo "3. Checking workflow configuration..."
if ! grep -q "registry.npmjs.org" .github/workflows/release.yml; then
  echo "ERROR: Workflow does not use registry.npmjs.org"
  exit 1
fi
echo "   OK: Workflow uses registry.npmjs.org"

if ! grep -q "NPM_TOKEN" .github/workflows/release.yml; then
  echo "ERROR: Workflow does not use NPM_TOKEN"
  exit 1
fi
echo "   OK: Workflow uses NPM_TOKEN"

if grep -q "RELEASE_CHANNEL" .github/workflows/release.yml; then
  echo "ERROR: Workflow still references RELEASE_CHANNEL"
  exit 1
fi
echo "   OK: Workflow does not reference RELEASE_CHANNEL"

echo ""
echo "4. Running quality gates..."
npm run lint
npm run typecheck
npm run test

echo ""
echo "5. Testing npm pack..."
npm pack --dry-run

echo ""
echo "=== All verifications passed ==="
```

## Post-Merge Verification

After merging to main and the first release runs:

- [ ] GitHub Actions workflow completes successfully
- [ ] Package visible on npmjs.com: `npm view vanguard-cli`
- [ ] Global installation works: `npm install -g vanguard-cli`
- [ ] CLI executable works: `vanguard --version`
- [ ] GitHub Release created with correct version tag

## Requirements Traceability

| Requirement | Status |
|-------------|--------|
| NFR-001: Release workflow < 5 minutes | Verified post-deployment |
| NFR-002: CLI startup < 500ms | Existing (no change) |
| NFR-003: Package size < 5MB | Verified by npm pack |
| NFR-004: Node.js >= 20.0.0 | Existing (no change) |
| NFR-005: MIT License | Existing (no change) |

## Rollback Instructions

If issues are discovered after deployment:

1. **Revert PR**: Use GitHub UI to revert the merge commit
2. **Restore RELEASE_CHANNEL**: `git checkout HEAD~1 -- RELEASE_CHANNEL`
3. **Restore package.json**: `git checkout HEAD~1 -- package.json`
4. **Restore workflow**: `git checkout HEAD~1 -- .github/workflows/release.yml`

---
_Generated by Vanguard for vanguard-cli_

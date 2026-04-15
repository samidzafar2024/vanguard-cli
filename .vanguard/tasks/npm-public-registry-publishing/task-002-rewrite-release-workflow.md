# Task: Rewrite Release Workflow for npm Registry

> Self-contained task with full context for updating the GitHub Actions release workflow.

## Context

**Spec**: `.vanguard/specs/npm-public-registry-publishing.md`
**Plan**: `.vanguard/plans/npm-public-registry-publishing.md`
**Epic**: Public npm Registry Publishing

## Objective

Rewrite the GitHub Actions release workflow to publish to the public npm registry instead of GitHub Packages, with simplified version management (auto-increment patch).

## Acceptance Criteria

- [ ] Workflow uses `registry-url: https://registry.npmjs.org`
- [ ] Workflow uses `scope: @vanguard`
- [ ] Authentication uses `NPM_TOKEN` secret (not `GITHUB_TOKEN`)
- [ ] "Read Release Channel" step removed
- [ ] Version calculation auto-increments patch (e.g., 1.2.3 -> 1.2.4)
- [ ] Version calculation supports manual major/minor bumps (detects if version already changed)
- [ ] "Check Version Availability" queries npm registry (not GitHub Packages)
- [ ] "Publish" step uses `npm publish` with `--tag latest`
- [ ] GitHub Release step has `prerelease: false` (not conditional)
- [ ] Workflow YAML is valid syntax
- [ ] Lint passes: `npm run lint`

## Implementation Notes

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/release.yml` | Modify | Complete rewrite of release workflow |

### Architecture Guidance

**Layer**: Infrastructure (CI/CD)

**Pattern**: GitHub Actions workflow with sequential job steps

### Current Workflow Structure

```yaml
# Current (GitHub Packages)
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    registry-url: "https://npm.pkg.github.com"
    scope: "@vanguard-data"

- name: Read Release Channel
  run: CHANNEL=$(cat RELEASE_CHANNEL | tr -d '[:space:]')

- name: Publish to GitHub Packages
  run: npm publish --tag ${{ steps.channel.outputs.channel }}
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Target Workflow Structure

```yaml
name: Release

on:
  push:
    branches: [main]
    paths-ignore:
      - "*.md"
      - "docs/**"
      - ".vanguard/**"
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"
          scope: "@vanguard"

      - name: Install dependencies
        run: npm ci

      - name: Quality Gates
        run: |
          npm run lint
          npm run typecheck
          npm run test

      - name: Calculate Version
        id: version
        run: |
          CURRENT=$(node -p "require('./package.json').version")

          # Check if version was manually bumped in this push
          if git diff HEAD~1 --name-only | grep -q "package.json"; then
            PREV_VERSION=$(git show HEAD~1:package.json | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).version")
            if [ "$CURRENT" != "$PREV_VERSION" ]; then
              echo "Manual version bump detected: $PREV_VERSION -> $CURRENT"
              echo "version=$CURRENT" >> $GITHUB_OUTPUT
              exit 0
            fi
          fi

          # Auto-increment patch version
          NEW_VERSION=$(echo $CURRENT | awk -F. '{$NF = $NF + 1} 1' OFS=.)
          echo "Auto-incrementing version: $CURRENT -> $NEW_VERSION"
          echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT

      - name: Check Version Availability
        run: |
          VERSION=${{ steps.version.outputs.version }}
          if npm view vanguard-cli@${VERSION} version 2>/dev/null; then
            echo "::error::Version ${VERSION} already exists on npm registry"
            exit 1
          fi
          echo "Version ${VERSION} is available"

      - name: Update Version
        run: |
          npm version ${{ steps.version.outputs.version }} --no-git-tag-version
          npm run format

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish --tag latest
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ steps.version.outputs.version }}
          name: v${{ steps.version.outputs.version }}
          generate_release_notes: true
          prerelease: false

      - name: Commit Version Bump
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add package.json package-lock.json
          git commit -m "chore: bump version to ${{ steps.version.outputs.version }}"
          git push
```

### Key Changes Explained

| Change | Before | After | Reason |
|--------|--------|-------|--------|
| registry-url | npm.pkg.github.com | registry.npmjs.org | Public npm registry |
| scope | @vanguard-data | @vanguard | New organization |
| permissions | contents: write, packages: write | contents: write | No packages permission needed for npm |
| Read Release Channel | Present | Removed | No channel logic for public releases |
| Calculate Version | Channel-based prerelease | Simple patch increment | Simplified versioning |
| Check Availability | GitHub Packages | npm registry | Different registry to check |
| Publish auth | GITHUB_TOKEN | NPM_TOKEN | Different auth mechanism |
| prerelease flag | Conditional on channel | Always false | All public releases are stable |

### Version Calculation Logic

The version calculation supports two scenarios:

1. **Automatic patch bump** (default): If no version change detected in commit, increment patch
   - `0.1.0` -> `0.1.1`
   - `1.2.3` -> `1.2.4`

2. **Manual version bump**: If developer changed version in package.json, use that version
   - Developer sets `1.3.0` -> workflow publishes `1.3.0`
   - Developer sets `2.0.0` -> workflow publishes `2.0.0`

## Dependencies

- [ ] Depends on: task-001 (Update package.json) - package name must be correct first
- [ ] Blocks: task-003 (Cleanup and verification)

## Testing Requirements

No automated tests - this is CI/CD configuration.

### Manual Verification

1. **YAML Syntax Validation**
   ```bash
   # Option 1: Use yamllint
   yamllint .github/workflows/release.yml

   # Option 2: Use GitHub Actions extension in VS Code
   # Option 3: Push to a branch and check GitHub Actions UI for syntax errors
   ```

2. **Version Calculation Logic Test**
   ```bash
   # Test patch increment
   CURRENT="1.2.3"
   NEW_VERSION=$(echo $CURRENT | awk -F. '{$NF = $NF + 1} 1' OFS=.)
   echo $NEW_VERSION  # Should output: 1.2.4

   # Test with different versions
   echo "0.1.0" | awk -F. '{$NF = $NF + 1} 1' OFS=.  # 0.1.1
   echo "2.0.0" | awk -F. '{$NF = $NF + 1} 1' OFS=.  # 2.0.1
   ```

## Requirements Traceability

| Requirement | Status |
|-------------|--------|
| FR-004: Semantic versioning | Implemented by version calculation |
| FR-005: Automatic release on push to main | Implemented by workflow trigger |
| FR-006: Quality gates before publish | Implemented by Quality Gates step |
| FR-007: GitHub Release created automatically | Implemented by softprops/action-gh-release |
| FR-008: Auto-increment patch version | Implemented by Calculate Version step |
| FR-011: NPM_TOKEN used for publishing | Implemented by publish step env |

## Notes

- The `NPM_TOKEN` secret must be configured in GitHub repository settings before this workflow will succeed
- The npm organization `@vanguard` must exist on npmjs.com
- First run after merge will publish whatever version is calculated

---
_Generated by Vanguard for vanguard-cli_

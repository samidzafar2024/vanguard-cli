# Task 004: GitHub Actions Release Workflow

> Create automated CI/CD pipeline for publishing to GitHub Packages.

## Context

**Spec**: `.vanguard/specs/github-packages-publishing.md`
**Plan**: `.vanguard/plans/github-packages-publishing.md`
**Epic**: GitHub Packages Publishing

## Objective

Implement a fully automated GitHub Actions workflow that runs quality checks, bumps versions, publishes to GitHub Packages, and creates GitHub Releases on every push to main.

## Acceptance Criteria

- [x] Workflow file created at `.github/workflows/release.yml`
- [x] Workflow triggers on push to `main` branch
- [x] Quality gates run: lint, typecheck, test
- [x] Workflow fails fast if quality gates fail (no publish)
- [x] Version auto-increments based on channel
- [x] Package publishes to GitHub Packages with correct tag
- [x] GitHub Release created with auto-generated notes
- [x] Version bump committed back to repository
- [x] Workflow completes in < 5 minutes (NFR-001)

## Implementation Notes

### Files to Create

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/release.yml` | Create | Release automation workflow |

### Workflow Structure

```yaml
name: Release

on:
  push:
    branches: [main]
    paths-ignore:
      - '*.md'
      - 'docs/**'
      - '.vanguard/**'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write

    steps:
      # 1. Checkout with full history for version calculation
      # 2. Setup Node.js 20
      # 3. Install dependencies
      # 4. Run quality gates (lint, typecheck, test)
      # 5. Read RELEASE_CHANNEL file
      # 6. Calculate next version
      # 7. Update package.json version
      # 8. Build TypeScript
      # 9. Publish to GitHub Packages
      # 10. Create GitHub Release
      # 11. Commit version bump
```

### Detailed Step Implementation

#### Step 1: Checkout
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### Step 2: Setup Node.js
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://npm.pkg.github.com'
    scope: '@vanguard-data'
```

#### Step 3: Install Dependencies
```yaml
- run: npm ci
```

#### Step 4: Quality Gates
```yaml
- name: Quality Gates
  run: |
    npm run lint
    npm run typecheck
    npm run test
```

#### Step 5: Read Release Channel
```yaml
- name: Read Release Channel
  id: channel
  run: |
    CHANNEL=$(cat RELEASE_CHANNEL | tr -d '[:space:]')
    echo "channel=$CHANNEL" >> $GITHUB_OUTPUT
```

#### Step 6: Calculate Next Version
```yaml
- name: Calculate Version
  id: version
  run: |
    CURRENT=$(node -p "require('./package.json').version")
    CHANNEL=${{ steps.channel.outputs.channel }}

    # Parse current version
    BASE_VERSION=$(echo $CURRENT | sed 's/-.*//')

    if [ "$CHANNEL" = "latest" ]; then
      # Stable release - use base version
      NEW_VERSION="$BASE_VERSION"
    else
      # Prerelease - increment prerelease number
      # Get current prerelease number or start at 1
      PRERELEASE_NUM=$(echo $CURRENT | grep -oP '(?<=\.)[0-9]+$' || echo "0")
      NEW_NUM=$((PRERELEASE_NUM + 1))
      NEW_VERSION="${BASE_VERSION}-${CHANNEL}.${NEW_NUM}"
    fi

    echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT
```

#### Step 7: Update package.json
```yaml
- name: Update Version
  run: npm version ${{ steps.version.outputs.version }} --no-git-tag-version
```

#### Step 8: Build
```yaml
- name: Build
  run: npm run build
```

#### Step 9: Publish
```yaml
- name: Publish to GitHub Packages
  run: npm publish --tag ${{ steps.channel.outputs.channel }}
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Step 10: Create Release
```yaml
- name: Create GitHub Release
  uses: softprops/action-gh-release@v1
  with:
    tag_name: v${{ steps.version.outputs.version }}
    name: v${{ steps.version.outputs.version }}
    generate_release_notes: true
    prerelease: ${{ steps.channel.outputs.channel != 'latest' }}
```

#### Step 11: Commit Version Bump
```yaml
- name: Commit Version Bump
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add package.json package-lock.json
    git commit -m "chore: bump version to ${{ steps.version.outputs.version }}"
    git push
```

### Architecture Guidance

**Layer**: Infrastructure (CI/CD)

**Pattern**: Trunk-based development with automated releases

Key design decisions:
1. **Single workflow**: Combines CI and CD for simplicity
2. **Fail-fast**: Quality gates before any publishing
3. **Atomic operations**: Either full release or nothing
4. **Channel-based tagging**: No conventional commits complexity

### Permissions Required

The workflow uses `GITHUB_TOKEN` (automatically provided) with:
- `contents: write` - For creating releases and committing version bumps
- `packages: write` - For publishing to GitHub Packages

## Dependencies

- [ ] Depends on: Task 001 (Package Configuration)
- [ ] Depends on: Task 002 (Build Configuration)
- [ ] Depends on: Task 003 (Release Channel File)
- [ ] Blocks: Task 005 (Documentation)

## Testing Requirements

- [ ] Workflow syntax is valid: Push to branch and verify Actions tab
- [ ] Quality gates execute correctly
- [ ] Version calculation works for alpha channel
- [ ] Dry-run publish shows correct registry
- [ ] Workflow handles first-time publish (no existing versions)

### Pre-Merge Testing

Before merging to main:
1. Create workflow file
2. Push to feature branch
3. Verify workflow syntax in Actions tab (will show errors if invalid)
4. Cannot fully test publish until merge (requires main branch)

### Post-Merge Verification

After first merge to main:
1. Verify workflow runs successfully
2. Check GitHub Packages for published package
3. Verify version number format
4. Verify GitHub Release created
5. Test `npx @vanguard-data/vanguard-cli@alpha --help`

## Notes

- First run may require manual package visibility settings in GitHub
- Repository must be in `Vanguard` org for scoped package to work
- If workflow fails on first run, check:
  1. Repository permissions allow Actions to push
  2. Package scope matches org name
  3. RELEASE_CHANNEL file exists

---
_Generated by Vanguard Scrum Master Agent_

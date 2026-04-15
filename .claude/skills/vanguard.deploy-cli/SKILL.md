---
description: "Deploy the vanguard-cli package to npm by merging changes to the main branch"
---

# Vanguard: deploy-cli Action

**Project**: Sample Project

## Before You Begin

1. **Read the manifest** at `vanguard.manifest.yaml` to understand:
   - Current project state and active documents
   - What specs, plans, and tasks exist
   - Document summaries for quick context

2. **Check document status** in the manifest:
   - `specs`: Feature specifications
   - `plans`: Technical designs
   - `tasks`: Implementation tasks with status

3. **Verify prerequisites**:
   - All tests are passing
   - Version has been bumped appropriately
   - CHANGELOG.md has been updated
   - No uncommitted changes in working directory

## Instructions

### Step 1: Pre-deployment Verification

Before initiating the deployment process:

1. **Confirm test suite status**:
   ```bash
   npm test
   ```
   All tests must pass before proceeding.

2. **Verify version bump**:
   - Check `package.json` for the new version number
   - Ensure version follows semantic versioning (MAJOR.MINOR.PATCH)
   - Confirm version hasn't been published to npm yet:
     ```bash
     npm view vanguard-cli versions
     ```

3. **Review CHANGELOG.md**:
   - New version is documented with release date
   - All significant changes are listed
   - Breaking changes are clearly marked

4. **Check build artifacts**:
   ```bash
   npm run build
   ```
   Ensure the build completes successfully with no errors.

### Step 2: Final Branch Preparation

1. **Ensure you're on a feature/release branch**:
   ```bash
   git branch --show-current
   ```
   Should NOT be `main` yet.

2. **Commit all changes**:
   ```bash
   git status
   git add .
   git commit -m "chore: prepare release v{VERSION}"
   ```

3. **Push branch to remote**:
   ```bash
   git push origin {BRANCH_NAME}
   ```

### Step 3: Create Pull Request

1. **Create PR to main**:
   - Title: "Release v{VERSION}"
   - Description should include:
     - Version number
     - Key changes from CHANGELOG
     - Any deployment notes or breaking changes
     - Link to any related issues

2. **Request review** (if team workflow requires it)

3. **Wait for CI/CD checks** to pass:
   - Build verification
   - Test suite execution
   - Linting checks
   - Any other automated validations

### Step 4: Merge to Main

1. **Review PR one final time**:
   - All checks passing
   - No merge conflicts
   - Code review approved (if required)

2. **Merge the pull request**:
   - Use "Squash and merge" or "Create a merge commit" based on team conventions
   - Ensure merge commit message is clear: "Release v{VERSION}"

3. **Delete the feature branch** after successful merge (optional, based on team policy)

### Step 5: Monitor Automated Deployment

Once merged to `main`, the CI/CD pipeline should automatically:

1. **Trigger the publish workflow**:
   - GitHub Actions (or similar) detects merge to main
   - Runs final verification steps
   - Publishes to npm registry

2. **Monitor the deployment**:
   - Check CI/CD logs for any errors
   - Verify package appears on npm:
     ```bash
     npm view vanguard-cli
     ```
   - Confirm the version number matches

3. **Create GitHub Release** (if not automated):
   - Tag: `v{VERSION}`
   - Title: "v{VERSION}"
   - Description: Copy from CHANGELOG.md
   - Mark as latest release

### Step 6: Post-deployment Verification

1. **Test installation from npm**:
   ```bash
   npm install -g vanguard-cli@{VERSION}
   vanguard --version
   ```

2. **Verify basic functionality**:
   ```bash
   vanguard --help
   vanguard init
   ```

3. **Check npm package page**:
   - Visit https://www.npmjs.com/package/vanguard-cli
   - Verify README displays correctly
   - Check download stats

### Step 7: Communication

1. **Announce the release**:
   - Update project documentation
   - Notify team members
   - Post to relevant channels (Discord, Slack, etc.)
   - Update any dependent projects

2. **Monitor for issues**:
   - Watch for bug reports
   - Check GitHub issues
   - Monitor npm download errors

## Troubleshooting

**If CI/CD publish fails**:
1. Check npm authentication token is valid
2. Verify version doesn't already exist on npm
3. Review CI/CD logs for specific error messages
4. If necessary, manually publish:
   ```bash
   npm publish
   ```

**If tests fail after merge**:
1. Immediately create hotfix branch
2. Fix the failing tests
3. Follow emergency hotfix procedure

**If wrong version was published**:
1. Cannot unpublish after 24 hours
2. If within 24 hours and no downloads:
   ```bash
   npm unpublish vanguard-cli@{VERSION}
   ```
3. Otherwise, publish patch version with fix

## After Completion

1. **Update the manifest**:
   - Mark any release-related tasks as completed
   - Document the deployed version
   - Note the deployment timestamp

2. **Archive release artifacts**:
   - Ensure git tags are pushed
   - GitHub release is created
   - Release notes are preserved

3. **Prepare for next iteration**:
   - Create new development branch if needed
   - Set up next version in package.json (with -dev suffix)
   - Update project roadmap

---

## Arguments

$ARGUMENTS

---

_Vanguard deploy-cli command for unknown stack + MVC with Interactors_
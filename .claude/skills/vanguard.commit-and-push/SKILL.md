---
description: "Creates commits for the current changes related to the current work on the current branch, and push to the remote repository."
---

# Vanguard: commit-and-push Action

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

3. **Verify git status**:
   - Review all modified, added, and deleted files
   - Ensure changes are related to current work
   - Check current branch name

## Instructions

### Step 1: Review Current Changes

Run `git status` and `git diff` to examine all pending changes. Verify that:
- All changes are intentional and related to the current work
- No sensitive data, credentials, or debug code is included
- File permissions and structure are correct

### Step 2: Stage Related Changes

Group changes logically based on their purpose:
- Feature implementation changes
- Test additions or updates
- Documentation updates
- Configuration changes
- Dependency updates

Stage each group separately using `git add <files>` for precise commit organization.

### Step 3: Create Commits

For each logical group of changes, create a focused commit:

```bash
git commit -m "Add user authentication flow"
```

**Commit Message Guidelines**:
- Use imperative mood ("Add feature" not "Added feature")
- Keep first line under 72 characters
- Be specific and descriptive
- Focus on what and why, not how
- Examples:
  - "Add login validation with email format check"
  - "Update user schema to include role field"
  - "Fix pagination bug in search results"
  - "Refactor API client error handling"

**Avoid**:
- Generic messages like "fixes" or "updates"
- References to Claude, AI, or vendor-specific tools
- Implementation details better suited for code comments

### Step 4: Verify Commits

Review your commits before pushing:

```bash
git log --oneline -n 5
git show HEAD
```

Ensure each commit:
- Has a clear, descriptive message
- Contains related changes only
- Builds upon previous commits logically

### Step 5: Push to Remote

Push your commits to the remote repository:

```bash
git push origin <branch-name>
```

If this is a new branch:

```bash
git push -u origin <branch-name>
```

Handle any conflicts or rejections appropriately:
- If rejected due to remote changes, pull and rebase first
- Resolve any merge conflicts carefully
- Re-run tests if necessary after conflict resolution

## After Completion

1. **Update the manifest** at `vanguard.manifest.yaml`:
   - Mark any completed tasks as `status: done`
   - Update document statuses if specs or plans were implemented
   - Add summary notes about what was committed

2. **Verify remote state**:
   - Confirm commits appear in remote repository
   - Check that branch is up to date
   - Verify CI/CD pipelines triggered if applicable

---

## Arguments

$ARGUMENTS

---

_Vanguard commit-and-push command for unknown stack + MVC with Interactors_
---
description: "Create a PR from current branch linked to an ADO User Story"
---

# WayPoint: Pull Request

**Project**: bonuscompplatform

## Purpose

Create a pull request from the current branch and link it to an Azure DevOps User Story.
Takes a spec name (the manifest key or filename) and reads the `**Ticket**:` field to get the ADO story ID.

## Workflow

### Step 1: Resolve the Spec and Story ID

The `$ARGUMENTS` should be a spec identifier — either:
- A manifest key (e.g., `auth-resolution-hardening`)
- A spec filename (e.g., `auth-resolution-hardening.md`)
- A path (e.g., `.waypoint/specs/auth-resolution-hardening.md`)

**Resolution steps:**

1. Read `waypoint.manifest.yaml` to find the spec entry matching `$ARGUMENTS`
2. Read the spec file and extract the `**Ticket**:` field (a numeric ADO story ID)
3. If `**Ticket**:` is missing or non-numeric → abort with:
   `"Spec '{name}' has no ADO ticket. Run /waypoint.sync first to create the User Story."`

If `$ARGUMENTS` is empty:
1. Read `waypoint.manifest.yaml` and list all specs that have tasks
2. Ask the user which spec this PR is for
3. Then proceed with that spec

### Step 2: Fetch the User Story Title

```bash
az boards work-item show --id {story-id} --output json
```

Extract `System.Title` from the response.

### Step 3: Check Branch State

```bash
git branch --show-current
git log main..HEAD --oneline
```

- If no commits ahead of main → warn and abort
- Show the commit list for the PR description

### Step 4: Push the Branch

If not already tracking a remote branch:

```bash
git push -u origin {branch-name}
```

If push fails → report error and abort.

### Step 5: Get Repository Name

```bash
basename $(git remote get-url origin) .git
```

### Step 6: Create the PR

```bash
az repos pr create \
  --title "{story-id} - {story-title}" \
  --description "{PR description — see template below}" \
  --source-branch {current-branch} \
  --target-branch main \
  --repository {repo-name} \
  --work-items {story-id} \
  --output json
```

### Step 7: Report Result

Show the PR URL and linked work item.

## PR Title Format

```
{story-id} - {story-title}
```

Example: `37968 - BCP - Tooling - WayPoint ADO Sync Agent`

The story ID is the raw number (no `#` prefix). The title comes directly from the ADO work item.

## PR Description Template

Build the description from the User Story and branch commits:

```markdown
## Summary
- {Bullet points summarizing changes from git log}

## Linked Work Item
- US#{story-id}: {story-title}

## Test Plan
- [ ] {Relevant test items based on changes}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Error Handling

| Condition | Action |
|-----------|--------|
| Spec not found in manifest | List available specs and ask user to pick |
| Spec has no `**Ticket**:` field | Abort — tell user to run `/waypoint.sync` first |
| No commits ahead of main | Warn and abort |
| PR already exists for branch | Show existing PR URL |
| `git push` fails | Report error, do not create PR |
| Invalid story ID | Report and abort |
| `az` CLI not logged in | Prompt user to run `az login` |

## ADO Defaults

| Field | Value |
|-------|-------|
| Organization | `Meriton365` |
| Project | `DevOps Projects and Support` |

---

## Arguments

$ARGUMENTS

---

_WayPoint PR command for bonuscompplatform_

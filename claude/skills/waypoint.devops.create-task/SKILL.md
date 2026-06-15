---
description: "Create a GitHub Issue as a task for Vanguard development"
---

# WayPoint: Create Task Action

**Project**: vanguard-security
**Repo**: samidzafar2024/vanguard-cli

## Before You Begin

1. **Read the manifest** at `vanguard-security/waypoint.manifest.yaml` to understand current state
2. **Read the task file** at `.waypoint/tasks/{feature}/task-NNN.md` to get task details

## Usage

Create a GitHub Issue for a specific implementation task.

`/waypoint.devops.create-task --feature {feature} --task task-NNN`

## CLI Pattern

```bash
# Step 1: Create GitHub Issue
gh issue create \
  --repo samidzafar2024/vanguard-cli \
  --title "[TASK] {title}" \
  --body "$(cat <<'EOF'
## What to build
{description from task file}

## Files to change
{files list from task file}

## Acceptance Criteria
{checklist from task file}

## References
- Task file: .waypoint/tasks/{feature}/task-NNN.md
- Research: vanguard-security/docs/research/{relevant-doc}.md
EOF
)" \
  --label "phase{N}" \
  --label "{agent|brain|opsec|workflow|prompt}" \
  --milestone "Phase {N}"

# Step 2: Note the issue number
# Output: https://github.com/samidzafar2024/vanguard-cli/issues/{number}
```

## Labels to Use

| Label | Meaning |
|---|---|
| `phase1` | Foundation (vanguardFetch, engagement.yaml, trust-tier, dispatcher) |
| `phase2` | Brain core (Planner + Critic + Chain Hunter wiring) |
| `phase3` | New attack surfaces (LLM app, cloud, browser agents) |
| `phase4` | Frontier (post-exploit, remediator, cross-target) |
| `agent` | New specialist agent |
| `brain` | Brain/HPC-AG changes |
| `opsec` | OPSEC stack changes |
| `workflow` | Temporal workflow changes |
| `prompt` | Prompt template changes |

## After Completion

Update `vanguard-security/waypoint.manifest.yaml`:
- Add issue number to the task entry
- Set task status to `open`

---

## Arguments

$ARGUMENTS

---

_WayPoint Create Task command for Vanguard Security — GitHub Issues_

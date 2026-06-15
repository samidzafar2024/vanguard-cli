---
description: "Create a GitHub Epic/Milestone for a Vanguard phase or feature"
---

# WayPoint: Create Story Action

**Project**: vanguard-security
**Repo**: samidzafar2024/vanguard-cli

## Before You Begin

1. **Read the manifest** at `vanguard-security/waypoint.manifest.yaml`
2. **Read the plan** at `.waypoint/plans/{feature}.md`

## Usage

Create a GitHub Issue as an Epic grouping related tasks for a phase or feature.

`/waypoint.devops.create-story --phase {N} --title "Story title"`

## CLI Pattern

```bash
# Step 1: Create GitHub Milestone (for the phase, if it doesn't exist)
gh api repos/samidzafar2024/vanguard-cli/milestones \
  --method POST \
  --field title="Phase {N}: {name}" \
  --field description="{phase description from research/99-architectural-review.md}"

# Step 2: Create Epic issue
gh issue create \
  --repo samidzafar2024/vanguard-cli \
  --title "[EPIC] Phase {N}: {title}" \
  --body "$(cat <<'EOF'
## Summary
{what this phase delivers}

## Why
{business/technical rationale from research docs}

## Tasks
- [ ] #{task-issue-1} {task title}
- [ ] #{task-issue-2} {task title}
- [ ] #{task-issue-3} {task title}

## Definition of Done
- All child tasks closed
- pnpm run check passes
- Pipeline-testing passes on Juice Shop target
- No regressions in existing agents

## References
- Research: vanguard-security/docs/research/99-architectural-review.md
- Plan: .waypoint/plans/{feature}.md
EOF
)" \
  --label "epic" \
  --label "phase{N}" \
  --milestone "Phase {N}: {name}"
```

## Phase Milestones

| Phase | Name | Key Deliverables |
|---|---|---|
| Phase 1 | Foundation | vanguardFetch, engagement.yaml, trust-tier, 3-mode dispatcher, blast-radius |
| Phase 2 | Brain Core | Planner+Critic+Chain Hunter wired, 62 new chain patterns, OPSEC Critic |
| Phase 3 | New Attack Surfaces | LLM app agents, cloud split, browser agents |
| Phase 4 | Frontier | Post-exploit, remediator, cross-target pipeline, pgvector memory |

## After Completion

Update `vanguard-security/waypoint.manifest.yaml`:
- Add milestone and epic issue number
- Set story status to `open`

---

## Arguments

$ARGUMENTS

---

_WayPoint Create Story command for Vanguard Security — GitHub Issues + Milestones_

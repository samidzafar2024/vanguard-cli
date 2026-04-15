---
workflow: plan
step: 4
total_steps: 4
id: write-tasks
name: Write Task Files
---

# Step 4/4: Write Task Files

> Create detailed, self-contained task files

## Objective

Create detailed task files

## Inputs Required

- Sequenced task list

## Outputs Produced

- .vanguard/tasks/{feature}/task-*.md

---

Write each task to a file:
- Use the task template
- Include context, objective, acceptance criteria
- Include implementation notes and file paths
- List dependencies and testing requirements

Write to `.vanguard/tasks/{feature}/task-NNN-{slug}.md`.

---

## Checkpoint

Before proceeding to the next step, confirm:

> **Can a developer pick up any task and know exactly what to do?**

## Tips

- Each task file should be self-contained -- don't assume context

---

## Navigation

Previous: [Sequence Tasks](./sequence-tasks.md)

Next: (End of workflow - finalize outputs)

---

_Planning workflow - Step 4 of 4_
_Project: vanguard-cli | Track: team_

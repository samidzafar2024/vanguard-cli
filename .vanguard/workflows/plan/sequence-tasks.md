---
workflow: plan
step: 3
total_steps: 4
id: sequence-tasks
name: Sequence Tasks
---

# Step 3/4: Sequence Tasks

> Order tasks respecting dependencies

## Objective

Order tasks by dependencies

## Inputs Required

- Task list

## Outputs Produced

- Sequenced task list with dependencies

---

Sequence tasks:
- Infrastructure and schema tasks first
- Core domain logic before application logic
- Application logic before presentation
- Tests alongside or immediately after implementation

---

## Checkpoint

Before proceeding to the next step, confirm:

> **Can each task be started once its dependencies are done?**

## Tips

- Number tasks to show execution order

---

## Navigation

Previous: [Identify Tasks](./identify-tasks.md)

Next: [Write Task Files](./write-tasks.md)

---

_Planning workflow - Step 3 of 4_
_Project: vanguard-cli | Track: team_

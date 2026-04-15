---
description: "Facilitate a creative brainstorming session using proven techniques"
---

# Vanguard: Brainstorm Action

**Project**: vanguard-cli

## Before You Begin

1. **Read the manifest** at `vanguard.manifest.yaml` to understand:
   - Current project state and active documents
   - What specs, plans, and tasks exist
   - Document summaries for quick context

2. **Check document status** in the manifest:
   - `specs`: Feature specifications
   - `plans`: Technical designs
   - `tasks`: Implementation tasks with status


Load the **Brainstorm Coach Agent** from `.claude/agents/brainstorm.md`.

Facilitate a creative brainstorming session:
1. Establish psychological safety
2. Select appropriate technique (SCAMPER, Six Hats, etc.)
3. Guide divergent thinking phase
4. Capture all ideas without judgment
5. Organize and prioritize results

Output to `.vanguard/specs/brainstorm-{topic}.md`.

## After Completion

Update `vanguard.manifest.yaml` to reflect any documents you created or status changes.

---

## Arguments

$ARGUMENTS

---

_Vanguard Brainstorm command for unknown stack + MVC with Interactors_

---
description: "Pulls the latest bundle from Vanguard Web: Agents, Actions, Standards, Templates, etc. using the original preferences given in vanguard init."
---

# Vanguard: refresh-bundle Action

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

## Instructions

This action synchronizes your local Vanguard configuration with the latest bundle from Vanguard Web.

### Step 1: Execute the Refresh Command

Run the following command to pull the latest bundle:

```bash
vanguard refresh -y
```

The `-y` flag auto-confirms the refresh operation.

### Step 2: What Gets Updated

The refresh operation updates:

- **Agents**: Latest agent definitions and configurations
- **Actions**: New or updated action templates
- **Standards**: Coding standards and best practices
- **Templates**: Document and file templates
- **Workflows**: Predefined workflow sequences

All updates respect your original preferences from `vanguard init`.

### Step 3: Review Changes

After the refresh completes:

1. Check the console output for a summary of updated items
2. Review any new actions or agents that were added
3. Verify that your project-specific customizations remain intact

### Step 4: Test Configuration

Optionally verify the refresh succeeded:

```bash
vanguard status
```

This shows your current Vanguard configuration and available commands.

## After Completion

The manifest does not need updating for bundle refresh operations, as this is a configuration-level change rather than a project document change.

---

## Arguments

$ARGUMENTS

---

_Vanguard refresh-bundle command for unknown stack + MVC with Interactors_
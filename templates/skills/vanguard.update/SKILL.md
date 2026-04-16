---
description: "Fetch latest bundle and apply non-destructively"
---

# Vanguard: Update Framework

Pull the latest agent framework bundle from the Vanguard platform and apply files non-destructively, respecting each file's write strategy.

## Instructions

1. Fetch the latest bundle from the Vanguard API:
   - Call `GET /api/agent-framework/bundle?project_id=<PROJECT_ID>` (find project_id in `.vanguard/config.yaml`)
   - Or run `vanguard bundle` if using the CLI
2. For each file in the bundle, check the `writeStrategy` field:
   - **`"overwrite"`**: Always write the file (agents, skills, rules, hooks, CLAUDE.md)
   - **`"create"`**: Only write if the file doesn't already exist (manifest, config, constitution)
   - **`"merge"`**: Deep-merge the JSON content into the existing file (settings.json)
   - If `writeStrategy` is absent, treat it as `"overwrite"` (backward compat)
3. Report a summary of what was done:
   - Files written (overwrite)
   - Files created (new)
   - Files skipped (create, already existed)
   - Files merged

## Arguments

$ARGUMENTS
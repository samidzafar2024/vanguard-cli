---
name: bcp.bug-intake
description: "Parse pasted bug reports or tester messages into structured ADO Bug work items. Use this skill whenever the user pastes a bug report, tester feedback, QA note, error transcript, or any unstructured text describing a software defect — even if they don't say 'create a bug' or 'file a ticket'. Also triggers when the user says things like 'log this bug', 'file this in ADO', 'create a bug for this', or pastes a Slack/Teams message from a tester."
---

# Bug Intake

Take an unstructured bug report or tester message and turn it into a well-formed Azure DevOps Bug work item — without writing any files to disk.

## Workflow

### Step 1 — Parse the pasted text

Read the user's pasted text carefully and extract every piece of information you can identify:

| Field | Look for |
|-------|----------|
| **Title** | A short summary or subject line. If none, synthesize one from the description. |
| **Feature area** | Which part of the app is affected (e.g., "approvals", "comp plan builder", "dashboard"). |
| **Error message** | Any literal error text, stack trace, or status code. |
| **Steps to reproduce** | Numbered or sequential actions the tester performed. |
| **Expected behaviour** | What should have happened. |
| **Actual behaviour** | What actually happened. |
| **Severity** | Critical / High / Medium / Low — or any priority signal. |
| **Environment** | Browser, OS, deployment slot, URL, tenant. |
| **Repro rate** | Always, intermittent, once, unknown. |
| **Screenshots / attachments** | Any mentioned but obviously not inline — note them. |

### Step 2 — Ask for what's missing (all at once)

Compare what you extracted against the full field set above. If anything is missing or ambiguous, ask the user **all** follow-up questions in a single grouped message. Never drip-feed questions one at a time — that wastes the reporter's time and breaks their flow.

Format the follow-ups like this:

```
Before I file this, I need a few more details:

1. **Steps to reproduce** — Can you walk me through the exact steps? (e.g., "1. Go to X, 2. Click Y, 3. See error")
2. **Expected vs actual** — What should have happened vs what you saw?
3. **Severity** — How bad is this? (Critical / High / Medium / Low)
4. **Environment** — Browser, OS, or deployment slot?
5. **Repro rate** — Does this happen every time, intermittently, or was it a one-off?
```

Only ask about fields that are genuinely missing — if the paste already includes repro steps, don't re-ask for them.

If the pasted text is comprehensive enough that nothing is missing, skip straight to Step 3.

### Step 3 — Show the formatted summary and wait for confirmation

Present the complete bug summary back to the user in a clean format:

```
## Bug Summary

**Title:** BCP - {Feature Area} - {Short description}
**Severity:** {severity} (Priority {1|2|3|4})
**Feature Area:** {area}
**Environment:** {env details}
**Repro Rate:** {rate}

### Steps to Reproduce
1. ...
2. ...
3. ...

### Expected Behaviour
...

### Actual Behaviour
...

### Error Details
...

### Additional Notes
...
```

Then ask: **"Look good? I'll create the ADO Bug work item once you confirm."**

Do NOT proceed until the user explicitly confirms. A thumbs-up, "yes", "go", "lgtm", "do it", or similar counts as confirmation.

### Step 4 — Create the ADO Bug work item

Use the `az` CLI to create the Bug. The description must be HTML — use `<p>`, `<ol>`, `<li>`, `<h4>`, `<b>`, `<br>` tags.

Build the repro steps as an HTML ordered list for the `Microsoft.VSTS.TCM.ReproSteps` field.

**Severity mapping:**
- Critical → `1 - Critical`
- High → `2 - High`
- Medium → `3 - Medium`
- Low → `4 - Low`

```bash
az boards work-item create --type Bug \
  --title "BCP - {Feature Area} - {Short title}" \
  --area "DevOps Projects and Support\CoPointData" \
  --iteration "DevOps Projects and Support" \
  --fields \
    "Microsoft.VSTS.Common.Severity={1 - Critical|2 - High|3 - Medium|4 - Low}" \
    "Microsoft.VSTS.TCM.ReproSteps=<h4>Steps to Reproduce</h4><ol><li>...</li></ol><h4>Expected Behaviour</h4><p>...</p><h4>Actual Behaviour</h4><p>...</p>" \
    "System.Description=<p>Feature Area: {area}</p><p>Environment: {env}</p><p>Repro Rate: {rate}</p><p>{any extra context}</p>" \
    "System.Tags=BCP;BCP v2" \
  --org https://dev.azure.com/Meriton365 --project "DevOps Projects and Support" \
  --output json
```

Parse the JSON response to extract the work item `id` and `url`.

If the user mentions a parent User Story or Feature, link it:

```bash
az boards work-item relation add --id {new_bug_id} \
  --relation-type parent --target-id {parent_id} \
  --org https://dev.azure.com/Meriton365 --project "DevOps Projects and Support"
```

### Step 5 — Report the result

Output the created work item ID and URL:

```
Bug created: #{id}
{url}
```

If a parent was linked, confirm that too.

## Important rules

- **No files written to disk.** The entire intake happens in conversation and the `az` CLI call. No markdown files, no YAML updates, no temp files.
- **All follow-ups in one shot.** Never ask questions one at a time.
- **Wait for confirmation** before running the `az` command.
- **Title format:** Always prefix with `BCP - {Feature Area} -` to match project convention.
- **HTML in fields:** ADO requires HTML for description and repro steps — never use raw markdown in those fields.

## Arguments

$ARGUMENTS

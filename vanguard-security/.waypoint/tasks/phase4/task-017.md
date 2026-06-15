# Task 017: Remediation Generator (Remediator)

**Phase**: Phase 4
**Wave**: After brain-critic — runs only after all findings are validated
**Depends on**: Phase 3 brain-critic (task is post-critic)
**Labels**: phase4, agent, brain

## Why This Matters

Right now Vanguard finds vulnerabilities and reports them. The developer still has to:
1. Read the finding
2. Understand the root cause
3. Write the fix themselves
4. Re-test to confirm it's fixed

The `remediator` agent collapses steps 1-4 into one automated loop.
It reads the confirmed finding, writes the fix, verifies the fix works, and opens a PR.

A developer gets a GitHub PR notification. They review the code change. They merge it.
The vulnerability is patched. No back-and-forth with a security consultant.

**This is the only agent in Vanguard that modifies source code.** Hence: active mode required.

## What to Build

### Agent: `remediator`

**Agent definition**:
```typescript
'remediator': {
  prerequisites: ['brain-critic'],
  promptTemplate: 'remediator',
  deliverableFilename: 'remediation_deliverable.md',
  modelTier: 'large',        // Opus — code generation quality matters
  required_mode: 'active',   // modifies files, opens PRs
},
```

**Prompt file**: `apps/worker/prompts/remediator.txt`

---

### Workflow

```
1. Load brain-critic output: list of confirmed findings with:
   - finding.evidence.file_path
   - finding.evidence.line_number
   - finding.vuln_type
   - finding.severity (Critical or High only — skip Medium/Low)

2. For each Critical/High finding:
   a. Read affected file
   b. Identify vulnerable code pattern
   c. Generate language-appropriate fix:
      - SQL injection → parameterized query
      - XSS → output encoding (DOMPurify, escapeHtml, etc.)
      - Path traversal → Path.normalize + allowlist check
      - SSRF → allowlist of permitted domains
      - Hardcoded secret → env var reference
      - Insecure deserialization → validation before deserialize
   d. Apply fix to a NEW branch: fix/<vuln-type>-<finding-id>
   e. Commit with message: "fix: remediate <finding.title>"

3. Re-run specific vuln agent against patched code
   - If fixed: open PR via `gh pr create`
   - If not fixed: try alternative fix (max 2 attempts)
   - If still not fixed: log "could not auto-remediate" and skip

4. PR body includes:
   - Finding title + severity
   - Root cause explanation
   - Fix description
   - Link to deliverable for evidence
```

---

### Language-Specific Fix Patterns

**Python (SQLi)**:
```python
# Before
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# After (parameterized)
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

**JavaScript (XSS)**:
```javascript
// Before
element.innerHTML = userInput;

// After
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
```

**Python (SSRF)**:
```python
# Before
response = requests.get(user_supplied_url)

# After
ALLOWED_DOMAINS = ['api.trusted.com', 'cdn.company.com']
parsed = urllib.parse.urlparse(user_supplied_url)
if parsed.netloc not in ALLOWED_DOMAINS:
    raise ValueError("Domain not allowed")
response = requests.get(user_supplied_url)
```

---

### Safety Constraints

```typescript
REMEDIATOR_CONSTRAINTS = [
  'Only modify the specific file and lines identified in the finding',
  'Never touch files not referenced in the finding evidence',
  'Always create a new branch — never commit to main/master',
  'Branch name format: fix/<vuln-type>-<finding-id>',
  'If fix requires installing a new package: add to package.json only, do not npm install',
  'If unsure about the fix: write a placeholder comment and skip opening the PR',
  'Maximum 2 fix attempts per finding — do not loop indefinitely',
]
```

---

### Engagement.yaml requirements

```yaml
# Remediator requires:
mode: active
active_mode_confirmed: true
repo_path: /path/to/source  # required — no source = no remediator
```

If `repoPath` not provided → remediator is skipped automatically.

## Files to Create/Change

- `apps/worker/prompts/remediator.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity wrapper
- `apps/worker/src/temporal/workflows.ts` — add after brain-critic, skip if no repoPath

## Acceptance Criteria

- [ ] Correctly generates parameterized query fix for SQL injection finding
- [ ] Correctly generates DOMPurify fix for XSS finding
- [ ] Creates new branch with correct naming (fix/<type>-<id>)
- [ ] Re-runs specific vuln agent after applying fix
- [ ] Opens PR if re-test confirms fix worked
- [ ] Skips gracefully when no repoPath provided (black-box mode)
- [ ] Never modifies main/master branch directly
- [ ] Never attempts more than 2 fix iterations per finding
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/12-remediation-generation.md`
- Only Critical and High severity findings — Medium/Low not worth auto-fixing
- If multiple findings in same file — apply all fixes on same branch (one PR per file)
- Remediator is the most sensitive agent — test thoroughly with a real CVE scenario
- `gh pr create` requires GitHub remote configured in the repo

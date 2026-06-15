---
description: "Review Vanguard implementation for quality, architecture compliance, and security"
---

# WayPoint: Review Action

**Project**: vanguard-security

## Before You Begin

1. **Read the manifest** at `vanguard-security/waypoint.manifest.yaml`
2. **Read the task file** to understand acceptance criteria
3. **Run** `vanguard-security/.claude/commands/review.md` checklist (full Vanguard-specific review)

## Review Steps

1. **Check acceptance criteria** — does implementation match task file checklist?
2. **Architecture compliance** — services ≠ activities, `Result<T,E>` for fallible ops, `ActivityLogger` not `console.log`
3. **TypeScript safety** — no double-casting, explicit return types, `Readonly` constants
4. **Security** — no credentials in logs, YAML `FAILSAFE_SCHEMA`, input validation at boundaries
5. **Code style** — `pnpm run check` (TypeScript), `pnpm biome` (lint)

## Output Format

For each issue found:
- **Location**: file:line
- **Issue**: what's wrong and why it matters
- **Fix**: how to correct it
- **Severity**: Critical / Warning / Suggestion

Summary: total by severity + overall assessment (Ready to commit / Needs fixes / Needs discussion)

## After Completion

Update `vanguard-security/waypoint.manifest.yaml`:
- Set task to `in-review` or `done`

---

## Arguments

$ARGUMENTS

---

_WayPoint Review command for Vanguard Security — TypeScript + Temporal + Claude Agent SDK_

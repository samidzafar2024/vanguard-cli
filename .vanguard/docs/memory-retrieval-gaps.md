# Memory Retrieval Gaps: Why Agents Ignore Stored Decisions

> **Status**: Analysis & Fixes (3 of 4 implemented, 1 remaining)
> **Date**: 2026-02-24
> **Branch**: `fix/memory-protocol-hardening`
> **Scope**: Agent personas, memory-protocol.sh hooks, Graphiti integration

---

## Problem Statement

Decisions stored in Graphiti/Vanguard Memory are not being picked up by agent personas during task execution. Agents fall back to hardcoded defaults or outdated assumptions instead of honoring previously stored decisions, patterns, and conventions.

---

## Root Causes

### 1. Search Is Only Suggested, Never Enforced

The `phase` hook in `memory-protocol.sh` injects an advisory reminder via `additionalContext` with `permissionDecision: "allow"`. The phase **always proceeds** regardless of whether Claude actually performs the search. There is no gate or enforcement — the reminder is easy to skip.

### 2. Search Only Triggers on Phase Start, Not During Work

The `PreToolUse` hook fires only when `matcher: "Skill"` matches. Once inside the phase, there is **no mid-session search trigger**. An agent can make 50+ tool calls implementing code without ever re-checking memory.

### 3. Search Query Is a Placeholder, Not Auto-Filled

The injected reminder contains `[task topic]` as a **literal placeholder**. Claude must construct the query itself, leading to vague queries, overly narrow queries, or skipping search entirely.

### 4. Persona Files Have Hardcoded Architecture Rules That Compete With Memory

Every persona file embeds a static copy of architecture rules, code examples, and anti-patterns. These are always present in the context window and naturally outweigh dynamically fetched memory results.

### 5. Context Window Compression Evicts Memory Results

In long sessions, memory search results from the start of a phase get compressed or dropped, while persona file content stays prominent.

### 6. The Stop Hook Is Non-Blocking and Too Late

The `check` mode writes warnings to `stderr` and exits 0. It is purely informational and fires after significant work is already done.

### 7. No SessionStart or Post-Compression Re-Injection

The CLI provides `vanguard memory hook session-start` but it was **not wired into `.claude/settings.json`**. No automatic re-injection of decisions at session start.

### 8. No Response Validation on Session Start

The session-init hook fetched context but did not verify the response contained actual data. If the API was down or returned empty, the agent proceeded with zero context and no indication that decisions were missing.

### 9. No Phase-Awareness in Search Counters

The search counter was global across all phases. Searching for architecture decisions in `/architect` satisfied the counter, so the agent could enter `/implement` and start editing without searching for implementation-specific patterns.

---

## Implemented Fixes

### Fix 1: Wire `session-start` Hook — DONE

**What**: Added `SessionStart` hook in `.claude/settings.json` that runs `memory-protocol.sh session-init` to fetch Graphiti context at session start.

**Why**: Ensures foundational decisions are present in the agent's context window from the start.

---

### Fix 2: Session Start Grace Period & Response Validation — DONE

**What**: The `session-init` case now validates that actual context was returned:

- **Success** (non-empty response): Marks `last_search=0` — grants grace period, guard won't fire until 10 tool calls pass
- **Failure** (empty/error): Sets `last_search=-1` — guard fires immediately on the first Edit/Write attempt, forcing the agent to manually search before it can modify any code

**Why**: If the API is down, the agent must not proceed to edit files without any decisions context. Setting `last_search=-1` ensures `since_search = total - (-1) = total + 1`, which exceeds the threshold even at `total=0`.

---

### Fix 3: Lower Threshold + Mid-Session Reminders — DONE

**What**: Reduced `VANGUARD_MEMORY_THRESHOLD` default from 20 to 10. Added a one-time stderr nudge in `track` (PostToolUse) at 10 tool calls without search.

**Why**: Catches drift earlier — 20 calls is enough to implement an entire feature incorrectly.

---

### Fix 4: Block Edit/Write Until Memory Is Searched — DONE

**What**: Added `PreToolUse` hooks with `matcher: "Edit"` and `matcher: "Write"` that return `permissionDecision: "deny"` after 10+ tool calls without a memory search.

**Why**: File modifications are the highest-stakes actions. Hard-blocking forces the agent to search memory before modifying code. The agent can still read, glob, grep, and explore — it just can't write until it checks the knowledge graph.

---

### Fix 5: Phase-Aware Counter Reset — DONE

**What**: Added `FILE_CURRENT_PHASE` state file. When the `phase` hook detects a new phase (skill name differs from stored phase), it:

1. Updates `FILE_CURRENT_PHASE` to the new phase
2. Resets `FILE_LAST_SEARCH` to `0` — forcing the agent to search again for this phase's concerns

**Why**: Searching for "architecture decisions" in `/architect` does not mean the agent has searched for "implementation patterns" in `/implement`. Each phase has different concerns; the search counter must be phase-scoped.

### Fix 6: Failure Mode Hardening — DONE

Four defensive checks added to prevent silent failures:

| Failure Mode | What Happens | Prevention |
|---|---|---|
| **node not in PATH** | All JSON parsing fails, entire hook is inert | Node check at script top — warns to stderr, exits 0 (fail-open) |
| **vanguard CLI not in PATH** | `session-init` can't fetch context | CLI check — warns to stderr, sets `last_search=-1` so guard fires immediately (agent must use MCP tools instead) |
| **VANGUARD_TOKEN missing/expired** | API calls fail, MCP tools fail, agent gets stuck in guard loop | Token check — warns to stderr, sets `last_search=999999` to disable guard entirely (no enforcement without auth) |
| **State files lost mid-session** | Guard blocks everything or blocks nothing depending on which files survive | Fail-open check in guard — if `FILE_TOTAL` or `FILE_LAST_SEARCH` is missing, allow the operation |

**Key design choice**: Token missing → disable guard (fail-open). CLI missing → force guard (agent can still use MCP `search_hybrid` directly). The difference: without a token, MCP tools also won't work, so blocking would create a deadlock. Without the CLI, MCP tools still work via the configured server.

---

## Remaining Work

### P0: Make Phase Hook Actually Search Instead of Just Reminding (Medium Effort / High Impact)

**What**: Change the `phase` case from injecting a "please search" text reminder to actually executing `vanguard memory hook pre-task` and injecting the real results into `additionalContext`.

**Why**: Eliminates the dependency on Claude choosing to search. Decisions are injected automatically.

**Implementation sketch**:
```bash
vanguard.implement)
  TOPIC=$(json_get "tool_input.args")
  RESULTS=$(vanguard memory hook pre-task "$TOPIC" --project agentic-memory --json 2>/dev/null || echo "")

  if [ -n "$RESULTS" ]; then
    CTX="MEMORY CONTEXT — Phase: /implement
The following decisions and patterns were found in the knowledge graph:

$RESULTS

Apply these decisions and patterns during implementation."
  else
    CTX="MEMORY PROTOCOL — Phase start: /implement
No prior decisions found. SEARCH: search_hybrid(query=\"patterns conventions for [task topic]\", group_id=\"...\") before starting."
  fi
  ;;
```

---

### Phase Coverage Gap: Only 6 of 18+ Skills Get Memory Reminders (Needs Discussion)

The `phase` case currently has explicit matches for 6 skills: `vanguard.architect`, `vanguard.discover`, `vanguard.implement`, `vanguard.plan`, `vanguard.review`, and `vanguard.specify`. All other skills — `vanguard.brainstorm`, `vanguard.design`, `vanguard.clarify`, `vanguard.extend`, `vanguard.test`, and all agent personas (`vanguard:agents:*`) — hit the `*)` fallback and `exit 0` with no memory reminder at all.

**Options to discuss:**
1. **Catch-all default**: Add a generic memory reminder for any unmatched skill (e.g., `"MEMORY PROTOCOL — Phase start: $skill. SEARCH first..."`)
2. **Explicit opt-in list**: Only memory-active phases get reminders; others are intentionally exempt (brainstorm may not need stored decisions)
3. **Agent-level config**: Let each persona file declare whether it wants memory enforcement via a YAML flag

This needs discussion because not all phases benefit equally from memory search — a brainstorm session may want creative freedom without being blocked by the guard.

---

### Suggestion: Consider Decoupling Static Rules From Persona Files

> **Note**: This is a longer-term consideration, not an immediate fix recommendation.

Currently every persona file embeds a static copy of architecture rules (typically 60+ lines). This creates a conflict where hardcoded static rules always outweigh dynamically fetched memory. A future improvement could slim down persona files to identity/role/commands only and have architecture rules always come from memory search. This requires the other fixes to be in place first for reliability.

---

## Summary

| Fix | Status | Effort | Impact |
|-----|--------|--------|--------|
| Wire `session-start` hook | **DONE** | Low | High |
| Session start response validation + grace period | **DONE** | Low | High |
| Lower threshold + mid-session nudge | **DONE** | Low | Medium |
| Block Edit/Write until memory searched (guard) | **DONE** | Low | High |
| Phase-aware counter reset | **DONE** | Low | High |
| Failure mode hardening (node/CLI/token/state) | **DONE** | Low | High |
| Phase hook searches instead of reminding | **TODO (P0)** | Medium | High |
| Phase coverage: only 6 of 18+ skills get memory reminders | **TODO — needs discussion** | Low-Medium | High |
| Decouple static rules from persona files | **Suggestion** | Medium | High |

---

## State Files

All state is stored in `/tmp/.wmp-*` and resets on new session:

| File | Purpose |
|------|---------|
| `.wmp-session` | Current session ID (triggers reset on change) |
| `.wmp-total` | Total tool call counter |
| `.wmp-last-search` | Counter value at last memory search (`-1` = never searched / API failed) |
| `.wmp-last-write` | Counter value at last memory store |
| `.wmp-last-blocked` | Counter value at last stop-hook warning (prevents re-block loops) |
| `.wmp-current-phase` | Current phase skill name (triggers search reset on phase change) |

---

## Related Files

- `.claude/hooks/memory-protocol.sh` — Hook implementation
- `.claude/settings.json` — Hook wiring configuration
- `.claude/commands/vanguard/agents/*.md` — Persona definitions
- `.claude/commands/vanguard.implement.md` — Implement phase command
- `src/application/services/session-start-hook.service.ts` — Session start hook service
- `src/application/services/pre-task-hook.service.ts` — Pre-task hook service (three-tier fallback)
- `src/application/services/hook-wiring.service.ts` — Hook wiring / settings.json generation

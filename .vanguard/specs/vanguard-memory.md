# Specification: Vanguard Memory

> Persistent, searchable knowledge for AI coding agents

## Overview

### Problem Statement

AI coding agents suffer from **context amnesia**:

1. **Session Isolation**: Each Claude Code conversation starts fresh, losing prior context
2. **Repeated Explanations**: Developers re-explain the same patterns, decisions, and conventions repeatedly
3. **Lost Decisions**: Architectural decisions made in one session are forgotten in the next
4. **Tribal Knowledge**: Valuable patterns emerge during coding sessions but aren't captured systematically
5. **Context Overload**: CLAUDE.md files become unwieldy as projects grow, with no way to search or prioritize

Vanguard telemetry already detects this amnesia pattern. **Vanguard Memory solves it** by providing persistent, queryable knowledge that integrates with Claude Code.

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Amnesia Reduction | 50% fewer repeated questions | Compare telemetry pre/post |
| Context Relevance | 80%+ injected context rated useful | User feedback sampling |
| Capture Rate | 70%+ of patterns auto-captured | Extraction vs manual ratio |
| Query Latency | <500ms for semantic search | Performance monitoring |
| Adoption | Used in 90%+ of coding sessions | Hook activation rate |

## User Scenarios

### Persona: Developer (Primary)

**Goal**: Get relevant project context automatically when working with Claude Code, without manually maintaining documentation.

#### Scenario: Pre-task Context Injection (Happy Path)
1. Developer starts a Claude Code session
2. Developer types: "implement user authentication"
3. Vanguard Memory hook queries for relevant knowledge
4. Claude receives injected context: authentication decisions, session middleware patterns, security conventions
5. Claude implements auth following established project patterns
6. Developer doesn't need to re-explain architecture decisions

#### Scenario: Post-task Knowledge Capture (Happy Path)
1. Developer completes a task implementing a new pattern
2. Vanguard Memory post-task hook analyzes the session
3. System extracts: "Repository pattern for user data access"
4. Candidate is queued for review (confidence: 0.75)
5. Developer approves in review queue
6. Pattern is available for future sessions

#### Scenario: Manual Knowledge Curation
1. Developer realizes an important convention isn't captured
2. Developer runs: `vanguard memory add`
3. Interactive prompts guide domain, topic, content entry
4. Item is saved locally and synced to database
5. Knowledge immediately available for search and injection

#### Scenario: Search for Existing Knowledge
1. Developer wonders "how do we handle errors?"
2. Developer runs: `vanguard memory query "error handling"`
3. System returns relevant patterns and decisions ranked by similarity
4. Developer finds the API error format convention
5. Developer follows established pattern

#### Scenario: Low Confidence Extraction (Edge Case)
1. Post-task hook extracts potential pattern
2. Confidence score is 0.45 (below threshold)
3. Item is discarded, not queued for review
4. System logs extraction attempt for metrics
5. No action required from developer

#### Scenario: Duplicate Detection (Edge Case)
1. Post-task hook extracts "Repository pattern"
2. System finds existing item with 0.92 similarity
3. Extraction is skipped (duplicate detected)
4. Existing knowledge remains authoritative
5. Developer is not bothered with redundant review

### Persona: Tech Lead

**Goal**: Ensure team members follow established patterns and decisions without constant oversight.

#### Scenario: Team Knowledge Sharing
1. Tech lead documents critical architecture decision
2. Decision is synced via git to team repo
3. Team member starts session on related feature
4. Claude receives the decision context automatically
5. Implementation follows team standards

#### Scenario: Pattern Enforcement
1. Tech lead marks error handling pattern as "high confidence"
2. Team member asks Claude about error handling
3. High-confidence pattern is prioritized in injection
4. Claude follows established pattern
5. Code review finds fewer pattern violations

### Persona: New Team Member

**Goal**: Get up to speed on project conventions without reading extensive documentation.

#### Scenario: Onboarding Context
1. New developer joins project
2. Developer starts first Claude Code session
3. Vanguard Memory injects key decisions and conventions
4. Claude explains project-specific patterns contextually
5. Developer learns conventions through natural interaction

## Functional Requirements

### Core Memory Operations

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-001 | User can initialize memory directory with `vanguard memory init` | Must | Developer |
| FR-002 | User can add memory item interactively with `vanguard memory add` | Must | Developer, Tech Lead |
| FR-003 | User can add memory item via flags (non-interactive) | Must | Developer |
| FR-004 | User can add memory item from markdown file | Should | Tech Lead |
| FR-005 | User can list memory items with domain/topic filters | Must | All |
| FR-006 | User can view single memory item details | Must | All |
| FR-007 | User can edit existing memory item | Must | Developer, Tech Lead |
| FR-008 | User can delete memory item with confirmation | Must | Tech Lead |
| FR-009 | Memory items stored as markdown with YAML frontmatter | Must | All |
| FR-010 | Memory items follow hierarchical ID convention (domain/topic/slug) | Must | All |

### Search & Retrieval

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-011 | User can search memory with natural language query | Must | All |
| FR-012 | Search uses vector similarity (semantic search) | Must | All |
| FR-013 | Search combines vector + full-text (hybrid search) | Should | All |
| FR-014 | Search results include similarity score | Must | All |
| FR-015 | Search supports domain/topic/tag filters | Should | All |
| FR-016 | Search supports confidence level filter | Should | Tech Lead |
| FR-017 | Search expands relations to include connected knowledge | Should | All |
| FR-018 | Search results can output as JSON for scripting | Should | Developer |

### Relations

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-019 | User can add explicit relations between memory items | Should | Tech Lead |
| FR-020 | User can remove relations between items | Should | Tech Lead |
| FR-021 | User can view relation graph for an item | Could | All |
| FR-022 | Relations support wildcard patterns (e.g., `decisions/*`) | Could | Tech Lead |

### Sync & Storage

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-023 | User can sync local files to database with `vanguard memory sync` | Must | Developer |
| FR-024 | Sync detects changes via content hash comparison | Must | All |
| FR-025 | Sync supports dry-run mode to preview changes | Should | Developer |
| FR-026 | Sync generates embeddings for new/changed items | Must | All |
| FR-027 | User can view sync status and last sync time | Should | Developer |
| FR-028 | Local files are source of truth; database is derived index | Must | All |

### Claude Code Integration

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-029 | Pre-task hook queries memory for relevant context | Must | Developer |
| FR-030 | Pre-task hook injects context into prompt | Must | Developer |
| FR-031 | Context injection adapts to detected intent (implement, debug, etc.) | Should | Developer |
| FR-032 | Context injection respects Vanguard workflow phase | Could | Developer |
| FR-033 | Post-task hook extracts knowledge from completed sessions | Should | All |
| FR-034 | User can install Claude Code hooks via CLI | Must | Developer |
| FR-035 | Hooks respect timeout limits (pre-task: 5s, post-task: 10s) | Must | All |
| FR-036 | Hook failure degrades gracefully (no injection vs blocking) | Must | All |

### Auto-Capture

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-037 | System extracts patterns from coding sessions | Should | All |
| FR-038 | System extracts architectural decisions from sessions | Should | All |
| FR-039 | System extracts error solutions from debug sessions | Should | All |
| FR-040 | Extracted items have confidence scores (0-1) | Must | All |
| FR-041 | High-confidence items can auto-save (configurable) | Should | Tech Lead |
| FR-042 | Low/medium confidence items queue for review | Must | All |
| FR-043 | Duplicate extraction is detected and skipped | Must | All |
| FR-044 | Extraction excludes sensitive content (secrets, keys) | Must | All |

### Review Queue

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-045 | User can list pending review items | Should | Developer, Tech Lead |
| FR-046 | User can approve review item | Should | Developer, Tech Lead |
| FR-047 | User can modify and approve review item | Should | Developer, Tech Lead |
| FR-048 | User can reject review item with reason | Should | Developer, Tech Lead |
| FR-049 | Review items expire after configurable period | Could | Tech Lead |

### Import/Export

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-050 | User can import from existing CLAUDE.md | Should | Developer |
| FR-051 | User can import from ADR directory | Could | Tech Lead |
| FR-052 | User can import from Vanguard specs | Could | Developer |
| FR-053 | User can export memory to markdown bundle | Should | Tech Lead |
| FR-054 | User can export memory to JSON | Should | Developer |
| FR-055 | User can export high-confidence items to CLAUDE.md format | Should | All |

### Statistics & Observability

| ID | Requirement | Priority | Personas |
|----|-------------|----------|----------|
| FR-056 | User can view memory statistics (counts by domain, source, confidence) | Should | Tech Lead |
| FR-057 | User can view auto-capture statistics | Could | Tech Lead |
| FR-058 | System tracks hook activation for telemetry | Should | Tech Lead |

## Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Pre-task hook latency | < 500ms (target: 200ms) |
| NFR-002 | Search query latency | < 400ms (target: 150ms) |
| NFR-003 | Sync operation (incremental) | < 10s for 100 items |
| NFR-004 | Knowledge extraction per session | < 15s |
| NFR-005 | Local file storage format | Human-readable markdown |
| NFR-006 | Database compatibility | PostgreSQL 14+ with pgvector |
| NFR-007 | Embedding model | OpenAI text-embedding-3-large (1536 dims) |
| NFR-008 | CLI command response | < 2s for all commands |
| NFR-009 | Memory item size limit | 50KB per item |
| NFR-010 | Items per project | 10,000+ supported |

## Out of Scope

The following are explicitly **not included** in this specification:

1. **Real-time collaborative editing** - Use git for team sync; no live editing
2. **Web UI for memory management** - CLI is primary interface; web UI is future phase
3. **Cross-project memory sharing** - Memory is project-scoped only
4. **Custom embedding models** - OpenAI text-embedding-3-large only
5. **Offline operation** - Requires database connection for search
6. **Mobile interface** - CLI and API only
7. **Automatic conflict resolution** - Manual merge required for sync conflicts
8. **LLM-powered memory summarization** - Raw items stored; no auto-summarization
9. **Memory versioning/history** - Git provides history; no internal versioning
10. **Paid/premium features** - All features available to all users

## Data Model Summary

### Memory Item Structure

```yaml
# Required fields
id: domain/topic/slug
title: Human-readable title
content: Markdown content
domain: architecture | decisions | patterns | conventions | errors
confidence: low | medium | high
source: manual | auto-captured | imported

# Optional fields
topic: Sub-category within domain
tags: [tag1, tag2]
relations: [other/item/id]
captureContext: { sessionId, sourceFiles, confidenceScore }
```

### Domains

| Domain | Description | Examples |
|--------|-------------|----------|
| `architecture` | System design patterns, principles | Layer rules, dependency inversion |
| `decisions` | Architectural Decision Records | "Use PostgreSQL", "Session auth" |
| `patterns` | Reusable code patterns | Repository pattern, error handling |
| `conventions` | Project conventions, standards | Naming, file structure |
| `errors` | Common errors and solutions | Prisma connection pooling |

## Configuration

### Memory Config (`.vanguard/memory/_config.yaml`)

| Setting | Description | Default |
|---------|-------------|---------|
| `embeddings.model` | Embedding model | text-embedding-3-large |
| `autoCapture.enabled` | Enable auto-extraction | true |
| `autoCapture.confidenceThreshold` | Min confidence to consider | medium |
| `autoCapture.requireReview` | Queue for review vs auto-save | true |
| `search.defaultLimit` | Default result count | 5 |
| `search.similarityThreshold` | Min similarity score | 0.6 |
| `hooks.preTask.enabled` | Enable pre-task injection | true |
| `hooks.postTask.enabled` | Enable post-task extraction | true |

## Clarifications (Added by Analyst)

### Edge Cases Identified

#### EC-001: Memory Item ID Conflicts
**Question**: What happens if a user manually creates an item with an ID that already exists?
**Decision**: The `add` command MUST check for existing IDs and reject duplicates with a clear error. User can use `--force` to overwrite or `edit` to modify existing.

#### EC-002: Circular Relations
**Question**: What happens if Item A relates to Item B, and Item B relates to Item A?
**Decision**: Circular relations are allowed. Relation expansion MUST track visited nodes to prevent infinite loops. Max depth of 2 already limits traversal.

#### EC-003: Orphaned Relations
**Question**: What happens if an item is deleted but other items still reference it?
**Decision**: Relations to deleted items become "dangling references." The system SHOULD warn on delete if item is referenced elsewhere. Relations to non-existent items are silently ignored during expansion.

#### EC-004: Invalid Frontmatter
**Question**: What happens if a `.md` file in the memory directory has malformed YAML?
**Decision**: Parser MUST fail gracefully. Invalid files are logged as warnings but don't block other operations. `memory list` shows them with an "invalid" status. `memory sync` skips them with an error in the output.

#### EC-005: API Unavailable During Search
**Question**: What happens if vanguard-web API is down when user runs `memory query`?
**Decision**: Search MUST fail with clear error: "Search requires connection to vanguard-web. Ensure you're logged in and the service is available." Local `list` and `show` commands work offline.

#### EC-006: Sync Conflict Detection
**Question**: What happens if local file and database have diverged (e.g., item edited on web)?
**Decision**: Out of scope for v1 (database is read-only from CLI perspective). Local files are always source of truth. Future: detect hash mismatch and prompt user.

#### EC-007: Content Exceeds Size Limit
**Question**: What happens if user tries to add content larger than 50KB?
**Decision**: `add` command MUST reject with error: "Content exceeds 50KB limit. Consider breaking into smaller items or linking to external documentation."

#### EC-008: Empty Memory Directory
**Question**: What happens if user runs `memory query` before `memory init`?
**Decision**: All memory commands except `init` MUST check for `.vanguard/memory/` existence and fail with: "Memory not initialized. Run 'vanguard memory init' first."

#### EC-009: Hook Timeout Behavior
**Question**: What exactly happens when pre-task hook times out?
**Decision**: Return empty string (no context injected). Log warning to stderr. Do NOT block the user's prompt. Post-task hook timeout: abort extraction silently, log for telemetry.

#### EC-010: Embedding Generation Failure
**Question**: What happens if OpenAI API fails during sync?
**Decision**: Sync MUST be atomic per-item. Failed items are logged. Successful items proceed. Final output shows "X items synced, Y failed." User can retry with `--force` on failed items.

#### EC-011: Domain Validation
**Question**: Are custom domains allowed, or only the predefined 5?
**Decision**: Predefined domains only (architecture, decisions, patterns, conventions, errors). Custom domains require explicit configuration in `_config.yaml` with description and suggested topics. This prevents domain sprawl.

#### EC-012: Tag Normalization
**Question**: How are tags normalized? Are "API", "api", "Api" the same?
**Decision**: Tags are lowercase-normalized. Hyphens allowed, spaces converted to hyphens. Max 20 tags per item. Max 50 chars per tag.

### Requirement Conflicts Identified

#### RC-001: FR-028 vs FR-005 (Offline Operation)
**Conflict**: FR-028 says "local files are source of truth" but FR-005 requires database for search.
**Resolution**: Local files are authoritative for content. Database is a search index. `list` and `show` work offline (file-based). `query` requires database. This is consistent - clarify in documentation.

#### RC-002: FR-008 vs Team Workflow
**Conflict**: FR-008 says "delete with confirmation" is for Tech Lead only, but any developer might need to delete their own items.
**Resolution**: Any user can delete. "Tech Lead" persona indicates primary use case, not permission restriction. No role-based permissions in v1.

#### RC-003: NFR-001 vs FR-031 Intent Detection
**Potential Issue**: Intent detection (FR-031) adds latency. Combined with embedding generation, could exceed 500ms target.
**Resolution**: Intent detection MUST be local regex-based (fast). Embedding generation happens server-side. Pre-generated embeddings are cached. Latency budget: 100ms network + 50ms intent + 50ms formatting = 200ms target achievable.

### Constitution Alignment Check

| Principle | Alignment | Notes |
|-----------|-----------|-------|
| Domain logic is heart | ✅ | MemoryItem entity encapsulates business rules |
| Entities have identity | ✅ | MemoryId provides unique, stable identity |
| Value objects immutable | ✅ | Confidence, MemorySource, ContentHash are immutable |
| Repositories abstract persistence | ✅ | MemoryRepository port interface defined |
| Validate all inputs | ✅ | Input validation at CLI (presentation) layer |
| No secrets in code | ⚠️ | Need to ensure OpenAI key is from env, not config |

### Security Considerations (Constitution Reference)

Per constitution principle "Validate all inputs at system boundaries":

1. **Memory ID validation**: Must reject path traversal attempts (`../`, absolute paths)
2. **Content sanitization**: Auto-capture MUST filter potential secrets before storage
3. **Tag injection**: Tags must be alphanumeric + hyphens only
4. **File path safety**: FileMemoryRepository must validate paths stay within `.vanguard/memory/`

### Ambiguities Requiring Stakeholder Decision

## Open Questions

- [x] Should conventions domain allow auto-capture? **Decision: No, manual only (too nuanced)**
- [x] What's the default confidence threshold? **Decision: 0.5 to consider, 0.8 for auto-save**
- [x] How long should review items persist? **Decision: 30 days before auto-expire**
- [x] Should we support organization-level shared memory in v1? **Decision: No, project-scoped only**
- [ ] What's the cost budget for embedding generation per project per month?
- [x] Should hooks be opt-in or opt-out by default? **Decision: Opt-out (enabled by default) with clear disable option**
- [ ] Should `memory add` auto-sync after creating an item, or require explicit `memory sync`?
- [ ] What's the maximum number of items returned by pre-task hook injection (context length concern)?
- [ ] Should deleted items be soft-deleted (recoverable) or hard-deleted?

## Acceptance Criteria Summary

### Phase 1 (Core)
- [ ] `vanguard memory init` creates directory structure
- [ ] `vanguard memory add` creates item interactively
- [ ] `vanguard memory add` rejects duplicate IDs (EC-001)
- [ ] `vanguard memory add` rejects content > 50KB (EC-007)
- [ ] `vanguard memory list` shows items with filters
- [ ] `vanguard memory list` shows "invalid" status for malformed files (EC-004)
- [ ] `vanguard memory show <id>` displays item
- [ ] Items persist as markdown in `.vanguard/memory/`
- [ ] All commands fail gracefully if memory not initialized (EC-008)
- [ ] Database schema deployed with vector support
- [ ] Tags are lowercase-normalized (EC-012)
- [ ] Memory IDs reject path traversal attempts (Security)

### Phase 2 (Search)
- [ ] `vanguard memory query` returns relevant results
- [ ] `vanguard memory query` fails with clear error if API unavailable (EC-005)
- [ ] Results ranked by similarity score
- [ ] `vanguard memory sync` indexes to database
- [ ] `vanguard memory sync` handles embedding failures gracefully (EC-010)
- [ ] `vanguard memory sync` skips invalid files with warning (EC-004)
- [ ] API endpoints accessible from CLI

### Phase 3 (Integration)
- [ ] Pre-task hook injects relevant context
- [ ] Hook latency under 500ms
- [ ] Hook timeout returns empty string, doesn't block (EC-009)
- [ ] `vanguard memory hook install` configures Claude Code
- [ ] Graceful degradation on hook failure
- [ ] Relation expansion prevents infinite loops (EC-002)

### Phase 4 (Auto-Capture)
- [ ] Post-task hook extracts knowledge
- [ ] Post-task timeout aborts silently (EC-009)
- [ ] Review queue shows pending items
- [ ] Approve/reject workflow functions
- [ ] Duplicate detection prevents redundancy
- [ ] Extraction filters sensitive content (FR-044)

### Phase 5 (Relations & Cleanup)
- [ ] `vanguard memory delete` warns if item is referenced (EC-003)
- [ ] Dangling relations are silently ignored during expansion (EC-003)

---

_Generated by Vanguard for vanguard-cli_
_Architecture: Domain-Driven Design_
_Reference: [Architecture Docs](/docs/architecture/vanguard-memory/)_

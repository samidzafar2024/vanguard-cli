# Technical Plan: Vanguard Memory

> Technical architecture for persistent, searchable knowledge in vanguard-cli

**Specification**: `.vanguard/specs/vanguard-memory.md`
**Architecture Reference**: `/docs/architecture/vanguard-memory/`

## Architecture Alignment

This plan follows **Domain-Driven Design** principles as defined in the constitution:

1. Domain logic is the heart of the application
2. Entities have identity and lifecycle
3. Value objects are immutable and compared by value
4. Aggregates enforce consistency boundaries
5. Repositories abstract persistence
6. Domain events capture things that happened
7. Ubiquitous language shared between code and stakeholders

## File Structure

```
src/
├── domain/
│   ├── entities/
│   │   ├── memory-item.ts           # MemoryItem aggregate root
│   │   ├── memory-domain.ts         # Domain entity (architecture, patterns, etc.)
│   │   └── memory-config.ts         # Configuration entity
│   ├── value-objects/
│   │   ├── memory-id.ts             # Hierarchical ID (domain/topic/slug)
│   │   ├── confidence.ts            # Confidence level enum
│   │   ├── memory-source.ts         # Source enum (manual, auto-captured, imported)
│   │   └── content-hash.ts          # SHA256 hash for change detection
│   ├── errors/
│   │   └── memory-errors.ts         # Domain-specific errors
│   └── interfaces/
│       └── memory-repository.ts     # Repository port interface
│
├── application/
│   ├── use-cases/
│   │   └── memory/
│   │       ├── add-memory-item.ts       # Add item use case
│   │       ├── list-memory-items.ts     # List with filters
│   │       ├── get-memory-item.ts       # Get single item
│   │       ├── update-memory-item.ts    # Update existing
│   │       ├── delete-memory-item.ts    # Delete with confirmation
│   │       ├── search-memory.ts         # Semantic search
│   │       ├── sync-memory.ts           # Sync files to database
│   │       └── init-memory.ts           # Initialize memory directory
│   ├── ports/
│   │   ├── memory-repository.ts         # Repository interface
│   │   ├── embedding-service.ts         # Embedding generation interface
│   │   └── memory-api-client.ts         # API client interface
│   └── services/
│       ├── memory-service.ts            # Domain service
│       └── hook-service.ts              # Claude Code hooks service
│
├── infrastructure/
│   ├── repositories/
│   │   └── file-memory-repository.ts    # File-based persistence
│   ├── persistence/
│   │   ├── memory-file-parser.ts        # Markdown + YAML frontmatter
│   │   └── memory-file-writer.ts        # Write memory items to disk
│   ├── api/
│   │   └── memory-api-client.ts         # HTTP client for vanguard-web API
│   └── embeddings/
│       └── openai-embedding-service.ts  # OpenAI embeddings adapter
│
└── presentation/
    └── cli/
        └── commands/
            └── memory/
                ├── init.ts              # vanguard memory init
                ├── add.ts               # vanguard memory add
                ├── list.ts              # vanguard memory list
                ├── show.ts              # vanguard memory show
                ├── edit.ts              # vanguard memory edit
                ├── delete.ts            # vanguard memory delete
                ├── query.ts             # vanguard memory query
                ├── sync.ts              # vanguard memory sync
                ├── relate.ts            # vanguard memory relate
                ├── stats.ts             # vanguard memory stats
                ├── review.ts            # vanguard memory review
                ├── import.ts            # vanguard memory import
                ├── export.ts            # vanguard memory export
                └── hook.ts              # vanguard memory hook
```

## Component Design

### Domain Layer

#### MemoryItem (Aggregate Root)

**Layer**: Domain

**Responsibility**: Represents a single piece of knowledge with its metadata, content, and relations. Enforces business rules for memory items.

**Dependencies**: MemoryId, Confidence, MemorySource, ContentHash

**Interface**:
```typescript
// domain/entities/memory-item.ts

import { MemoryId } from '../value-objects/memory-id'
import { Confidence } from '../value-objects/confidence'
import { MemorySource } from '../value-objects/memory-source'
import { ContentHash } from '../value-objects/content-hash'

export interface CaptureContext {
  readonly sessionId?: string
  readonly sourceFiles?: readonly string[]
  readonly confidenceScore?: number
}

export class MemoryItem {
  private constructor(
    public readonly id: MemoryId,
    public readonly title: string,
    public readonly content: string,
    public readonly contentHash: ContentHash,
    public readonly domain: string,
    public readonly topic: string | undefined,
    public readonly subtopic: string | undefined,
    public readonly confidence: Confidence,
    public readonly source: MemorySource,
    public readonly author: string | undefined,
    public readonly tags: readonly string[],
    public readonly relations: readonly string[],
    public readonly captureContext: CaptureContext | undefined,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(params: {
    id: MemoryId
    title: string
    content: string
    domain: string
    topic?: string
    confidence?: Confidence
    source?: MemorySource
    author?: string
    tags?: readonly string[]
    relations?: readonly string[]
    captureContext?: CaptureContext
  }): MemoryItem

  // Business methods
  updateContent(content: string): MemoryItem
  updateConfidence(confidence: Confidence): MemoryItem
  addTag(tag: string): MemoryItem
  removeTag(tag: string): MemoryItem
  addRelation(itemId: string): MemoryItem
  removeRelation(itemId: string): MemoryItem

  // Validation
  isValid(): boolean
  hasRelationTo(itemId: string): boolean
  matchesDomain(domain: string): boolean
}
```

#### MemoryId (Value Object)

**Layer**: Domain

**Responsibility**: Represents a hierarchical memory item identifier following the convention `domain/topic/slug` or `domain/slug`.

**Dependencies**: None (pure value object)

**Interface**:
```typescript
// domain/value-objects/memory-id.ts

export class MemoryId {
  private constructor(
    public readonly domain: string,
    public readonly topic: string | undefined,
    public readonly slug: string,
  ) {}

  static create(id: string): MemoryId
  static fromParts(domain: string, topic: string | undefined, slug: string): MemoryId
  static generate(domain: string, topic: string | undefined, title: string): MemoryId

  toString(): string
  equals(other: MemoryId): boolean

  // Path utilities
  getFilePath(basePath: string): string
  getDirectory(basePath: string): string
}
```

#### Confidence (Value Object)

**Layer**: Domain

**Responsibility**: Represents confidence level with validation and comparison.

**Interface**:
```typescript
// domain/value-objects/confidence.ts

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export class Confidence {
  private constructor(public readonly level: ConfidenceLevel) {}

  static create(level: ConfidenceLevel): Confidence
  static fromScore(score: number): Confidence  // 0-1 -> low/medium/high

  isHigherThan(other: Confidence): boolean
  isAtLeast(level: ConfidenceLevel): boolean
  toScore(): number  // low=0.3, medium=0.6, high=0.9

  equals(other: Confidence): boolean
  toString(): string
}
```

#### MemoryConfig (Entity)

**Layer**: Domain

**Responsibility**: Configuration for memory behavior, including auto-capture settings, search defaults, and hook configuration.

**Interface**:
```typescript
// domain/entities/memory-config.ts

export interface EmbeddingConfig {
  readonly model: string
  readonly dimensions: number
}

export interface AutoCaptureConfig {
  readonly enabled: boolean
  readonly confidenceThreshold: ConfidenceLevel
  readonly requireReview: boolean
  readonly extract: {
    readonly patterns: boolean
    readonly decisions: boolean
    readonly errorSolutions: boolean
    readonly conventions: boolean
  }
  readonly excludePaths: readonly string[]
}

export interface SearchConfig {
  readonly defaultLimit: number
  readonly similarityThreshold: number
  readonly includeRelations: boolean
  readonly maxRelationDepth: number
}

export interface HookConfig {
  readonly preTask: { enabled: boolean; timeout: number }
  readonly postTask: { enabled: boolean; timeout: number }
}

export class MemoryConfig {
  static readonly DEFAULT: MemoryConfig

  static create(params: Partial<MemoryConfigParams>): MemoryConfig
  static fromYaml(content: string): MemoryConfig

  toYaml(): string
  merge(overrides: Partial<MemoryConfigParams>): MemoryConfig
}
```

### Application Layer

#### MemoryRepository (Port)

**Layer**: Application

**Responsibility**: Abstract interface for memory item persistence. Allows swapping between file-based and database-based implementations.

**Interface**:
```typescript
// application/ports/memory-repository.ts

export interface MemoryRepository {
  // CRUD operations
  save(item: MemoryItem): Promise<void>
  findById(id: MemoryId): Promise<MemoryItem | null>
  findAll(options?: MemoryQueryOptions): Promise<MemoryItem[]>
  delete(id: MemoryId): Promise<void>
  exists(id: MemoryId): Promise<boolean>

  // Bulk operations
  saveAll(items: MemoryItem[]): Promise<void>

  // Query operations
  findByDomain(domain: string): Promise<MemoryItem[]>
  findByTag(tag: string): Promise<MemoryItem[]>
  findByConfidence(minConfidence: ConfidenceLevel): Promise<MemoryItem[]>

  // Sync support
  getContentHash(id: MemoryId): Promise<ContentHash | null>
  getAllIds(): Promise<MemoryId[]>
}

export interface MemoryQueryOptions {
  domain?: string
  topic?: string
  tags?: string[]
  confidence?: ConfidenceLevel[]
  source?: MemorySource[]
  limit?: number
  offset?: number
}
```

#### EmbeddingService (Port)

**Layer**: Application

**Responsibility**: Generate embeddings for semantic search. Abstracts the embedding provider.

**Interface**:
```typescript
// application/ports/embedding-service.ts

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>
  batchEmbeddings(texts: string[]): Promise<number[][]>

  readonly model: string
  readonly dimensions: number
}
```

#### MemoryApiClient (Port)

**Layer**: Application

**Responsibility**: Communicate with vanguard-web API for search, sync, and hooks.

**Interface**:
```typescript
// application/ports/memory-api-client.ts

export interface SearchResult {
  item: MemoryItem
  similarity: number
}

export interface SyncResult {
  added: number
  updated: number
  deleted: number
  errors: string[]
}

export interface MemoryApiClient {
  // Search
  search(query: string, options: SearchOptions): Promise<SearchResult[]>

  // Sync
  syncItems(items: MemoryItem[]): Promise<SyncResult>
  getSyncStatus(): Promise<SyncStatus>

  // Hook endpoints
  queryForContext(prompt: string, phase?: string): Promise<string>

  // Health
  isAvailable(): Promise<boolean>
}
```

#### Use Cases

**AddMemoryItem**:
```typescript
// application/use-cases/memory/add-memory-item.ts

export interface AddMemoryItemInput {
  title: string
  content: string
  domain: string
  topic?: string
  confidence?: ConfidenceLevel
  tags?: string[]
  relations?: string[]
  fromFile?: string
}

export class AddMemoryItemUseCase {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly configService: MemoryConfigService,
  ) {}

  async execute(input: AddMemoryItemInput): Promise<MemoryItem>
}
```

**SearchMemory**:
```typescript
// application/use-cases/memory/search-memory.ts

export interface SearchMemoryInput {
  query: string
  domains?: string[]
  confidence?: ConfidenceLevel[]
  tags?: string[]
  limit?: number
  threshold?: number
  includeRelations?: boolean
}

export interface SearchMemoryOutput {
  items: SearchResult[]
  relatedItems?: SearchResult[]
  meta: {
    query: string
    totalMatches: number
    searchTimeMs: number
  }
}

export class SearchMemoryUseCase {
  constructor(
    private readonly apiClient: MemoryApiClient,
    private readonly config: MemoryConfig,
  ) {}

  async execute(input: SearchMemoryInput): Promise<SearchMemoryOutput>
}
```

**SyncMemory**:
```typescript
// application/use-cases/memory/sync-memory.ts

export interface SyncMemoryInput {
  force?: boolean
  dryRun?: boolean
}

export interface SyncMemoryOutput {
  added: number
  updated: number
  deleted: number
  unchanged: number
  errors: SyncError[]
}

export class SyncMemoryUseCase {
  constructor(
    private readonly fileRepository: MemoryRepository,
    private readonly apiClient: MemoryApiClient,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(input: SyncMemoryInput): Promise<SyncMemoryOutput>
}
```

### Infrastructure Layer

#### FileMemoryRepository

**Layer**: Infrastructure

**Responsibility**: Persist memory items as markdown files with YAML frontmatter in `.vanguard/memory/`.

**Dependencies**: fs, gray-matter (YAML frontmatter)

**Implementation Notes**:
- Files stored at `.vanguard/memory/{domain}/{topic?}/{slug}.md`
- Uses gray-matter for frontmatter parsing/serialization
- Watches for file changes (optional)
- Implements content hash for change detection

#### MemoryFileParser

**Layer**: Infrastructure

**Responsibility**: Parse markdown files with YAML frontmatter into MemoryItem domain entities.

**Interface**:
```typescript
// infrastructure/persistence/memory-file-parser.ts

export class MemoryFileParser {
  parse(filePath: string, content: string): MemoryItem
  parseMany(directory: string): Promise<MemoryItem[]>

  serialize(item: MemoryItem): string
}
```

#### OpenAIEmbeddingService

**Layer**: Infrastructure

**Responsibility**: Generate embeddings using OpenAI's text-embedding-3-large model.

**Implementation Notes**:
- Uses existing OpenAI client pattern
- Implements batching for efficiency
- Handles rate limiting and retries

### Presentation Layer

#### Memory Commands

All commands follow existing CLI patterns in vanguard-cli:

| Command | File | Description |
|---------|------|-------------|
| `memory init` | init.ts | Initialize `.vanguard/memory/` structure |
| `memory add` | add.ts | Interactive + flag-based item creation |
| `memory list` | list.ts | List items with filters |
| `memory show` | show.ts | Display single item |
| `memory edit` | edit.ts | Edit item in $EDITOR |
| `memory delete` | delete.ts | Delete with confirmation |
| `memory query` | query.ts | Semantic search |
| `memory sync` | sync.ts | Sync to database |
| `memory relate` | relate.ts | Manage relations |
| `memory stats` | stats.ts | Show statistics |
| `memory review` | review.ts | Review queue management |
| `memory import` | import.ts | Import from sources |
| `memory export` | export.ts | Export to formats |
| `memory hook` | hook.ts | Hook commands |

## Data Model

### MemoryItem (File Format)

```yaml
---
# Required
id: patterns/error-handling/api-errors
title: API Error Response Format
created: 2026-01-19T14:30:00Z

# Classification
domain: patterns
topic: error-handling
confidence: high
source: manual

# Optional
author: samid@vanguard.dev
updated: 2026-01-19T14:30:00Z
tags:
  - api
  - errors
  - conventions
relations:
  - decisions/003-error-handling-strategy
captureContext:
  sessionId: abc123
  confidenceScore: 0.87
---

# API Error Response Format

All API errors should return a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```
```

### MemoryConfig (File Format)

```yaml
# .vanguard/memory/_config.yaml
version: 1
project: vanguard-cli

embeddings:
  model: text-embedding-3-large
  dimensions: 1536

autoCapture:
  enabled: true
  confidenceThreshold: medium
  requireReview: true
  extract:
    patterns: true
    decisions: true
    errorSolutions: true
    conventions: false
  excludePaths:
    - "node_modules/**"
    - "*.test.ts"

search:
  defaultLimit: 5
  similarityThreshold: 0.6
  includeRelations: true
  maxRelationDepth: 2

hooks:
  preTask:
    enabled: true
    timeout: 5000
  postTask:
    enabled: true
    timeout: 10000
```

## API Contracts

### vanguard-web Integration

Memory commands communicate with vanguard-web via REST API.

#### POST /api/memory/search

**Request**:
```json
{
  "query": "how do we handle authentication?",
  "projectName": "vanguard-cli",
  "domains": ["patterns", "decisions"],
  "confidence": ["high", "medium"],
  "limit": 5,
  "threshold": 0.6,
  "includeRelations": true
}
```

**Response**:
```json
{
  "success": true,
  "items": [
    {
      "id": "decisions/002-session-auth",
      "title": "Session-Based Authentication",
      "similarity": 0.89,
      "confidence": "high",
      "domain": "decisions"
    }
  ],
  "relatedItems": [],
  "meta": {
    "totalMatches": 3,
    "searchTimeMs": 145
  }
}
```

#### POST /api/memory/sync

**Request**:
```json
{
  "projectName": "vanguard-cli",
  "items": [
    {
      "id": "patterns/error-handling/api-errors",
      "title": "API Error Response Format",
      "content": "...",
      "contentHash": "sha256:abc123...",
      "embedding": [0.1, 0.2, ...]
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "sync": {
    "added": 1,
    "updated": 0,
    "deleted": 0,
    "errors": []
  }
}
```

#### POST /api/memory/hook/query

**Request**:
```json
{
  "prompt": "implement user authentication",
  "projectName": "vanguard-cli",
  "phase": "implement",
  "maxItems": 5
}
```

**Response**:
```json
{
  "success": true,
  "context": "<vanguard-context>\n## Relevant Project Knowledge\n...",
  "itemCount": 3
}
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File Format | Markdown + YAML frontmatter | Human-readable, git-friendly, standard tooling |
| Frontmatter Parser | gray-matter | Well-maintained, TypeScript support |
| Embedding Model | text-embedding-3-large | Already integrated in vanguard-web |
| Vector Database | PostgreSQL + pgvector | Already deployed for telemetry |
| CLI Framework | Commander.js | Existing pattern in vanguard-cli |
| Testing | Vitest | Project standard |
| Content Hash | SHA256 | Standard, collision-resistant |

## Implementation Phases

### Phase 1: Core Data Model & Local Storage

**Goal**: Basic CRUD operations with file-based storage.

- [ ] Create `MemoryId` value object with validation
- [ ] Create `Confidence` value object
- [ ] Create `MemorySource` value object
- [ ] Create `ContentHash` value object
- [ ] Create `MemoryItem` entity with factory and business methods
- [ ] Create `MemoryConfig` entity
- [ ] Create `MemoryRepository` port interface
- [ ] Implement `FileMemoryRepository`
- [ ] Implement `MemoryFileParser` with gray-matter
- [ ] Create domain errors (`MemoryNotFoundError`, `InvalidMemoryIdError`, etc.)
- [ ] Implement `InitMemoryUseCase`
- [ ] Implement `AddMemoryItemUseCase`
- [ ] Implement `ListMemoryItemsUseCase`
- [ ] Implement `GetMemoryItemUseCase`
- [ ] Implement `UpdateMemoryItemUseCase`
- [ ] Implement `DeleteMemoryItemUseCase`
- [ ] Create `memory init` command
- [ ] Create `memory add` command (interactive + flags)
- [ ] Create `memory list` command
- [ ] Create `memory show` command
- [ ] Create `memory edit` command
- [ ] Create `memory delete` command
- [ ] Write unit tests for domain layer
- [ ] Write integration tests for file operations

### Phase 2: Search & API Integration

**Goal**: Semantic search via vanguard-web API.

- [ ] Create `EmbeddingService` port interface
- [ ] Create `MemoryApiClient` port interface
- [ ] Implement `OpenAIEmbeddingService`
- [ ] Implement `MemoryApiClient` HTTP adapter
- [ ] Implement `SearchMemoryUseCase`
- [ ] Implement `SyncMemoryUseCase`
- [ ] Add database schema to vanguard-web (migration)
- [ ] Add REST endpoints to vanguard-web
- [ ] Create `memory query` command
- [ ] Create `memory sync` command
- [ ] Create `memory stats` command
- [ ] Write tests for search functionality
- [ ] Add caching for embeddings

### Phase 3: Claude Code Integration

**Goal**: Pre-task context injection hooks.

- [ ] Create `HookService` application service
- [ ] Implement pre-task hook query logic
- [ ] Add hook endpoints to vanguard-web
- [ ] Create `memory hook query` command
- [ ] Create `memory hook install` command
- [ ] Implement intent detection
- [ ] Implement context formatting
- [ ] Add graceful degradation on hook failure
- [ ] Write integration tests with Claude Code hooks

### Phase 4: Relations & Advanced Features

**Goal**: Relation management and import/export.

- [ ] Implement `memory relate` command
- [ ] Add relation expansion to search
- [ ] Implement `memory import` command (CLAUDE.md, ADR, specs)
- [ ] Implement `memory export` command (markdown, JSON)
- [ ] Add relation graph visualization (optional)
- [ ] Write tests for relations

### Phase 5: Auto-Capture (Future)

**Goal**: Post-task knowledge extraction.

- [ ] Implement post-task hook extraction
- [ ] Create review queue data model
- [ ] Implement review queue API
- [ ] Create `memory review` commands
- [ ] Implement duplicate detection
- [ ] Add confidence scoring
- [ ] Add security filtering

## Testing Strategy

### Unit Tests

- **Domain entities**: MemoryItem creation, validation, business methods
- **Value objects**: MemoryId parsing, Confidence comparisons
- **Use cases**: Mock repository, test orchestration logic

### Integration Tests

- **File operations**: Read/write markdown files, parse frontmatter
- **API client**: Mock server responses, test error handling
- **CLI commands**: Test full command execution

### E2E Tests (Phase 3+)

- **Hook integration**: Test with Claude Code simulator
- **Sync workflow**: Test file → database sync cycle

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API unavailability | Search fails | Graceful degradation, offline mode for list/show |
| Large content files | Performance issues | 50KB limit enforced, content chunking for search |
| Embedding API costs | Budget overrun | Rate limiting, embedding cache, batch operations |
| Frontmatter parsing | Corrupt files | Validation on write, recovery on read errors |
| Hook latency | Poor UX | 500ms timeout, async background processing |
| ID conflicts | Data loss | Content hash comparison, manual merge UI |

## Dependencies

### External Packages (New)

| Package | Purpose | Version |
|---------|---------|---------|
| gray-matter | YAML frontmatter parsing | ^4.0.3 |

### Existing Infrastructure

- vanguard-web PostgreSQL database
- vanguard-web pgvector extension
- OpenAI API (existing integration)
- Commander.js CLI framework

---

_Generated by Vanguard for vanguard-cli_
_Stack: Plain TypeScript_
_Architecture: Domain-Driven Design_

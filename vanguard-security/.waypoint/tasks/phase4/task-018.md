# Task 018: Cross-Engagement Memory (pgvector)

**Phase**: Phase 4
**Wave**: Platform service — runs throughout all waves, not a discrete agent
**Depends on**: Phase 3 complete
**Labels**: phase4, platform, memory

## Why This Matters

After 10 engagements, Vanguard has seen things. It's found SQLi 3 times on targets
using the same Django version. It's seen AWS IMDS → credential theft twice in a row.
Right now that knowledge dies when the run ends.

Cross-engagement memory lets Vanguard say:
> "This SSRF pattern was found on 3 previous targets using nginx 1.20.
>  All three led to AWS credential theft via IMDS. Prioritize immediately."

The Brain Planner gets smarter with every engagement. Not from internet scraping —
from your team's own historical findings. This is institutional memory.

## What to Build

### Service: `EngagementMemory`

**New file**: `apps/worker/src/services/engagement-memory.ts`

```typescript
import { pgvector } from 'pgvector/pg';
import type { ConfirmedFinding } from '../types/findings.js';

export interface FindingSignature {
  id: string;
  vuln_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  tech_stack_hash: string;    // hash of "nginx+django+postgres"
  target_hash: string;        // sha256 of domain — never raw domain
  chain_pattern_id?: string;  // if part of a chain
  embedding: number[];        // pgvector: 1536-dim embedding of signature text
  discovered_at: string;
}

export interface SimilarFinding {
  signature: FindingSignature;
  similarity: number;         // 0.0 - 1.0 cosine similarity
  recommendation: string;     // "This pattern preceded AWS cred theft in 3 prior runs"
}

export class EngagementMemory {
  constructor(private db: pg.Client) {}

  async storeFinderprint(finding: ConfirmedFinding): Promise<void>
  async findSimilar(finding: ConfirmedFinding, topK = 5): Promise<SimilarFinding[]>
  async getPatterns(): Promise<Pattern[]>
  async getRecurringFindings(threshold = 3): Promise<RecurringPattern[]>
}
```

---

### Database Schema

```sql
-- Migration: apps/worker/migrations/001_engagement_memory.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE finding_signatures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vuln_type   TEXT NOT NULL,
  severity    TEXT NOT NULL,
  tech_stack_hash  TEXT NOT NULL,
  target_hash      TEXT NOT NULL,  -- sha256 of domain
  chain_pattern_id TEXT,
  embedding   vector(1536),        -- text-embedding-3-small dimension
  metadata    JSONB,
  discovered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON finding_signatures 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

### What Gets Stored (Anonymized)

```typescript
// What IS stored:
{
  vuln_type: 'sql_injection',
  severity: 'critical',
  tech_stack_hash: sha256('django:4.2+postgres:15'),   // no version specifics
  target_hash: sha256('targetcorp.com'),               // NEVER raw domain
  chain_pattern_id: 'sqli-data-exfil-001',
}

// What NEVER gets stored:
// - target URL, IP, domain name
// - actual evidence (request/response)
// - any PII or personal data
// - finding description text (only type + severity)
```

---

### Brain Planner Integration

After `storeFingerprint`, before dispatching next wave:

```typescript
// apps/worker/src/temporal/workflows.ts
const similar = await engagementMemory.findSimilar(currentFinding);

if (similar.length > 0) {
  const hint = similar
    .map(s => `${s.signature.vuln_type} seen ${s.count}x — ${s.recommendation}`)
    .join('\n');
  
  brainHints.push(`HISTORICAL CONTEXT:\n${hint}`);
}
```

Brain Planner sees: "XSS on React + nginx seen 4× — 3 of those also had CSRF. Check CSRF next."

---

### Docker Compose Addition

```yaml
# docker-compose.yml — add alongside vanguard-temporal
pgvector:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_DB: vanguard_memory
    POSTGRES_USER: vanguard
    POSTGRES_PASSWORD: ${PGVECTOR_PASSWORD}
  volumes:
    - pgvector_data:/var/lib/postgresql/data
  networks:
    - vanguard-net

volumes:
  pgvector_data:
```

---

### Privacy Architecture

```typescript
// REQUIRED in EngagementMemory:
const NEVER_STORE = [
  'target_url',
  'target_ip', 
  'target_domain_raw',
  'evidence_request',
  'evidence_response',
  'finding_description',
  'any field containing personal data',
] as const;

// Before storing, run through privacy filter:
function anonymizeSignature(finding: ConfirmedFinding): FindingSignature {
  return {
    vuln_type: finding.vuln_type,
    severity: finding.severity,
    tech_stack_hash: sha256(finding.tech_stack.sort().join('+')),
    target_hash: sha256(new URL(finding.target_url).hostname),
    // nothing else from the finding
  };
}
```

## Files to Create/Change

- `apps/worker/src/services/engagement-memory.ts` — NEW
- `apps/worker/migrations/001_engagement_memory.sql` — NEW
- `apps/worker/src/services/container.ts` — register EngagementMemory in DI
- `apps/worker/src/temporal/workflows.ts` — call storeFingerprint after brain-critic, inject findSimilar results into brain_hints
- `docker-compose.yml` — add pgvector service
- `apps/worker/src/types/engagement.ts` — add `memory_enabled?: boolean` flag

## Acceptance Criteria

- [ ] `EngagementMemory.storeFingerprint` stores anonymized signature (no raw domain, no evidence)
- [ ] `findSimilar` returns top-5 most similar findings from history
- [ ] Brain Planner receives historical context in brain_hints
- [ ] No raw target URLs, IPs, or evidence in pgvector rows (privacy test)
- [ ] Opt-out: `memory_enabled: false` in engagement.yaml skips all memory operations
- [ ] pgvector service starts with `docker compose up`
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/22-memory-architecture.md`
- pgvector embedding: use `text-embedding-3-small` (1536 dim, cheap, fast)
- IVFFlat index: `lists = 100` for 10K+ vectors. Exact search (`lists = 1`) for < 1K
- Memory is per-installation — never shared across organizations
- `memory_enabled` defaults to `false` until explicitly opted in (privacy-first default)
- Pgvector password must be in `.env` — never hardcoded

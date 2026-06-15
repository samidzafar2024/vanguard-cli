# Plan: Phase 4 — Advanced Attack Surfaces

**Status**: Draft
**Date**: 2026-04-28
**Spec ref**: `.waypoint/specs/phase4-advanced-surfaces.md`
**Tasks**: task-014 through task-018

---

## Architecture Overview

Phase 4 adds 8 new agents across three attack categories plus two platform features.
All agents follow the same pattern established in Phase 2-3.

```
Existing pipeline (Phase 1-3 complete)
  │
  ▼
═══════════════════════════════════════════════════════
WAVE 1 (parallel with existing)
  ├── [C1] llm-prompt-injector  (if LLM endpoints detected by profiling)
  ├── [C2] llm-exfiltrator      (if LLM endpoints detected)
  ├── [C3] llm-rag-poisoner     (if RAG system detected)
  ├── [C4] browser-side         (parallel with xss-vuln)
═══════════════════════════════════════════════════════
  │
  ▼
Replaces generic cloud-vuln:
═══════════════════════════════════════════════════════
  ├── [C5] aws-vuln    (if AWS detected by osint-recon/profiling)
  ├── [C6] gcp-vuln    (if GCP detected)
  └── [C7] azure-vuln  (if Azure detected)
═══════════════════════════════════════════════════════
  │
  ▼
After all vuln/exploit agents + Brain Critic:
  └── [C8] remediator  (white-box mode only, active mode required)

Platform layer (background):
  └── [C9] cross-engagement memory (pgvector, per-installation)
```

---

## Component Designs

### C1-C3 — LLM Application Agents

**Agent definitions**:
```typescript
'llm-prompt-injector': {
  prerequisites: ['profiling'],   // profiling detects LLM endpoints
  promptTemplate: 'llm-prompt-injector',
  deliverableFilename: 'llm_prompt_injection_deliverable.md',
  modelTier: 'large',
  required_mode: 'validated',
},
'llm-exfiltrator': {
  prerequisites: ['profiling'],
  promptTemplate: 'llm-exfiltrator',
  deliverableFilename: 'llm_exfiltration_deliverable.md',
  modelTier: 'large',
  required_mode: 'validated',
},
'llm-rag-poisoner': {
  prerequisites: ['profiling'],
  promptTemplate: 'llm-rag-poisoner',
  deliverableFilename: 'llm_rag_poison_deliverable.md',
  modelTier: 'large',
  required_mode: 'active',       // modifies knowledge base content
},
```

**Conditional execution** — only run if profiling detected LLM endpoints:
```typescript
// workflows.ts
if (targetProfile.tech_stack.includes('llm_endpoint')) {
  await Promise.allSettled([
    runSequentialPhase('llm-prompt-injector', ...),
    runSequentialPhase('llm-exfiltrator', ...),
    runSequentialPhase('llm-rag-poisoner', ...),
  ]);
}
```

**Prompt approach for `llm-prompt-injector`**:
- Use playwright to interact with chat interface
- Send structured injection payloads from payload library
- Detect success: AI deviates from expected response pattern
- Payloads: role confusion, instruction override, DAN-style jailbreaks, indirect injection via document upload

---

### C4 — Browser-Side Agent

**Agent definition**:
```typescript
'browser-side': {
  prerequisites: ['recon'],
  promptTemplate: 'browser-side',
  deliverableFilename: 'browser_side_deliverable.md',
  modelTier: 'medium',
  required_mode: 'validated',
},
```

**Prompt approach**:
- Parse CSP header → find bypass vectors (JSONP endpoints, CDN wildcards)
- Enumerate all postMessage listeners via JS analysis
- Test origin validation: `window.postMessage(payload, '*')`
- Check for prototype pollution in loaded libraries
- Test Service Worker registration for cache poisoning

---

### C5-C7 — Per-Cloud Agents (replace generic `cloud-vuln`)

**Migration**: existing `cloud-vuln` agent stays but becomes a router:
```typescript
// cloud-vuln prompt updated to detect cloud provider, then delegate
// OR: cloud-vuln deprecated, profiling detects provider, specific agent runs
```

**Recommended approach**: Keep `cloud-vuln` as generic fallback. Add dedicated agents that run IN ADDITION when specific cloud is detected. Brain Planner selects which to run.

**`aws-vuln` prompt responsibilities**:
```
1. If AWS credentials in CredentialStore:
   - aws sts get-caller-identity (validate)
   - aws iam list-attached-user-policies (enumerate permissions)
   - aws s3 ls (find accessible buckets)
   - aws secretsmanager list-secrets (check access)
   - Check IMDS v1 availability via SSRF if found

2. Without credentials:
   - Check for public S3 buckets via common naming patterns
   - Check EC2 metadata service via SSRF endpoints
   - Check for unauthenticated Lambda function URLs
```

**`gcp-vuln` and `azure-vuln`**: same pattern adapted per cloud provider.

---

### C8 — Remediation Generator

**Agent definition**:
```typescript
'remediator': {
  prerequisites: ['brain-critic'],    // only after findings are validated
  promptTemplate: 'remediator',
  deliverableFilename: 'remediation_deliverable.md',
  modelTier: 'large',                 // Opus — code generation quality matters
  required_mode: 'active',            // modifies files
},
```

**Workflow**:
```
1. Brain Critic output: list of confirmed findings with file locations
2. Remediator reads each finding:
   - Identifies affected file + line number from evidence
   - Generates language-appropriate fix (SQL → parameterized query, XSS → output encoding)
   - Applies fix to local repo copy on a new branch
3. Re-runs specific vuln agent against patched code
4. If fixed: opens PR via `gh pr create`
5. If not fixed: tries alternative fix, max 2 attempts
```

**Requires**:
- Source code access (`repoPath` must be provided)
- `active_mode_confirmed: true`
- GitHub/GitLab remote configured

---

### C9 — Cross-Engagement Memory

**Infrastructure** (not an agent — a platform service):
```typescript
// apps/worker/src/services/engagement-memory.ts
export class EngagementMemory {
  // pgvector-based vector store
  async storeFingerprint(finding: ConfirmedFinding): Promise<void>
  async findSimilar(finding: ConfirmedFinding): Promise<SimilarFinding[]>
  async getPatterns(): Promise<Pattern[]>
}
```

**What gets stored** (anonymized):
- Finding type + severity (not evidence)
- Tech stack component + version
- Hash of target domain (not the domain itself)
- Chain pattern ID if part of a chain

**What never gets stored**:
- Target URLs, IPs, domain names
- Actual evidence or request/response content
- Personal data

---

## New Tasks

| Task ID | Title | Depends On |
|---|---|---|
| task-014 | LLM Attack Surface (3 agents) | Phase 3 complete |
| task-015 | AWS/GCP/Azure per-cloud agents | Phase 3 + credential feedback loop |
| task-016 | Browser-Side Attack Agent | Phase 3 complete |
| task-017 | Remediation Generator | Phase 3 brain-critic |
| task-018 | Cross-Engagement Memory | Phase 3 complete |

---

## ALL_AGENTS additions

```typescript
// Add after existing agents, before report:
'llm-prompt-injector',
'llm-exfiltrator',
'llm-rag-poisoner',
'browser-side',
'aws-vuln',
'gcp-vuln',
'azure-vuln',
'remediator',
```

---

## Integration Points

| File | Change |
|---|---|
| `apps/worker/src/types/agents.ts` | Add 8 new agents to ALL_AGENTS |
| `apps/worker/src/session-manager.ts` | Add definitions for all new agents |
| `apps/worker/src/temporal/activities.ts` | Add activity wrappers |
| `apps/worker/src/temporal/workflows.ts` | Conditional LLM wave, per-cloud routing, remediator after critic |
| `apps/worker/src/services/engagement-memory.ts` | NEW — pgvector service |
| `docker-compose.yml` | Add pgvector service for cross-engagement memory |

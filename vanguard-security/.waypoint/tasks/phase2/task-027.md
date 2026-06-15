# Task 027: Profiling Agent (Tech Stack + Cloud + LLM Fingerprinting)

**Phase**: Phase 2
**Wave**: Wave 1 — parallel with secrets-detection and hardening-auditor
**Depends on**: Task 008 (waf-fingerprint — must run before any probing)
**Labels**: phase2, agent

## Why This Matters

The existing `recon` agent maps the attack surface (endpoints, params, forms).
But it doesn't answer three questions that determine which agents to run in Phase 4:

1. **What cloud is this?** — Is it AWS (run aws-vuln), GCP (gcp-vuln), or Azure (azure-vuln)?
2. **Does this app use an LLM?** — Is there a chat interface, /api/chat endpoint, or AI assistant? (run llm-prompt-injector)
3. **What framework/version is running?** — Express 4.17.1? Django 3.2? (Brain Planner uses this for CVE prioritization)

Without `profiling`, Phase 4 agents run blind — they don't know which cloud agents
or LLM agents are relevant. The Brain Planner also can't make CVE-aware routing
decisions without knowing the precise framework version.

**`profiling` is the tech-stack intelligence that unlocks Phase 4 routing.**

## What to Build

### Agent: `profiling`

**Agent definition** (`apps/worker/src/session-manager.ts`):
```typescript
'profiling': {
  name: 'profiling',
  displayName: 'Tech Stack Profiling',
  prerequisites: ['waf-fingerprint'],
  promptTemplate: 'profiling',
  deliverableFilename: 'profiling_deliverable.md',
  modelTier: 'medium',
  required_mode: 'passive',
},
```

**Prompt file**: `apps/worker/prompts/profiling.txt`

---

### Detection Categories

**1. Framework + Language Detection**

```
HTTP response headers:
  X-Powered-By: Express → Node.js + Express
  X-Powered-By: PHP/8.1.0 → PHP 8.1
  Server: gunicorn → Python (likely Django/Flask)

Cookie patterns:
  PHPSESSID → PHP
  JSESSIONID → Java (Spring/Tomcat)
  django_session → Django
  laravel_session → Laravel

Error page signatures:
  "A PHP Error was encountered" → CodeIgniter
  "Whoops!" → Laravel debug
  Django yellow error page
  Rails exception page

HTML meta / generator tags:
  <meta name="generator" content="WordPress 6.4.2">
  <meta name="generator" content="Drupal 10">

JS bundle filenames:
  vendor.chunk.js → React/Vue/Angular bundled app
  next-server.js, _next/ → Next.js
  nuxt → Nuxt.js
```

**2. Cloud Provider Detection**

```
Response headers:
  x-amz-request-id → AWS (S3 or CloudFront)
  x-amz-cf-id → CloudFront
  x-goog-stored-content-length → GCP Cloud Storage
  x-ms-request-id → Azure

DNS + certificate:
  *.amazonaws.com → AWS
  *.azurewebsites.net, *.azure.com → Azure
  *.appspot.com, *.googleapis.com → GCP

CDN / delivery:
  Server: AmazonS3 → S3 bucket
  Via: 1.1 cloudfront.net → CloudFront
  x-azure-ref → Azure Front Door

SSRF indicator patterns from recon:
  Any /api/metadata, /api/health endpoints → check for cloud metadata format
```

**3. LLM Endpoint Detection**

```
URL patterns (from recon deliverable + direct probing):
  /api/chat, /api/chat/completions → likely LLM endpoint
  /api/assistant, /api/ask → potential LLM
  /v1/messages, /v1/chat/completions → OpenAI-compatible API

Response patterns:
  {"model": "gpt-4", ...} → OpenAI response format
  {"model": "claude-3", ...} → Anthropic format
  Streaming: Content-Type: text/event-stream with data: {"choices":[...]}

UI indicators (via Playwright):
  <div class="chat-container">, <textarea class="message-input">
  Typewriter effect on text loading → streaming LLM response
  "Powered by ChatGPT/Claude/Gemini" in footer

Known AI SaaS header indicators:
  x-openai-organization → OpenAI API in use
  x-anthropic-version → Anthropic API
  anthropic-ratelimit-requests → Anthropic
```

**4. Version Extraction**

```
Where found → extract exact version:
  X-Powered-By: Express → search response for version hints (404 pages, /package.json)
  Generator tags → version in content attribute
  Error pages → framework version in stack trace
  /robots.txt hints, /sitemap.xml CMS version

Write version to tech_stack array:
  ["Express:4.17.1", "React:18.2.0", "Node:20.10.0"]
```

---

### Output Format

```typescript
interface ProfilingDeliverable {
  tech_stack: string[];              // ["Express:4.17.1", "React:18.2.0", "AWS"]
  cloud_provider: 'aws' | 'gcp' | 'azure' | 'vercel' | 'cloudflare' | null;
  llm_endpoints: LLMEndpoint[];      // [] if none detected
  framework: string | null;          // "Express" | "Django" | "Laravel" | null
  framework_version: string | null;  // "4.17.1" | null
  language: string | null;           // "nodejs" | "python" | "php" | "java" | null
  cms: string | null;                // "WordPress:6.4.2" | "Drupal:10" | null
}

interface LLMEndpoint {
  url: string;
  provider_hint: 'openai' | 'anthropic' | 'google' | 'unknown';
  confidence: number;                // 0.0 - 1.0
  ui_present: boolean;               // chat interface found in browser
}
```

---

### Feeding Phase 4 Routing

```typescript
// apps/worker/src/temporal/workflows.ts
const profile = await loadDeliverable('profiling_deliverable.md');

// Phase 4 LLM routing
if (profile.llm_endpoints.length > 0) {
  await Promise.allSettled([
    runSequentialPhase('llm-prompt-injector', ...),
    runSequentialPhase('llm-exfiltrator', ...),
    runSequentialPhase('llm-rag-poisoner', ...),
  ]);
}

// Phase 4 cloud routing
if (profile.cloud_provider === 'aws') {
  await runSequentialPhase('aws-vuln', ...);
} else if (profile.cloud_provider === 'gcp') {
  await runSequentialPhase('gcp-vuln', ...);
} else if (profile.cloud_provider === 'azure') {
  await runSequentialPhase('azure-vuln', ...);
}
```

---

### Relationship to Existing `recon` Agent

`recon` maps endpoints, parameters, and forms — the attack surface.
`profiling` identifies the technology and infrastructure — what the surface is made of.

They are complementary. `profiling` runs in Wave 1 (parallel to recon).
`recon` findings feed into `profiling` (URL patterns → LLM detection).
`profiling` findings feed into Brain Planner (tech stack → CVE matching).

## Files to Create/Change

- `apps/worker/prompts/profiling.txt` — NEW (may already exist as stub — check first)
- `apps/worker/src/session-manager.ts` — add/update agent definition
- `apps/worker/src/types/agents.ts` — ensure in ALL_AGENTS (may already be listed)
- `apps/worker/src/temporal/activities.ts` — add/verify activity wrapper
- `apps/worker/src/temporal/workflows.ts` — Phase 4 routing conditional (LLM + cloud)
- `apps/worker/src/types/findings.ts` — add `ProfilingDeliverable` type

## Acceptance Criteria

- [ ] Detects Express from `X-Powered-By` header
- [ ] Detects AWS from `x-amz-request-id` or CloudFront headers
- [ ] Detects LLM endpoint from `/api/chat` URL pattern + streaming response
- [ ] `profiling_deliverable.md` contains `cloud_provider` and `llm_endpoints` fields
- [ ] Phase 4 LLM agents only trigger when `llm_endpoints.length > 0`
- [ ] Phase 4 cloud agents only trigger when `cloud_provider` is set
- [ ] Brain Planner receives tech_stack for CVE matching
- [ ] `pnpm run check` passes

## Notes

- "profiling" is listed in the Phase 3 plan ALL_AGENTS as "existing" — check if a stub
  exists in `apps/worker/src/session-manager.ts` before creating a new definition
- LLM detection should use Playwright for UI indicators (chat interface presence)
- Cloud detection via headers is the most reliable signal — prioritize over DNS
- Version extraction: best-effort — don't fail if version not found, just set null
- This agent's output directly gates Phase 4 execution — test it thoroughly

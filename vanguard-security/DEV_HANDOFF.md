# Vanguard — Developer Handoff

> Last updated: 2026-04-30
> Written for any developer (or future AI session) picking this up cold.

---

## What Is Vanguard?

Vanguard is an **autonomous AI penetration testing platform**. You point it at a URL (and optionally a repo), it spins up a Kali Linux container, and 43 AI agents work through a structured attack pipeline — recon, scanning, vulnerability analysis, exploitation, post-exploitation, kill chain simulation, remediation, and a final executive report.

- Built on **Temporal.io** for durable, crash-recoverable workflow orchestration
- Agents run via the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) with `maxTurns: 10_000`
- Runtime is **Kali Linux rolling** (Docker), so every security tool is pre-installed
- TypeScript monorepo: `apps/cli` (published to npm) + `apps/worker` (Temporal worker, runs in Docker)

---

## Architecture in One Diagram

```
User runs: ./vanguard start -u https://target.com -r my-repo

           apps/cli (Node.js on host)
                |
                ├── docker compose up → Temporal server (port 7233 / UI 8233)
                └── docker run --rm   → Kali container (apps/worker)
                                            |
                                            └── Temporal Worker
                                                    |
                                                    └── pentestPipelineWorkflow
                                                              |
                                                              └── 43 agents
```

Each scan gets its own Docker container + its own Temporal task queue — complete isolation.

---

## The 43-Agent Pipeline

Agents run in waves. Dependencies are tracked in `session-manager.ts` via `prerequisites`.

### Wave 0 — Passive Intelligence (no HTTP to target)
| Agent | What it does |
|---|---|
| `osint-recon` | OSINT via public sources (Shodan, certs, DNS) |
| `waf-fingerprint` | Detects WAF/CDN, maps bypass opportunities |

### Wave 1A — Surface Mapping (5 agents in parallel)
| Agent | What it does |
|---|---|
| `profiling` | Tech stack fingerprint → `ProfilingData` (drives all conditional routing) |
| `secrets-detection` | Scans for leaked secrets in public assets |
| `hardening-auditor` | Security headers, TLS config, cookie flags |
| `github-leaks` | GitHub dorking for leaked credentials/configs |
| `network-scan` | nmap TCP/UDP sweep, banner grabbing, CVE correlation |

### Wave 1B — Deep Intelligence (parallel)
| Agent | What it does |
|---|---|
| `supply-chain` | Dependency vulnerabilities, typosquatting |
| `cred-intel` | Credential intelligence from breach databases |

### Brain Team — Planner
| Agent | What it does |
|---|---|
| `brain-planner` | Synthesizes Wave 1 → attack plan for all agents |

### Deep Scanning (sequential)
| Agent | What it does |
|---|---|
| `pre-recon` | Source code analysis (if repo provided) |
| `sast` | Static analysis for code vulnerabilities |
| `recon` | Active attack surface mapping |
| `nuclei-scan` | Template-based vulnerability scanning |
| `ssl-tls-vuln` | TLS/SSL vulnerabilities (BEAST, POODLE, etc.) |
| `cloud-vuln` | Generic cloud misconfiguration checks |
| `container-vuln` | Container/Docker security issues |

### Conditional Agents (gated on profiling results)
| Agent | Gate condition | What it does |
|---|---|---|
| `aws-vuln` | `cloud_provider === 'aws'` | IAM misconfig, S3, Lambda, Cognito |
| `gcp-vuln` | `cloud_provider === 'gcp'` | IAM bindings, GCS, GKE, SA keys |
| `azure-vuln` | `cloud_provider === 'azure'` | RBAC, Blob, Key Vault, AKS |
| `llm-prompt-injector` | `llm_endpoints.length > 0` | Prompt injection, jailbreaks, data exfil |
| `active-directory` | `ad_environment === true` | BloodHound, Kerberoasting, AS-REP roasting |
| `mobile-recon` | `mobile_apps.length > 0` | APK/IPA analysis, hardcoded secrets, WebViews |

### Brain Team — Guardian
| Agent | What it does |
|---|---|
| `brain-guardian` | OPSEC check before active attacks — can halt pipeline |

### Wave 2-3 — Vulnerability Analysis + Exploitation (8 parallel pairs)
Each pair: `vuln` agent → queue check → conditional `exploit` agent.

| Vuln Agent | Exploit Agent | Vulnerability Class |
|---|---|---|
| `injection-vuln` | `injection-exploit` | SQL/NoSQL/Command injection |
| `xss-vuln` | `xss-exploit` | Reflected, Stored, DOM XSS |
| `auth-vuln` | `auth-exploit` | Broken authentication, JWT, session |
| `ssrf-vuln` | `ssrf-exploit` | Server-Side Request Forgery |
| `authz-vuln` | `authz-exploit` | Broken access control, privilege escalation |
| `websocket-vuln` | `websocket-exploit` | WebSocket injection, origin bypass |
| `idor-vuln` | `idor-exploit` | Insecure Direct Object Reference |
| `browser-vuln` | `browser-exploit` | CSP bypass, CORS, postMessage, prototype pollution |

Exploitation only runs if the vuln agent writes findings to its queue file.

### Post-Wave — Simulation & Analysis
| Agent | Prerequisites | What it does |
|---|---|---|
| `post-exploit` | all 8 exploit agents | DB enumeration, SSRF to cloud metadata, credential abuse |
| `brain-critic` | `post-exploit` | Validates findings, scores severity |
| `brain-chain-hunter` | `brain-critic` | Builds multi-step exploit chains |
| `kill-chain` | `brain-chain-hunter` | MITRE ATT&CK-mapped narrative of full attack path |
| `remediation` | `kill-chain` | Root cause analysis + framework-specific fixes |
| `report` | `remediation` | Executive security assessment report |

---

## Key Files

### Entry Points
| File | Purpose |
|---|---|
| `vanguard` | Shell entry point — delegates to `apps/cli/dist/index.mjs` |
| `apps/cli/src/index.ts` | CLI dispatcher (start, stop, logs, workspaces, build) |
| `apps/cli/src/docker.ts` | Docker orchestration — spawns containers |
| `apps/worker/src/temporal/worker.ts` | Temporal worker — spins up inside the container |
| `apps/worker/src/temporal/workflows.ts` | Main workflow (`pentestPipelineWorkflow`) — all wave routing |
| `apps/worker/src/temporal/activities.ts` | Activity wrappers — thin Temporal layer, calls services |

### Core Logic
| File | Purpose |
|---|---|
| `apps/worker/src/session-manager.ts` | `AGENTS` registry — all 43 agent definitions, prerequisites, prompt templates |
| `apps/worker/src/types/agents.ts` | `AgentName`, `ALL_AGENTS`, `VulnType` types |
| `apps/worker/src/types/deliverables.ts` | `DeliverableType` enum — every agent's output file registered here |
| `apps/worker/src/services/agent-execution.ts` | Agent lifecycle — retry logic, Claude SDK call, checkpoint |
| `apps/worker/src/services/queue-validation.ts` | Decides if exploit should run based on vuln agent output |
| `apps/worker/src/ai/claude-executor.ts` | Claude Agent SDK integration |
| `apps/worker/src/audit/metrics-tracker.ts` | Writes `session.json` — cost, timing, per-agent metrics |

### Prompts
```
apps/worker/prompts/           ← production prompts (real agents)
apps/worker/prompts/pipeline-testing/  ← stub prompts (--pipeline-testing mode, instant)
apps/worker/prompts/shared/    ← shared partials (_filesystem.txt, login-instructions.txt)
```

---

## Conditional Routing — How It Works

`profiling` agent runs early and returns `ProfilingData`:

```typescript
interface ProfilingData {
  tech_stack: string[];
  cloud_provider: 'aws' | 'gcp' | 'azure' | 'vercel' | 'cloudflare' | null;
  llm_endpoints: Array<{ url: string; provider_hint: string; confidence: number; ui_present: boolean }>;
  framework: string | null;
  language: string | null;
  ad_environment?: boolean;
  mobile_apps?: Array<{ platform: 'ios' | 'android' | 'pwa'; url: string; store_url?: string }>;
}
```

`workflows.ts` reads this and gates agents accordingly:

```typescript
// Cloud provider routing
if (profilingData?.cloud_provider === 'aws') runAwsVulnAgent(...)
if (profilingData?.cloud_provider === 'gcp') runGcpVulnAgent(...)
if (profilingData?.cloud_provider === 'azure') runAzureVulnAgent(...)

// LLM endpoints
if (profilingData?.llm_endpoints.length > 0) runLlmPromptInjectorAgent(...)

// Active Directory
if (profilingData?.ad_environment === true) runActiveDirectoryAgent(...)

// Mobile apps
if ((profilingData?.mobile_apps?.length ?? 0) > 0) runMobileReconAgent(...)
```

---

## Adding a New Agent (checklist)

1. **`apps/worker/src/types/agents.ts`** — add name to `ALL_AGENTS` array (respects execution order)
2. **`apps/worker/src/types/deliverables.ts`** — add `DeliverableType` enum entry + `DELIVERABLE_FILENAMES` mapping
3. **`apps/worker/src/session-manager.ts`** — add `AgentDefinition` to `AGENTS` record, add to `PhaseName` type, `AGENT_PHASE_MAP`, `PLAYWRIGHT_SESSION_MAPPING`, `AGENT_VALIDATORS`
4. **`apps/worker/src/audit/metrics-tracker.ts`** — add phase slot in `calculatePhaseMetrics()`
5. **`apps/worker/src/temporal/activities.ts`** — add activity wrapper function
6. **`apps/worker/src/temporal/workflows.ts`** — call activity in the right wave/phase
7. **`apps/worker/prompts/<agent-name>.txt`** — production prompt
8. **`apps/worker/prompts/pipeline-testing/<agent-name>.txt`** — stub: just `save-deliverable --type X --content '...'`
9. If it's a new `VulnType`: also update `VULN_TYPE_CONFIG` in `apps/worker/src/services/queue-validation.ts`

---

## Running Locally

```bash
# 1. Set credentials
echo "ANTHROPIC_API_KEY=your-key" > .env

# 2. Build the Kali Docker image (one-time, ~10 min)
./vanguard build

# 3. Run a scan
./vanguard start -u https://target.com -r my-repo

# 4. Run in pipeline-testing mode (fast — agents just save stubs, no real scanning)
./vanguard start -u https://target.com -r my-repo --pipeline-testing

# 5. Monitor
./vanguard logs <workspace-name>
# Temporal UI: http://localhost:8233

# 6. Stop
./vanguard stop
```

---

## Workspace & Resume

Each scan creates a workspace at `workspaces/<hostname>_<sessionId>/`:
```
workspaces/
  example-com_abc123/
    session.json          ← metrics, status, cost, per-agent results
    workflow.log          ← human-readable timeline
    deliverables/         ← agent output files (.md)
    prompts/              ← prompt snapshot per agent
```

Resume is automatic — run the same command again, it detects completed agents via `session.json` and skips them.

---

## TypeScript / Linting

```bash
npx tsc --noEmit          # type check (must be zero errors)
npx @biomejs/biome check  # lint + format check
npx @biomejs/biome format --write apps/worker/src/  # auto-fix formatting
```

Current state: **zero TypeScript errors, zero Biome errors** (2 pre-existing warnings in `preflight.ts` — not our code).

---

## What Was Built (This Session)

Starting from a 5-agent prototype, the pipeline was expanded to 43 agents across 4 parallel implementation sessions:

**Phase 4 — Cloud & Advanced Attacks**
- `aws-vuln`, `gcp-vuln`, `azure-vuln` — cloud-provider-specific vulnerability agents
- `llm-prompt-injector` — LLM attack surface (prompt injection, jailbreaks)
- `browser-vuln`, `browser-exploit` — browser-side attack surface
- `post-exploit` — post-exploitation simulation
- `remediation` — AI-generated remediation guidance

**Phase 5 — Network & Enterprise**
- `network-scan` — nmap TCP/UDP, CVE correlation
- `mobile-recon` — APK/IPA analysis, mobile attack surface
- `active-directory` — BloodHound, Impacket, Kerberoasting
- `kill-chain` — MITRE ATT&CK-mapped full attack narrative

**Infrastructure changes to support all new agents:**
- `ALL_AGENTS` — 43 agents in correct execution order
- `VulnType` — extended with `'browser'`
- `DeliverableType` enum — expanded from ~15 to 62+ entries covering every agent
- `VULN_TYPE_CONFIG` — `browser` pair added
- `ProfilingData` — extended with `ad_environment` and `mobile_apps`
- `session-manager.ts` — all agent definitions, phase map, validators
- `metrics-tracker.ts` — all phase slots
- `activities.ts` — all activity wrappers
- `workflows.ts` — all conditional routing + wave ordering
- 24 new prompt files (12 production + 12 pipeline-testing stubs)

---

## Next Steps

1. **Test end-to-end** — `./vanguard start -u <url> -r <repo> --pipeline-testing` against a target you own
2. **Tune prompts** — production prompts in `apps/worker/prompts/` are functional but can be refined per target type
3. **Publish** — `apps/cli` publishes to npm as `@copointai/vanguard` via `.github/workflows/release.yml`

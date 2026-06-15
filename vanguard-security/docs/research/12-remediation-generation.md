# Research #12 — Remediation Generation + Validation

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** **Frontier capability** — find→fix→verify→PR loop. v1 alpha months 1-3 (SQLi+XSS+path traversal, Node/TS+Python). 6-12 month roadmap to GA.

---

## Executive summary

**The "find a vuln" problem is commoditized.** Bottleneck shifted to remediation: writing patch, validating, getting merged, confirming chain closed. **The team that closes this loop autonomously owns the next decade of AppSec.** Snyk DeepCode Fix, GitHub Copilot Autofix, Synack Sara are all circling — none ships fully closed find→fix→verify→PR loop driven by adversarial proof.

**This is Vanguard's natural moat.**

**The frontier gap nobody has shipped: adversarial verification.** Re-running the exact exploit chain post-patch, confirming it now fails, only then submitting PR. **The replay IS the product. Everyone else ships suggestions; Vanguard ships proofs.**

**Tier 1 (ship autonomous v1)**: SQLi + XSS + path traversal. Highly deterministic, near-zero false-fix surface.
**Tier 2 (ship draft PR only)**: SSRF, hardcoded secrets.
**Tier 3 (advisory only, never autopatch)**: IDOR/authz, auth bypass, session flaws — patches that close test exploit but don't enforce right policy = high false-fix risk.

---

## Research questions

1. What's the state of remediation tools in 2025?
2. What per-vuln-class patterns are highest leverage?
3. What code modification primitives to use?
4. How to validate patches with adversarial proof?
5. What's the PR submission workflow?
6. When is human review mandatory?
7. How to detect false fixes?
8. Multi-language + framework-aware coverage?
9. What's the `remediator` agent design?

---

## Key findings

### 1. State of the art (2025)

**GitHub Copilot Autofix** (GA April 2025) — most mature shipping system. Pairs CodeQL findings with Claude/GPT-4 class model, suggests inline PR fixes. Microsoft Security data: ~67% of fixes accepted with no edit; median time-to-remediate dropped from 36 days to ~28 minutes for SQLi. **Critical gap**: Autofix patches are advisory; human reviews. **System doesn't re-run CodeQL adversarially against patched branch to confirm closure.**

**Snyk DeepCode AI Fix** — hybrid retrieval (training corpus of real GitHub fix commits) + symbolic verification. Strong on JS/TS/Python; weaker on Go/Rust. Same gap: no dynamic re-verification.

**CodeRabbit / Greptile** — review-time tools, comment on PRs with suggested diffs. Not autonomous; code review with LLM context.

**Anthropic Claude Code** — closest general-purpose remediation primitive. Read repo, edit files via targeted diffs, run tests, iterate. **Claude Code SDK + computer-use APIs make it tractable to wrap Claude in remediator loop without building file-edit infrastructure from scratch.**

**Synack Sara** (announced 2024, expanded 2025) — triage + suggests fixes for human pentesters. **Not autonomous PR submission.**

**Academic — Google Big Sleep / Project Naptime** — LLM agents can patch real CVEs when given fuzzer harness for verification — **the harness IS the oracle.** Architectural pattern Vanguard should copy: **the pentest itself is the oracle.**

**Frontier gap nobody shipped: adversarial verification.** Re-running exact exploit chain post-patch, confirming it fails, then submitting PR.

### 2. Per-vuln-class remediation patterns (ranked by frequency × determinism × low-false-fix-risk)

#### Tier 1 (ship first, autonomous)

1. **SQLi → parameterized queries.** Highly deterministic; near-zero false-fix. Pattern: locate sink (`db.query`, `cursor.execute`), identify tainted concatenation, rewrite to parameterized form with original variable bound as parameter
2. **XSS (reflected/stored) → context-aware output encoding.** Identify sink (HTML body, attribute, JS context, URL), inject right encoder (`escapeHtml`, `encodeURIComponent`, framework-native auto-escape)
3. **Path traversal → `path.resolve` + prefix check, or basename allowlist.** Deterministic; small diff

#### Tier 2 (ship next, draft PR only)

4. **SSRF → URL allowlist + DNS rebinding guard** (resolve once, validate, pass IP). Higher business-logic coupling — what URLs are *legitimate*? Often needs human config
5. **Hardcoded secrets → move to env var + revoke.** Deterministic on patch, but revocation out-of-band

#### Tier 3 (research, do not ship autonomous)

6. **IDOR / broken authz → insert authorization check.** Requires understanding *intent* of endpoint ("who *should* be allowed?"). Patches need human review almost always — **high false-fix risk where patch closes test exploit but doesn't enforce right policy**
7. **Auth bypass / session flaws** — same reasoning. Don't autopatch
8. **CSRF, open redirect, XXE** — Tier 2/3 depending on framework

### 3. Code modification primitives (3 layers)

**Layer A — Targeted text edits (Claude Code style).** Read file, find exact string, replace with patched. **Astonishingly effective for small localized fixes** (which most Tier 1 are). No AST required. Cost: requires unique anchoring strings; brittle on minified/repetitive code.

**Layer B — Tree-sitter AST patches.** Tree-sitter has grammars for ~40 languages, gives parse tree without compilation. For SQLi: match `(call_expression function: (member_expression property: (property_identifier) @method) arguments: (arguments (binary_expression) @arg))` and rewrite argument node. **Use when text edits ambiguous.**

**Layer C — Language-server protocol (LSP) refactoring.** Use project's actual language server (gopls, pyright, rust-analyzer) for rename-symbol, extract-function. **Overkill for v1. Defer.**

**Recommended v1 stack: Layer A as default, Layer B for SQLi/XSS where sink-rewriting needs structural awareness.** Both wrapped in same `apply_patch` tool.

**Diff generation**: agent produces unified diffs, apply with `patch` or `git apply --check` to validate, then `git apply` to commit. Free dry-run.

### 4. Validation pipeline (THE MOAT)

**This is the part nobody else shipped.** Flow:

```
Vuln Found → Patch Generated → Branch Created → Tests Run
   → Pentest Re-run on Patched Branch → Chain-Closed Check
   → Regression Check → PR Submitted
```

**Stages:**

1. **Snapshot the exploit** — Vanguard's pipeline already produces "chain" object (sequence of HTTP requests/payloads). Persist as replayable artifact (HAR + assertion: "response contains DB error" or "response 200 with admin data")

2. **Apply patch on branch** — `git checkout -b vanguard/fix-{finding-id}`, apply diff, commit

3. **Build & boot** — use existing project's build system. Detect via `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` / `Dockerfile`. **If Dockerfile exists, prefer it** — most reproducible target. Boot patched app in ephemeral container

4. **Replay the exploit** — send exact chain. Assert original success condition no longer holds. **The adversarial oracle.**

5. **Mutation testing of the fix** — don't just replay original payload; mutate. SQLi: vary quote styles, encoding, comment syntax. **If any mutation succeeds, patch is incomplete.** Borrow small fuzzer (sqlmap-tamper-style mutations) per vuln class

6. **Regression suite** — run project's test suite. If tests fail, patch rejected. If no tests, smoke test: every endpoint touched by diff should still return 2xx for baseline auth'd request

7. **Re-run full Vanguard pentest** (subset: only agents relevant to patched class, to keep cost bounded). **If new findings appear because of patch, that's a false fix**

**Only if all stages pass: open PR.**

### 5. PR submission workflow

GitHub: `gh pr create`. GitLab: glab CLI. Bitbucket: REST API.

**PR structure:**

- **Branch**: `vanguard/fix-{vuln-class}-{finding-id-short}`
- **Title**: `Fix {vuln-class} in {file}:{line}` (under 70 chars)
- **Body — non-negotiable sections:**
  - **Vulnerability**: class, CWE, severity, location
  - **Exploit reproduction**: chain with curl commands
  - **Fix**: 1-paragraph explanation
  - **Validation evidence**: "Replayed exploit post-patch: blocked. Mutation tests: 12/12 blocked. Test suite: 847/847 passing. Re-run pentest: finding closed, no new findings."
  - **Reviewer checklist**: business-logic confirmation, edge cases agent flagged uncertain
  - Attribution footer noting Vanguard-generated

Commit message: Conventional Commits style (`fix(security): parameterize SQL query in user lookup`). Co-author trailer for traceability.

**Tier rules:**
- Tier 1 → PR auto-opened, ready for merge
- Tier 2 → PR opened in **draft**
- Tier 3 → no PR, just issue with advisory

### 6. When human review is mandatory (hard rules blocking autonomous PRs)

- Patch touches **authentication, authorization, or session code** — even if finding is in another class. Authz logic intent-laden
- Patch **deletes** or **renames** public function/export. API surface change
- Patch touches **cryptographic primitives** (key derivation, IV generation, signature verification). Too easy to introduce subtle weakening
- Patch modifies more than **N=15 lines** OR more than **3 files**. Heuristic — large diffs correlate with poor patches
- Patch in file with **no test coverage** for modified function. No regression safety net
- Confidence score from remediator < 0.85 (self-reported, calibrated against prior accept/reject)
- Project is **production-tagged** (config setting). Production gets advisory-only mode by default

**Policy-as-code in `.vanguard/remediation-policy.yaml`, overridable per-repo.**

### 7. False-fix detection (most dangerous failure mode)

Patch closes test exploit but introduces different vulnerability. Examples:

- SQLi "fixed" by string-escaping incomplete in MySQL strict mode
- XSS "fixed" by stripping `<script>` but not `<img onerror>`
- Path traversal "fixed" by blocking `..` but not URL-encoded `%2e%2e`
- Authz "fixed" by checking session userId but not role

**Detection strategies:**

1. **Mutation testing** — strongest signal for known classes
2. **Differential pentest** — re-run *all* Vanguard agents on patched branch, not just one that found it. New agent fires → flag
3. **Pattern-based anti-patterns** — codify "fixes that look like fixes but aren't": `replace("'", "''")` for SQLi, regex-based HTML stripping for XSS. Remediator self-checks output against denylist before submitting
4. **LLM critic** — second model (or same model, fresh context) reads only diff + vuln description, answers "does this fully close class of bugs, or just this specific payload?" Cheap, surprisingly effective per Anthropic's constitutional-AI work

**Critic = additional gate before PR submission.**

### 8. Multi-language coverage (priority by ecosystem footprint × Vanguard's market)

| Lang | SQLi fix | XSS fix | Path trav | Maturity |
|---|---|---|---|---|
| **Node/TS** | parameterize via `?` placeholders, prepared statements (`mysql2`, `pg`, Prisma) | framework escape (React auto, manual `DOMPurify`) | `path.resolve` + prefix | High |
| **Python** | `cursor.execute(sql, params)`, SQLAlchemy text+bindparams | Jinja autoescape, `markupsafe.escape` | `os.path.realpath` + prefix | High |
| **Go** | `db.Query(sql, args...)` (already idiomatic) | `html/template` (auto), `template.HTMLEscapeString` | `filepath.Clean` + prefix | High |
| **Java** | `PreparedStatement.setX()`, JPA `setParameter` | OWASP Encoder, framework `<c:out>` | `Path.normalize` + `startsWith` | Medium (build-system complexity) |
| **Rust** | sqlx compile-time checked, `?` placeholders | `askama`, `maud` auto-escape | `Path::canonicalize` | Lower priority — small surface |

**Ship Node/TS + Python first** (covers ~70% of web vulns in wild). Add Go in month 4, Java in month 6, Rust opportunistically.

### 9. Framework-aware patching

Same vuln class needs different patches per framework. **Remediator must detect framework before writing patch.**

**SQLi:**
- Express + raw `mysql`: `db.query('SELECT * FROM u WHERE id = ?', [userId])`
- Express + Prisma: rewrite to `prisma.user.findUnique({ where: { id: userId } })` if call site is simple
- Django: `User.objects.raw('SELECT ...', [params])` or refactor to ORM
- Rails: ActiveRecord `where(id: params[:id])`, never `where("id = #{params[:id]}")`
- Spring: `JdbcTemplate.query(sql, args)` or `@Query` with named params

**XSS:**
- React/Vue/Svelte: framework already escapes; bug is `dangerouslySetInnerHTML` / `v-html` / `{@html}` — fix is remove or wrap in `DOMPurify.sanitize`
- Express + manual templating: switch to `res.render` with auto-escape, or wrap in `escape-html`
- Django: ensure `|safe` filter removed; rely on auto-escape
- Rails: remove `raw`, `html_safe`, use `sanitize` helper

**Framework detection** via `package.json` / `requirements.txt` / `Gemfile` / `pom.xml` parsing is first thing remediator does. Store result in agent context.

### 10. The `remediator` agent design

Slot after `oracle` (confirmation agent) in pipeline. Receives confirmed finding + reproducible chain.

**Inputs:**
- Finding (class, CWE, file, line, severity)
- Reproducible exploit chain (HAR + assertion)
- Repo handle (path, default branch, framework manifest)
- Policy (Tier rules)

**Tools available:**
- `read_file`, `grep`, `tree_sitter_query` — investigation
- `apply_patch` (Layer A/B) — modification
- `run_tests`, `boot_app`, `replay_chain`, `mutation_fuzz` — validation
- `git_branch`, `git_commit`, `gh_pr_create` — submission
- `escalate_to_human` — when policy blocks autonomy

**Cookbook prompt sketch:**

```
You are Vanguard's remediator. Your job: write minimal, idiomatic
patch that closes the confirmed vulnerability AND survives mutation
testing of the same class.

Inputs:
  Finding: {class, location, severity, CWE}
  Exploit chain: {HAR replay + assertion}
  Framework: {detected from manifest}
  Policy tier: {1|2|3}

Process (do not skip steps):
  1. Read vulnerable file and 2 levels of callers.
  2. Identify sink and taint source.
  3. Choose idiomatic framework-native fix (see playbook).
  4. Write smallest diff that fixes it. No drive-by refactors.
  5. Self-check against anti-pattern denylist for this class.
  6. Apply patch on fresh branch.
  7. Run tests. If failing, iterate up to 3 times, else escalate.
  8. Replay original exploit. Assert blocked.
  9. Run mutation fuzzer for this class. Assert all blocked.
  10. Run scoped Vanguard re-pentest on touched endpoints.
  11. If any step 7-10 fails, escalate with diagnostic report.
  12. If all pass and policy permits, open PR with evidence template.

Hard rules:
  - Never modify auth/authz/crypto code unless finding IS in that class.
  - Never delete public exports.
  - Diff size budget: 15 lines / 3 files. Exceed = escalate.
  - If confidence < 0.85, escalate even if all checks pass.

Output (always):
  - patch.diff
  - validation_report.json (test results, replay results, mutation results)
  - confidence: 0.0-1.0 with reasoning
  - PR url OR escalation reason
```

**Brain integration**: remediator is leaf agent; doesn't make routing decisions. Brain hands it (finding, chain) tuples in parallel — multiple findings remediated concurrently (different branches, different PRs). Brain aggregates: "8 findings, 5 auto-patched, 2 advisory, 1 escalated." Findings in same file batched into one PR to avoid merge conflicts.

**Telemetry from day 1:**
- Patch acceptance rate (merged without edits / opened)
- Time from finding to merged PR
- False-fix rate (patches reverted within 30 days, or new findings on same line)
- Escalation reasons (frequency table)
- Per-class success rate

**This data is the moat — every accepted patch is training signal for next iteration.**

---

## What to build first — 6-12 month roadmap

**Months 1-3 — v1 alpha:** SQLi + XSS only, Node/TS + Python only, **advisory mode** (PRs always draft, no auto-merge). Validation pipeline with replay + framework test suite. No mutation fuzzer yet.

**Months 4-6 — v1 beta:** Add path traversal. Add mutation fuzzer. Add Go. Tier 1 PRs go non-draft. Telemetry dashboard live.

**Months 7-9 — v1 GA:** Add SSRF (Tier 2, draft only). Add Java. Critic LLM gate. Policy-as-code config.

**Months 10-12 — v2 frontier:** IDOR/authz advisory mode (no patches, but rich repro + suggested authz check locations). Multi-finding PR batching. Per-customer fine-tune on accepted patches.

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| **Adversarial verification = the moat** | Replay IS the product; everyone else ships suggestions | Validation pipeline mandatory before PR |
| **Tier 1 (SQLi+XSS+path) autonomous** | Deterministic, near-zero false-fix | v1 alpha scope |
| **Tier 2 (SSRF+secrets) draft PR only** | Business-logic coupling needs review | Months 7-9 |
| **Tier 3 (IDOR/auth/session) advisory only** | Intent-laden — high false-fix risk | Never autopatch in v1/v2 |
| **Layer A (text edit) default + Layer B (tree-sitter) for ambiguous** | Claude Code style; AST when needed | v1 alpha |
| **Validation: replay + mutation + regression + scoped re-pentest** | Each catches different false-fix class | Mandatory pipeline |
| **Hard rules block autonomy**: auth/crypto code, large diffs, no test coverage, low confidence | Prevent worst-case regressions | Policy-as-code |
| **LLM critic as final gate** | Catches "fixes that look like fixes" | Constitutional-AI pattern |
| **Multi-finding PRs in same file batched** | Avoid merge conflicts | Brain orchestration |
| **Telemetry day-1**: acceptance rate, false-fix rate, escalation reasons | Becomes training signal | Ship with v1 |

**The shipping discipline that wins**: never let remediator submit PR not backed by successful adversarial replay. **The replay IS the product.**

---

## Open questions

1. **Mutation fuzzer corpus** — sqlmap-tamper-style mutations are mature; XSS/path-traversal mutation libraries less so. Build vs reuse?
2. **Confidence calibration** — self-reported confidence vs prior accept/reject data. How to bootstrap?
3. **Framework drift** — what if remediator's framework knowledge is stale (Express 4 vs 5)? Auto-detect version + use appropriate playbook
4. **Repo permissions** — Vanguard needs write access to fork or branch. Setup friction?
5. **Multi-finding PR conflict resolution** — what if two findings in same file conflict on diff?
6. **Customer test coverage gating** — many repos have <50% coverage. How aggressive to be?

---

## Sources

### Shipping tools
- [GitHub Copilot Autofix (GA April 2025)](https://github.com/features/security/code) — most mature
- [Snyk DeepCode AI Fix](https://snyk.io/platform/deepcode-ai/)
- CodeRabbit, Greptile — code review
- [Anthropic Claude Code](https://www.anthropic.com/claude-code) — closest general-purpose remediation primitive
- Synack Sara

### Academic
- [Google Big Sleep / Project Naptime](https://googleprojectzero.blogspot.com/2024/10/from-naptime-to-big-sleep.html) — fuzzer-as-oracle pattern
- Anthropic Constitutional AI (Bai et al. 2022)

### Tooling
- Tree-sitter — https://tree-sitter.github.io/tree-sitter/
- Language Server Protocol — https://microsoft.github.io/language-server-protocol/
- Conventional Commits — https://www.conventionalcommits.org/

### Cross-references
- Research #07 (competitive analysis) — remediation as future moat
- Research #16 (AI/ML application surface) — remediation for LLM-app-specific vulns
- Research #08 (adversarial output) — Critic LLM as final gate pattern

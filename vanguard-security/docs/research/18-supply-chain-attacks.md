# Research #18 — Supply Chain Attack Surface

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** Rewrite `supply-chain.txt` cookbook with 10 new sections; 9 new chain patterns; multi-tool SCA stack mandatory; **internal-package leakage detection = highest-priority heuristic** (best bounties, lowest FP)

---

## Executive summary

**454,648 malicious packages published to npm in 2025 alone** (Socket.dev). Real attacks include Shai-Hulud (self-propagating npm worm hit 25K malicious repos), Qix maintainer phish (compromised packages aggregating 2-3B weekly downloads), tj-actions/changed-files (CVE-2025-30066 hit 23K+ repos via maliciously-repointed Action tags), and xz-utils backdoor (multi-year insider attack, sshd pre-auth RCE).

**Key opinions:**
- **Multi-tool SCA mandatory** — only 60-65% finding overlap between scanners. Vanguard stack: Trivy + Grype + OSV-Scanner + Socket-CLI
- **Internal-package leakage detection = highest-priority heuristic** — pays best bounties, lowest FP rate
- **Public-registry mutations must be denied at the tool layer** (not just by prompt). Autonomous registration of typosquat/dep-confusion packages is operator-only
- **Maintainer-reputation scoring is the only structural defense against xz-class attacks** — SCA is useless there
- **Tag-pinned references** (Action `@v3`, image `:latest`) = same finding class. Both mutable. tj-actions and Shai-Hulud both exploited mutable refs

---

## Research questions

1. What package ecosystems matter for autonomous pentesting?
2. What attack patterns dominate per ecosystem?
3. What detection patterns should Vanguard use?
4. What's the best tooling matrix?
5. What 2023-2025 disclosures should we learn from?
6. How should `supply-chain.txt` rewrite?
7. What new chain patterns should we add?
8. What's the active vs passive boundary?

---

## Key findings

### 1. Supply chain ecosystem prioritization

**Tier 1 — must cover, every engagement**
- **npm** — 454,648 malicious packages in 2025. Worms (Shai-Hulud), phishing (Qix → 2-3B weekly downloads), Lazarus campaigns. Single-character typosquats, postinstall scripts, dependency confusion.
- **PyPI** — second-most exploited. `setup.py` arbitrary code, wheel backdoors, recurring SSH-key-exfil campaigns (TeamPCP/Telnyx, soopsocks, litellm 47K downloads in 46 minutes).
- **Container registries** — Docker Hub, GHCR, ECR, GAR, ACR, Quay. Mutable tags, image squatting, `.docker/config.json` leaks.
- **GitHub Actions / reusable workflows** — adjacent. tj-actions/changed-files (CVE-2025-30066) hit 23K+ repos.

**Tier 2 — cover when manifests indicate**
- Maven Central / Gradle (large enterprise, slow attacker tempo)
- Go modules (sumdb makes poisoning hard but typosquat works)
- Crates.io (relatively clean but rising)
- NuGet (dependency confusion against internal feeds)
- RubyGems (historical issues, now quieter)
- Helm/OCI charts (dependencies frequently pull mutable images)

**Tier 3 — high-value but specialized**
- VS Code Marketplace (detections quadrupled 2024→2025: 27→105)
- Chrome Web Store (extension-hijack via sale to adware)
- CocoaPods / SPM / Pub (niche; raise priority for mobile/Flutter)

### 2. Per-ecosystem attack catalog

#### npm (worst neighborhood)

| Pattern | Recent example | Detection |
|---|---|---|
| **Dependency confusion (Birsan)** | Black Basta ransom group ran org-targeted DC campaigns 2024-2025 | Sniff JS bundles, `.npmrc`, Dockerfiles, CI logs for `@org/*` names not on public npm |
| **Self-propagating worm** | Shai-Hulud waves 1-3 (Sep/Nov 2025 + Bitwarden CLI). Steals npm tokens → publishes to all maintainer's packages → injects GHA to harvest more | OpenSSF Scorecard maintainer-token freshness, recent-publish-spike detection |
| **Maintainer ATO** | Qix (Sep 2025) — phishing → malicious chalk/debug/ansi-styles releases (~2-3B weekly downloads aggregated) | Detect packages whose top maintainer has stale 2FA, recent ownership-change |
| **Typosquatting / brandjacking** | andrew_r1 ten-package campaign, Telegram-bot-lib clones with SSH-key injection | Levenshtein ≤ 2 against top-10K npm; brandjacking against tooling names |
| **Postinstall RCE** | #1 npm payload mechanism (Socket 2025 mid-year) | Static-grep `package.json` `scripts.{pre,post}install` for network calls, base64, eval |
| **Protestware / rage-quit** | colors/faker (2022), node-ipc (2022) | Single-maintainer + low bus-factor flag |
| **Leftpad re-registration** | Original 2016, still possible | Check published-then-unpublished history via npm API |

#### PyPI

- **`setup.py` install-time RCE** — still dominant despite wheels
- **Wheel backdoors** — pre-compiled `.whl` very hard to audit; flag if wheel exists but no source dist, or if maintainers swapped sdist → wheel-only recently
- **2FA mandate (2024)** — reduces drive-by takeovers but not session-token theft, OAuth-app abuse, social-engineered transfer
- **Recent campaigns**: termncolor (Jul 2025), sisaws/secmeasure (Aug 2025), soopsocks (Oct 2025, 2,653 dl), litellm (47K dl in 46 min, SSH key + env exfil), TeamPCP/Telnyx (~/.ssh/ + bash_history exfil)

#### Container registries

- **Mutable tags** — `latest`, `prod`, semver float (`:3`, `:3.11`) repointable. Treat any unpinned (no `@sha256:`) base image as finding
- **Image squatting** — `nginxx`, `pythonn`, namespace squatting on Docker Hub Library names
- **Layer poisoning** — rebuild image, swap single layer
- **Leaked registry creds** — `.docker/config.json` in repo, base64-encoded `auths`, GHA Secret echoed in workflow logs
- **Secrets baked in layers** — `.env`, `id_rsa`, AWS creds. Scan with `dive`, `syft`, then trufflehog over layers
- **Public images consumed without digest pinning** — `FROM node:20` rather than `FROM node:20@sha256:...`

#### CI/CD-adjacent (cross-ref Research #15)

- **GHA referenced by mutable tag** — `uses: foo/bar@v3` is a tag, not commit; tag can be moved (tj-actions did exactly this)
- **Self-hosted runner artifact poisoning** — runner re-used between jobs, attacker plants `node_modules` for next build
- **Cache poisoning** — npm cache, pip wheel cache, GHA cache
- **Reusable workflow / composite action injection** — same logic as tj-actions but at workflow YAML level

#### IDE & browser extensions

- **VS Code marketplace** — `prettier-vscode-plus` (Nov 21 2025), Bitcoin-Black/Codo-AI infostealers, ReversingLabs's 19-extension dependency-folder-malware campaign (Feb-Dec 2025). Microsoft removed 110 of 136 reviewed extensions
- **Chrome Web Store** — extension-hijack-by-acquisition; extensions with millions of users sold to adware vendors

#### xz-utils class — multi-year insider

CVE-2024-3094: Jia Tan persona contributed to xz for ~2 years, gained co-maintainer status, then injected obfuscated-test-file backdoor that hooked `RSA_public_decrypt` in liblzma → sshd pre-auth RCE for anyone with attacker's private key. Made it into Fedora 40 beta, Debian unstable, Kali, Arch before Andres Freund's accidental discovery via SSH login latency.

**This is the canonical "you cannot detect this with SCA" attack.** Vanguard's only defense is **maintainer-reputation scoring** — flag critical-path packages with recent maintainer additions, single-maintainer dependency, sudden activity bursts after long silence, release cadence changes.

### 3. Detection patterns (layered)

**Manifest discovery (always passive, always-on):**
- JS: `package.json`, `*.lock`, `.npmrc`, `bun.lockb`
- Python: `requirements*.txt`, `pyproject.toml`, `Pipfile*`, `poetry.lock`, `setup.py`, `*.whl`
- Java: `pom.xml`, `build.gradle*`, `gradle.lockfile`
- Go: `go.mod`, `go.sum`, `vendor/modules.txt`
- Rust: `Cargo.toml`, `Cargo.lock`
- .NET: `*.csproj`, `packages.config`, `nuget.config`
- Containers: `Dockerfile*`, `docker-compose*.yml`, `compose.yaml`
- Helm/k8s: `Chart.yaml`, `Chart.lock`, `values.yaml`, `kustomization.yaml`
- CI: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, `.circleci/config.yml`
- IDE: `.vscode/extensions.json`, `.devcontainer/`

**Signal extraction:**
- **Internal-package leakage** — grep client bundles, source-mapped JS, Docker images for `@company-internal-scope/*`, then HEAD public npm/PyPI for that name → DC candidate
- **Lock-file hash mismatch** — `package-lock.json` `integrity` field doesn't match upstream tarball SHA-512
- **Mutable container tags** — any `FROM` line without `@sha256:`
- **Mutable Action refs** — any `uses: x/y@v?` (tag, not 40-char SHA)
- **Lifecycle-script suspicion** — postinstall/preinstall containing `curl`, `wget`, `bash -c`, `node -e`, base64 blobs, `eval`, fetching from non-registry hosts
- **Maintainer reputation** — single maintainer, account < 90 days old, 2FA off (npm exposes), recent ownership transfer
- **Provenance** — npm provenance attestations almost never present
- **Cosign/Sigstore signature** — same idea for container images
- **Lock-file diff** — for monitored target, diff lockfile across recent commits, prioritize newly-added transitive deps

### 4. Tooling matrix

Multi-tool mandatory — only 60-65% finding overlap.

| Layer | Primary | Secondary | Why |
|---|---|---|---|
| All-in-one SCA | **Trivy** | Snyk CLI | 32K stars, scans containers + FS + IaC + secrets in one binary |
| CVE-focused with prio | **Grype** | — | EPSS + KEV composite scoring beats Trivy on triage |
| Ecosystem-accurate | **OSV-Scanner** | pip-audit, cargo-audit, npm-audit | OSV.dev primary source, fewer FPs than CPE matching |
| Malicious-package detection | **Socket CLI** | Phylum (commercial) | Scores install scripts, network calls, typosquat similarity. **Best public signal for novel malice** |
| Risk score | **OpenSSF Scorecard** | deps.dev | Maintainer practices, signed releases, branch protection |
| Secret scan | **trufflehog v3** | gitleaks, noseyparker | Trufflehog v3 verifies live credentials |
| SBOM | **syft** | trivy sbom | CycloneDX + SPDX |
| Container layer | **dive** + **syft** | trivy image | dive shows wasted/suspicious layers |
| Signature verify | **cosign** | sigstore-python | Verify image and npm provenance |

**Vanguard's recommended scan stack:**
```bash
trivy fs . && trivy image $img && grype $target && osv-scanner -r . && \
  syft $img -o cyclonedx-json && socket-cli scan
```
Run in parallel, dedupe by CVE/GHSA ID, prioritize by EPSS×KEV×reachability.

### 5. Real disclosure analysis

**xz-utils / CVE-2024-3094 (March 2024)**
- *Lesson*: SCA cannot catch insider backdoors. Defense is maintainer reputation + bus-factor + behavioral anomaly (release cadence shifts)
- *Action*: Add Scorecard pull for every direct dep > 1M downloads; flag maintainer-set deltas across last 12 months

**tj-actions/changed-files / CVE-2025-30066 (March 2025)**
- *Lesson*: Tag-pinned Action refs equivalent to mutable image tags. Attacker compromised maintainer PAT, retroactively repointed `v1`-`v45` tags to malicious commit, dumped CI memory containing GitHub PATs, AWS keys, npm tokens, RSA private keys to public Action logs. 23K+ repos. Started as Coinbase-targeted (Unit 42 attribution)
- *Action*: Flag every `uses:` ref that isn't 40-char SHA. Add chain pivoting Action-log access → secret extraction

**Shai-Hulud worm (Sep, Nov 2025, Bitwarden CLI Dec 2025)**
- *Lesson*: First true self-propagating npm worm. Steals npm tokens from compromised host → publishes to every package maintainer owns → injects GHA in those repos to harvest more tokens → exponential. Wave 2 hit ~25K malicious repos / 350 users
- *Action*: Add `~/.npmrc` token harvesting to chain catalog. Detect signs of recent worm victimization (workflow YAML diffs adding token-exfil steps)

**Qix maintainer phish (Sep 2025)**
- *Lesson*: Single phish on single prolific maintainer compromised chalk, debug, ansi-styles family — packages aggregating 2-3B weekly downloads. Attacker had hours
- *Action*: Direct + transitive bus-factor calculation; flag deps where one maintainer holds publish rights to packages summing > 100M weekly downloads

**3CX (March 2023)**
- *Lesson*: Compromised desktop app installer → trojanized via compromised dependency (`X_TRADER` from Trading Technologies, itself compromised earlier). Two-hop supply chain
- *Action*: Recursive vendor attestation

**MOVEit (May 2023)**
- *Lesson*: Not typical supply chain *publish* attack — CVE-2023-34362 SQLi in widely-deployed file-transfer software exploited by Cl0p. But *consumer* impact (MOVEit ran inside thousands of orgs as trusted ingest) is supply-chain shape
- *Action*: Maintain "trusted-internal-software" registry with stricter CVE SLA

**PyTorch nightly (Dec 2022)**
- *Lesson*: Classic dependency confusion — `torchtriton` was internal name; attacker registered on public PyPI, victim torch-nightly users pip-installed public preferentially
- *Action*: For every ML/AI target, sniff training pipelines and Dockerfiles for internal package names, then check public PyPI/npm

**Lazarus / DPRK npm campaigns (ongoing)**
- *Lesson*: Operation 99 (Jan 2025), Marstech Mayhem (Feb 2025), Sonatype's 234-package cluster. Targeting Web3/crypto devs via LinkedIn/Discord lures + malicious packages. ~36K victim exposure
- *Action*: Maintain low-quality-publisher blocklist (heuristics: account age, package name patterns, README templates)

### 6. Cookbook prompt design — `supply-chain.txt` rewrite

Current cookbook covers npm audit / pip-audit / govulncheck + dep confusion + typosquat. **Gaps to add:**

1. **Lifecycle-script forensics** — static-AST scan of `scripts.{pre,post}install`, `setup.py` top-level code, `build.rs`, NuGet `tools/install.ps1` for: network calls, eval/exec, base64 decode, unusual file writes outside build dir
2. **Maintainer reputation scoring** — pull OpenSSF Scorecard + npms.io / deps.dev / PyPI Warehouse APIs; rank by maintainer count, account age, 2FA status, recent ownership-change, release-cadence anomalies
3. **SBOM generation + delta** — `syft` an image and previous prod image; diff added/changed components; route deltas through Trivy+Grype+OSV
4. **Container image SCA** — `trivy image`, `grype $img`, `dive`, plus secret scan over each layer with trufflehog. Flag mutable tags, missing Cosign signatures, missing SLSA provenance
5. **Sigstore/Cosign verification** — for any pulled artifact, verify before trust
6. **Internal-package-name leakage** (HIGHEST PRIORITY) — concrete recipe: download client JS bundle / Docker image / unpacked desktop app → grep for `@company-scope/`, `internal-`, `corp-`, then `npm view <name>` to test if it exists publicly; if not, that's a DC candidate (flag, do NOT register without auth)
7. **Lock-file diff analysis** — over last N commits, list net-new direct + transitive deps; route through full SCA with double weight
8. **Action-ref pinning audit** — for every `.github/workflows/*.yml`, count `uses:` refs that aren't 40-char SHA; cross-reference each repo against GitHub Advisory DB
9. **Build-script poisoning detection** — `Makefile`, `build.gradle`, `webpack.config.js` `pre`/`post` hooks; npm/yarn `prepare` hook; analogous in cargo/go
10. **VS Code/IDE config** — flag `.vscode/extensions.json` recommendations and `.devcontainer/devcontainer.json` features for low-reputation publishers

### 7. New chain patterns

```yaml
- id: chain.dep-confusion-to-ci-rce
  steps: [internal-pkg-leak, public-registry-register, victim-build-pulls, ci-rce, secret-exfil]
  evidence: [bundle_grep_match, npm_view_404, has_ci_workflow]
  severity: critical
  bounty_band: 25k-50k

- id: chain.maintainer-token-to-mass-rce
  steps: [maintainer-cred-leak, npm-publish-as-maintainer, downstream-postinstall, victim-host-rce]
  evidence: [trufflehog_npm_token, owns_high-dl_pkg]
  severity: critical

- id: chain.shai-hulud-replay
  steps: [steal-npmrc-token, enumerate-owned-pkgs, publish-malicious-versions, inject-actions-yml, harvest-more-tokens]
  evidence: [npmrc_token_present, gh_pat_present]
  severity: critical

- id: chain.tj-actions-style
  steps: [maintainer-pat-compromise, retag-mutable-action, victim-runs-action, dump-runner-env, ingest-public-logs]
  evidence: [unpinned_action_ref, public_workflow_logs]
  severity: critical

- id: chain.container-creds-to-prod
  steps: [docker-config-json-leak, registry-push-access, push-poisoned-image-to-tag, k8s-deploy-pulls-latest, prod-rce]
  evidence: [docker_config_in_repo, mutable_tag_in_deployment]
  severity: critical

- id: chain.vscode-ext-to-source-repo
  steps: [low-rep-ext-recommended, dev-installs, ext-postactivate-rce, ext-reads-token-from-keychain, push-to-source-repo]
  evidence: [vscode_extensions_json_lists_low_rep, dev_machine_in_scope]
  severity: high

- id: chain.xz-style-insider
  steps: [recent-co-maintainer-add, release-cadence-spike, obfuscated-test-file, sshd-rce]
  evidence: [scorecard_maintainer_delta, binary_blob_in_tests_dir]
  severity: critical
  note: heuristic-only; never auto-claim, always human review

- id: chain.helm-oci-tag-poison
  steps: [helm-chart-pulls-mutable-image, attacker-pushes-to-tag, helm-upgrade-deploys, cluster-rce]
  evidence: [Chart_yaml_unpinned_image]

- id: chain.pypi-typosquat-credtheft
  steps: [typo-pkg-installed, setup-py-runs, ssh-key-bash-history-exfil, lateral-movement]
  evidence: [requirements_typo_match, levenshtein_le_2]
```

### 8. Active vs passive boundary

**Passive — always safe, run by default:**
- All SCA (Trivy, Grype, OSV, Snyk read-only)
- SBOM generation
- Manifest, lockfile, Dockerfile, workflow, `.npmrc` analysis on assets in scope
- Maintainer reputation scoring (Scorecard, deps.dev, npms.io)
- Secret scanning on in-scope repos and on artifacts target *publishes*
- **Internal-package leakage detection** (read-only — extract names, HEAD public registries, do NOT register)
- Container image pull + layer audit on images target hosts publicly

**Gated active — requires explicit `AUTH=ACTIVE` + bug-bounty scope check:**
- Mock dependency-confusion test using *private* registry or clearly-scoped honeypot package name (`@target-vanguard-poc-${random}`); never plausibly-owned by another org
- Submitting test packages to internal Artifactory/Nexus to validate routing
- Pulling and statically detonating suspicious packages in sandboxed VM (not shared dev box)
- Cosign signature challenges against target's published artifacts

**Never autonomous — operator-only with written approval:**
- **Registering typosquat or DC packages on public registries** (npm, PyPI). Affects entire ecosystem; research/disclosure activity, not pentest activity
- Phishing maintainers
- Account-takeover testing (credential stuffing, MFA bypass)
- Pushing to registry the target uses
- Tag-rewriting on shared GHA repos

**Default Vanguard posture: passive + gated-active-with-private-namespace only. Public-registry mutations FORBIDDEN at the tool layer** (allowlist `npm view`, `npm whoami`; deny `npm publish`, `npm unpublish`).

### 9. Decision tree for autonomous supply-chain testing

```
[1] Discover manifests across all in-scope repos / images / desktop bundles
[2] Parallel SCA (Trivy + Grype + OSV-Scanner + Snyk if licensed)
    -> dedupe by CVE/GHSA -> rank by EPSS x KEV x reachability
[3] Generate SBOM (syft) -> store baseline -> diff vs prior runs
[4] Heuristic layer (cheap, parallelizable)
    - Internal-package leakage scan (HIGH priority — pays best, low FP)
    - Mutable container tag detection
    - Mutable GHA ref detection
    - Lifecycle-script suspicion
    - Lock-file integrity check
[5] Maintainer reputation pass (OpenSSF Scorecard + deps.dev) on direct deps
    - Flag: single maintainer + > 1M weekly DL
    - Flag: maintainer set changed in last 90 days
    - Flag: release cadence anomaly
[6] Cross-correlate findings with chain-patterns.yaml
    -> build chain candidates with evidence requirements
[7] Verify chain evidence (still passive) — DOES NOT execute the chain
[8] Score and rank (bounty-band, confidence, blast radius)
[9] Gate
    - AUTH=PASSIVE -> emit findings + chains, stop
    - AUTH=ACTIVE_PRIVATE -> proceed with private-namespace tests
    - AUTH=ACTIVE_PUBLIC -> deny (operator-only)
[10] Report — per-finding + chain-level + executive summary
```

**Prioritization rule:** internal-package leakage > maintainer-cred leakage > unpinned Action refs > unpinned image tags > postinstall RCE > known CVEs. **Rationale**: novel-attack findings convert to bounties at highest dollar values; CVEs commoditized.

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| **Multi-tool SCA mandatory** | Only 60-65% overlap between scanners | Trivy + Grype + OSV-Scanner + Socket-CLI baseline |
| **Internal-package leakage = highest-priority heuristic** | Best bounties, lowest FP | First in `supply-chain.txt` Stage 4 |
| **Public-registry mutations denied at tool layer** | Affects entire ecosystem | Tool allowlist enforces |
| **Maintainer-reputation scoring** | Only structural defense vs xz-class | New OpenSSF Scorecard integration |
| **Tag-pinning audit (Action refs + image tags)** | Both mutable, both exploited | Same finding class |
| **9 new chain patterns** | Real disclosure-driven gaps | Append to chain-patterns.yaml |
| **3-tier auth gate (passive/active-private/active-public)** | Public mutations are operator-only | Authorization enforcement |
| **Heuristics over CVEs in priority** | Novel attacks pay better | Reorder cookbook |

---

## Open questions

1. **Sigstore adoption rate** — npm provenance attestations almost never present. When does it cross the threshold to flag absence as a finding?
2. **Maintainer-reputation false positive rate** — single-maintainer + high-DL is common (lodash had ~3 maintainers historically). How to avoid alert fatigue?
3. **Lock-file diff scope** — last N commits is reasonable, but what's N for a long-running project?
4. **VS Code marketplace API** — Microsoft removed 110/136 reviewed extensions but doesn't expose review data. Does Vanguard need to maintain its own extension reputation DB?
5. **Active testing legal** — even private-namespace DC tests touch external registries. Privacy/ToS implications?

---

## Sources

### Recent disclosures (2024-2025)
- [CISA — tj-actions/changed-files (CVE-2025-30066)](https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-tj-actionschanged-files-cve-2025-30066-and-reviewdogaction)
- [Wiz — tj-actions analysis](https://www.wiz.io/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066)
- [Unit 42 — tj-actions targeted Coinbase first](https://unit42.paloaltonetworks.com/github-actions-supply-chain-attack/)
- [Datadog Security Labs — XZ Utils backdoor (CVE-2024-3094)](https://securitylabs.datadoghq.com/articles/xz-backdoor-cve-2024-3094/)
- [JFrog — XZ analysis](https://jfrog.com/blog/xz-backdoor-attack-cve-2024-3094-all-you-need-to-know/)
- [thesamesam xz-utils gist (canonical timeline)](https://gist.github.com/thesamesam/223949d5a074ebc3dce9ee78baad9e27)
- [Unit 42 — Shai-Hulud npm worm](https://unit42.paloaltonetworks.com/npm-supply-chain-attack/)
- [Sysdig — Shai-Hulud self-replicating worm](https://www.sysdig.com/blog/shai-hulud-the-novel-self-replicating-worm-infecting-hundreds-of-npm-packages)
- [Datadog — Shai-Hulud 2.0](https://securitylabs.datadoghq.com/articles/shai-hulud-2.0-npm-worm/)
- [OX Security — Shai-Hulud Bitwarden wave](https://www.ox.security/blog/shai-hulud-bitwarden-cli-supply-chain-attack/)
- [Socket — Qix maintainer phishing](https://socket.dev/blog/npm-author-qix-compromised-in-major-supply-chain-attack)

### Reports & timelines
- [Socket — 2025 mid-year malicious-package report](https://socket.dev/blog/malicious-open-source-packages-2025-mid-year-threat-report)
- [Sonatype — software supply chain attack timeline](https://www.sonatype.com/resources/vulnerability-timeline)
- [CSO Online — industrialization of npm supply-chain attacks](https://www.csoonline.com/article/4117139/from-typos-to-takeovers-inside-the-industrialization-of-npm-supply-chain-attacks.html)
- [Silobreaker — 2025 supply chain month-by-month](https://www.silobreaker.com/blog/cyber-threats/supply-chain-attacks-in-2025-a-month-by-month-summary/)

### Tooling research
- [AppSecSanta — best open-source SCA tools 2026](https://appsecsanta.com/sca-tools/open-source-sca-tools)
- [Stakater — Trivy vs Clair vs Grype deep dive](https://www.stakater.com/post/open-source-container-security-a-deep-dive-into-trivy-clair-and-grype)
- [arXiv — VEX/SCA tool consistency evaluation](https://arxiv.org/html/2503.14388v1)

### IDE / browser
- [BleepingComputer — malicious VS Code extensions](https://www.bleepingcomputer.com/news/security/malicious-vscode-extensions-on-microsofts-registry-drop-infostealers/)
- [Wiz — VS Code extension marketplace risk](https://www.wiz.io/blog/supply-chain-risk-in-vscode-extension-marketplaces)
- [ReversingLabs — VS Code fake-image extension cluster](https://www.reversinglabs.com/blog/malicious-vs-code-fake-image)

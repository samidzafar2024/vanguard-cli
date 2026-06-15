# Research #15 — Cloud-Native Attack Surface

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** Restructure cloud-vuln cookbook into per-cloud specialists; new `cicd-vuln`, `iac-vuln`, `k8s-vuln` agents; `cloud-pivot` chain materialization agent; 9 new chain patterns

---

## Executive summary

Vanguard's GTM has two pillars (AI startups + enterprise SaaS) and the cloud surface diverges sharply. **AWS + Kubernetes + Vercel/Cloudflare + GitHub Actions + Terraform together cover ~85% of testable surface for Vanguard's target market.** GCP and Azure matter for enterprise but ship as v2.

**The single highest-leverage new agent is `cicd-vuln`** — GitHub Actions injection, self-hosted runner takeover, OIDC trust policy misconfig. Real bounties $20K-$50K consistently, almost no incumbent tool covers it well.

**Critical structural change:** `cloud-vuln.txt` (190 lines, tries to do AWS/GCP/Azure/IaC/creds in one prompt) should split into per-cloud specialists. Each ~120-150 lines, deeply opinionated. **Detection-based branching inside a single mega-prompt creates a model mediocre at all three.**

**`cloud-pivot` is a new dedicated agent** — runs after surface scans. Its only job: chain materialization (taking individual findings and walking patterns to produce realized exploitation paths with evidence). Separates "can we find issue X" from "can we prove issue X chains to admin" — what bug bounty triagers actually pay for.

---

## Research questions

1. What cloud-native infrastructure do modern apps actually use?
2. What are the highest-EV attack patterns per cloud surface (AWS/GCP/Azure/K8s/Serverless/IaC/CI/CD)?
3. What's the tooling matrix in 2025?
4. What new chain patterns should we add?
5. How should the cookbook prompts restructure?
6. How should Vanguard integrate with CSPM tools (Wiz, Orca, Lacework)?
7. What ethical guardrails for post-exploitation?

---

## Key findings

### 1. Cloud-native landscape map

**AI startup stack (Vanguard's primary GTM):**
- **Compute**: AWS Lambda + API Gateway, ECS Fargate, single-region EKS. GCP Cloud Run #2. Modal/Replicate/Banana/RunPod for GPU inference.
- **Data**: S3, DynamoDB / Aurora Serverless, Postgres on Neon/Supabase/RDS, vector DBs (Pinecone, Weaviate, pgvector, Qdrant)
- **Edge**: Vercel, Cloudflare Workers + R2, Netlify
- **Auth**: Cognito, Auth0, Clerk, WorkOS, Supabase Auth, Firebase Auth
- **CI/CD**: GitHub Actions (~90%), occasionally CircleCI
- **IaC**: Terraform (most), AWS CDK (TypeScript shops), Pulumi (minority), SST for serverless TS
- **Observability**: Datadog, Sentry, Honeycomb, BetterStack — these often hold cloud creds and are themselves a pivot target

**Enterprise SaaS stack (Stripe/Notion/Datadog tier):**
- Multi-region/account AWS Organizations or multi-cloud, self-managed K8s, Azure when Entra federation needed
- Service mesh (Istio/Linkerd/AWS App Mesh)
- Internal developer platform (Backstage, Port), policy-as-code (OPA, Kyverno, Sentinel)
- Secrets in HashiCorp Vault, AWS Secrets Manager, Doppler
- CI/CD: GitHub Actions Enterprise, GitLab CI, Buildkite, Jenkins (legacy)

### 2. Per-cloud attack catalog

#### AWS (deepest surface)

Three name-checks anchor the literature:
- **Rhino Security Labs** — canonical IAM Privilege Escalation list (21 documented chains)
- **Christophe Tafani-Dereeper (Datadog Security Labs)** — STS/IAM, CloudTrail evasion, stratus-red-team
- **Daniel Grzelak (plerion)** + **Houston Hopkins** — STS abuse, account ID enumeration via S3, "shadow admin"

**High-value attack patterns:**

- **IMDS abuse** — IMDSv1 still on by default for legacy AMIs/ECS. IMDSv2 with `HopLimit: 2` exploitable from container. ECS task metadata (`169.254.170.2/v2/credentials/`) leaks task role. Lambda has `AWS_LAMBDA_RUNTIME_API` — env-var creds + runtime API give parity with IMDS.
- **IAM privesc chains** — Encode 12+ explicitly: `iam:CreatePolicyVersion`, `iam:AttachUserPolicy`, `iam:PutUserPolicy`, `iam:UpdateAssumeRolePolicy`, `iam:PassRole + ec2:RunInstances`, `iam:PassRole + lambda:CreateFunction + InvokeFunction`, `iam:PassRole + glue:CreateDevEndpoint`, `iam:PassRole + cloudformation:CreateStack`, `sts:AssumeRole` over weak trust, `codestar:*`, `iam:CreateLoginProfile` on existing user.
- **S3** — Public ACL/policy, signed-URL TTL abuse, bucket-name enum via `aws s3 ls --no-sign-request s3://<guess>`, dangling CNAME takeover, S3 Object Lambda misconfig, presigned URL injection.
- **Cognito** — Identity Pool with unauthenticated role + "guest access" enabled (Grzelak finding) — fetch unauth creds and pivot. User Pool federation misconfig allowing arbitrary IdP.
- **Lambda** — Public Function URLs (`https://<id>.lambda-url.<region>.on.aws/`), env-var leakage via reflective bug, layer poisoning when internal layer ARN used by name across accounts.
- **Cross-account assume-role** — Trust policies with `"Principal": "*"` or weak external ID. Confused-deputy.
- **SSM / Secrets Manager exfil** — `ssm:GetParameter*` with wildcards, `secretsmanager:GetSecretValue` against `*`.
- **EC2 → IAM → instance compromise** — SSRF → IMDSv2 token → instance role → `ssm:SendCommand` → RCE on adjacent boxes.
- **Organizations / SCP bypass** — `iam:PassRole` on role outside SCP-restricted region/service set.
- **CloudTrail evasion** — Operate in regions not enabled for org-trail, unsupported services (some AppSync, Data Pipeline historically not logged), data events default-off for S3/Lambda.

#### GCP

- **Service account key leak** — JSON keys in repos and CI logs constantly. `gcloud auth activate-service-account` and pivot.
- **Metadata server** — `metadata.google.internal` requires `Metadata-Flavor: Google` — many SSRF filters miss this.
- **IAM** — `iam.serviceAccountTokenCreator`, `iam.serviceAccountUser`, `iam.serviceAccountKeyAdmin` are primary privesc primitives.
- **GKE** — Workload Identity binding misconfig allowing default SA to impersonate Google SA.
- **Cloud Functions / Cloud Run** — Public invoker (`allUsers` with `roles/run.invoker`). Cloud Build trigger with public source repo allowing arbitrary build-time RCE on Cloud Build SA (overprivileged by default).
- **Firestore/Firebase** — Open security rules (`allow read, write: if true`), Firebase config leaked to clients with admin-level rules.

#### Azure / Entra

- **Entra abuse** — Device code phishing, illicit consent grants, refresh token replay, primary refresh token (PRT) extraction
- **Managed identity abuse** — `IDENTITY_ENDPOINT` + `IDENTITY_HEADER` from App Service / Functions / VM. Same SSRF-to-creds pattern as IMDS.
- **Storage account** — SAS tokens overscoped, account keys in app settings, public blob containers.
- **AKS** — Default node pool with managed identity attached, kubelet identity = node identity = subscription read.
- **Conditional Access bypasses** — legacy auth endpoints, break-glass account compromise.

#### Kubernetes (deserves own agent)

- **Service Account token abuse** — Default-mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`. Many clusters still grant `default` SA `cluster-admin` "to ship faster." Run `kubectl auth can-i --list` from inside pod.
- **Pod-to-host escapes** — `privileged: true`, `hostPID: true` (then `nsenter`), `hostNetwork`, `hostPath: /` mounts, `/var/run/docker.sock`, `CAP_SYS_ADMIN`/`CAP_SYS_PTRACE`.
- **Container runtime CVEs** — runC CVE-2019-5736 (still found), CVE-2024-21626 (runC `WORKDIR`), containerd CVEs.
- **API server exposure** — `kubectl --insecure-skip-tls-verify` against `https://<node>:6443`. `system:anonymous` mapped to permissive role on misconfigured clusters.
- **Kubelet `:10250`** — Read-only `:10255` (deprecated). `kubelet exec`, `kubelet logs`, `kubelet run` if anonymous auth enabled.
- **etcd `:2379`** — Unauthenticated etcd = full cluster read including all secrets, base64 only.
- **CRD-based privesc** — `serviceaccounts/token` create, `pods/exec` create, validating/mutating webhook config write (define webhook seeing every request including secrets), `clusterroles/clusterrolebindings` write, `nodes/proxy`.
- **Service mesh** — Istio mTLS in `PERMISSIVE` mode, sidecar bypass via `iptables` from privileged pod.

#### Serverless

- **Lambda Function URLs** public by default — discover via `*.lambda-url.<region>.on.aws/`
- **Cold-start race conditions** for shared module-level state
- **API Gateway authorizer bypass** — Lambda authorizer returning static `Allow` policy with `*` resource
- **AppSync direct resolvers** — VTL templates with `$context.identity` not validated
- **Layer poisoning** — Pin layer ARNs by version not name
- **SAM/Serverless framework deploy artifact in public S3** — extract entire Lambda zip + env

#### IaC

- **Terraform state file (`terraform.tfstate`)** — Plaintext secrets, every resource attribute. Common locations: misconfigured S3 backend, GitHub repo (#1 leak), CI artifact, dev's home dir via path traversal. **Daniel Grzelak's 2019 work foundational.**
- **Terraform Cloud / Spacelift / env0** — Workspace permissions overly broad, run-task webhook hijack, VCS PAT scoped to org.
- **CDK** — Default constructs often overly permissive. `Bucket()` without `blockPublicAccess: BLOCK_ALL`, `Function()` with auto-generated role gaining `*` to CloudWatch Logs.
- **Pulumi** — Stack state in cloud or self-hosted. Plaintext config files (`Pulumi.<stack>.yaml`) sometimes commit secrets when devs forget `--secret`.

#### CI/CD (Vanguard's highest-leverage NEW agent)

- **`pull_request_target` injection** — Running on base repo with secrets and merging PR head. Branch name / PR title / commit message injection into shell steps.
- **Self-hosted runner takeover** — Persistent (vs ephemeral GitHub-hosted) and often shared across orgs. PR from fork can run on them if `pull_request` is trigger.
- **Workflow injection via untrusted input** — `${{ github.event.issue.title }}`, `${{ github.head_ref }}`, `${{ github.event.pull_request.body }}` in `run:` blocks → command injection.
- **GITHUB_TOKEN abuse** — Default permissions read-only org-wide in newer orgs, but legacy repos still default write. Cross-repo write via reusable workflows.
- **OIDC trust policy misconfig** — AWS role trusting `token.actions.githubusercontent.com` with wildcard `sub`, allowing fork PRs to assume role. The `sub` should pin `repo:org/repo:ref:refs/heads/main` exactly.
- **Reusable workflow injection** — `uses: org/.github/workflows/foo.yml@main` — if `main` not protected, an org member with push to that file owns every dependent workflow.
- **Artifact poisoning** — Job A uploads, Job B (privileged) downloads and executes. PR can poison Job A.
- **Dependency confusion in CI** — npm/pip/gem/gradle/maven all have known patterns.
- **Cache poisoning** — GitHub Actions cache scoped per-branch but cross-branch reads possible.

### 3. Tooling matrix

| Surface | Recon / Map | Misconfig / Static | Active Exploit | Output / Graph |
|---|---|---|---|---|
| AWS | cloudfox, ScoutSuite, Prowler | cloudsplaining, Prowler, Steampipe | **Pacu**, stratus-red-team, awspx | Cartography, PMapper |
| GCP | gcphound, ScoutSuite | gcp-iam-collector | stratus-red-team (GCP) | Cartography |
| Azure / Entra | AzureHound, ROADrecon, Stormspotter | MicroBurst | PowerZure, AADInternals, TokenTactics | BloodHound (Entra) |
| K8s | kube-hunter, krane | kube-bench, Trivy K8s, kubescape | **peirates**, botb, kdigger | Cartography K8s |
| IaC | terrascan map | trivy config, **checkov**, kics, tfsec, cloudsplaining | n/a | terraform-graph |
| CI/CD | **gato**, octoscan | **zizmor**, actionlint, StepSecurity Harden-Runner | gato-x exploit | n/a |
| Containers | dive, syft | **trivy** image, grype, snyk container | n/a | SBOM via syft → grype |
| Secrets | **trufflehog v3**, gitleaks, noseyparker | semgrep secrets pack | n/a | aggregator into graph |

**The 7 baseline tools for Vanguard:** `cloudfox`, `Prowler`, `Trivy`, `kube-hunter`/`kube-bench`, `gato`, `checkov`, `trufflehog`/`gitleaks` — cover ~80% of findings, stable JSON output. Pacu and peirates second-tier (active exploit, requires authorization gate).

### 4. Cookbook restructure recommendation

**Current state:** `cloud-vuln.txt` is 190 lines doing AWS+GCP+Azure+IaC+creds+metadata in one prompt. Context-budget anti-pattern. Detection-based branching inside mega-prompt creates a model mediocre at all three.

**Proposed structure:**

```
apps/worker/prompts/
  cloud/
    _shared-cloud-prelude.txt      # detection logic, output schema
    cloud-vuln-aws.txt              # AWS-specific catalog + tooling
    cloud-vuln-gcp.txt              # GCP-specific
    cloud-vuln-azure.txt            # Azure-specific
    cloud-pivot.txt                 # NEW — chain materialization
  k8s/
    k8s-vuln-passive.txt            # manifest + helm static
    k8s-vuln-active.txt             # kube-hunter, peirates (auth-gated)
  iac/
    iac-vuln.txt                    # tfstate, checkov, kics, cloudsplaining
  cicd/
    cicd-vuln-github.txt            # gato, octoscan, zizmor
    cicd-vuln-gitlab.txt            # GitLab CI specific
  container/
    container-vuln.txt              # KEEP — focused on image+Dockerfile only
```

A thin `cloud-router` step (existing `cloud-vuln` becomes this) does provider detection then dispatches.

### 5. New chain patterns (9 cloud-specific)

- `imds_v2_hop_limit_to_iam` — Container with hop-limit ≥2 → IAM role creds
- `iam_privesc_chain` — IAM creds → 21-path Rhino privesc → admin
- `k8s_pod_rce_to_cluster_admin` — Pod RCE → SA token → kube-apiserver → cluster admin
- `k8s_anon_apiserver_or_kubelet` — Exposed kube-apiserver/kubelet/etcd → cluster takeover
- `gha_oidc_to_cloud_role` — GitHub Actions injection → OIDC → AWS role assumption
- `tfstate_in_public_bucket` — Terraform state in public bucket/repo → secrets → cloud takeover
- `ci_artifact_poison_to_prod_rce` — CI artifact poisoning → registry push → prod deploy → RCE
- `lambda_env_to_role_pivot` — Lambda env injection / log leak → execution role → cross-service
- `cognito_unauth_pool_to_data` — Cognito Identity Pool unauth role → S3/DDB/cross-tenant
- `dangling_dns_to_cloud_takeover` — Dangling CNAME on cloud resource → resource claim → takeover

### 6. Decision tree for autonomous cloud testing

```
After recon:
  detect_provider := (cert SANs, ASN owner, DNS NS, server header, repo IaC files)

  If provider == AWS or repo has terraform/cdk with aws provider:
    run cloud-vuln-aws cookbook
    if ECS/EKS detected: run k8s-vuln (passive — manifest scan only)
    if Lambda detected: run serverless-vuln
  If provider == GCP or repo has gcp provider: run cloud-vuln-gcp
  If provider == Azure or repo has azurerm provider: run cloud-vuln-azure

  Always (repo-driven):
    if find . -name "*.tf" | head -1: run iac-vuln
    if find .github/workflows -name "*.yml": run cicd-vuln (gato + zizmor)
    if find . -name "Dockerfile": run container-vuln (Trivy image+config)
    if find . -name "Chart.yaml" -o -path "*/k8s/*.yaml": run k8s-vuln (manifest)

  If active K8s endpoint reachable (port 6443/10250/2379 from external):
    run k8s-vuln-active (kube-hunter)
    require explicit authorization flag

  Post all surface scans:
    run cloud-pivot — feeds findings into chain-hunter, materializes chains
```

### 7. Post-exploitation patterns with guardrails

**Strict enumerate-validate-document-stop loop.** No persistence, no exfil beyond proof, no lateral movement outside scope.

**AWS foothold (IAM creds):**
1. `aws sts get-caller-identity` — establish identity, region, account
2. `cloudfox aws all-checks` — automated breadth
3. `cloudsplaining` against effective policy — find privesc primitive
4. Validate ONE privesc path with `--simulate-principal-policy` — do NOT actually escalate without `--engagement-mode=active`
5. Document data accessible — sample object names/sizes only, cap at 100 keys per bucket and 1KB per object as proof
6. Stop

**Guardrails as code:**
- `--engagement-mode` flag: `passive | validated | active`. Default = `validated` (enumerate, single-step prove, no destructive ops)
- Blocklist of API calls always denied unless `active`: `iam:CreateAccessKey`, `iam:PutUserPolicy`, `iam:AttachUserPolicy`, `iam:UpdateAssumeRolePolicy`, `iam:CreateLoginProfile`, `lambda:CreateFunction`, `ec2:RunInstances`, `cloudformation:CreateStack`, `kms:ScheduleKeyDeletion`, anything `Delete*`/`Terminate*`
- Mandatory dry-run for IAM mutations
- Per-engagement scope file pinning account IDs / project IDs / subscription IDs

### 8. CSPM integration thoughts

**Positioning:** CSPM finds, Vanguard proves. Wiz lists "S3 bucket public" as P3. Vanguard takes that finding and demonstrates `curl https://bucket.s3.amazonaws.com/customers.csv → 200 OK`. Customer ticket goes from "Wiz P3" to "Vanguard validated critical with exfil PoC."

**Concrete integrations:**
1. **`cspm-import` step** reading Wiz/Orca/Lacework JSON. Vanguard prioritizes resources flagged by CSPM, skips re-discovery. Sales wedge: "we plug into your existing Wiz."
2. **Validate by exploiting** — for each CSPM finding above threshold, trigger matching cookbook. Outputs "validated: yes/no" overlay.
3. **OCSF/SARIF output** — Wiz, Datadog, Splunk all consume. Security team sees Vanguard validations alongside CSPM findings.
4. **Don't re-implement CSPM.** Don't ship 500 misconfig checks. Ship 50 highest-impact + chain materialization. CSPM owns breadth; Vanguard's wedge is depth + proof.

---

## Implementation decisions

| Decision | Rationale | Action |
|---|---|---|
| Split `cloud-vuln.txt` into per-cloud specialists | 190-line monolith hurts model focus | New `cloud/` directory structure |
| Build `cicd-vuln` as highest-leverage new agent | $20K-$50K bounty class, low industry coverage | New cookbook agent |
| New `cloud-pivot` chain materialization agent | Separates "find" from "prove chain" | New agent runs after cloud surface scans |
| Branching dispatch in workflow | Provider-aware execution | Update `temporal/workflows.ts` or SKILL.md |
| 9 new cloud chain patterns | Massive gap in current 20 | Append to `chain-patterns.yaml` |
| `--engagement-mode` flag (passive/validated/active) | Production safety | Activity-level enforcement |
| Always-denied IAM mutation blocklist | Catastrophic prevention | Hard-coded refusal list |
| 7 baseline tools (cloudfox, Prowler, Trivy, kube-hunter, gato, checkov, trufflehog) | 80% of findings | Bundle in install |
| OCSF/SARIF output format | CSPM ingestion | Output transformer |
| `cspm-import` step | Sales wedge + reduces re-discovery | New optional step |

**Shipping order (opinionated):**
1. `cicd-vuln` (GitHub Actions) — highest leverage
2. `cloud-vuln-aws` split + `cloud-pivot`
3. `k8s-vuln-passive` (manifest scanner separated from container-vuln)
4. `iac-vuln` (Terraform state hunting + checkov/tfsec)
5. GCP and Azure specialists
6. Active K8s testing (kube-hunter/peirates) — gated behind `--engagement-mode=active`

---

## Open questions

1. **Active K8s testing** — can Vanguard responsibly auto-enable `kube-hunter` against external endpoints? Or always require operator approval?
2. **Pacu integration** — its session model is interactive. Headless mode mature enough?
3. **CSPM exporters** — which to support first (Wiz vs Orca vs Lacework)? Wiz has broadest market.
4. **OCSF maturity** — schema still evolving. Start with SARIF for stability?
5. **stratus-red-team** — should Vanguard also adopt it as a *defensive* tool (test customer's detection coverage)?

---

## Sources

### AWS
- [Rhino Security Labs — AWS IAM Privilege Escalation](https://github.com/RhinoSecurityLabs/AWS-IAM-Privilege-Escalation)
- [Pacu](https://github.com/RhinoSecurityLabs/pacu)
- [CloudGoat](https://github.com/RhinoSecurityLabs/cloudgoat)
- [Stratus Red Team (Datadog)](https://github.com/DataDog/stratus-red-team)
- [Datadog Security Labs blog (Tafani-Dereeper)](https://securitylabs.datadoghq.com/)
- [Plerion (Daniel Grzelak)](https://plerion.com/blog)
- [Hacking The Cloud](https://hackingthe.cloud/)
- [Cloudfox (Bishop Fox)](https://github.com/BishopFox/cloudfox)
- [Prowler](https://github.com/prowler-cloud/prowler)
- [ScoutSuite (NCC)](https://github.com/nccgroup/ScoutSuite)
- [Cloudsplaining (Salesforce)](https://github.com/salesforce/cloudsplaining)
- [PMapper / Principal Mapper](https://github.com/nccgroup/PMapper)
- [Cartography](https://github.com/cartography-cncf/cartography)

### Kubernetes
- [kube-hunter](https://github.com/aquasecurity/kube-hunter)
- [kube-bench](https://github.com/aquasecurity/kube-bench)
- [peirates](https://github.com/inguardians/peirates)
- [botb](https://github.com/brompwnie/botb)
- [Trivy](https://github.com/aquasecurity/trivy)

### IaC
- [Checkov](https://github.com/bridgecrewio/checkov)
- [KICS](https://github.com/Checkmarx/kics)
- [tfsec](https://github.com/aquasecurity/tfsec) (now part of Trivy)

### CI/CD
- [gato / gato-x (Praetorian)](https://github.com/praetorian-inc/gato-x)
- [octoscan (CyberCX)](https://github.com/synacktiv/octoscan)
- [zizmor (Trail of Bits)](https://github.com/woodruffw/zizmor)
- [Adnan Khan — GitHub Actions security research](https://adnanthekhan.com/)
- [Trail of Bits — GitHub Actions assessment tools](https://blog.trailofbits.com/)

### GCP / Azure
- [gcphound](https://github.com/google/gcphound)
- [GCPBucketBrute](https://github.com/RhinoSecurityLabs/GCPBucketBrute)
- [AzureHound / BloodHound](https://github.com/BloodHoundAD/AzureHound)
- [ROADtools (Dirk-jan Mollema)](https://github.com/dirkjanm/ROADtools)
- [AADInternals](https://aadinternals.com/aadinternals/)
- [PowerZure](https://github.com/hausec/PowerZure)

### Secrets
- [trufflehog v3](https://github.com/trufflesecurity/trufflehog)
- [gitleaks](https://github.com/gitleaks/gitleaks)
- [noseyparker](https://github.com/praetorian-inc/noseyparker)

### Frameworks
- [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/)
- [SLSA](https://slsa.dev/)
- [OCSF](https://schema.ocsf.io/)
- [Capital One breach (SSRF + IMDSv1)](https://krebsonsecurity.com/2019/07/capital-one-data-theft-impacts-106m-people/)

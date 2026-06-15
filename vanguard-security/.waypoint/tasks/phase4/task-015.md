# Task 015: Per-Cloud Agents (AWS / GCP / Azure)

**Phase**: Phase 4
**Wave**: Wave 2 — runs after credential feedback loop (credential from cred-intel/github-leaks available)
**Depends on**: Phase 3 complete, task-013 (credential feedback loop)
**Labels**: phase4, agent, cloud

## Why This Matters

The existing `cloud-vuln` agent is a generalist — it covers basic S3 bucket checks
and obvious misconfigs. Real cloud environments have complex IAM graphs, Lambda
function URLs, IMDS exploitation chains, and cross-account trust issues that require
provider-specific knowledge.

A dedicated `aws-vuln` agent knows about IAM privilege escalation paths that don't
exist in GCP. A dedicated `gcp-vuln` agent knows about Workload Identity Federation
bypass. Splitting by provider gives 3× more depth per cloud.

**This also enables the SSRF → IMDS chain:**
- `ssrf-vuln` finds SSRF endpoint → writes to CredentialStore
- `aws-vuln` uses SSRF vector to reach 169.254.169.254 → steals IAM credentials
- Chain Hunter connects: SSRF → IMDS → AWS key → S3 access

## What to Build

### Agent 1: `aws-vuln`

**Agent definition**:
```typescript
'aws-vuln': {
  prerequisites: ['profiling'],
  promptTemplate: 'aws-vuln',
  deliverableFilename: 'aws_vuln_deliverable.md',
  modelTier: 'large',
  required_mode: 'validated',
},
```

**Prompt file**: `apps/worker/prompts/aws-vuln.txt`

With credentials (from CredentialStore via brain_hints):
```
1. aws sts get-caller-identity (validate key is live)
2. aws iam list-attached-user-policies --user-name <caller>
3. aws iam list-user-policies --user-name <caller>
4. aws sts get-caller-identity → check if role has PowerUser/Admin
5. Privilege escalation checks (20+ techniques):
   - iam:CreatePolicyVersion → overwrite policy with Admin
   - iam:PassRole + ec2:RunInstances → launch EC2 as privileged role
   - iam:CreateAccessKey → create new root-equivalent key
   - lambda:CreateFunction + iam:PassRole → run as privileged lambda
6. aws s3 ls → enumerate all buckets
7. For each bucket: check ACL, website-hosting, public-access-block
8. aws secretsmanager list-secrets → check read access
9. aws ssm get-parameters-by-path --path / --recursive → parameter store
```

Without credentials:
```
1. Check for public S3 buckets via naming patterns:
   <company>-prod, <company>-backup, <company>-assets, <company>-data
2. Check EC2 IMDS via any SSRF found by ssrf-vuln:
   GET http://169.254.169.254/latest/meta-data/iam/security-credentials/
3. Check unauthenticated Lambda function URLs:
   Scan /api/* for Lambda response signatures (x-amzn-requestid header)
4. Check CloudFront distribution misconfigs (public origin access)
```

---

### Agent 2: `gcp-vuln`

**Agent definition**:
```typescript
'gcp-vuln': {
  prerequisites: ['profiling'],
  promptTemplate: 'gcp-vuln',
  deliverableFilename: 'gcp_vuln_deliverable.md',
  modelTier: 'large',
  required_mode: 'validated',
},
```

**Prompt file**: `apps/worker/prompts/gcp-vuln.txt`

With credentials:
```
1. gcloud auth activate-service-account (validate key)
2. gcloud projects get-iam-policy → enumerate permissions
3. gsutil ls → find accessible buckets
4. gcloud functions list → find HTTP trigger functions
5. gcloud run services list → find public Cloud Run endpoints
6. Check for Workload Identity Federation misconfiguration
7. GKE cluster: kubectl get pods --all-namespaces (if kubeconfig available)
```

Without credentials:
```
1. Check GCS bucket naming: <company>-prod, storage.<company>.com
2. Metadata server via SSRF: http://metadata.google.internal/computeMetadata/v1/
3. Check Cloud Functions with unauthenticated invocation
```

---

### Agent 3: `azure-vuln`

**Agent definition**:
```typescript
'azure-vuln': {
  prerequisites: ['profiling'],
  promptTemplate: 'azure-vuln',
  deliverableFilename: 'azure_vuln_deliverable.md',
  modelTier: 'large',
  required_mode: 'validated',
},
```

**Prompt file**: `apps/worker/prompts/azure-vuln.txt`

With credentials:
```
1. az login --service-principal (validate)
2. az role assignment list --all → find overprivileged assignments
3. az storage account list → enumerate storage accounts
4. For each account: check blob public access, SAS token expiry
5. az keyvault list → check Key Vault access policies
6. az functionapp list → find function apps with anonymous auth
7. Azure AD: check app registrations for client secret exposure
8. Managed Identity: check if IMDS accessible via SSRF
```

Without credentials:
```
1. Azure Blob Storage: check <company>.blob.core.windows.net
2. Azure IMDS via SSRF: http://169.254.169.254/metadata/instance?api-version=2021-02-01
3. Azure Function URLs: check <appname>.azurewebsites.net/api/*
```

---

### Conditional Execution

Route by detected cloud provider:
```typescript
// apps/worker/src/temporal/workflows.ts
const targetProfile = await loadDeliverable('profiling_deliverable.md');

const cloudAgents: Promise<void>[] = [];

if (targetProfile.tech_stack.includes('aws')) {
  cloudAgents.push(runSequentialPhase('aws-vuln', ...));
}
if (targetProfile.tech_stack.includes('gcp')) {
  cloudAgents.push(runSequentialPhase('gcp-vuln', ...));
}
if (targetProfile.tech_stack.includes('azure')) {
  cloudAgents.push(runSequentialPhase('azure-vuln', ...));
}
if (cloudAgents.length === 0) {
  // Fall back to generic cloud-vuln
  cloudAgents.push(runSequentialPhase('cloud-vuln', ...));
}

await Promise.allSettled(cloudAgents);
```

## Files to Create/Change

- `apps/worker/prompts/aws-vuln.txt` — NEW
- `apps/worker/prompts/gcp-vuln.txt` — NEW
- `apps/worker/prompts/azure-vuln.txt` — NEW
- `apps/worker/src/session-manager.ts` — add 3 agent definitions
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add 3 activity wrappers
- `apps/worker/src/temporal/workflows.ts` — per-cloud routing with fallback to cloud-vuln

## Acceptance Criteria

- [ ] `aws-vuln` detects public S3 bucket with no credentials
- [ ] `aws-vuln` uses AWS key from CredentialStore (injected via brain_hints)
- [ ] `aws-vuln` tests at least 5 IAM privilege escalation paths
- [ ] `gcp-vuln` checks unauthenticated Cloud Functions
- [ ] `azure-vuln` checks SAS token and blob public access
- [ ] All three only run when respective cloud detected by profiling
- [ ] Falls back to generic `cloud-vuln` when no specific cloud detected
- [ ] `pnpm run check` passes

## Notes

- Research ref: `docs/research/15-cloud-native-attack-surface.md`
- Credential feedback loop (task-013) must be complete — these agents depend on it
- AWS IAM privilege escalation: 20+ known paths documented in research ref
- IMDS testing requires an SSRF vector to already be found by ssrf-vuln
- Never store cloud credentials in deliverables — reference only (last 4 chars of key)

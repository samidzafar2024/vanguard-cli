---
description: "Prepare an Architecture Review Board document (kickoff or feature review)"
---

# WayPoint: ARB Review Preparation

**Project**: bonuscompplatform

## Before You Begin

1. **Read the process guide** at `.waypoint/templates/arb-process-guide.md` for full context on how this workflow operates.

2. **Read the flow file** at `.waypoint/workflows/arb/_flow.yaml` for the step sequence and checkpoints.

3. **Determine the review type** — this is your first question to the user:
   - **Kickoff**: Full system review (new product or annual re-review). Uses `arb-architecture.md` template.
   - **Feature**: Delta review for a major change to an existing system. Uses `arb-feature-review.md` template. Requires an existing approved `ARCHITECTURE.md`.

4. **Determine project maturity** — second question:
   - **Greenfield**: No code yet — interview the architect about intended design.
   - **Brownfield**: Existing codebase — explore the code and ask targeted questions.

## Workflow: Step-by-Step

This phase uses a **step-file workflow** with 15 steps for kickoff reviews.

**Flow file**: `.waypoint/workflows/arb/_flow.yaml`
**Kickoff template**: `.waypoint/templates/arb-architecture.md`
**Feature template**: `.waypoint/templates/arb-feature-review.md`
**Steps**: 15 (kickoff) / subset (feature)

### Kickoff Review Steps

| # | Step | File |
|---|---|---|
| 1 | Project Identity, Review Type & Maturity | `gather-project-identity.md` |
| 2 | Business Context | `gather-business-context.md` |
| 3 | System Architecture (C4 L1 + L2) | `discover-system-architecture.md` |
| 4 | Application Stack | `catalog-application-stack.md` |
| 5 | Integration Architecture | `document-integrations.md` |
| 6 | Infrastructure & Deployment | `map-infrastructure.md` |
| 7 | Data Architecture | `data-architecture.md` |
| 8 | Security Architecture | `document-security.md` |
| 9 | Non-Functional Requirements | `document-nfrs.md` |
| 10 | Operational Readiness | `document-ops-readiness.md` |
| 11 | Cost Estimate | `estimate-cost.md` |
| 12 | Compliance & Risk | `assess-compliance-and-risk.md` |
| 13 | Key Decisions + Alternatives | `record-decisions.md` |
| 14 | Review Governance | `define-governance.md` |
| 15 | Assemble Document | `assemble-document.md` |

### Feature Review Steps

For feature reviews, use the `arb-feature-review.md` template. Focus on deltas:
- Change Summary + review triggers
- Architecture Impact (current vs proposed, L2 delta)
- Integration, Data, Security, NFR, Operational, Cost impacts
- Risk Delta
- New Key Decisions with alternatives

### How to Execute

**Read each step file** in `.waypoint/workflows/arb/` in sequence. Each step contains:
- **Brownfield instructions**: What to scan in the codebase
- **Greenfield instructions**: What questions to ask the architect
- **Output format**: What the section should look like
- **Checkpoint**: A question to confirm before proceeding

For each step:
1. Read the step file
2. **Brownfield**: Explore the codebase to gather information. Ask the user only for things you can't derive from code.
3. **Greenfield**: Interview the user following the questions in the step file.
4. Populate the corresponding section of the template
5. Confirm the checkpoint before moving to the next step

### Checkpoints

Each step has a checkpoint question. Only proceed when you can answer "yes":

- **Step 1**: Do I know the review type, maturity, project name, audience, and metadata?
- **Step 2**: Is the problem statement clear? Are business drivers and stakeholders identified?
- **Step 3**: Do I have both L1 Context and L2 Container diagrams with inventory?
- **Step 4**: Is every layer of the stack documented with technology, version, and purpose?
- **Step 5**: Is every external system detailed with direction, protocol, data, and failure mode?
- **Step 6**: Are all environments, resource names, pipeline stages, and container config documented?
- **Step 7**: Is data classified by sensitivity? Are storage decisions and migration strategy clear?
- **Step 8**: Are auth flows, RBAC, headers, and secrets management documented?
- **Step 9**: Are all NFRs specific, measurable, and testable?
- **Step 10**: Are observability, alerting, incident response, and DR documented?
- **Step 11**: Is there a monthly run-rate estimate with scaling projection?
- **Step 12**: Are controls enumerated and risks assessed with likelihood/impact/mitigation?
- **Step 13**: Does every decision list alternatives considered and explain rejections?
- **Step 14**: Are review triggers, feature review process, and cadence defined?
- **Step 15**: Does the final document pass the quality checklist?

### Entry Conditions

- **Kickoff**: Working codebase (brownfield) or access to architect (greenfield)
- **Feature**: Existing approved `ARCHITECTURE.md` from kickoff review

### Final Outputs

- **Kickoff**: `ARCHITECTURE.md` at project root
- **Feature**: `ARCHITECTURE-{feature-name}.md` at project root

## Important Notes

- **Do not guess.** If information cannot be derived from code, ask the user.
- **Mark unknowns.** Use `[TBD]` for unknown values, `[PROPOSED]` for greenfield designs pending approval, `[ESTIMATED]` for cost projections.
- **No secrets.** Never include passwords, tokens, or connection strings in the document.
- **Alternatives required.** Every architectural decision must list alternatives that were considered.
- **NFRs must be measurable.** "Must be fast" is not acceptable. "p99 < 500ms" is.

## After Completion

- Recommend adding a reference to `ARCHITECTURE.md` in the project's `CLAUDE.md`
- For kickoff: the Review Governance section defines when the team should return for feature reviews
- Update `waypoint.manifest.yaml` to reflect the new document

---

## Arguments

$ARGUMENTS

---

_WayPoint ARB Review command — Kickoff & Feature review workflows_

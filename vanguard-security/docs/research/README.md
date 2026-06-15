# Vanguard Research Archive

This directory holds the research work that informed Vanguard's architecture and engineering decisions. Every major design choice (brain architecture, OPSEC strategy, tool selection) should trace back to a research doc here.

## Why this exists

Vanguard is an autonomous AI pentest tool. Many of its decisions — what reasoning architecture, what attack patterns, what stealth approach — are not obvious from first principles. They come from:

- Academic papers (PentestGPT, Reflexion, Tree of Thoughts, MulVAL, etc.)
- Real-world bug bounty methodology (NahamSec, Frans Rosén, LiveOverflow, TomNomNom)
- Commercial pentest products (XBOW, NodeZero, Synack Sara, Pentera, Picus)
- Red team OPSEC literature (Cobalt Strike profiles, Sliver, Mythic, MITRE ATT&CK)
- Tool-specific deep dives (sqlmap tampers, nuclei rate limits, JA3/JA4 fingerprinting)

Without this archive, future contributors (and future you) lose the *why* behind every design decision.

## Index

| # | Doc | Topic | Status |
|---|---|---|---|
| 00 | [00-research-roadmap.md](./00-research-roadmap.md) | What's done, what's pending, priority order | Living |
| 01 | [01-hpc-ag-architecture.md](./01-hpc-ag-architecture.md) | The Hierarchical Planner-Critic with Attack Graph brain | ✅ Complete |
| 02 | [02-opsec-industry-standards.md](./02-opsec-industry-standards.md) | OPSEC for autonomous pentest tools — 3-tier roadmap | ✅ Complete |
| 03 | TBD | Vendor-specific WAF detection mechanics | 📋 Planned |
| 04 | TBD | Engagement legal/ethical framework | 📋 Planned |
| 05 | TBD | Benchmark + evaluation standards (Cybench, NYU CTF) | 📋 Planned |
| 06 | TBD | Real-world chain databases (H1 Hacktivity analysis) | 📋 Planned |
| 07 | TBD | Competitive analysis: XBOW, NodeZero, Sara, Pentera | 📋 Planned |

## Doc structure convention

Every research doc follows:

1. **Executive summary** — 3-5 sentences, the bottom line
2. **Research questions** — what we set out to answer
3. **Key findings** — organized by sub-topic, with citations inline
4. **Implementation decisions** — what we built / will build because of this research
5. **Open questions** — what we don't know yet
6. **Sources** — full citations at the bottom

## How to add a new research doc

1. Pick the next available `NN-` number
2. Copy the structure of `01-hpc-ag-architecture.md` as a template
3. Add an entry to the index above
4. Cite sources inline as `[short-name](url)` plus full list at bottom
5. End with **Implementation decisions** linking to specific files in the codebase

## Contribution rule

If you make a non-trivial design decision and there's no research doc backing it, **write one before merging**. "Because the LLM said so" is not a research doc.

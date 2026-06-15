# Spec: Phase 5 — Network & Enterprise

**Status**: Draft
**Date**: 2026-04-28
**Research refs**: `docs/research/11-post-exploitation.md`, `docs/research/10-multi-target-strategies.md`
**Depends on**: Phase 1 + 2 + 3 + 4 complete

---

## Executive Summary

Phase 5 takes Vanguard beyond web and cloud into full enterprise attack simulation. This is the "full kill chain" phase — network layer, Active Directory, mobile applications, and multi-stage attack path simulation with human approval gates.

This phase targets enterprise security teams and professional pentesters who need to simulate how a real APT (Advanced Persistent Threat) would move through an organization after initial access.

**Important**: All Phase 5 agents require `mode: active` + `active_mode_confirmed: true`. These are the most invasive capabilities in the platform. Every destructive action has a human approval gate.

---

## Users

### U1 — Enterprise Red Team
- Simulates full kill chain: initial access → lateral movement → data exfil
- Needs: AD attack simulation, network scanning, kill chain coordinator
- Operates only in fully authorized, scoped engagements

### U2 — Security Consultant (Mobile)
- Client has iOS/Android apps in scope
- Needs: mobile testing agent that handles APK/IPA analysis + runtime testing

### U3 — CISO / Security Program Manager
- Wants proof that a breach scenario is possible end-to-end
- Needs: kill chain simulation report showing the complete attack path

---

## Functional Requirements

### F1 — Network Scanner (`network-recon`)
- Port scanning via nmap (already in Kali container)
- Service enumeration: SSH, FTP, SMB, RDP, databases
- OS fingerprinting
- Network topology mapping from discovered hosts
- Feeds discovered services to other agents (ssh default creds → cred-intel)
- Mode: validated (scanning), active (service probing)

### F2 — Active Directory Attack Simulation (`ad-attack`)
- Kerberoasting: request service tickets, attempt offline crack
- AS-REP Roasting: find accounts without Kerberos pre-auth
- Pass-the-Hash / Pass-the-Ticket
- DCSync: simulate domain controller sync (active mode only)
- BloodHound-style path analysis: find shortest path to Domain Admin
- Requires: initial credential (from cred-intel or manual supply)
- Human approval gate before each escalation step

### F3 — Mobile Application Testing (`mobile-vuln`)
- Android: APK decompilation (jadx), manifest analysis, hardcoded secrets
- iOS: IPA analysis, plist inspection, Keychain misuse
- Runtime: certificate pinning bypass, SSL interception
- API testing: mobile-specific endpoints, device attestation bypass
- Deep link exploitation

### F4 — Kill Chain Coordinator (`kill-chain`)
- Orchestrates multi-stage attack path
- Stage 1: initial access (web vuln or credential)
- Stage 2: establish persistence
- Stage 3: lateral movement (network + AD)
- Stage 4: privilege escalation
- Stage 5: data discovery + exfiltration simulation (no actual data exfil)
- Human approval gate between every stage
- Full kill chain report: MITRE ATT&CK mapping for every step

### F5 — Multi-Target Pipeline
- Run Vanguard across multiple targets in sequence
- Shared CredentialStore across targets (found credentials tested on all targets)
- Cross-target chain detection: credential found on Target A works on Target B
- Requires explicit multi-target scope in engagement.yaml

---

## Security Scenarios

### Scenario A — Full enterprise kill chain
`network-recon` finds internal admin panel on port 8080. `cred-intel` tries default creds — success: `admin:admin`. Human approves escalation. `ad-attack` uses credentials to enumerate AD. Finds Kerberoastable service account. Human approves crack attempt. Finds path to Domain Admin. Report: full MITRE ATT&CK mapped kill chain.

### Scenario B — Mobile API abuse
`mobile-vuln` decompiles Android APK, finds hardcoded API key in strings.xml. Key tested against production API — has read access to all user data. Finding: Critical — hardcoded credential + data exposure.

### Scenario C — Multi-target credential reuse
Target A: `cred-intel` finds `admin:Password123!` on `/grafana`. Target B (different company, same engagement): same credential works on SSH. Cross-target finding: credential reuse across systems.

---

## Non-Functional Requirements

- Every `ad-attack` step requires explicit human approval via CLI prompt
- Kill chain simulation never actually exfiltrates data — proves access only
- `network-recon` respects scope boundaries — never scans outside defined FQDN/IP range
- Mobile testing requires explicit `mobile_testing: true` in engagement.yaml
- All Phase 5 agents require `mode: active` — validated mode = no Phase 5 agents run

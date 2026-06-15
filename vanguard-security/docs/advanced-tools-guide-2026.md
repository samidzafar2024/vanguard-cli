# Advanced Security Tools Guide 2026

> This guide covers professional-grade security tools beyond basic web app pentesting (nmap, subfinder, nuclei, nikto, semgrep, gitleaks, trivy, sqlmap, dalfox, ffuf, testssl.sh, jwt_tool, httpx, whatweb, amass). All categories below represent the extended toolkit used in professional red team, blue team, bug bounty, and enterprise security work.

---

## Table of Contents

1. [Commercial / Enterprise Tools](#1-commercial--enterprise-tools)
2. [Exploitation Frameworks](#2-exploitation-frameworks)
3. [Password & Credential Attacks](#3-password--credential-attacks)
4. [Active Directory / Windows](#4-active-directory--windows)
5. [Cloud Security](#5-cloud-security)
6. [Container & Kubernetes Security](#6-container--kubernetes-security)
7. [Mobile Security](#7-mobile-security-iosandroid)
8. [Network Attacks](#8-network-attacks)
9. [OSINT Advanced](#9-osint-advanced)
10. [Social Engineering](#10-social-engineering)
11. [Forensics & Incident Response](#11-forensics--incident-response)
12. [Threat Intelligence & Monitoring](#12-threat-intelligence--monitoring)
13. [WAF Bypass & Evasion](#13-waf-bypass--evasion)
14. [API Security Specialized](#14-api-security-specialized)
15. [Fuzzing](#15-fuzzing)
16. [Blockchain / Smart Contract Security](#16-blockchainsmart-contract-security)
17. [CLI Automation Analysis](#17-cli-automation-analysis)

---

## 1. Commercial / Enterprise Tools

### Burp Suite Pro (vs Community)

| Field | Details |
|-------|---------|
| **What it does** | Full-featured web application security testing platform. Intercepts HTTP/S traffic as a proxy, enables active/passive scanning, fuzzing, crawling, and extension-based automation. Pro adds automated scanner, Collaborator (out-of-band detection), advanced intruder (no throttle), and BApp store integrations. Community limits Intruder speed and lacks the scanner. |
| **Attack types** | XSS, SQLi, SSRF, XXE, IDOR, authentication flaws, session management, business logic, API testing |
| **License** | Commercial (Pro ~$449/yr individual). Community edition is free. |
| **CLI automation** | Partial — `burpsuite --project-file --config-file` enables headless scanning. REST API available in Pro for starting scans, pulling results. Full interactive testing requires the GUI. Bambda scripting (Java-based) automates repeatable tasks. |

---

### Nessus Professional

| Field | Details |
|-------|---------|
| **What it does** | Industry-leading vulnerability scanner. Performs credentialed and uncredentialed scanning of hosts, services, and configurations. Covers CVEs, misconfigurations, default credentials, patch levels, compliance checks (PCI, CIS, DISA STIG). |
| **Attack types** | Vulnerability assessment, network exposure, compliance auditing, patch gap analysis |
| **License** | Commercial (~$4,709/yr). Nessus Essentials is free (limited to 16 IPs). |
| **CLI automation** | Yes — full REST API. `nessuscli` binary supports scan creation, launch, export. Can be scripted end-to-end: `nessuscli scan --create --launch --export`. |

---

### Qualys VMDR

| Field | Details |
|-------|---------|
| **What it does** | Cloud-based vulnerability management, detection, and response platform. Continuous asset discovery, agent-based and agentless scanning, risk prioritization (TruRisk scoring), patch orchestration, and compliance reporting. |
| **Attack types** | Vulnerability management, configuration assessment, compliance, container/cloud scanning |
| **License** | Commercial (subscription, per-asset pricing). No free tier. |
| **CLI automation** | Yes — Qualys API v2 (XML/JSON). Command-line via curl or SDKs. CI/CD integrations available. Agent deployment scriptable via mass deployment tools. |

---

### Rapid7 InsightVM

| Field | Details |
|-------|---------|
| **What it does** | Live vulnerability management with real-risk scoring, remediation workflow tracking, and integrations into SIEM/SOAR. Uses an on-prem scan engine + cloud console. Provides attacker-path analytics ("what can an attacker reach from this asset"). |
| **Attack types** | Vulnerability management, lateral movement risk mapping, compliance, container scanning |
| **License** | Commercial (subscription). |
| **CLI automation** | Yes — InsightVM REST API. `nexpose-client` CLI wrappers available. Scriptable scan creation, site management, and report generation. |

---

### Tenable.io

| Field | Details |
|-------|---------|
| **What it does** | Cloud-based vulnerability management platform (SaaS version of Nessus). Covers IT, OT, IoT, cloud, containers, and web apps. Provides exposure metrics, predictive prioritization using threat intel feeds, and attack path mapping. |
| **Attack types** | Vulnerability assessment, cloud security posture, web application scanning, OT/ICS scanning |
| **License** | Commercial (subscription). |
| **CLI automation** | Yes — Tenable.io REST API. `pytenable` official Python SDK. Fully scriptable: scan creation, launch, export to CSV/Nessus/PDF. |

---

### Checkmarx SAST/SCA

| Field | Details |
|-------|---------|
| **What it does** | Enterprise Static Application Security Testing (SAST) and Software Composition Analysis (SCA). Analyzes source code for vulnerabilities across 30+ languages with data-flow taint analysis. KICS plugin covers IaC. CxOne platform integrates SAST, SCA, DAST, API security, and supply chain into a unified console. |
| **Attack types** | Injection flaws, insecure code patterns, vulnerable dependencies, supply chain risks, secrets in code |
| **License** | Commercial (enterprise). |
| **CLI automation** | Yes — `CxCLI` (cx.exe / cx) supports full scan submission and result retrieval. Integrates into Jenkins, GitHub Actions, GitLab CI, Azure DevOps natively. |

---

### Veracode

| Field | Details |
|-------|---------|
| **What it does** | Cloud-based application security platform offering SAST (Static Analysis), DAST (Dynamic Analysis), SCA, and penetration testing as a service. SAST uses binary/bytecode analysis (no source code required). DAST crawls and tests running apps. Pipeline Scan allows fast in-CI scanning. |
| **Attack types** | OWASP Top 10, CWE coverage in SAST/DAST, dependency vulnerabilities |
| **License** | Commercial (subscription). |
| **CLI automation** | Yes — Veracode REST APIs + `veracode-cli`. Pipeline Scan JAR runs in CI: `java -jar pipeline-scan.jar --file app.jar`. Results in JSON. |

---

### Invicti (formerly Acunetix)

| Field | Details |
|-------|---------|
| **What it does** | Web application and API security scanner with proof-based scanning (auto-confirms exploitability to eliminate false positives). Covers OWASP Top 10, business logic, GraphQL, REST/SOAP APIs. Combines DAST with IAST via a sensor agent for deeper coverage. |
| **Attack types** | XSS, SQLi, SSRF, XXE, RCE, IDOR, authentication bypass, API vulnerabilities |
| **License** | Commercial (Invicti Enterprise / Acunetix 360). |
| **CLI automation** | Yes — REST API for scan creation, scheduling, reporting. Invicti also provides a CLI scanner for CI/CD integration. |

---

### HCL AppScan

| Field | Details |
|-------|---------|
| **What it does** | Enterprise DAST, SAST, IAST, and SCA platform (formerly IBM AppScan). AppScan Standard is a desktop DAST tool. AppScan Enterprise adds centralized management and reporting. AppScan on Cloud (ASoC) is the SaaS offering. Covers OWASP, PCI DSS, GDPR compliance reporting. |
| **Attack types** | Web application vulnerabilities (DAST), code vulnerabilities (SAST), dependency risks (SCA) |
| **License** | Commercial (HCL subscription). |
| **CLI automation** | Yes — AppScan CLI (`appscan.sh` / `appscan.bat`) for SAST. ASoC REST API for DAST scheduling and result extraction. Jenkins/Azure DevOps plugins available. |

---

## 2. Exploitation Frameworks

### Metasploit Framework

| Field | Details |
|-------|---------|
| **What it does** | The most widely used exploitation framework. Provides a modular platform for developing, testing, and executing exploits. Contains 2,000+ exploit modules, 1,000+ auxiliary modules (scanners, brute force, fuzzers), post-exploitation modules (privilege escalation, pivoting, credential dumping), payloads (Meterpreter, reverse shells), and encoders/evasion. Metasploit Pro (commercial) adds automated exploitation, phishing, and reporting. |
| **Attack types** | Network exploitation, web exploitation, post-exploitation, pivoting, persistence, credential harvesting, lateral movement |
| **License** | Open source (Framework). Metasploit Pro is commercial (~$15,000/yr). |
| **CLI automation** | Yes — `msfconsole` with resource scripts (`.rc` files), `msfvenom` for payload generation, `msfrpc` for programmatic control. Fully scriptable: `msfconsole -q -r script.rc`. |

---

### Cobalt Strike

| Field | Details |
|-------|---------|
| **What it does** | Commercial adversary simulation and red team operations platform. Built on a team server (C2 infrastructure) with Beacon payloads (HTTP/S, DNS, SMB, TCP). Features: spear-phishing, drive-by downloads, Beacon Object Files (BOFs) for in-memory execution, lateral movement, credential theft, Aggressor scripting for automation. Widely used in enterprise red team engagements and (unfortunately) by APT groups. |
| **Attack types** | Command and control, lateral movement, persistence, credential dumping, privilege escalation, full red team simulation |
| **License** | Commercial (~$5,900/operator/yr). Requires vetting/purchase from Fortra. |
| **CLI automation** | Partial — Aggressor Script (ASL) automates Beacon interactions. `agscript` runs headless scripts against team server. Full orchestration requires team server running. |

---

### Sliver C2

| Field | Details |
|-------|---------|
| **What it does** | Open-source adversary simulation C2 framework developed by Bishop Fox. Alternative to Cobalt Strike. Supports Implants in Go (compiled per-target), multiple C2 channels (mTLS, WireGuard, HTTP/S, DNS), session and beacon modes, armory (extension system), BOF support, multiplayer team server, and built-in pivoting. |
| **Attack types** | Command and control, lateral movement, persistence, post-exploitation |
| **License** | Open source (MIT) — https://github.com/BishopFox/sliver |
| **CLI automation** | Yes — gRPC API allows programmatic control. Sliver client is interactive but scriptable via the API. Multiplayer server deployable via Docker. |

---

### Havoc C2

| Field | Details |
|-------|---------|
| **What it does** | Modern open-source C2 framework with a focus on evasion. Features Demon implant (written in C), malleable C2 profiles, sleep obfuscation, AMSI/ETW patching, process injection, BOF support, teamserver with web UI, and Golang/Python extensions. More actively maintained evasion features than Sliver for mature Windows environments. |
| **Attack types** | Command and control, AV/EDR evasion, post-exploitation, persistence |
| **License** | Open source — https://github.com/HavocFramework/Havoc |
| **CLI automation** | Partial — API available, but primary interface is the GUI teamserver. Extendable via Python scripting. |

---

### Empire Framework

| Field | Details |
|-------|---------|
| **What it does** | Post-exploitation framework focused on PowerShell (Windows) and Python (Linux/macOS) agents. Supports lateral movement, credential harvesting, keylogging, screenshot capture, persistence mechanisms, and bypassing AMSI/script block logging. BC-Security maintains the active fork (Empire 5+). Integrates with Starkiller (web GUI). |
| **Attack types** | Post-exploitation, lateral movement, credential theft, persistence, privilege escalation |
| **License** | Open source (BSD) — https://github.com/BC-SECURITY/Empire |
| **CLI automation** | Yes — RESTful API (Flask). Headless server mode: `python3 empire --rest`. Starkiller (Electron) provides GUI. Fully scriptable via REST API. |

---

### BeEF (Browser Exploitation Framework)

| Field | Details |
|-------|---------|
| **What it does** | Focuses exclusively on browser-based exploitation. Hooks victim browsers via a JavaScript payload (often via XSS injection), then enables command modules: keylogging, screenshot capture, network scanning from victim browser, social engineering dialogs, session hijacking, webcam/mic access, fingerprinting, and over 300 exploit modules. |
| **Attack types** | Client-side exploitation, XSS leveraging, browser fingerprinting, social engineering, network pivoting via browser |
| **License** | Open source (Apache 2.0) — https://github.com/beefproject/beef |
| **CLI automation** | Partial — REST API available for hooking and module execution. Hook injection usually requires prior XSS to plant JS. |

---

## 3. Password & Credential Attacks

### Hashcat

| Field | Details |
|-------|---------|
| **What it does** | World's fastest password recovery tool using GPU acceleration. Supports 350+ hash types including MD5, SHA-1/256/512, NTLM, NetNTLMv1/v2, bcrypt, WPA2, Kerberos 5 (etype 17/18/23), PBKDF2, Argon2, Django, WordPress, Bitcoin wallets, and many more. Attack modes: dictionary (0), combinator (1), brute-force/mask (3), hybrid wordlist+mask (6), hybrid mask+wordlist (7), association (9). Supports rule engines for complex mutations. |
| **Attack types** | Offline password cracking, hash cracking, credential recovery |
| **License** | Open source (MIT) — https://github.com/hashcat/hashcat |
| **CLI automation** | Yes — fully CLI: `hashcat -m 1000 -a 0 hashes.txt wordlist.txt -r rules/best64.rule`. Scriptable with exit codes and potfile output parsing. |

---

### John the Ripper

| Field | Details |
|-------|---------|
| **What it does** | Classic password cracker with wide format support (3,000+ hash/cipher types in Jumbo fork). Features auto-detection of hash type, incremental mode (intelligent brute force), wordlist mode, single crack mode (uses username/gecos field for mutations), and external mode (custom C code). Runs on CPU (slower than Hashcat on GPU but broader format support and easier format auto-detection). |
| **Attack types** | Offline hash cracking, ZIP/RAR/Office/PDF password recovery, SSH key passphrase cracking |
| **License** | Open source (GPL) — https://github.com/openwall/john |
| **CLI automation** | Yes — fully CLI: `john --format=nt --wordlist=rockyou.txt hashes.txt`. Results parseable with `--show`. |

---

### Hydra

| Field | Details |
|-------|---------|
| **What it does** | Online password brute-force and credential stuffing tool supporting 50+ protocols: SSH, FTP, HTTP/HTTPS (GET/POST/form), RDP, SMB, MySQL, PostgreSQL, MSSQL, SMTP, POP3, IMAP, VNC, Telnet, LDAP, Oracle, Redis, and more. |
| **Attack types** | Online brute-force, credential stuffing, default credential testing |
| **License** | Open source (AGPL) — https://github.com/vanhauser-thc/thc-hydra |
| **CLI automation** | Yes — fully CLI: `hydra -L users.txt -P passwords.txt ssh://target`. Output parseable. |

---

### Medusa

| Field | Details |
|-------|---------|
| **What it does** | Parallel, modular online brute-force tool. Focuses on speed via parallel host/user/password testing. Supports SSH, FTP, HTTP, SMB, MSSQL, MySQL, PostgreSQL, VNC, Telnet, and ~30 modules. Quieter/more reliable than Hydra in some scenarios. |
| **Attack types** | Online brute-force, credential testing |
| **License** | Open source (GPL) — https://github.com/jmk-foofus/medusa |
| **CLI automation** | Yes — fully CLI. Module-based: `medusa -h target -u admin -P wordlist.txt -M ssh`. |

---

### CrackMapExec (CME) / NetExec

| Field | Details |
|-------|---------|
| **What it does** | Swiss-army knife for Windows/Active Directory environments. Tests credentials across SMB, WinRM, LDAP, MSSQL, SSH, RDP at scale across entire subnets. Dumps SAM/LSA/NTDS, executes commands, deploys payloads, enumerates shares/users/groups/policies, and integrates with Impacket. NetExec (`nxc`) is the actively maintained community fork. |
| **Attack types** | Credential validation, lateral movement, post-exploitation, AD enumeration, pass-the-hash |
| **License** | Open source (BSD) — https://github.com/Pennyw0rth/NetExec |
| **CLI automation** | Yes — fully CLI. Outputs JSON with `--json`. Scriptable across CIDR ranges. |

---

### Responder

| Field | Details |
|-------|---------|
| **What it does** | LLMNR/NBT-NS/mDNS poisoning tool for capturing NTLMv1/v2 hashes on a network. Listens for broadcast name resolution requests, spoofs responses, and captures challenge-response hashes which can then be cracked offline with Hashcat/JtR. Also includes rogue SMB, HTTP, FTP, LDAP, MSSQL, and DNS servers. |
| **Attack types** | Credential capture, MITM, NTLM hash capture, network poisoning |
| **License** | Open source (Apache 2.0) — https://github.com/lgandx/Responder |
| **CLI automation** | Partial — runs as daemon: `python3 Responder.py -I eth0 -A`. Log files parseable for captured hashes. Requires network position (internal or VPN). |

---

## 4. Active Directory / Windows

### BloodHound + Neo4j

| Field | Details |
|-------|---------|
| **What it does** | AD attack path visualization tool. Uses graph database (Neo4j) to map relationships between users, computers, groups, GPOs, OUs, ACLs, and trusts. Identifies shortest attack paths to Domain Admin, Kerberoastable accounts, AS-REP roastable accounts, DCSync rights, unconstrained delegation targets, and more. BloodHound CE (Community Edition) is the modern version with improved UI. |
| **Attack types** | AD privilege escalation path discovery, lateral movement planning, ACL abuse, delegation attacks |
| **License** | Open source (Apache 2.0) — https://github.com/SpecterOps/BloodHound |
| **CLI automation** | Partial — data collection via SharpHound (Windows) or BloodHound.py (Linux). Neo4j queries can be automated via Cypher API. BloodHound CE has REST API. |

---

### Mimikatz

| Field | Details |
|-------|---------|
| **What it does** | Windows credential extraction tool. Extracts plaintext passwords, NTLM hashes, Kerberos tickets, and certificates from LSASS memory, DPAPI, SAM, NTDS.dit. Modules: `sekurlsa` (LSASS dump), `lsadump` (SAM/LSA/DCSync), `kerberos` (ticket manipulation — pass-the-ticket, golden ticket, silver ticket), `crypto` (certificate/key export), `dpapi` (credential manager decryption). |
| **Attack types** | Credential dumping, pass-the-hash, pass-the-ticket, golden/silver ticket attacks, DCSync |
| **License** | Open source (CC BY 4.0) — https://github.com/gentilkiwi/mimikatz |
| **CLI automation** | Yes — command-line driven: `mimikatz.exe "privilege::debug" "sekurlsa::logonpasswords" exit`. Fully scriptable. Often run via Meterpreter/Beacon in automated pipelines. |

---

### Impacket Suite

| Field | Details |
|-------|---------|
| **What it does** | Python library and collection of tools for working with Windows network protocols. Key tools: `psexec.py` (remote code execution), `smbclient.py`, `secretsdump.py` (remote NTDS/SAM dump without touching disk), `GetTGT.py`/`GetST.py` (Kerberos ticket requests), `GetNPUsers.py` (AS-REP roasting), `GetUserSPNs.py` (Kerberoasting), `ntlmrelayx.py` (NTLM relay attacks), `wmiexec.py`, `atexec.py`, `dcomexec.py`. |
| **Attack types** | Remote code execution, credential dumping, Kerberoasting, AS-REP roasting, NTLM relay, DCSync, pass-the-hash |
| **License** | Open source (Apache 2.0) — https://github.com/fortra/impacket |
| **CLI automation** | Yes — all tools are standalone Python scripts with CLI interfaces. Fully scriptable. Core of most AD attack automation. |

---

### Rubeus

| Field | Details |
|-------|---------|
| **What it does** | C# Kerberos interaction and abuse toolkit for Windows. Performs AS-REP roasting, Kerberoasting, ticket extraction, overpass-the-hash, S4U2Self/S4U2Proxy abuse (constrained delegation), ticket renewal/forging (golden/silver), and more. Runs entirely in memory, BOF-compatible. |
| **Attack types** | Kerberoasting, AS-REP roasting, pass-the-ticket, constrained delegation abuse, ticket forging |
| **License** | Open source (BSD 3-Clause) — https://github.com/GhostPack/Rubeus |
| **CLI automation** | Yes — CLI-driven: `Rubeus.exe kerberoast /outfile:hashes.txt`. Often executed via Beacon/Meterpreter for in-memory operation. |

---

### PowerView

| Field | Details |
|-------|---------|
| **What it does** | PowerShell tool for AD reconnaissance. Enumerates domains, trusts, users, groups, computers, GPOs, ACLs, sessions, logged-on users, shares, and OUs. Part of PowerSploit. Key functions: `Get-DomainUser`, `Get-DomainGroupMember`, `Find-LocalAdminAccess`, `Get-ObjectAcl`, `Invoke-ACLScanner`. |
| **Attack types** | AD enumeration, ACL abuse discovery, delegation enumeration, trust mapping |
| **License** | Open source (BSD 3-Clause) — https://github.com/PowerShellMafia/PowerSploit |
| **CLI automation** | Yes — PowerShell-driven, fully scriptable. Often combined with BloodHound data collection. |

---

### SharpHound

| Field | Details |
|-------|---------|
| **What it does** | The official data collector for BloodHound. C# binary that enumerates AD objects, ACLs, sessions, group memberships, and trust relationships, outputting JSON files for import into BloodHound. Collection methods: default, all, DCOnly, LoggedOn, Session, ACL, ObjectProps, Group, GPOLocalGroup. |
| **Attack types** | AD attack path mapping (data collection phase) |
| **License** | Open source (Apache 2.0) — https://github.com/SpecterOps/SharpHound |
| **CLI automation** | Yes — fully CLI: `SharpHound.exe -c all --zipfilename output.zip`. BloodHound.py (Python alternative) works from Linux without domain-joined machine. |

---

### Evil-WinRM

| Field | Details |
|-------|---------|
| **What it does** | WinRM shell for pentesting. Provides an interactive PowerShell session over WinRM (port 5985/5986) with built-in file upload/download, in-memory DLL loading, pass-the-hash support (NTLM auth), Kerberos auth, SSL support, and command history. |
| **Attack types** | Remote code execution, lateral movement, post-exploitation |
| **License** | Open source (MIT) — https://github.com/Hackplayers/evil-winrm |
| **CLI automation** | Partial — interactive shell. Can script commands via `-e` (execute) but primarily interactive. |

---

## 5. Cloud Security

### ScoutSuite

| Field | Details |
|-------|---------|
| **What it does** | Multi-cloud security auditing tool. Collects configuration data from cloud provider APIs (AWS, Azure, GCP, Alibaba, Oracle, Kubernetes) and evaluates against security best practices. Generates an interactive HTML report with findings across IAM, storage, networking, logging, encryption, and compute. |
| **Attack types** | Cloud misconfiguration detection, compliance gap analysis, attack surface discovery |
| **License** | Open source (GPL v2) — https://github.com/nccgroup/ScoutSuite |
| **CLI automation** | Yes — fully CLI: `scout aws --profile myprofile --report-dir ./results`. JSON output available. Integrates into CI/CD for drift detection. |

---

### Prowler

| Field | Details |
|-------|---------|
| **What it does** | AWS (and now Azure/GCP) security assessment tool. Runs 300+ security checks against CIS Benchmarks, NIST, PCI DSS, HIPAA, GDPR, SOC2, ENS. Checks IAM policies, S3 public access, CloudTrail logging, security groups, encryption at rest/transit, root account usage, MFA enforcement, secrets in parameter store, and more. Prowler v3+ supports multi-cloud. |
| **Attack types** | Misconfiguration detection, compliance auditing, privilege escalation path discovery |
| **License** | Open source (Apache 2.0) — https://github.com/prowler-cloud/prowler |
| **CLI automation** | Yes — fully CLI: `prowler aws -M json -o results/`. Outputs JSON/CSV/HTML. GitHub Actions integration available. |

---

### CloudSploit

| Field | Details |
|-------|---------|
| **What it does** | Open-source cloud security scanner by Aqua Security. Checks AWS, Azure, GCP, and Oracle for misconfigurations across 400+ plugins covering IAM, storage, networking, databases, and logging. Now part of Aqua's commercial platform but core scanner is open source. |
| **Attack types** | Cloud misconfiguration, security posture assessment |
| **License** | Open source (GPL v3) — https://github.com/aquasecurity/cloudsploit |
| **CLI automation** | Yes — fully CLI: `node index.js --cloud aws --json results.json`. |

---

### Pacu

| Field | Details |
|-------|---------|
| **What it does** | AWS exploitation framework (think Metasploit for AWS). Modular tool for offensive AWS security testing. Modules include: IAM privilege escalation (17+ methods), S3 bucket enumeration/exfiltration, EC2 metadata SSRF exploitation, CloudTrail disabling/evading, secrets enumeration (SSM, Secrets Manager), role enumeration/assumption, Lambda backdooring, and more. |
| **Attack types** | AWS privilege escalation, IAM abuse, cloud post-exploitation, data exfiltration |
| **License** | Open source (BSD 3-Clause) — https://github.com/RhinoSecurityLabs/pacu |
| **CLI automation** | Yes — interactive console with module commands: `run iam__enum_permissions`. Can be driven via scripts. |

---

### GCPBucketBrute

| Field | Details |
|-------|---------|
| **What it does** | GCP storage bucket enumeration tool. Tests permutations of a target name against Google Cloud Storage to find publicly accessible or misconfigured buckets. Tests read, write, and list permissions with both unauthenticated and authenticated requests. |
| **Attack types** | Cloud storage misconfiguration discovery, exposed data detection |
| **License** | Open source (Apache 2.0) — https://github.com/RhinoSecurityLabs/GCPBucketBrute |
| **CLI automation** | Yes — fully CLI: `python3 gcpbucketbrute.py -k target_keyword`. |

---

### Cloudfox

| Field | Details |
|-------|---------|
| **What it does** | AWS (and Azure) security tool focused on finding attack paths and exploitable configurations for pentesters and red teams. Enumerates: principals with privilege escalation paths, secrets accessible to compute services, cross-account trust relationships, SSRF-vulnerable metadata endpoints, exposed endpoints, and role assumption chains. More offensive than Prowler/ScoutSuite. |
| **Attack types** | Cloud privilege escalation, lateral movement, secrets discovery, attack path analysis |
| **License** | Open source (MIT) — https://github.com/BishopFox/cloudfox |
| **CLI automation** | Yes — fully CLI: `cloudfox aws all-checks -p profile-name -o json`. |

---

### Cartography

| Field | Details |
|-------|---------|
| **What it does** | Infrastructure asset inventory and relationship mapping tool. Ingests data from AWS, GCP, Azure, GitHub, Okta, Duo, PagerDuty, and more into a Neo4j graph database. Enables querying relationships across infrastructure: "which EC2 instances have internet-facing load balancers AND have secrets manager access?" Used for continuous security posture monitoring and compliance. |
| **Attack types** | Attack surface mapping, dependency risk analysis, blast radius assessment |
| **License** | Open source (Apache 2.0) — https://github.com/cartography-cncf/cartography |
| **CLI automation** | Yes — fully CLI: `cartography --neo4j-uri bolt://localhost:7687`. Scheduled via cron. Query via Neo4j Cypher API. |

---

## 6. Container & Kubernetes Security

### Falco

| Field | Details |
|-------|---------|
| **What it does** | CNCF runtime security tool for containers and Kubernetes. Uses eBPF/kernel module to monitor system calls and detect anomalous behavior at runtime: shell spawned in container, privilege escalation, unexpected network connections, sensitive file reads, and over 100 default rules. Outputs alerts to stdout, syslog, webhooks (Slack, Falcosidekick → SIEM). |
| **Attack types** | Runtime threat detection, container escape, cryptomining, lateral movement detection |
| **License** | Open source (Apache 2.0) — https://github.com/falcosecurity/falco |
| **CLI automation** | Yes — runs as daemon. `falco -r rules.yaml -o json_output=true`. Alerts streamed as JSON. Part of defensive automation pipelines. |

---

### kube-bench

| Field | Details |
|-------|---------|
| **What it does** | Checks Kubernetes clusters against CIS Kubernetes Benchmark. Tests: API server flags, controller manager settings, scheduler settings, etcd configuration, kubelet settings, RBAC policies, pod security standards, and network policies. Runs as a pod or directly on nodes. |
| **Attack types** | Kubernetes misconfiguration detection, compliance auditing |
| **License** | Open source (Apache 2.0) — https://github.com/aquasecurity/kube-bench |
| **CLI automation** | Yes — fully CLI: `kube-bench --json > results.json`. Runs as Job in Kubernetes: `kubectl apply -f job.yaml`. |

---

### kube-hunter

| Field | Details |
|-------|---------|
| **What it does** | Active Kubernetes cluster penetration testing tool. Performs passive discovery (what's exposed) and active hunting (tests for exploitable weaknesses): anonymous API access, etcd exposure, dashboard access, SSRF via metadata, privilege escalation via misconfigured RBAC, and container escape paths. |
| **Attack types** | Kubernetes attack surface enumeration, exploitation of misconfigurations |
| **License** | Open source (Apache 2.0) — https://github.com/aquasecurity/kube-hunter |
| **CLI automation** | Yes — CLI: `kube-hunter --remote target.example.com --report json`. |

---

### Checkov

| Field | Details |
|-------|---------|
| **What it does** | Static analysis for Infrastructure as Code (IaC). Analyzes Terraform, CloudFormation, Kubernetes YAML, Helm, Dockerfile, Bicep, ARM templates, Ansible, and more for security misconfigurations and compliance violations. 2,000+ built-in checks. Integrates with Prisma Cloud for policy management. |
| **Attack types** | IaC misconfiguration prevention, compliance as code, supply chain risk in infrastructure |
| **License** | Open source (Apache 2.0) — https://github.com/bridgecrewio/checkov |
| **CLI automation** | Yes — fully CLI: `checkov -d ./terraform --output json`. CI/CD integration via GitHub Actions, GitLab CI, Jenkins. |

---

### Terrascan

| Field | Details |
|-------|---------|
| **What it does** | IaC security scanner from Tenable. Scans Terraform, Kubernetes, Helm, Kustomize, Dockerfile, and CloudFormation for security violations and compliance (500+ policies for CIS, SOC2, HIPAA, PCI DSS, GDPR, NIST). Supports custom Rego policies (OPA). Can act as an admission controller in Kubernetes. |
| **Attack types** | IaC misconfiguration, policy enforcement, compliance validation |
| **License** | Open source (Apache 2.0) — https://github.com/tenable/terrascan |
| **CLI automation** | Yes — fully CLI: `terrascan scan -t terraform -o json`. Kubernetes admission webhook for real-time enforcement. |

---

### Snyk Container

| Field | Details |
|-------|---------|
| **What it does** | Container image vulnerability scanner with developer-friendly output. Scans OS packages and application dependencies in Docker images, identifies CVEs with fix availability, and suggests minimal base image alternatives. Integrates into Docker Desktop, CI/CD, and registries (ECR, GCR, Docker Hub). |
| **Attack types** | Container vulnerability management, supply chain risk |
| **License** | Commercial (free tier available for open-source projects). |
| **CLI automation** | Yes — `snyk container test image:tag --json`. CI/CD plugins for all major platforms. |

---

## 7. Mobile Security (iOS/Android)

### MobSF (Mobile Security Framework)

| Field | Details |
|-------|---------|
| **What it does** | All-in-one mobile security testing framework for static and dynamic analysis. Static: decompiles APK/IPA/APPX, analyzes permissions, hardcoded secrets, insecure API calls, weak crypto, exported activities, manifest issues. Dynamic: instruments running app (Android emulator/device), captures traffic, API calls, file system changes, and crypto operations. REST API for automated scanning. |
| **Attack types** | Mobile app reverse engineering, OWASP Mobile Top 10, data leakage, insecure communication |
| **License** | Open source (GPL v3) — https://github.com/MobSF/Mobile-Security-Framework-MobSF |
| **CLI automation** | Yes — REST API: `curl -F "file=@app.apk" http://localhost:8000/api/v1/upload`. Full scan → report pipeline scriptable. |

---

### Frida

| Field | Details |
|-------|---------|
| **What it does** | Dynamic instrumentation toolkit for iOS, Android, Windows, macOS, Linux. Injects JavaScript into running processes to hook functions, intercept calls, bypass certificate pinning, bypass root/jailbreak detection, dump memory, modify return values, and trace execution flows. Used for reverse engineering, bypassing security controls, and dynamic analysis. |
| **Attack types** | SSL pinning bypass, root/jailbreak detection bypass, runtime manipulation, API interception, mobile app reverse engineering |
| **License** | Open source (wxWindows Library Licence) — https://github.com/frida/frida |
| **CLI automation** | Yes — `frida -U -f com.app.package -l script.js`. Scripts in JavaScript/Python. Fully automatable for specific bypass tasks. |

---

### Objection

| Field | Details |
|-------|---------|
| **What it does** | Runtime mobile exploration toolkit built on Frida. Provides an interactive shell for iOS/Android without requiring jailbreak/root. Commands: SSL pinning bypass, root/jailbreak bypass, dump keychain/NSUserDefaults, list activities, bypass biometric authentication, dump memory, list loaded classes, hook methods. Simplifies common Frida use cases. |
| **Attack types** | Runtime mobile security bypass, data extraction, certificate pinning bypass |
| **License** | Open source (MIT) — https://github.com/sensepost/objection |
| **CLI automation** | Partial — interactive REPL. Can be driven by piping commands: `echo "android sslpinning disable" | objection explore`. |

---

### apktool

| Field | Details |
|-------|---------|
| **What it does** | Android APK reverse engineering tool. Decodes APK resources to near-original form, disassembles Dalvik bytecode to smali (assembly-like representation), and allows repackaging and resigning of modified APKs. Used for analyzing app logic, modifying apps for testing, and understanding obfuscated code. |
| **Attack types** | Android app reverse engineering, code analysis, APK modification for testing |
| **License** | Open source (Apache 2.0) — https://github.com/iBotPeaches/Apktool |
| **CLI automation** | Yes — fully CLI: `apktool d app.apk -o output_dir && apktool b output_dir -o modified.apk`. |

---

### jadx

| Field | Details |
|-------|---------|
| **What it does** | DEX to Java decompiler. Converts Android APK/DEX/AAR files into readable Java source code (much more readable than smali). JADX-GUI provides a searchable code browser. Useful for finding hardcoded secrets, understanding business logic, identifying vulnerable code paths, and locating API endpoints in mobile apps. |
| **Attack types** | Android source code analysis, secret discovery, vulnerability research |
| **License** | Open source (Apache 2.0) — https://github.com/skylot/jadx |
| **CLI automation** | Yes — `jadx -d output_dir app.apk`. Grep over output for secrets/endpoints. |

---

### Drozer

| Field | Details |
|-------|---------|
| **What it does** | Android security assessment framework. Tests attack surface of Android apps from the perspective of an installed malicious app. Modules for: exported activity/provider/service/receiver enumeration and exploitation, SQL injection in Content Providers, intent-based attacks, path traversal, and more. Requires Drozer agent installed on device. |
| **Attack types** | Android IPC abuse, exported component exploitation, Content Provider attacks |
| **License** | Open source (BSD) — https://github.com/WithSecureLabs/drozer |
| **CLI automation** | Partial — interactive console. Scriptable via `drozer console connect --command "run module"`. |

---

## 8. Network Attacks

### Wireshark

| Field | Details |
|-------|---------|
| **What it does** | Industry-standard network protocol analyzer. Captures and interactively dissects 3,000+ protocols in real time. Used for traffic analysis, troubleshooting, credential capture on unencrypted protocols, certificate inspection, and understanding application behavior over the network. `tshark` is the CLI version. |
| **Attack types** | Traffic analysis, credential interception (cleartext protocols), MITM verification, protocol reverse engineering |
| **License** | Open source (GPL v2) — https://github.com/wireshark/wireshark |
| **CLI automation** | Yes — `tshark -i eth0 -w capture.pcap` and `tshark -r capture.pcap -T json`. Fully scriptable for automated traffic capture and analysis. |

---

### tcpdump

| Field | Details |
|-------|---------|
| **What it does** | Lightweight CLI packet capture tool. Captures network traffic with BPF (Berkeley Packet Filter) expressions for precise filtering. Lower overhead than Wireshark, ideal for remote servers/containers where GUI is unavailable. Outputs PCAP files for later analysis. |
| **Attack types** | Traffic capture, credential interception, debugging |
| **License** | Open source (BSD) — https://github.com/the-tcpdump-group/tcpdump |
| **CLI automation** | Yes — fully CLI: `tcpdump -i any -w output.pcap 'port 80 or port 443'`. Core component in network security automation. |

---

### Ettercap

| Field | Details |
|-------|---------|
| **What it does** | Comprehensive MITM attack suite for LAN environments. Performs ARP poisoning, DNS spoofing, ICMP redirect attacks, passive OS fingerprinting, and protocol dissection for credential capture (FTP, HTTP, POP3, SSH1, etc.). Plugin architecture for extensibility. GUI and text-mode interfaces. |
| **Attack types** | ARP poisoning, MITM, DNS spoofing, credential interception, session hijacking |
| **License** | Open source (GPL v2) — https://github.com/Ettercap/ettercap |
| **CLI automation** | Partial — text mode: `ettercap -T -i eth0 -M arp:remote /target1/ /target2/`. Largely replaced by Bettercap for modern use. |

---

### Bettercap

| Field | Details |
|-------|---------|
| **What it does** | Modern, modular network attack and monitoring framework. Supersedes Ettercap. Supports WiFi attacks (deauth, probe sniffing, clients), BLE enumeration, HID injection (Bluetooth), ARP/NDP/DNS/DHCP spoofing, HTTPS downgrade (via SSL stripping), credential capture, network scanning, and TCP/UDP proxying. Includes a REST API and web UI. |
| **Attack types** | MITM, WiFi attacks, BLE attacks, credential capture, network reconnaissance |
| **License** | Open source (GPL v3) — https://github.com/bettercap/bettercap |
| **CLI automation** | Yes — caplet files (scripts): `bettercap -iface eth0 -caplet script.cap`. REST API available. |

---

### Scapy

| Field | Details |
|-------|---------|
| **What it does** | Python-based packet crafting and manipulation library. Allows building, sending, receiving, and decoding network packets at every layer. Used for: custom exploit PoC development, protocol fuzzing, network scanning, VLAN hopping, ARP cache poisoning, custom ICMP/TCP/UDP tools, and network research. |
| **Attack types** | Custom protocol attacks, packet crafting, network fuzzing, exploit PoC development |
| **License** | Open source (GPL v2) — https://github.com/secdev/scapy |
| **CLI automation** | Yes — Python API: scriptable for complex custom packet sequences. Interactive shell also available. |

---

### netcat / ncat

| Field | Details |
|-------|---------|
| **What it does** | The "Swiss-army knife" of networking. Creates TCP/UDP connections, listens on ports, transfers files, and creates reverse/bind shells. `ncat` (Nmap's version) adds SSL, access control, brokering, and exec modes. Fundamental for: reverse shell handlers, port forwarding, pivoting, file transfers, banner grabbing. |
| **Attack types** | Reverse/bind shells, port forwarding, data exfiltration, pivoting |
| **License** | Open source. Part of Nmap project (ncat). |
| **CLI automation** | Yes — fully CLI. Core component of exploit delivery and shell handling in automated pipelines. |

---

### socat

| Field | Details |
|-------|---------|
| **What it does** | Advanced bidirectional data relay between two data channels (sockets, files, pipes, serial ports). More powerful than netcat for: SSL-wrapped shells, full PTY upgrades (fully interactive shell), complex port forwarding chains, UNIX socket proxying, and IPv6. |
| **Attack types** | Reverse shells with full TTY, SSL tunneling, complex pivoting, port forwarding |
| **License** | Open source (GPL v2) — http://www.dest-unreach.org/socat/ |
| **CLI automation** | Yes — fully CLI: `socat TCP-LISTEN:4444,reuseaddr,fork EXEC:/bin/bash,pty,stderr`. Core tool in post-exploitation automation. |

---

## 9. OSINT Advanced

### Maltego

| Field | Details |
|-------|---------|
| **What it does** | Visual link analysis platform for OSINT. Transforms entities (person, company, domain, IP, email, phone) into related entities using 300+ data source integrations (Shodan, VirusTotal, HaveIBeenPwned, LinkedIn, PassiveDNS, Certificate Transparency, etc.). Builds relationship graphs for investigation and attack surface mapping. |
| **Attack types** | Target profiling, infrastructure mapping, social engineering preparation, supply chain mapping |
| **License** | Commercial (Community free with limits, Pro ~$999/yr). |
| **CLI automation**| Partial — iTDS (Transform Distribution Server) API. Maltego CLI available in some editions. Primarily a GUI investigation tool. |

---

### SpiderFoot

| Field | Details |
|-------|---------|
| **What it does** | Automated OSINT framework with 200+ modules. Aggregates data from DNS, WHOIS, Shodan, Have I Been Pwned, VirusTotal, Censys, Pastebin, dark web sources, social media, certificate transparency, and more. Identifies email addresses, IP ranges, subdomains, credentials, leaked data, social profiles, and relationships. Web UI + CLI. |
| **Attack types** | Reconnaissance, target profiling, credential exposure discovery, infrastructure mapping |
| **License** | Open source (MIT) — https://github.com/smicallef/spiderfoot |
| **CLI automation** | Yes — `spiderfoot -s target.com -t all -o json -q`. REST API available. Headless scanning supported. |

---

### Recon-ng

| Field | Details |
|-------|---------|
| **What it does** | Full-featured web reconnaissance framework inspired by Metasploit. Modular marketplace of recon modules for: DNS enumeration, WHOIS, Shodan/Censys lookups, GitHub dorking, LinkedIn harvesting, email harvesting, breach data lookups, and certificate transparency. Stores results in SQLite for correlation. |
| **Attack types** | Reconnaissance, email harvesting, infrastructure mapping, breach data correlation |
| **License** | Open source (BSD 3-Clause) — https://github.com/lanmaster53/recon-ng |
| **CLI automation** | Yes — resource files for scripted workflows: `recon-ng -w workspace -r script.rc`. REST API available. |

---

### Shodan

| Field | Details |
|-------|---------|
| **What it does** | Search engine for internet-connected devices. Indexes banners from ports 21, 22, 23, 25, 80, 443, 8080, etc. Enables querying by product, version, org, country, port, CVE, SSL cert, hostname, and more. Exposes: exposed industrial control systems, default-credential devices, vulnerable services, misconfigured databases, open webcams, and internet-facing infrastructure. |
| **Attack types** | External attack surface discovery, vulnerable service identification, IoT/OT exposure |
| **License** | Commercial (API key required; free tier available). |
| **CLI automation** | Yes — `shodan search "hostname:target.com" --fields ip_str,port,org --limit 100 -O json`. `shodan` CLI tool. Python API (shodan library). Fully scriptable. |

---

### Censys

| Field | Details |
|-------|---------|
| **What it does** | Internet-wide scanning platform. Performs continuous scanning of IPv4 space and certificate transparency logs. Query language (CQL) enables finding hosts by service, protocol, TLS certificate, ASN, and more. Better than Shodan for certificate-based discovery and IPv6. Used for attack surface management and vulnerability research. |
| **Attack types** | External asset discovery, certificate-based enumeration, exposed service detection |
| **License** | Commercial (free research tier). |
| **CLI automation** | Yes — `censys` Python CLI and SDK. Fully scriptable queries. |

---

### FOFA

| Field | Details |
|-------|---------|
| **What it does** | Chinese internet asset search engine (by WhiteHat). Similar to Shodan but with broader coverage of Asian IP space. Query language supports: protocol, banner, cert, title, body, icon hash, country, and more. Used in APT tracking and discovering assets missed by Shodan/Censys. |
| **Attack types** | Global attack surface discovery, APT infrastructure tracking, asset enumeration |
| **License** | Commercial (API key, some free queries). |
| **CLI automation** | Yes — REST API: `curl "https://fofa.info/api/v1/search/all?email=...&key=...&qbase64=..."`. Python SDK available. |

---

### Hunter.io

| Field | Details |
|-------|---------|
| **What it does** | Email address discovery service. Finds email addresses associated with a domain using public sources (LinkedIn, company websites, mail headers, web crawling). Returns email format patterns and verified addresses. Used in phishing target enumeration and social engineering preparation. |
| **Attack types** | Email harvesting, phishing target enumeration, social engineering |
| **License** | Commercial (free tier: 25 searches/month). |
| **CLI automation** | Yes — REST API: `curl "https://api.hunter.io/v2/domain-search?domain=target.com&api_key=..."`. Python/CLI wrappers available. |

---

### Holehe

| Field | Details |
|-------|---------|
| **What it does** | Checks if an email address is registered on 120+ websites (Twitter, Instagram, GitHub, Spotify, Adobe, etc.) using password reset flows without sending emails. Used for OSINT to determine what services a target uses, building profiles, and identifying accounts for social engineering or credential stuffing targeting. |
| **Attack types** | Target profiling, account enumeration, OSINT |
| **License** | Open source (MIT) — https://github.com/megadose/holehe |
| **CLI automation** | Yes — fully CLI: `holehe target@email.com --only-used --json`. |

---

## 10. Social Engineering

### SET (Social Engineering Toolkit)

| Field | Details |
|-------|---------|
| **What it does** | The premier social engineering framework. Features: spear-phishing email campaigns, credential harvester (clone any website for credential capture), Metasploit payload integration, QR code attacks, wireless access point attacks, HID attack vectors (USB/BadUSB payloads), SMS spoofing, and more. Pre-installed in Kali Linux. |
| **Attack types** | Phishing, credential harvesting, payload delivery, USB/HID attacks |
| **License** | Open source (BSD) — https://github.com/trustedsec/social-engineer-toolkit |
| **CLI automation** | Partial — interactive menu but CLI automation possible via input redirection. Specific modules (credential harvester) have headless modes. |

---

### Gophish

| Field | Details |
|-------|---------|
| **What it does** | Open-source phishing simulation platform. Manages phishing campaigns: create email templates, landing pages, target lists, SMTP profiles. Tracks opened emails, clicked links, submitted credentials in real time. REST API for full campaign management. Used for security awareness training and authorized phishing assessments. |
| **Attack types** | Phishing simulation, credential harvesting, user security awareness assessment |
| **License** | Open source (MIT) — https://github.com/gophish/gophish |
| **CLI automation** | Yes — full REST API. Campaign creation, launch, results retrieval all scriptable. |

---

### Evilginx2

| Field | Details |
|-------|---------|
| **What it does** | Man-in-the-middle phishing framework that bypasses 2FA. Acts as a reverse proxy between the victim and the legitimate site, capturing session cookies after authentication (including post-2FA). Phishlets define proxy configuration for specific sites (Microsoft 365, Google, GitHub, etc.). Captures session tokens, not just credentials, enabling account takeover even with TOTP/push 2FA. |
| **Attack types** | Phishing with 2FA bypass, session token capture, account takeover |
| **License** | Open source (BSD 3-Clause) — https://github.com/kgretzky/evilginx2 |
| **CLI automation** | Partial — interactive shell. Phishlet and lure configuration is manual; session capture is automated once running. |

---

## 11. Forensics & Incident Response

### Volatility (Memory Forensics)

| Field | Details |
|-------|---------|
| **What it does** | Industry-standard memory forensics framework. Analyzes RAM dumps to extract: running processes, network connections, loaded DLLs, injected code, registry hives, user credentials (LSASS), encryption keys, command history, clipboard, browser artifacts, malware indicators, and rootkit artifacts. Supports Windows, Linux, macOS memory images. Volatility 3 is the current version. |
| **Attack types** | Incident response, malware analysis, credential extraction from memory, rootkit detection |
| **License** | Open source (Volatility Software License / GPL v2) — https://github.com/volatilityfoundation/volatility3 |
| **CLI automation** | Yes — fully CLI: `python3 vol.py -f memory.dmp windows.pslist`. Plugin outputs parseable as JSON/CSV. |

---

### Autopsy

| Field | Details |
|-------|---------|
| **What it does** | Digital forensics platform (GUI frontend for The Sleuth Kit). Analyzes disk images, mobile devices, and live systems. Features: file system analysis, keyword search, deleted file recovery, email extraction, web artifact recovery (browser history, downloads, cookies), timeline analysis, EXIF metadata extraction, hash filtering, and report generation. Used by law enforcement and IR teams. |
| **Attack types** | Disk forensics, evidence recovery, incident investigation, malware artifact analysis |
| **License** | Open source (Apache 2.0) — https://github.com/sleuthkit/autopsy |
| **CLI automation** | Partial — Autopsy has a CLI mode for automated ingest with modules. Primarily GUI-oriented for analysis. The Sleuth Kit (`tsk_*` tools) are fully CLI. |

---

### FTK Imager

| Field | Details |
|-------|---------|
| **What it does** | Forensic imaging and triage tool by AccessData/Exterro. Creates forensic images (E01, AFF, raw DD) of disks, volumes, and RAM. Previews file systems, recovers deleted files, mounts forensic images, generates hash verification (MD5/SHA-1). Widely accepted for court-admissible evidence collection. |
| **Attack types** | Evidence acquisition, disk imaging, memory capture, chain of custody preservation |
| **License** | Free (closed source). Windows only. |
| **CLI automation** | Partial — `ftkimager.exe` CLI supports image creation: `ftkimager \\.\PhysicalDrive0 output.img --verify`. Limited scriptability. |

---

### Velociraptor

| Field | Details |
|-------|---------|
| **What it does** | Advanced DFIR (Digital Forensics and Incident Response) platform. Deploys lightweight agents across endpoints for: live forensic artifact collection (using VQL — Velociraptor Query Language), threat hunting at scale, process/network/file monitoring, memory acquisition, log collection, IOC sweeping, and automated response actions. Scales to 100,000+ endpoints. |
| **Attack types** | Threat hunting, IR triage, IOC sweeping, endpoint forensics, automated response |
| **License** | Open source (AGPL v3) — https://github.com/Velocidex/velociraptor |
| **CLI automation** | Yes — `velociraptor query "SELECT * FROM pslist()" --format json`. VQL notebooks and server-side scheduled queries enable full automation. |

---

## 12. Threat Intelligence & Monitoring

### MISP (Malware Information Sharing Platform)

| Field | Details |
|-------|---------|
| **What it does** | Open-source threat intelligence platform for sharing, storing, and correlating Indicators of Compromise (IoCs), TTPs, and threat actor profiles. Supports STIX/TAXII, OpenIOC, MITRE ATT&CK mappings, feeds from 100+ sources (FS-ISAC, US-CERT, community feeds). Used by CERTs, SOCs, and ISACs for collaborative threat intel. |
| **Attack types** | Threat intelligence management, IoC correlation, threat actor tracking |
| **License** | Open source (AGPL v3) — https://github.com/MISP/MISP |
| **CLI automation** | Yes — full REST API. PyMISP library for Python automation. Feed sync, event creation, attribute search all scriptable. |

---

### OpenCTI

| Field | Details |
|-------|---------|
| **What it does** | Open Cyber Threat Intelligence platform. Structures threat intelligence using STIX 2.1 data model in a graph database (ElasticSearch + Redis). Integrates with MISP, VirusTotal, Shodan, MITRE ATT&CK, and 100+ connectors. Provides relationship graphs between threat actors, campaigns, malware, vulnerabilities, and TTPs. |
| **Attack types** | Threat actor profiling, campaign tracking, malware attribution, TTP analysis |
| **License** | Open source (Apache 2.0) — https://github.com/OpenCTI-Platform/opencti |
| **CLI automation** | Yes — GraphQL API. Python client library (`pycti`). Connector framework for automated ingestion/enrichment. |

---

### TheHive

| Field | Details |
|-------|---------|
| **What it does** | Open-source Security Incident Response Platform (SIRP). Manages security incidents and alerts: case management, task tracking, IOC management, analyst collaboration, alert ingestion from SIEM/MISP/email. Integrates with Cortex for automated analysis/response. REST API for SOAR integration. Used by SOC teams for structured IR. |
| **Attack types** | Incident management, alert triage, case documentation, response coordination |
| **License** | Open source (AGPL v3) — https://github.com/TheHive-Project/TheHive |
| **CLI automation** | Yes — full REST API. `TheHive4py` Python library. Alert ingestion, case creation, task automation all scriptable. |

---

### Cortex

| Field | Details |
|-------|---------|
| **What it does** | Observable analysis and active response engine, companion to TheHive. Runs analyzers (one-way analysis: VirusTotal, Shodan, MISP lookup, PassiveDNS, etc.) and responders (actions: block IP in firewall, kill process, quarantine endpoint) on observables. 200+ built-in analyzers. |
| **Attack types** | Automated IOC enrichment, automated incident response actions |
| **License** | Open source (AGPL v3) — https://github.com/TheHive-Project/Cortex |
| **CLI automation** | Yes — REST API for running analyzers and retrieving reports. Fully integrated with TheHive SOAR workflows. |

---

## 13. WAF Bypass & Evasion

### wafw00f

| Field | Details |
|-------|---------|
| **What it does** | WAF detection and fingerprinting tool. Identifies which WAF product (Cloudflare, AWS WAF, Imperva, F5 Big-IP, Akamai, Barracuda, etc.) is protecting a target by analyzing HTTP responses to crafted requests. Supports 180+ WAF fingerprints. |
| **Attack types** | Pre-attack reconnaissance, WAF identification for bypass planning |
| **License** | Open source (BSD 2-Clause) — https://github.com/EnableSecurity/wafw00f |
| **CLI automation** | Yes — fully CLI: `wafw00f https://target.com -o json`. Integrates into recon pipelines. |

---

### bypass-403

| Field | Details |
|-------|---------|
| **What it does** | Tool for bypassing 403 Forbidden responses. Tests techniques: HTTP method variations (GET→POST, PUT, HEAD), URL path manipulation (`//path`, `/./path`, `%2f`), header injection (`X-Original-URL`, `X-Rewrite-URL`, `X-Forwarded-For: 127.0.0.1`), case manipulation, and extension appending. Useful when endpoints return 403 to direct access but may respond to crafted requests. |
| **Attack types** | Access control bypass, authorization testing |
| **License** | Open source — https://github.com/iamj0ker/bypass-403 |
| **CLI automation** | Yes — fully CLI. Outputs responses for analysis. |

---

### Nuclei WAF Bypass Templates

| Field | Details |
|-------|---------|
| **What it does** | Community-contributed Nuclei templates specifically designed to test WAF bypass techniques, including header manipulation, encoding variations, HTTP smuggling, cache poisoning, and evasion of specific WAF products. Run as part of nuclei template collections. |
| **Attack types** | WAF evasion, access control testing, HTTP request smuggling |
| **License** | Open source (MIT) — part of https://github.com/projectdiscovery/nuclei-templates |
| **CLI automation** | Yes — `nuclei -t waf-bypass/ -u https://target.com`. Fully integrated with nuclei automation. |

---

## 14. API Security Specialized

### GraphQL Voyager

| Field | Details |
|-------|---------|
| **What it does** | Visual introspection tool for GraphQL APIs. Converts GraphQL introspection results into an interactive relationship graph showing all types, queries, mutations, subscriptions, and their connections. Used to understand API structure and identify over-exposed fields, sensitive relationships, and attack vectors in GraphQL schemas. |
| **Attack types** | GraphQL attack surface mapping, introspection-based reconnaissance |
| **License** | Open source (MIT) — https://github.com/graphql-kit/graphql-voyager |
| **CLI automation** | Partial — web-based tool. Introspection queries are automatable; visualization requires browser. Can script introspection + analysis with InQL or clairvoyance instead. |

---

### Arjun

| Field | Details |
|-------|---------|
| **What it does** | HTTP parameter discovery tool. Identifies hidden/undocumented GET/POST/JSON/XML parameters on web endpoints by testing wordlists and analyzing response variations. Useful for finding debug parameters, admin parameters, and hidden functionality not in API documentation. |
| **Attack types** | Hidden parameter discovery, attack surface expansion, mass assignment testing |
| **License** | Open source (MIT) — https://github.com/s0md3v/Arjun |
| **CLI automation** | Yes — fully CLI: `arjun -u https://target.com/api -m POST --output-file params.json`. |

---

### ParamSpider

| Field | Details |
|-------|---------|
| **What it does** | Mining parameters from web archives (Wayback Machine, CommonCrawl). Extracts URLs with parameters from archived snapshots of a target domain, useful for finding forgotten endpoints, legacy parameters, and testing surfaces that may no longer be linked but are still live. |
| **Attack types** | Historical attack surface discovery, parameter-based vulnerability hunting (XSS, SQLi, SSRF on archived params) |
| **License** | Open source (MIT) — https://github.com/devanshbatham/ParamSpider |
| **CLI automation** | Yes — fully CLI: `paramspider -d target.com`. Outputs URL list for downstream tools. |

---

### Katana

| Field | Details |
|-------|---------|
| **What it does** | Fast, configurable web crawler by ProjectDiscovery. Crawls web apps to discover all endpoints, forms, JavaScript-rendered paths, and API calls. Supports headless browser mode (Chromium) for JS-heavy SPAs, custom field extraction, scope control, and output filtering. Produces a comprehensive endpoint inventory for downstream testing. |
| **Attack types** | Endpoint discovery, attack surface mapping, JavaScript analysis |
| **License** | Open source (MIT) — https://github.com/projectdiscovery/katana |
| **CLI automation** | Yes — fully CLI: `katana -u https://target.com -jc -o endpoints.txt`. Headless mode: `-headless`. Integrates natively with the ProjectDiscovery toolkit. |

---

## 15. Fuzzing

### AFL++ (American Fuzzy Lop++)

| Field | Details |
|-------|---------|
| **What it does** | State-of-the-art coverage-guided fuzzer for binary and source-available targets. Uses genetic algorithms and instrumentation to mutate inputs and maximize code coverage. Features: persistent mode, in-process fuzzing, custom mutators, QEMU mode (black-box binary fuzzing), LTO instrumentation, cmplog (log comparison operations for smarter mutations), parallelization, and crash triage. Finds memory corruption bugs, crashes, and undefined behavior. |
| **Attack types** | Memory corruption discovery (buffer overflows, UAFs, null dereferences), RCE vulnerability research, format string bugs |
| **License** | Open source (Apache 2.0) — https://github.com/AFLplusplus/AFLplusplus |
| **CLI automation** | Yes — fully CLI: `afl-fuzz -i inputs/ -o findings/ -- ./target @@`. Automated crash corpus collection. |

---

### libFuzzer

| Field | Details |
|-------|---------|
| **What it does** | In-process, coverage-guided fuzzer from LLVM. Compiled directly into the target library. Target writes a `LLVMFuzzerTestOneInput` function; libFuzzer handles mutation, coverage tracking, and corpus management. Integrates with AddressSanitizer, MemorySanitizer, and UBSanitizer for immediate crash detection. Used in Google's OSS-Fuzz program. |
| **Attack types** | Memory safety vulnerabilities in C/C++ libraries, parser bugs, cryptographic implementation flaws |
| **License** | Open source (Apache 2.0 / LLVM) |
| **CLI automation** | Yes — compiled into target: `./target_fuzzer corpus/ -max_total_time=3600`. Part of CI via OSS-Fuzz integration. |

---

### Atheris

| Field | Details |
|-------|---------|
| **What it does** | Coverage-guided Python fuzzing engine by Google, backed by libFuzzer. Fuzzes native Python code, C extensions, and Python-wrapped C/C++ libraries. Finds: exceptions, crashes, type errors, and logic bugs in Python code. Supports hypothesis-style fuzz targets. |
| **Attack types** | Python library vulnerability research, parser fuzzing, input validation bugs |
| **License** | Open source (Apache 2.0) — https://github.com/google/atheris |
| **CLI automation** | Yes — Python script with `atheris.Setup` and `atheris.Fuzz()`. Runs as a CLI process. |

---

### RESTler

| Field | Details |
|-------|---------|
| **What it does** | Stateful REST API fuzzer from Microsoft Research. Automatically infers API dependencies from OpenAPI/Swagger specifications, then generates and sequences requests to test multi-step flows (create → use → delete). Detects: 500 errors, resource leaks, unhandled exceptions, and logic errors. First fuzzer specifically designed for stateful REST API security testing. |
| **Attack types** | REST API logic flaws, injection via API parameters, unhandled error exposure, stateful sequence bugs |
| **License** | Open source (MIT) — https://github.com/microsoft/restler-fuzzer |
| **CLI automation** | Yes — fully CLI: `python3 Restler.py fuzz --api_spec openapi.json`. Results in JSON logs. |

---

## 16. Blockchain/Smart Contract Security

### Slither

| Field | Details |
|-------|---------|
| **What it does** | Static analysis framework for Solidity smart contracts by Trail of Bits. Runs 100+ detectors for: reentrancy, integer overflow/underflow, unchecked return values, arbitrary send ETH, access control issues, timestamp dependency, tx.origin authentication, and more. Also provides code understanding (inheritance graph, function summaries) and allows custom detector development in Python. |
| **Attack types** | Smart contract vulnerability detection, reentrancy, access control flaws, logic bugs |
| **License** | Open source (AGPL v3) — https://github.com/crytic/slither |
| **CLI automation** | Yes — fully CLI: `slither contract.sol --json results.json`. Integrates into CI/CD for continuous contract auditing. |

---

### Mythril

| Field | Details |
|-------|---------|
| **What it does** | Security analysis tool for EVM bytecode using symbolic execution (concolic analysis with Z3 solver). Analyzes Solidity source or compiled bytecode for: integer overflow, reentrancy, unchecked CALL return values, delegatecall to user-controlled address, predictable random numbers, timestamp dependency, and more. Can test deployed contracts on mainnet/testnet. |
| **Attack types** | Smart contract exploit discovery via symbolic execution, on-chain vulnerability analysis |
| **License** | Open source (MIT) — https://github.com/Consensys/mythril |
| **CLI automation** | Yes — fully CLI: `myth analyze contract.sol --solv 0.8.0 -o json`. Integrates with MythX platform for CI/CD. |

---

### Echidna

| Field | Details |
|-------|---------|
| **What it does** | Smart contract fuzzer by Trail of Bits. Property-based fuzzer for Solidity/Vyper contracts. User writes invariants (properties that should always hold), and Echidna fuzzes transaction sequences trying to violate them. Finds: arithmetic issues, state corruption, access control bypasses, and logic errors that static analysis misses. Uses coverage-guided mutation. |
| **Attack types** | Smart contract property violation, business logic bugs, invariant breaking |
| **License** | Open source (AGPL v3) — https://github.com/crytic/echidna |
| **CLI automation** | Yes — fully CLI: `echidna contract.sol --config config.yaml --format json`. |

---

## 17. CLI Automation Analysis

### Tools That Are Fully Automatable in a CLI Pipeline

These tools have complete CLI interfaces, structured output (JSON/CSV/XML), and can run headlessly without human interaction:

| Tool | Automation Confidence | Notes |
|------|----------------------|-------|
| Nessus Pro | High | Full REST API, CLI scan management |
| Prowler | High | Purpose-built for CI/CD |
| ScoutSuite | High | Full CLI, JSON output |
| Cloudfox | High | Full CLI, JSON output |
| Checkov | High | Native CI/CD integration |
| Terrascan | High | Admission controller mode |
| kube-bench | High | Runs as K8s Job |
| kube-hunter | High | JSON output CLI |
| Trivy | High (already covered) | — |
| Hashcat | High | Fully scriptable with exit codes |
| John the Ripper | High | Fully scriptable |
| Hydra | High | Fully scriptable |
| Medusa | High | Fully scriptable |
| CrackMapExec/NetExec | High | JSON output, subnet scanning |
| Impacket suite | High | All Python CLI scripts |
| SharpHound/BloodHound.py | High | CLI data collection |
| tshark (Wireshark CLI) | High | Fully scriptable packet analysis |
| tcpdump | High | Core network capture tool |
| Scapy | High | Python library, fully scriptable |
| SpiderFoot | High | REST API + CLI headless mode |
| Recon-ng | High | Resource file scripting |
| Shodan CLI | High | Fully scriptable API |
| Censys CLI | High | Python SDK |
| FOFA API | High | REST API scriptable |
| Hunter.io API | High | REST API |
| Holehe | High | CLI JSON output |
| wafw00f | High | CLI JSON output |
| bypass-403 | High | CLI tool |
| Arjun | High | CLI JSON output |
| ParamSpider | High | CLI output |
| Katana | High | CLI, ProjectDiscovery ecosystem |
| MobSF | High | Full REST API |
| Frida | High | Script-based, CLI-driven |
| apktool | High | Fully CLI |
| jadx | High | Fully CLI |
| Volatility 3 | High | Fully CLI, JSON output |
| Velociraptor | High | VQL scripting, REST API |
| MISP | High | PyMISP automation |
| OpenCTI | High | GraphQL API |
| TheHive | High | REST API / Python library |
| Slither | High | Fully CLI, JSON output |
| Mythril | High | Fully CLI, JSON output |
| Echidna | High | Fully CLI, JSON output |
| AFL++ | High | Fully CLI |
| libFuzzer | High | Compiled into target |
| Atheris | High | Python script |
| RESTler | High | Fully CLI |
| Gophish | High | Full REST API for campaign management |
| Metasploit | High | msfconsole resource scripts, msfrpc API |
| Empire | High | REST API headless mode |
| Sliver C2 | High | gRPC API |
| netcat/ncat | High | Core shell scripting primitive |
| socat | High | Core shell scripting primitive |
| Snyk Container | High | CLI + CI/CD plugins |

---

### Tools That Require Human Interaction (GUI-Dependent or Interactive)

These tools have GUI components or interactive workflows that are difficult to fully automate:

| Tool | Automation Level | Reason |
|------|-----------------|--------|
| Burp Suite Pro | Partial | Scanner scriptable via API; full testing (manual logic testing, auth flows) requires GUI |
| Cobalt Strike | Partial | Aggressor Script automates some tasks; team server requires operator decisions |
| Havoc C2 | Partial | GUI teamserver; limited headless scripting |
| Evilginx2 | Partial | Phishlet configuration is manual; requires domain setup and operator judgment |
| BeEF | Partial | Hook injection via XSS requires manual trigger; module execution can be API-driven |
| BloodHound (analysis) | Partial | Data collection is automated; attack path analysis and decision-making uses GUI |
| Maltego | Partial | Link analysis and investigation is primarily visual/GUI |
| Cobalt Strike | Partial | Team server requires live operator; Aggressor scripting helps but not fully headless |
| Autopsy | Partial | `tsk_*` CLI tools automate extraction; deep analysis requires GUI |
| FTK Imager | Partial | CLI imaging supported; evidence review is GUI |
| Ettercap | Partial | Largely replaced by Bettercap; GUI mode used for complex MITM setups |
| Drozer | Partial | Interactive console; limited scripting support |
| Objection | Partial | Interactive REPL; some automation via piping |
| Evil-WinRM | Partial | Interactive shell; specific commands can be run non-interactively |
| Qualys | Partial | Full API exists but enterprise setup and policy tuning is GUI-driven |
| Invicti/Acunetix | Partial | REST API for scheduling; scan policy configuration typically GUI |
| HCL AppScan | Partial | CLI for SAST; DAST desktop version (AppScan Standard) is GUI |
| Checkmarx | Partial | CxCLI for scan submission; results triage and audit management in GUI |
| Veracode | Partial | Pipeline Scan CLI; full platform management in GUI |
| Maltego | Low | Investigation and link analysis is fundamentally visual |
| GraphQL Voyager | Low | Web-based visualization tool only; use InQL/clairvoyance for CLI automation |
| Mimikatz | Partial | Fully CLI, but requires interactive session on target Windows host |
| Responder | Partial | Daemon mode scriptable; requires network position that can't be automated into |
| SET | Partial | Interactive menu; specific attacks (credential harvester) have semi-headless modes |
| Bettercap | Partial | Caplet scripting helps; WiFi/BLE attacks require physical proximity |

---

### Design Recommendation for Vanguard CLI

When designing automated security pipelines, prioritize tools in the **High automation confidence** tier. For tools that are only **Partial**, wrap them in one of these patterns:

1. **API-first integration** — Burp Suite Pro, Nessus, Invicti all have REST APIs. Integrate via API calls rather than driving the GUI.
2. **Data collection only** — Use SharpHound/BloodHound.py for collection, skip the GUI visualization in CLI output; parse Neo4j Cypher queries programmatically.
3. **One-shot execution** — Tools like Mimikatz, Hashcat, Metasploit resource scripts can be invoked once with predetermined inputs; avoid interactive loops.
4. **Deferred human review** — Generate structured JSON output from all automated tools; flag items requiring human review rather than blocking the pipeline.

---

*Last updated: April 2026 | Maintained as part of the Vanguard Security CLI project*

# Vanguard Security CLI — Tools Reference Guide 2026

**Last updated:** April 2026  
**Purpose:** Comprehensive reference for all security tools integrated into Vanguard CLI  
**Frameworks covered:** OSCP, CEH, OWASP Top 10, PortSwigger 31 categories, PTES methodology, MITRE ATT&CK

---

## Table of Contents

1. [Framework Reference](#framework-reference)
2. [Recon / OSINT Tools](#1-recon--osint-tools)
3. [Secrets & Code Analysis (SAST)](#2-secrets--code-analysis-sast)
4. [Dependency Scanning (SCA)](#3-dependency-scanning-sca)
5. [Web Vulnerability Scanning (DAST)](#4-web-vulnerability-scanning-dast)
6. [SSL/TLS Analysis](#5-ssltls-analysis)
7. [Header Analysis](#6-header-analysis)
8. [JWT Testing](#7-jwt-testing)
9. [API Testing](#8-api-testing)
10. [Reporting](#9-reporting-tools)
11. [Framework Coverage Mapping Tables](#framework-coverage-mapping-tables)

---

## Framework Reference

### OWASP Top 10:2021

| ID | Category |
|----|----------|
| A01 | Broken Access Control |
| A02 | Cryptographic Failures |
| A03 | Injection |
| A04 | Insecure Design |
| A05 | Security Misconfiguration |
| A06 | Vulnerable and Outdated Components |
| A07 | Identification and Authentication Failures |
| A08 | Software and Data Integrity Failures |
| A09 | Security Logging and Monitoring Failures |
| A10 | Server-Side Request Forgery (SSRF) |

### PortSwigger Web Security Academy — 31 Topic Categories

**Server-Side:**
SQL Injection, Authentication, Path Traversal, Command Injection, Business Logic Vulnerabilities, Information Disclosure, Access Control, File Upload Vulnerabilities, Race Conditions, SSRF, XXE Injection, NoSQL Injection, API Testing, Web Cache Deception

**Client-Side:**
Cross-Site Scripting (XSS), CSRF, CORS, Clickjacking, DOM-Based Vulnerabilities, WebSockets

**Advanced:**
Insecure Deserialization, Web LLM Attacks, GraphQL API Vulnerabilities, Server-Side Template Injection (SSTI), Web Cache Poisoning, HTTP Host Header Attacks, HTTP Request Smuggling, OAuth Authentication, JWT Attacks, Prototype Pollution, Essential Skills

### PTES — 7 Phases

| Phase | Description |
|-------|-------------|
| 1. Pre-Engagement | Scoping, rules of engagement, NDAs |
| 2. Intelligence Gathering | OSINT, passive/active recon |
| 3. Threat Modeling | Asset mapping, attack surface analysis |
| 4. Vulnerability Analysis | Scanning, enumeration, identification |
| 5. Exploitation | Active exploitation of vulnerabilities |
| 6. Post-Exploitation | Persistence, lateral movement, data exfiltration |
| 7. Reporting | Findings documentation, remediation guidance |

### MITRE ATT&CK Enterprise — 14 Tactics

| Tactic | ID |
|--------|----|
| Reconnaissance | TA0043 |
| Resource Development | TA0042 |
| Initial Access | TA0001 |
| Execution | TA0002 |
| Persistence | TA0003 |
| Privilege Escalation | TA0004 |
| Defense Evasion | TA0005 |
| Credential Access | TA0006 |
| Discovery | TA0007 |
| Lateral Movement | TA0008 |
| Collection | TA0009 |
| Command and Control | TA0011 |
| Exfiltration | TA0010 |
| Impact | TA0040 |

---

## 1. Recon / OSINT Tools

---

### nmap

| Property | Details |
|----------|---------|
| **What it does** | Network port scanner that discovers hosts, services, OS fingerprints, and running software versions |
| **Frameworks** | OSCP (core tool), CEH, PTES Phase 2 & 4, MITRE TA0043 Reconnaissance, TA0007 Discovery |
| **Install (brew)** | `brew install nmap` |
| **Install (apt)** | `sudo apt install nmap` |
| **CLI command** | `nmap -sV -sC -oX output.xml <target>` |
| **Output format** | XML (native), text, grepable; JSON via nmap2json post-processing |
| **Node.js via child_process** | Yes — spawn nmap, parse XML output with `xml2js`; npm packages: `node-nmap`, `libnmap`, `nmap2json` |
| **License** | NPSL (Nmap Public Source License) — open source, free for non-commercial use |
| **npm wrapper** | `node-nmap` (npm), `libnmap` (npm), `nmap2json` (npm) |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 30 sec (quick) — 15 min (full service scan) |

---

### subfinder

| Property | Details |
|----------|---------|
| **What it does** | Fast passive subdomain enumeration using 50+ public APIs and certificate transparency logs |
| **Frameworks** | OSCP, CEH, PTES Phase 2, MITRE TA0043 Reconnaissance |
| **Install (go)** | `go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest` |
| **Install (brew)** | `brew install subfinder` |
| **Install (binary)** | Download from https://github.com/projectdiscovery/subfinder/releases |
| **CLI command** | `subfinder -d example.com -o subs.txt -oJ -silent` |
| **Output format** | Text (default), JSONL with `-oJ` flag |
| **Node.js via child_process** | Yes — single binary, pipe stdout for line-by-line subdomains |
| **License** | MIT |
| **npm wrapper** | None official |
| **Single binary** | Yes (Go binary) |
| **Needs Docker** | No |
| **Approx scan time** | 30 sec — 3 min (passive) |

---

### amass

| Property | Details |
|----------|---------|
| **What it does** | Comprehensive attack surface mapping combining passive OSINT and active DNS enumeration |
| **Frameworks** | OSCP, CEH, PTES Phase 2 & 3, MITRE TA0043, OWASP — Information Disclosure |
| **Install (brew)** | `brew install amass` |
| **Install (apt)** | `sudo apt install amass` |
| **Install (binary)** | `wget https://github.com/owasp-amass/amass/releases/latest/download/amass_linux_amd64.zip` |
| **CLI command** | `amass enum -passive -d example.com -json output.json` |
| **Output format** | Text, JSON (`-json`), GraphDB |
| **Node.js via child_process** | Yes — binary with JSON output flag |
| **License** | Apache 2.0 (OWASP project) |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 5 — 30 min (passive/active) |

---

### httpx

| Property | Details |
|----------|---------|
| **What it does** | Fast multi-purpose HTTP toolkit for probing live hosts, fingerprinting titles, status codes, and tech stacks |
| **Frameworks** | OSCP, CEH, PTES Phase 2 & 4, MITRE TA0043 |
| **Install (go)** | `go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest` |
| **Install (brew)** | `brew install httpx` |
| **CLI command** | `httpx -l subdomains.txt -json -o live.json -status-code -title -tech-detect` |
| **Output format** | Text (default), JSONL with `-json` |
| **Node.js via child_process** | Yes — Go binary, JSON output |
| **License** | MIT |
| **npm wrapper** | None (note: `httpx` on npm is an unrelated HTTP client for Python) |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | Seconds — 2 min per 1000 hosts |

---

### whatweb

| Property | Details |
|----------|---------|
| **What it does** | Web fingerprinting tool identifying CMS, frameworks, JS libraries, server software, and analytics platforms |
| **Frameworks** | CEH, PTES Phase 2, MITRE TA0043, OWASP A05 Security Misconfiguration |
| **Install (apt)** | `sudo apt install whatweb` |
| **Install (gem)** | `gem install whatweb` |
| **Install (source)** | `git clone https://github.com/urbanadventurer/WhatWeb` |
| **CLI command** | `whatweb --log-json=output.json -a 3 https://example.com` |
| **Output format** | Text, JSON, XML, CSV with `--log-*` flags |
| **Node.js via child_process** | Yes — spawn process, parse JSON log output |
| **License** | GPL v2 |
| **npm wrapper** | None |
| **Single binary** | No (Ruby script + gems) |
| **Needs Docker** | No |
| **Approx scan time** | 5 — 30 sec per target |

---

### dnsx

| Property | Details |
|----------|---------|
| **What it does** | Fast multi-purpose DNS toolkit for running bulk DNS queries with custom resolvers |
| **Frameworks** | OSCP, CEH, PTES Phase 2, MITRE TA0043 |
| **Install (go)** | `go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest` |
| **Install (brew)** | `brew install dnsx` |
| **CLI command** | `dnsx -l subdomains.txt -json -o dns-results.json -a -cname` |
| **Output format** | Text, JSONL with `-json` flag |
| **Node.js via child_process** | Yes — Go binary |
| **License** | GPL-3.0 |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | Seconds per batch |

---

### theHarvester

| Property | Details |
|----------|---------|
| **What it does** | OSINT gathering tool that collects emails, subdomains, IPs, and employee names from public sources |
| **Frameworks** | OSCP, CEH, PTES Phase 2, MITRE TA0043 Reconnaissance |
| **Install (pip)** | `pip install theHarvester` |
| **Install (apt)** | `sudo apt install theharvester` |
| **Install (source)** | `git clone https://github.com/laramies/theHarvester` |
| **CLI command** | `theHarvester -d example.com -b all -f output` (creates output.xml and output.json) |
| **Output format** | XML, JSON with `-f` flag |
| **Node.js via child_process** | Yes — Python CLI, produces JSON output file |
| **License** | GPL v2 |
| **npm wrapper** | None |
| **Single binary** | No (Python package, requires Python 3.12+) |
| **Needs Docker** | No |
| **Approx scan time** | 2 — 10 min (depends on sources) |

---

### shodan CLI

| Property | Details |
|----------|---------|
| **What it does** | CLI interface to Shodan search engine for querying internet-exposed devices, open ports, banners |
| **Frameworks** | OSCP, CEH, PTES Phase 2 & 3, MITRE TA0043 |
| **Install (pip)** | `pip install shodan` |
| **CLI command** | `shodan search --fields ip_str,port,org "apache country:US" --limit 100` |
| **Output format** | JSON (default), CSV with `--separator` |
| **Node.js via child_process** | Yes — Python CLI; also REST API available directly |
| **License** | MIT (CLI library); Shodan service requires API key (free tier available) |
| **npm wrapper** | `shodan-client` (npm) — unofficial REST API wrapper |
| **Single binary** | No (Python package) |
| **Needs Docker** | No |
| **Approx scan time** | Instant (queries Shodan index) |
| **Note** | Requires Shodan API key from shodan.io — free tier is rate-limited |

---

## 2. Secrets & Code Analysis (SAST)

---

### semgrep

| Property | Details |
|----------|---------|
| **What it does** | Lightweight multi-language static analysis engine for finding security bugs via pattern matching |
| **Frameworks** | OWASP A03 Injection, A07 Auth Failures, A08 Integrity, CEH, PTES Phase 4 |
| **Install (brew)** | `brew install semgrep` |
| **Install (pip)** | `pip install semgrep` |
| **CLI command** | `semgrep --config=auto --json -o results.json ./` |
| **Output format** | JSON, SARIF, text |
| **Node.js via child_process** | Yes — binary/CLI with JSON output |
| **License** | LGPL-2.1 (Community Edition) |
| **npm wrapper** | None official |
| **Single binary** | Yes (native binary via brew) |
| **Needs Docker** | No |
| **Approx scan time** | 30 sec — 5 min (large codebases) |

---

### gitleaks

| Property | Details |
|----------|---------|
| **What it does** | Detects hardcoded secrets, API keys, and credentials in git repositories and file systems |
| **Frameworks** | OWASP A02 Cryptographic Failures, A07 Auth Failures, CEH, PTES Phase 2 |
| **Install (brew)** | `brew install gitleaks` |
| **Install (binary)** | Download from https://github.com/gitleaks/gitleaks/releases |
| **CLI command** | `gitleaks detect --source=. --report-path=gitleaks.json --report-format=json` |
| **Output format** | JSON, CSV, SARIF |
| **Node.js via child_process** | Yes — single Go binary |
| **License** | MIT |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 5 — 60 sec (git history depth dependent) |

---

### truffleHog

| Property | Details |
|----------|---------|
| **What it does** | Searches git repos and code for secrets with entropy analysis and regex pattern matching; verifies found credentials against live APIs |
| **Frameworks** | OWASP A02, A07, CEH, PTES Phase 2, MITRE TA0006 Credential Access |
| **Install (brew)** | `brew install trufflesecurity/trufflehog/trufflehog` |
| **Install (binary)** | Download from https://github.com/trufflesecurity/trufflehog/releases |
| **CLI command** | `trufflehog git file://. --json --only-verified` |
| **Output format** | JSON with `--json` flag |
| **Node.js via child_process** | Yes — Go binary |
| **License** | AGPL-3.0 (v3+) |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No (Docker image available too) |
| **Approx scan time** | 1 — 10 min (repo size dependent) |

---

### bearer

| Property | Details |
|----------|---------|
| **What it does** | SAST tool focused on data flow analysis — tracks how sensitive/PII data flows through code (JS, TS, Ruby, Java, Go, Python) |
| **Frameworks** | OWASP A03, A04, A07, CEH, GDPR/privacy compliance, PTES Phase 4 |
| **Install (brew)** | `brew install Bearer/tap/bearer` |
| **Install (script)** | `curl -sfL https://raw.githubusercontent.com/Bearer/bearer/main/contrib/install.sh \| sh` |
| **CLI command** | `bearer scan . --format json --output bearer-results.json` |
| **Output format** | JSON, SARIF, HTML |
| **Node.js via child_process** | Yes — single binary |
| **License** | Elastic License 2.0 (source-available, free for dev/CI use; commercial tier: Bearer Pro via Cycode) |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 30 sec — 3 min |

---

### bandit

| Property | Details |
|----------|---------|
| **What it does** | Python-specific SAST tool running 47 security checks across injection, crypto, XSS, and other vulnerability categories |
| **Frameworks** | OWASP A03 Injection, A02 Crypto, CEH, PTES Phase 4 |
| **Install (pip)** | `pip install bandit` |
| **CLI command** | `bandit -r ./src -f json -o bandit-results.json` |
| **Output format** | JSON, SARIF, XML, HTML, CSV, text |
| **Node.js via child_process** | Yes — Python CLI with JSON output |
| **License** | Apache 2.0 |
| **npm wrapper** | None |
| **Single binary** | No (Python package) |
| **Needs Docker** | No |
| **Approx scan time** | 10 — 60 sec (Python project size) |

---

### gosec

| Property | Details |
|----------|---------|
| **What it does** | Go-specific security linter that checks for hardcoded credentials, SQL injection, file path traversal, and 30+ Go-specific vulnerabilities |
| **Frameworks** | OWASP A03, A02, A05, CEH, PTES Phase 4 |
| **Install (go)** | `go install github.com/securego/gosec/v2/cmd/gosec@latest` |
| **Install (brew)** | `brew install gosec` |
| **Install (script)** | `curl -sfL https://raw.githubusercontent.com/securego/gosec/master/install.sh \| sh -s -- -b $(go env GOPATH)/bin` |
| **CLI command** | `gosec -fmt json -out gosec-results.json ./...` |
| **Output format** | JSON, SARIF, JUnit XML, text |
| **Node.js via child_process** | Yes — Go binary |
| **License** | Apache 2.0 |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 5 — 30 sec |

---

## 3. Dependency Scanning (SCA)

---

### trivy

| Property | Details |
|----------|---------|
| **What it does** | All-in-one vulnerability scanner for containers, filesystems, git repos, IaC, and Kubernetes; detects CVEs, misconfigs, secrets, and generates SBOMs |
| **Frameworks** | OWASP A06 Vulnerable Components, A05 Misconfiguration, CEH, PTES Phase 4 |
| **Install (brew)** | `brew install trivy` |
| **Install (script)** | `curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \| sh -s -- -b /usr/local/bin` |
| **Install (apt)** | Add Aqua apt repo, then `sudo apt install trivy` |
| **CLI command** | `trivy fs --format json --output trivy-results.json ./` |
| **Output format** | JSON, SARIF, CycloneDX, SPDX, table |
| **Node.js via child_process** | Yes — single Go binary |
| **License** | Apache 2.0 |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No (but can scan Docker images) |
| **Approx scan time** | 30 sec — 3 min (first run downloads DB) |

---

### retire.js

| Property | Details |
|----------|---------|
| **What it does** | Scans JavaScript projects and front-end dependencies for known vulnerabilities in JS libraries; generates SBOM |
| **Frameworks** | OWASP A06 Vulnerable Components, PortSwigger Prototype Pollution, CEH |
| **Install (npm)** | `npm install -g retire` |
| **CLI command** | `retire --outputformat json --outputpath retire-results.json` |
| **Output format** | JSON, text, jsonsimple, CycloneDX |
| **Node.js via child_process** | Yes — Node.js CLI (or use directly as a module) |
| **License** | Apache 2.0 |
| **npm wrapper** | IS an npm package — `retire` |
| **Single binary** | No (Node.js package) |
| **Needs Docker** | No |
| **Approx scan time** | 5 — 30 sec |

---

### safety

| Property | Details |
|----------|---------|
| **What it does** | Checks Python dependencies against the PyUp vulnerability database for known CVEs |
| **Frameworks** | OWASP A06 Vulnerable Components, CEH, PTES Phase 4 |
| **Install (pip)** | `pip install safety` |
| **CLI command** | `safety scan --output json > safety-results.json` |
| **Output format** | JSON, HTML, text, SBOM |
| **Node.js via child_process** | Yes — Python CLI with JSON output |
| **License** | MIT (CLI free tier); commercial tier (PyUp) adds policy enforcement |
| **npm wrapper** | None |
| **Single binary** | No (Python package) |
| **Needs Docker** | No |
| **Approx scan time** | 10 — 30 sec |

---

### npm audit

| Property | Details |
|----------|---------|
| **What it does** | Built-in npm command that checks Node.js project dependencies against the npm advisory database for known CVEs |
| **Frameworks** | OWASP A06 Vulnerable Components, CEH |
| **Install** | Built into npm (ships with Node.js) |
| **CLI command** | `npm audit --json > npm-audit-results.json` |
| **Output format** | JSON (native with `--json`), human-readable text |
| **Node.js via child_process** | Yes — or call `npm.load()` programmatically |
| **License** | MIT (npm is open source) |
| **npm wrapper** | Built-in — also `audit-ci` (npm) for CI/CD gate |
| **Single binary** | Yes (part of Node.js install) |
| **Needs Docker** | No |
| **Approx scan time** | 5 — 15 sec |

---

### grype

| Property | Details |
|----------|---------|
| **What it does** | Vulnerability scanner for container images and filesystems, focused on high-accuracy CVE matching with EPSS and KEV prioritization |
| **Frameworks** | OWASP A06, CEH, PTES Phase 4 |
| **Install (brew)** | `brew tap anchore/grype && brew install grype` |
| **Install (script)** | `curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh \| sh -s -- -b /usr/local/bin` |
| **CLI command** | `grype dir:. -o json > grype-results.json` |
| **Output format** | JSON, SARIF, CycloneDX, table |
| **Node.js via child_process** | Yes — single Go binary |
| **License** | Apache 2.0 |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 30 sec — 2 min |

---

## 4. Web Vulnerability Scanning (DAST)

---

### nuclei

| Property | Details |
|----------|---------|
| **What it does** | Fast, customizable vulnerability scanner using YAML templates covering CVEs, misconfigurations, exposed panels, XSS, SQLi, SSRF, and more |
| **Frameworks** | OWASP Top 10 (all), PortSwigger (multiple), CEH, OSCP, PTES Phase 4 & 5, MITRE multiple tactics |
| **Install (go)** | `go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest` |
| **Install (brew)** | `brew install nuclei` |
| **Install (binary)** | Download from https://github.com/projectdiscovery/nuclei/releases |
| **CLI command** | `nuclei -u https://example.com -jsonl -o nuclei-results.jsonl -severity critical,high,medium` |
| **Output format** | JSONL with `-jsonl`, text (default), markdown |
| **Node.js via child_process** | Yes — Go binary; spawn with `-jsonl` and parse stdout line by line |
| **License** | MIT |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 2 — 15 min (template set dependent) |

---

### nikto

| Property | Details |
|----------|---------|
| **What it does** | Classic web server scanner checking for 6700+ potentially dangerous files, outdated server software, and security misconfigurations |
| **Frameworks** | OWASP A05 Misconfiguration, A06 Outdated Components, CEH, OSCP, PTES Phase 4 |
| **Install (apt)** | `sudo apt install nikto` |
| **Install (brew)** | `brew install nikto` |
| **Install (source)** | `git clone https://github.com/sullo/nikto` |
| **CLI command** | `nikto -host https://example.com -Format json -output nikto-results.json` |
| **Output format** | Text, JSON, XML, CSV, HTML |
| **Node.js via child_process** | Yes — Perl script, JSON output |
| **License** | GPL v2 |
| **npm wrapper** | None |
| **Single binary** | No (Perl script) |
| **Needs Docker** | No |
| **Approx scan time** | 5 — 20 min |

---

### wapiti

| Property | Details |
|----------|---------|
| **What it does** | Black-box web application vulnerability scanner that crawls web pages to find XSS, SQLi, XXE, SSRF, command injection, and 30+ other vulnerability classes |
| **Frameworks** | OWASP A03, A05, A10, PortSwigger (multiple), CEH, PTES Phase 4 |
| **Install (pip)** | `pip install wapiti3` |
| **Install (apt)** | `sudo apt install wapiti` |
| **CLI command** | `wapiti -u https://example.com -f json -o wapiti-results.json` |
| **Output format** | JSON, HTML, XML, TXT, CSV |
| **Node.js via child_process** | Yes — Python CLI |
| **License** | GPL v2 |
| **npm wrapper** | None |
| **Single binary** | No (Python package, requires Python 3.12+) |
| **Needs Docker** | Yes (recommended) or Python venv |
| **Approx scan time** | 10 — 60 min (crawler-based, target size dependent) |

---

### sqlmap

| Property | Details |
|----------|---------|
| **What it does** | Automated SQL injection detection and exploitation tool with support for 6 injection techniques across all major DBMS |
| **Frameworks** | OWASP A03 Injection, PortSwigger SQL Injection, CEH, OSCP, PTES Phase 4 & 5 |
| **Install (apt)** | `sudo apt install sqlmap` |
| **Install (source)** | `git clone https://github.com/sqlmapproject/sqlmap` |
| **Install (pip)** | `pip install sqlmap` |
| **CLI command** | `sqlmap -u "https://example.com/page?id=1" --batch --output-dir=./sqlmap-out` |
| **Output format** | Text (logs), directory of findings; no native JSON (parse log files) |
| **Node.js via child_process** | Yes — Python script; spawn and capture stdout |
| **License** | GPL v2 |
| **npm wrapper** | None |
| **Single binary** | No (Python script) |
| **Needs Docker** | No |
| **Approx scan time** | 2 — 30 min (depends on injection depth and target) |

---

### dalfox

| Property | Details |
|----------|---------|
| **What it does** | XSS parameter analysis and scanning tool with DOM XSS detection, blind XSS, and built-in payload mutation engine |
| **Frameworks** | OWASP A03 Injection, PortSwigger XSS + DOM-based, CEH, PTES Phase 4 |
| **Install (go)** | `go install github.com/hahwul/dalfox/v2@latest` |
| **Install (brew)** | `brew install dalfox` |
| **CLI command** | `dalfox url "https://example.com/search?q=test" --output dalfox-results.json --format json` |
| **Output format** | Text (default), JSON with `--format json` |
| **Node.js via child_process** | Yes — Go binary |
| **License** | MIT |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 1 — 10 min per target |

---

### ffuf

| Property | Details |
|----------|---------|
| **What it does** | Fast web fuzzer for directory/file brute-forcing, parameter fuzzing, vhost discovery, and API endpoint enumeration |
| **Frameworks** | OWASP A05 Misconfiguration, PortSwigger Information Disclosure + API Testing, CEH, OSCP, PTES Phase 4 |
| **Install (go)** | `go install github.com/ffuf/ffuf/v2@latest` |
| **Install (brew)** | `brew install ffuf` |
| **Install (apt)** | `sudo apt install ffuf` |
| **CLI command** | `ffuf -w /usr/share/wordlists/dirb/common.txt -u https://example.com/FUZZ -of json -o ffuf-results.json` |
| **Output format** | JSON with `-of json`, HTML, CSV |
| **Node.js via child_process** | Yes — Go binary |
| **License** | MIT |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 30 sec — 10 min (wordlist size dependent) |

---

### gobuster

| Property | Details |
|----------|---------|
| **What it does** | Directory/file/DNS/vhost/S3 brute-force tool for discovering hidden paths and subdomains using wordlists |
| **Frameworks** | OWASP A05, PortSwigger Information Disclosure, CEH, OSCP, PTES Phase 4 |
| **Install (apt)** | `sudo apt install gobuster` |
| **Install (go)** | `go install github.com/OJ/gobuster/v3@latest` |
| **Install (brew)** | `brew install gobuster` |
| **CLI command** | `gobuster dir -u https://example.com -w /usr/share/wordlists/dirb/common.txt -o gobuster-results.txt` |
| **Output format** | Text (default); JSON with `--no-progress` piped to formatter |
| **Node.js via child_process** | Yes — Go binary; stdout parsing |
| **License** | Apache 2.0 |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 1 — 15 min |

---

## 5. SSL/TLS Analysis

---

### testssl.sh

| Property | Details |
|----------|---------|
| **What it does** | Bash-based SSL/TLS tester checking cipher support, protocol versions, certificate validity, and known TLS vulnerabilities (Heartbleed, BEAST, POODLE, ROBOT, etc.) |
| **Frameworks** | OWASP A02 Cryptographic Failures, A05 Misconfiguration, CEH, OSCP, PTES Phase 4 |
| **Install (brew)** | `brew install testssl` |
| **Install (source)** | `git clone https://github.com/testssl/testssl.sh` |
| **CLI command** | `testssl.sh --jsonfile output.json https://example.com:443` |
| **Output format** | JSON (two formats: `--json`, `--jsonfile`), CSV, HTML |
| **Node.js via child_process** | Yes — bash script; spawn and capture JSON output file |
| **License** | GPL v2 |
| **npm wrapper** | None |
| **Single binary** | No (bash script, requires bash 3.2+) |
| **Needs Docker** | No (Docker image available: `drwetter/testssl.sh`) |
| **Approx scan time** | 2 — 5 min per host |

---

### sslyze

| Property | Details |
|----------|---------|
| **What it does** | Python SSL/TLS scanning library and CLI that analyzes certificate chains, cipher suites, TLS version support, and attacks (Heartbleed, CCS injection, ROBOT, session resumption) |
| **Frameworks** | OWASP A02 Cryptographic Failures, CEH, PTES Phase 4 |
| **Install (pip)** | `pip install --upgrade sslyze` |
| **Install (apt)** | `sudo apt install python3-sslyze` |
| **CLI command** | `sslyze example.com --json_out sslyze-results.json` |
| **Output format** | JSON with `--json_out`, human-readable text |
| **Node.js via child_process** | Yes — Python CLI with `--json_out -` for stdout |
| **License** | AGPL-3.0 |
| **npm wrapper** | None |
| **Single binary** | No (Python package) |
| **Needs Docker** | No |
| **Approx scan time** | 30 sec — 2 min |

---

## 6. Header Analysis

---

### shcheck

| Property | Details |
|----------|---------|
| **What it does** | Checks HTTP security headers of a website including CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy |
| **Frameworks** | OWASP A05 Security Misconfiguration, CEH, PTES Phase 4 |
| **Install (pip)** | `pip3 install shcheck` |
| **Install (docker)** | `docker run -it santoru/shcheck https://example.com` |
| **Install (source)** | `git clone https://github.com/santoru/shcheck` |
| **CLI command** | `shcheck.py -j https://example.com` |
| **Output format** | Text (default), JSON with `-j` flag |
| **Node.js via child_process** | Yes — Python script |
| **License** | MIT |
| **npm wrapper** | None |
| **Single binary** | No (Python script) |
| **Needs Docker** | Optional |
| **Approx scan time** | < 5 sec |

---

## 7. JWT Testing

---

### jwt_tool

| Property | Details |
|----------|---------|
| **What it does** | Toolkit for testing, tweaking, and cracking JSON Web Tokens — tests algorithm confusion, weak secrets, signature stripping, injection attacks |
| **Frameworks** | OWASP A07 Authentication Failures, PortSwigger JWT Attacks, CEH, PTES Phase 4 & 5 |
| **Install (source)** | `git clone https://github.com/ticarpi/jwt_tool && pip3 install -r requirements.txt` |
| **CLI command** | `python3 jwt_tool.py <JWT_TOKEN> -T` (tamper) or `-C -d wordlist.txt` (crack) |
| **Output format** | Text (stdout); results printed to terminal |
| **Node.js via child_process** | Yes — Python script; capture stdout |
| **License** | GPL v3 |
| **npm wrapper** | None |
| **Single binary** | No (Python script) |
| **Needs Docker** | No |
| **Approx scan time** | Seconds — minutes (crack mode depends on wordlist) |

---

## 8. API Testing

---

### kiterunner

| Property | Details |
|----------|---------|
| **What it does** | API endpoint discovery and brute-force tool that uses real-world Swagger/OpenAPI specs to test correct HTTP methods, headers, paths, and parameters for each request |
| **Frameworks** | OWASP A05 Misconfiguration, PortSwigger API Testing, CEH, PTES Phase 4 |
| **Install (binary)** | Download from https://github.com/assetnote/kiterunner/releases |
| **Install (go)** | `go install github.com/assetnote/kiterunner/cmd/kr@latest` |
| **CLI command** | `kr scan https://example.com -w routes-large.kite --output-format json -o kr-results.json` |
| **Output format** | JSON with `--output-format json`, text |
| **Node.js via child_process** | Yes — Go binary |
| **License** | Apache 2.0 |
| **npm wrapper** | None |
| **Single binary** | Yes |
| **Needs Docker** | No |
| **Approx scan time** | 1 — 10 min |

---

## 9. Reporting Tools

---

### Recommended Security Reporting Options

| Tool | Type | Install | Use Case | Output |
|------|------|---------|----------|--------|
| **pandoc** | Document converter | `brew install pandoc` | Convert markdown findings to HTML/PDF | HTML, PDF, DOCX |
| **wkhtmltopdf** | HTML-to-PDF | `brew install wkhtmltopdf` | Convert HTML report to PDF (deprecated, use carefully) | PDF |
| **weasyprint** | HTML-to-PDF | `pip install weasyprint` | Modern HTML/CSS to PDF (pandoc default) | PDF |
| **dgen** | Pentest report generator | Source — GitHub luduscybersecurity/dgen | Modular markdown-to-HTML/PDF pentest reports | HTML, PDF |
| **Custom Node.js** | Built-in Vanguard | — | Aggregate JSON outputs from all tools → Handlebars/EJS HTML template | HTML, JSON |

#### Recommended Vanguard Reporting Pipeline

```
All tool JSON outputs
        ↓
  Node.js aggregator (merge + deduplicate)
        ↓
  Handlebars/EJS HTML template
        ↓
  weasyprint or puppeteer PDF export
```

---

## Framework Coverage Mapping Tables

### OWASP Top 10:2021 — Tool Coverage

| OWASP Category | Primary Tools | Secondary Tools |
|----------------|---------------|-----------------|
| **A01** Broken Access Control | nuclei, nikto, wapiti | gobuster, ffuf, kiterunner |
| **A02** Cryptographic Failures | testssl.sh, sslyze | gitleaks, truffleHog, bandit |
| **A03** Injection (SQL, CMD, SSTI) | sqlmap, wapiti, nuclei | dalfox (XSS), semgrep, bandit |
| **A04** Insecure Design | bearer, semgrep | wapiti, nuclei |
| **A05** Security Misconfiguration | nikto, nuclei, shcheck | ffuf, gobuster, testssl.sh, sslyze, whatweb |
| **A06** Vulnerable & Outdated Components | trivy, grype, retire.js, npm audit | safety, semgrep |
| **A07** Identification & Auth Failures | jwt_tool, nuclei | wapiti, nikto, gitleaks, truffleHog |
| **A08** Software & Data Integrity | trivy, gitleaks, truffleHog | grype, semgrep |
| **A09** Security Logging & Monitoring | nuclei (log exposure templates) | nikto, wapiti |
| **A10** SSRF | nuclei, wapiti | sqlmap (OOB), ffuf |

---

### PortSwigger Web Security Academy — Tool Coverage

| PortSwigger Category | Tool(s) |
|----------------------|---------|
| SQL Injection | sqlmap, nuclei, wapiti, semgrep |
| Authentication | nuclei, jwt_tool, wapiti, hydra |
| Path Traversal | nuclei, nikto, wapiti |
| Command Injection | nuclei, wapiti, semgrep, bandit |
| Business Logic Vulnerabilities | Manual + nuclei (custom templates) |
| Information Disclosure | nikto, gobuster, ffuf, nuclei |
| Access Control | nuclei, wapiti, kiterunner |
| File Upload Vulnerabilities | nuclei, wapiti |
| Race Conditions | Custom scripts, nuclei |
| SSRF | nuclei, wapiti |
| XXE Injection | nuclei, wapiti |
| NoSQL Injection | nuclei, wapiti |
| API Testing | kiterunner, ffuf, nuclei |
| Web Cache Deception | nuclei |
| XSS | dalfox, nuclei, wapiti, semgrep |
| CSRF | nuclei, wapiti |
| CORS | nuclei, wapiti, shcheck |
| Clickjacking | shcheck, nuclei |
| DOM-Based Vulnerabilities | dalfox, nuclei |
| WebSockets | Manual + nuclei |
| Insecure Deserialization | nuclei, semgrep |
| Web LLM Attacks | Manual |
| GraphQL API Vulnerabilities | nuclei, kiterunner |
| SSTI | nuclei, wapiti, semgrep |
| Web Cache Poisoning | nuclei |
| HTTP Host Header Attacks | nuclei, wapiti |
| HTTP Request Smuggling | nuclei |
| OAuth Authentication | nuclei |
| JWT Attacks | jwt_tool, nuclei |
| Prototype Pollution | retire.js, nuclei, semgrep |
| Essential Skills | All tools |

---

### PTES Phases — Tool Mapping

| PTES Phase | Tools |
|------------|-------|
| **Phase 1:** Pre-Engagement | Shodan CLI (passive research), theHarvester |
| **Phase 2:** Intelligence Gathering | nmap, subfinder, amass, httpx, whatweb, dnsx, theHarvester, shodan CLI |
| **Phase 3:** Threat Modeling | amass (attack surface), shodan, nmap (asset inventory) |
| **Phase 4:** Vulnerability Analysis | nuclei, nikto, wapiti, sqlmap, dalfox, ffuf, gobuster, testssl.sh, sslyze, shcheck, jwt_tool, kiterunner, semgrep, gitleaks, truffleHog, bearer, bandit, gosec, trivy, grype, retire.js, npm audit, safety |
| **Phase 5:** Exploitation | sqlmap, dalfox, nuclei (exploit templates), jwt_tool |
| **Phase 6:** Post-Exploitation | Manual + shodan CLI |
| **Phase 7:** Reporting | pandoc, weasyprint, Vanguard HTML reporter |

---

### MITRE ATT&CK — Tool Mapping

| ATT&CK Tactic | Tools |
|---------------|-------|
| **TA0043** Reconnaissance | nmap, subfinder, amass, httpx, dnsx, theHarvester, shodan CLI, whatweb |
| **TA0042** Resource Development | (infrastructure; primarily manual) |
| **TA0001** Initial Access | nuclei, sqlmap, dalfox, wapiti |
| **TA0002** Execution | sqlmap, dalfox |
| **TA0003** Persistence | nuclei (persistence templates) |
| **TA0004** Privilege Escalation | nuclei |
| **TA0005** Defense Evasion | testssl.sh (detect weak TLS), shcheck |
| **TA0006** Credential Access | gitleaks, truffleHog, jwt_tool, theHarvester |
| **TA0007** Discovery | nmap, gobuster, ffuf, kiterunner, whatweb |
| **TA0008** Lateral Movement | nuclei |
| **TA0009** Collection | theHarvester, shodan CLI |
| **TA0011** Command and Control | (network level; primarily manual) |
| **TA0010** Exfiltration | (manual post-exploitation) |
| **TA0040** Impact | sqlmap (DB dump), nuclei |

---

## Quick Reference: Installation Summary

```bash
# ---- RECON ----
brew install nmap subfinder amass httpx dnsx
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest
pip install theHarvester shodan

# ---- SAST / SECRETS ----
brew install semgrep gitleaks gosec
brew install trufflesecurity/trufflehog/trufflehog
brew install Bearer/tap/bearer
pip install bandit

# ---- SCA ----
brew install trivy
brew tap anchore/grype && brew install grype
npm install -g retire
pip install safety

# ---- DAST ----
brew install nuclei nikto ffuf gobuster dalfox
pip install wapiti3
pip install sqlmap  # or: git clone https://github.com/sqlmapproject/sqlmap

# ---- SSL/TLS ----
brew install testssl
pip install --upgrade sslyze

# ---- HEADERS ----
pip3 install shcheck

# ---- JWT ----
git clone https://github.com/ticarpi/jwt_tool && pip3 install -r jwt_tool/requirements.txt

# ---- API ----
# Download kiterunner binary from: https://github.com/assetnote/kiterunner/releases

# ---- REPORTING ----
brew install pandoc
pip install weasyprint
```

---

## Node.js Integration Notes

All tools that produce JSON/JSONL output can be called from Node.js using:

```javascript
const { spawn } = require('child_process');

function runTool(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
    proc.on('error', reject);
  });
}

// Example: run nuclei with JSONL output
const { stdout } = await runTool('nuclei', [
  '-u', 'https://example.com',
  '-jsonl',
  '-severity', 'critical,high'
]);
const findings = stdout.trim().split('\n').map(JSON.parse);
```

**Tools with native npm wrappers:**
- `node-nmap` — nmap wrapper
- `libnmap` — nmap API
- `nmap2json` — nmap XML-to-JSON converter
- `retire` — retire.js IS the npm package
- `audit-ci` — npm audit wrapper for CI

**Tools requiring extra parsing (no JSON out of box):**
- `sqlmap` — parse text log files
- `gobuster` — parse text stdout
- `jwt_tool` — parse text stdout

---

## Tool Bundle Feasibility for Vanguard CLI

| Category | Bundleable as Binary | Requires Runtime | Docker Required |
|----------|---------------------|------------------|-----------------|
| nmap | Yes | No | No |
| subfinder | Yes (Go) | No | No |
| amass | Yes (Go) | No | No |
| httpx | Yes (Go) | No | No |
| dnsx | Yes (Go) | No | No |
| nuclei | Yes (Go) | No | No |
| dalfox | Yes (Go) | No | No |
| ffuf | Yes (Go) | No | No |
| gobuster | Yes (Go) | No | No |
| grype | Yes (Go) | No | No |
| trivy | Yes (Go) | No | No |
| gitleaks | Yes (Go) | No | No |
| truffleHog | Yes (Go) | No | No |
| bearer | Yes | No | No |
| kiterunner | Yes (Go) | No | No |
| testssl.sh | Script (bash) | bash 3.2+ | Optional |
| semgrep | Yes (native) | No | No |
| gosec | Yes (Go) | No | No |
| whatweb | No | Ruby | No |
| theHarvester | No | Python 3.12+ | No |
| shodan | No | Python | No |
| bandit | No | Python | No |
| safety | No | Python | No |
| sslyze | No | Python | No |
| wapiti | No | Python 3.12+ | Recommended |
| sqlmap | No | Python | No |
| shcheck | No | Python | No |
| jwt_tool | No | Python | No |
| retire.js | No | Node.js | No |
| npm audit | No | Node.js | No |

**Recommendation for Vanguard:** Bundle the 12 Go binaries (subfinder, amass, httpx, dnsx, nuclei, dalfox, ffuf, gobuster, grype, trivy, gitleaks, truffleHog + kiterunner) as pre-compiled cross-platform binaries. For Python tools, provide a `vanguard install-deps` command that runs the pip/apt installs automatically. Use the Node.js runtime that ships with Vanguard for retire.js and npm audit.

---

*Sources verified April 2026 from official repositories, Homebrew formulae, AppSec Santa benchmarks, and PortSwigger Web Security Academy.*

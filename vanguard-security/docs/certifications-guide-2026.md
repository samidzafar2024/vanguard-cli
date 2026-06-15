# Cybersecurity Certifications Complete Guide 2025–2026

> **Last Updated:** April 2026 | Compiled from current industry sources, official vendor documentation, and live job market data.

---

## Table of Contents

1. [Certification Overview Matrix](#1-certification-overview-matrix)
2. [Detailed Certification Profiles](#2-detailed-certification-profiles)
   - [OSCP / OSCP+](#21-oscp--oscp)
   - [CISSP](#22-cissp)
   - [CEH](#23-ceh-certified-ethical-hacker)
   - [CompTIA Security+](#24-comptia-security-sy0-701)
   - [AWS Certified Security Specialty](#25-aws-certified-security--specialty-scs-c03)
   - [Google Professional Cloud Security Engineer](#26-google-professional-cloud-security-engineer)
   - [AZ-500](#27-az-500-microsoft-azure-security-engineer-associate)
   - [SC-200](#28-sc-200-microsoft-security-operations-analyst)
   - [CRTP](#29-crtp-certified-red-team-professional)
   - [PNPT](#210-pnpt-practical-network-penetration-tester)
   - [OSWE](#211-oswe-offsec-web-expert)
   - [eJPT](#212-ejpt-elearnsecurity-junior-penetration-tester)
   - [BSCP](#213-bscp-burp-suite-certified-practitioner)
   - [GPEN](#214-gpen-giac-penetration-tester)
3. [What Amazon, Google & Microsoft Require](#3-what-amazon-google--microsoft-require)
4. [Company-Owned Cloud Security Certifications — Full Domain Breakdowns](#4-company-owned-cloud-security-certifications--full-domain-breakdowns)
   - [AWS Certified Security Specialty (SCS-C03)](#41-aws-certified-security--specialty-scs-c03)
   - [Google Professional Cloud Security Engineer](#42-google-professional-cloud-security-engineer)
   - [AZ-500 Full Syllabus](#43-az-500-full-syllabus-as-of-january-2026)
   - [SC-200 Full Syllabus](#44-sc-200-full-syllabus-as-of-april-2026)
5. [Rankings — Best Cert by Career Path](#5-rankings--best-cert-by-career-path)
6. [Salary Comparison Table](#6-salary-comparison-table)
7. [ROI Analysis](#7-roi-analysis)
8. [Certification Roadmaps](#8-certification-roadmaps)
9. [Key 2025–2026 Market Trends](#9-key-2025-2026-market-trends)
10. [Sources](#10-sources)

---

## 1. Certification Overview Matrix

| Certification | Issuing Body | Level | Exam Cost | Validity | Avg Salary (US) | Exam Format | Industry Recognition |
|---|---|---|---|---|---|---|---|
| OSCP / OSCP+ | OffSec | Advanced | $1,749 (bundle) | Lifetime / 3 yr (OSCP+) | $120K–$151K | 24 hr practical | Gold standard offensive |
| CISSP | ISC2 | Advanced | $749 | 3 years | $130K–$165K | 100–150 MCQ (CAT) | Highest overall |
| CEH v13 | EC-Council | Intermediate | $950–$1,199 | 3 years | $90K–$110K | 125 MCQ | Corporate / compliance |
| CompTIA Security+ (SY0-701) | CompTIA | Entry | $425 | 3 years | $85K–$105K | Up to 90 MCQ/PBQ | DoD baseline / entry hiring |
| AWS Security Specialty (SCS-C03) | Amazon Web Services | Advanced | $300 | 3 years | $158K–$200K | 65 MCQ | Best cloud security ROI |
| Google Cloud Security Engineer | Google Cloud | Advanced | $200 | 2–3 years | $152K–$201K | 60 MCQ | GCP ecosystem |
| AZ-500 | Microsoft | Intermediate | $165 | Annual (free renewal) | $120K–$145K | 40–60 MCQ | Azure ecosystem |
| SC-200 | Microsoft | Intermediate | $165 | Annual (free renewal) | $101K–$150K | 40–60 MCQ | Azure/SOC roles |
| CRTP | Altered Security | Beginner–Int | $249 | 3 years | $110K–$170K (role) | 24 hr practical | AD/Red Team entry |
| PNPT | TCM Security | Intermediate | $499 | Does not expire | $90K–$130K | 5 day practical + debrief | Growing fast |
| OSWE | OffSec | Advanced | $1,749 (bundle) | Lifetime | $120K–$160K | 48 hr practical | Web app offensive elite |
| eJPT | INE / eLearnSecurity | Beginner | $249 | Does not expire | $80K–$97K (entry) | 48 hr practical | Entry-level pen testing |
| BSCP | PortSwigger | Intermediate | $99 | 5 years | $100K–$140K (role) | 4 hr practical | Web security / bug bounty |
| GPEN | GIAC / SANS | Intermediate | $999 | 4 years | $117K–$130K | 82 MCQ + labs | Government / enterprise |

---

## 2. Detailed Certification Profiles

### 2.1 OSCP / OSCP+

**Full Name:** Offensive Security Certified Professional / OSCP+
**Issuing Body:** OffSec (Offensive Security)
**Difficulty:** Advanced

#### Background

OSCP is the most recognized offensive security certification in the world. Since November 1, 2024, passing the updated exam earns OSCP+ (3-year active status) alongside the lifetime OSCP credential. The companion course is PEN-200: Penetration Testing with Kali Linux.

#### Exam Format

- 23 hours 45 minutes to compromise target machines
- Additional 24 hours to write and submit a professional penetration testing report
- Scoring: 3 standalone machines (20 pts each = 60 pts) + 1 Active Directory set (40 pts) = 100 pts
- Minimum passing score: 70 points
- No internet access during exam (proctored)

#### Course Syllabus (PEN-200 Topics)

| Module Area | Key Topics |
|---|---|
| Penetration Testing Foundations | Methodology, scoping, reporting, note-taking |
| Information Gathering | Passive/active recon, DNS interrogation, OSINT |
| Vulnerability Scanning | Nessus, OpenVAS, manual discovery |
| Web Application Attacks | SQLi, file upload, command injection, XSS, LFI/RFI |
| Client-Side Attacks | Microsoft Office macros, HTML smuggling |
| Locating Public Exploits | Exploit databases, PoC modification |
| Fixing and Using Exploits | Shellcode, exploit customization |
| Antivirus Evasion | Obfuscation, custom payloads, AMSI bypass |
| Privilege Escalation (Linux) | SUID/GUID, sudo misconfigs, cron jobs, kernel exploits |
| Privilege Escalation (Windows) | Service misconfigs, token impersonation, DLL hijacking |
| Password Attacks | Hash cracking, credential stuffing, Mimikatz |
| Active Directory Enumeration | BloodHound, PowerView, LDAP queries |
| Active Directory Attacks | Kerberoasting, AS-REP roasting, Pass-the-Hash, DCSync |
| Active Directory Lateral Movement | Pass-the-Ticket, Golden/Silver Tickets, PSExec |
| Tunneling and Pivoting | Port forwarding, Chisel, Ligolo-ng, proxychains |
| Metasploit Framework | Msfvenom, modules, post-exploitation |
| Reporting | Professional penetration test report writing |

Active Directory content now represents **40% of the exam score**.

#### Target Job Roles
- Penetration Tester
- Red Team Operator
- Offensive Security Engineer
- Vulnerability Researcher
- Security Consultant (offensive)

#### Cost Breakdown

| Option | Price | Includes |
|---|---|---|
| Course + Exam Bundle | $1,749 | PEN-200 course, 90-day lab access, 1 exam attempt |
| Learn One | $2,749/year | All courses + unlimited lab access + 1 cert exam/year |
| Learn Unlimited | $6,099/year | All courses + unlimited labs + unlimited cert exams |
| Exam Retake | $249 | Retake only |

#### Validity

- **OSCP:** Lifetime credential — never expires
- **OSCP+:** 3-year active status; maintain via recertification exam, another qualifying OffSec cert, or CPEs

#### Average Salary Impact

- Average US salary: **$119,895** (ZipRecruiter, June 2025)
- Range: $85K–$168K depending on experience
- Premium over non-certified peers: **+$20K–$30K/year**
- First-year ROI: approximately **1,650%**

#### Industry Recognition

OSCP is explicitly listed as required or preferred in 35%+ of penetration testing job postings globally. It remains the benchmark certification that separates legitimate practitioners from theory-only professionals. Recognized by NSA, DoD, and major enterprise security teams worldwide.

---

### 2.2 CISSP

**Full Name:** Certified Information Systems Security Professional
**Issuing Body:** ISC2
**Difficulty:** Advanced

#### Background

CISSP is the most widely recognized senior cybersecurity credential globally. It is frequently a hard requirement on government, Fortune 500, and enterprise security leadership job postings. As of 2026, 89% of hiring managers filter for at least one certification; CISSP consistently tops that list for senior roles.

**Important 2026 Update:** Effective April 1, 2026, ISC2 removed CEH, CISA, CRISC, and OSCP from the approved one-year experience waiver list. The full five-year experience requirement now applies to most candidates.

#### Prerequisites

- 5 years of cumulative paid work experience in 2 or more of the 8 CISSP domains
- A relevant 4-year degree waives 1 year
- Candidates without experience can become an Associate of ISC2 after passing the exam

#### Exam Format

- **Format:** Computerized Adaptive Testing (CAT)
- **Questions:** 100–150 (exam can end at question 100 if outcome is statistically confident)
- **Duration:** 3 hours
- **Passing Score:** 700 out of 1000
- **Delivery:** Pearson VUE (in-person or online proctored)

#### The 8 CISSP Domains

| Domain | Weight |
|---|---|
| Security and Risk Management | 15% |
| Asset Security | 10% |
| Security Architecture and Engineering | 13% |
| Communication and Network Security | 13% |
| Identity and Access Management (IAM) | 13% |
| Security Assessment and Testing | 12% |
| Security Operations | 13% |
| Software Development Security | 11% |

#### Domain Deep-Dive Topics

**Domain 1 — Security and Risk Management:** Risk management frameworks (NIST, ISO 27001), threat modeling, legal and regulatory compliance, business continuity, ethics, security governance, policies, and standards.

**Domain 2 — Asset Security:** Data classification, data ownership, privacy, data retention policies, secure data handling.

**Domain 3 — Security Architecture and Engineering:** Secure design principles, security models (Bell-LaPadula, Biba), cryptography (PKI, symmetric/asymmetric, hashing), hardware security, cloud architecture security.

**Domain 4 — Communication and Network Security:** Network protocols, VPNs, firewalls, wireless security, microsegmentation, network attacks and countermeasures.

**Domain 5 — Identity and Access Management:** Authentication methods, MFA, SSO, OAuth/OIDC, PAM, federated identity, zero trust.

**Domain 6 — Security Assessment and Testing:** Vulnerability assessments, pen testing, audit logs, test coverage, metrics.

**Domain 7 — Security Operations:** Incident response, digital forensics, disaster recovery, change management, SIEM, endpoint protection.

**Domain 8 — Software Development Security:** SDLC security, secure coding practices, DevSecOps, code review, application security testing.

#### Target Job Roles
- CISO / Chief Information Security Officer
- Security Director / Manager
- Security Architect
- Senior Security Engineer
- IT Risk Manager
- Security Consultant (strategic)

#### Cost

| Item | Cost |
|---|---|
| Exam Voucher | $749 |
| Annual Maintenance Fee (AMF) | $125/year |
| CPE maintenance | $0 (self-reported, no exam) |

#### Validity

3 years, with 120 CPE credits required over the cycle (40/year minimum) and $125 annual AMF.

#### Average Salary Impact

- Average US salary: **$131K–$148K** (North America average: $147,757 per ISC2)
- Global average: $119,577
- Premium over non-certified peers: **+$25K–$35K/year**
- Payback period: under **2 weeks** of salary increase

#### Industry Recognition

Highest overall recognition in the cybersecurity industry. Appears in US federal requirements (DoD 8570), Fortune 500 job postings, and is the default senior-level credential benchmark. CISSP holders at FAANG-tier companies typically earn $200K–$300K+ total compensation.

---

### 2.3 CEH — Certified Ethical Hacker

**Full Name:** Certified Ethical Hacker (v13 as of 2025)
**Issuing Body:** EC-Council
**Difficulty:** Intermediate

#### Background

CEH is one of the oldest and most recognized ethical hacking certifications. It covers a broad, structured curriculum across 20 modules. CEH v13 introduces AI-driven attack and defense components. While criticized by practitioners for being exam-focused rather than practical, it is widely required in corporate and government procurement contexts.

#### Exam Format

- **Questions:** 125 multiple choice
- **Duration:** 4 hours
- **Passing Score:** Variable by form (typically 70%)
- **Delivery:** EC-Council Exam Center or Pearson VUE

#### CEH v13 Curriculum (20 Modules)

| Module | Topic |
|---|---|
| 01 | Introduction to Ethical Hacking |
| 02 | Footprinting and Reconnaissance |
| 03 | Scanning Networks |
| 04 | Enumeration |
| 05 | Vulnerability Analysis |
| 06 | System Hacking |
| 07 | Malware Threats |
| 08 | Sniffing |
| 09 | Social Engineering |
| 10 | Denial-of-Service |
| 11 | Session Hijacking |
| 12 | Evading IDS, Firewalls, and Honeypots |
| 13 | Hacking Web Servers |
| 14 | Hacking Web Applications |
| 15 | SQL Injection |
| 16 | Hacking Wireless Networks |
| 17 | Hacking Mobile Platforms |
| 18 | IoT and OT Hacking |
| 19 | Cloud Computing Security |
| 20 | Cryptography |

The v13 lab environment provides 221 hands-on labs, 550 attack techniques, and 4,000+ security tools. A practical exam (CEH Practical) is available as an add-on.

#### Target Job Roles
- Ethical Hacker
- Penetration Tester (corporate)
- Security Analyst
- Network Security Engineer
- Cybersecurity Auditor
- Government/Defense Security roles

#### Cost

| Option | Cost |
|---|---|
| Exam Voucher (online proctor) | $950 |
| Exam Voucher (Pearson VUE) | $1,199 |
| Eligibility Application (self-study) | +$100 |
| Official EC-Council Training | +$2,000–$3,000 |
| Annual Membership (renewal) | $80/year |

#### Prerequisites

EC-Council recommends 2+ years of IT security experience. Without official EC-Council training, a $100 eligibility application fee is required.

#### Validity

3 years. Renewal requires 120 ECE (EC-Council Continuing Education) credits over 3 years and an $80/year membership fee.

#### Average Salary Impact

- Typical range: **$90K–$110K**
- Salary increase reported: approximately **31%** after certification

#### Industry Recognition

Strong in corporate, government, banking, and defense sectors. Often listed alongside OSCP in job descriptions. However, for pure offensive security roles, OSCP is significantly more respected among practitioners. CEH is better suited for roles requiring compliance-oriented security credentials.

---

### 2.4 CompTIA Security+ (SY0-701)

**Full Name:** CompTIA Security+
**Issuing Body:** CompTIA
**Difficulty:** Entry-Level

#### Background

Security+ is the most widely deployed entry-level cybersecurity certification in the world. It is a DoD 8570/8140 baseline requirement for US government security roles and functions as the standard hiring filter at companies bringing in junior security professionals.

#### Exam Format

- **Exam Code:** SY0-701
- **Questions:** Up to 90 (MCQ + performance-based)
- **Duration:** 90 minutes
- **Passing Score:** 750 on a 100–900 scale
- **Delivery:** Pearson VUE (in-person or online)

#### The 6 Security+ Domains

| Domain | Weight |
|---|---|
| General Security Concepts | 12% |
| Threats, Vulnerabilities, and Mitigations | 22% |
| Security Architecture | 18% |
| Security Operations | 28% |
| Security Program Management and Oversight | 20% |

#### Domain Topics

**Domain 1 — General Security Concepts:** CIA triad, control types (administrative, technical, physical), cryptography fundamentals, identity concepts, risk terminology.

**Domain 2 — Threats, Vulnerabilities, and Mitigations:** Malware types, phishing/social engineering, application and cloud vulnerabilities, misconfigurations, secure baselines, defense-in-depth.

**Domain 3 — Security Architecture:** Cloud security models, network segmentation, zero trust, hybrid environments, infrastructure security, resilience strategies.

**Domain 4 — Security Operations:** Identity management, alerting/monitoring, incident response, digital forensics, vulnerability management, endpoint security, SIEM basics.

**Domain 5 — Security Program Management:** Risk management, compliance frameworks (NIST, ISO, GDPR, HIPAA), data privacy, supply chain security, security awareness training.

#### Target Job Roles
- Security Analyst (entry)
- SOC Analyst (Tier 1/2)
- Systems Administrator (security focus)
- IT Auditor
- Help Desk / Security Support
- Network Administrator

#### Cost

| Item | Cost |
|---|---|
| Exam Voucher | $425 |
| Renewal (every 3 years) | 50 CEUs or pass newest version |

#### Validity

3 years. Renew by earning 50 CEUs, passing the newest version, or achieving a higher CompTIA certification (CySA+, CASP+/SecurityX).

#### Average Salary Impact

- Average salary for Security+ holders: **$85K–$105K**
- Entry-level jobs: average **$88,000**
- Salary increase reported: approximately **27%**
- Exam cost of $425 is among the best dollar-for-dollar entry investments available

#### Industry Recognition

The de facto entry-level standard. Required by 85%+ of US federal contractor security job postings. Recognized globally by private and public sector. Strong prerequisite to CISSP and higher-level CompTIA certifications.

---

### 2.5 AWS Certified Security — Specialty (SCS-C03)

**Full Name:** AWS Certified Security — Specialty
**Issuing Body:** Amazon Web Services
**Difficulty:** Advanced (Cloud-Specialist)

#### Background

SCS-C03 launched December 2, 2025, replacing SCS-C02. This is the premium cloud security credential for AWS environments. It validates expertise across threat detection, incident response, IAM, data protection, and the entirely new Generative AI security domain added for 2026.

#### Prerequisites

AWS recommends 2+ years securing AWS workloads and 5+ years of general IT security experience. No formal prerequisite exam required, but an AWS Associate-level cert is strongly recommended.

#### Exam Format

- **Questions:** 50 scored + 15 unscored = 65 total
- **Passing Score:** 750 on a 100–1000 scale
- **Duration:** 170 minutes
- **Delivery:** Pearson VUE or PSI (in-person or online)
- **Cost:** $300 (50% discount with any active AWS certification)

#### Exam Domains (SCS-C03)

| Domain | Weight |
|---|---|
| 1. Detection | 16% |
| 2. Incident Response | 14% |
| 3. Infrastructure Security | 18% |
| 4. Identity and Access Management | 20% |
| 5. Data Protection | 18% |
| 6. Security Foundations and Governance | 14% |
| 7. Generative AI and Machine Learning Security *(new in 2025)* | Integrated across domains |

#### Validity

3 years. Recertify by retaking the exam or achieving a higher-level AWS certification.

#### Average Salary Impact

- Average US base salary: **$158,000–$200,000+**
- Top earners in major tech hubs: **$200,000+**
- Best salary-to-cost ratio of any advanced certification: $300 exam fee adds **$18K–$25K** in annual compensation

#### Industry Recognition

The definitive cloud security credential for AWS environments. Highly valued at AWS itself, at AWS Partners, and at any organization running cloud-native infrastructure. Essential for cloud security architect and cloud security engineer roles.

---

### 2.6 Google Professional Cloud Security Engineer

**Full Name:** Google Professional Cloud Security Engineer
**Issuing Body:** Google Cloud
**Difficulty:** Advanced (Cloud-Specialist)

#### Background

This certification validates the ability to design and implement a secure Google Cloud infrastructure. Google recommends 3+ years of industry experience including at least 1 year managing Google Cloud solutions.

#### Exam Format

- **Questions:** 60 multiple choice / multiple select
- **Duration:** 120 minutes
- **Passing Score:** ~70%
- **Cost:** $200
- **Delivery:** Kryterion (in-person or online)

#### Exam Domains

| Domain | Approx. Weight |
|---|---|
| Configuring Access within a Cloud Solution Environment | ~25% |
| Configuring Network Security | ~22% |
| Ensuring Data Protection | ~23% |
| Managing Operations | ~17% |
| Supporting Compliance Requirements | ~13% |

#### Key Topic Areas

**Configuring Access:**
- IAM policies, service accounts, role-based access control
- Least-privilege access models
- Workload Identity Federation
- BeyondCorp / Zero Trust access controls
- Cloud Identity and Access Context Manager

**Configuring Network Security:**
- VPC design and firewall rules
- Cloud Armor (DDoS / WAF)
- Private Service Connect, VPC Service Controls
- Cloud CDN and Load Balancer security
- Shared VPC architectures

**Ensuring Data Protection:**
- Cloud KMS (key management), CMEK, CSEK
- Data Loss Prevention (DLP) API
- Cloud HSM
- Encryption at rest and in transit
- Secret Manager
- AI/ML workload security (Vertex AI security — new for 2025–2026)
- Security and privacy controls for training data

**Managing Operations:**
- Security Command Center (SCC) — Standard and Premium
- Cloud Logging / Cloud Monitoring
- Chronicle SIEM / Security Operations
- Incident response in GCP
- Software supply chain security
- Binary Authorization

**Supporting Compliance:**
- Regulatory frameworks (PCI DSS, HIPAA, GDPR, FedRAMP)
- Google Cloud Compliance Reports Manager
- Assured Workloads
- Compliance automation

#### Target Job Roles
- GCP Security Engineer
- Cloud Security Architect
- Platform Security Engineer
- Data Security Engineer
- Site Reliability Engineer (security focus)

#### Validity

2–3 years from exam date. Recertify by retaking the exam.

#### Average Salary Impact

- National median: **$152,773** (ZipRecruiter, April 2026)
- Experienced professionals: **$120K–$175K**
- Top earners: **$200,000+**
- North America average for this cert: **$201,687** (highest average salary reported for any single Google Cloud cert)

#### Industry Recognition

The premier cloud security credential for GCP environments. Particularly valued at Google, Google Cloud Partners, and enterprises using Google Workspace + GCP. Increasingly paired with AWS Security Specialty for multi-cloud security architect roles.

---

### 2.7 AZ-500: Microsoft Azure Security Engineer Associate

**Full Name:** Microsoft Certified: Azure Security Engineer Associate
**Issuing Body:** Microsoft
**Difficulty:** Intermediate

#### Background

AZ-500 validates the ability to implement, manage, and monitor security for resources across Azure, multi-cloud, and hybrid environments. As of January 22, 2026, the exam received a minor revision.

**Note:** The AZ-500 exam will **retire on August 31, 2026**. Microsoft is transitioning to a new AI-era certification framework. Candidates should check Microsoft Learn for the replacement credential.

#### Exam Format

- **Questions:** 40–60 (MCQ, case studies, performance-based)
- **Duration:** 100 minutes (120 minutes with seat time)
- **Passing Score:** 700 out of 1000
- **Cost:** $165 USD
- **Delivery:** Pearson VUE (in-person or online)
- **Renewal:** Annual, free via Microsoft Learn online assessment

See [Section 4.3](#43-az-500-full-syllabus-as-of-january-2026) for the complete domain breakdown.

#### Target Job Roles
- Azure Security Engineer
- Cloud Security Engineer
- Cloud DevOps Engineer
- Security Architect (Azure)

#### Average Salary Impact

- US average: **$126,000**
- Range: $110K–$145K depending on experience
- In India: 14–28 lakhs annually

#### Industry Recognition

Essential for any security role in Microsoft-heavy enterprises. Frequently required alongside the SC-200 for SOC/cloud security engineering teams. Pairs naturally with the Microsoft Defender and Sentinel ecosystem.

---

### 2.8 SC-200: Microsoft Security Operations Analyst

**Full Name:** Microsoft Certified: Security Operations Analyst Associate
**Issuing Body:** Microsoft
**Difficulty:** Intermediate

#### Background

SC-200 targets SOC analysts, threat hunters, and security operations personnel working in the Microsoft security ecosystem (Sentinel, Defender XDR, Defender for Cloud). The April 2026 revision was significant: it added Microsoft Security Copilot throughout, restructured domain weightings, and removed several sub-objectives to focus the exam on real-world threat operations.

#### Exam Format

- **Questions:** 40–60 (MCQ, case studies, KQL queries)
- **Duration:** 120 minutes
- **Passing Score:** 700 out of 1000
- **Cost:** $165 USD
- **Renewal:** Annual, free via Microsoft Learn online assessment

See [Section 4.4](#44-sc-200-full-syllabus-as-of-april-2026) for the complete domain breakdown.

#### Target Job Roles
- SOC Analyst (Tier 2/3)
- Security Operations Analyst
- Threat Hunter
- Incident Responder
- Security Engineer (detection engineering)

#### Average Salary Impact

- US average: **$101,657** (ZipRecruiter)
- Range: $95K–$150K depending on experience and seniority
- Paired with AZ-500: commonly seen together in $120K–$140K roles

#### Industry Recognition

Growing rapidly as Microsoft Defender and Sentinel adoption increases across enterprise environments. Required or preferred in virtually all Microsoft-centric SOC hiring.

---

### 2.9 CRTP — Certified Red Team Professional

**Full Name:** Certified Red Team Professional
**Issuing Body:** Altered Security (formerly Pentester Academy)
**Difficulty:** Beginner–Intermediate

#### Background

CRTP is the premier beginner-friendly red team certification focused entirely on Active Directory attack and defense. Created by Nikhil Mittal (author of Nishang), it is a 4-week bootcamp-style course that has established itself as the gold standard entry point into Active Directory red teaming.

#### Exam Format

- **Duration:** 24-hour hands-on exam in a fully patched multi-domain Active Directory lab
- **Goal:** Achieve Domain Admin / Enterprise Admin access across multiple domains
- **Report:** Written report required after the exam
- **Retake Fee:** $99

#### Syllabus / Course Topics

| Topic Area | Details |
|---|---|
| Active Directory Fundamentals | AD architecture, objects, forest/domain trust relationships |
| Enumeration | BloodHound, PowerView, manual LDAP enumeration, trust mapping |
| Local Privilege Escalation | Windows local escalation techniques |
| Domain Privilege Escalation | Kerberoasting, AS-REP Roasting, Constrained/Unconstrained Delegation |
| Domain Persistence | Golden Tickets, Silver Tickets, Skeleton Key, DSRM abuse |
| Cross-Domain / Forest Attacks | SID History, Forest Trust abuse, External Trust exploitation |
| AD Certificate Services (ADCS) | ESC1–ESC8 attack vectors, certificate-based privilege escalation |
| Defense Bypass | Credential Guard, Device Guard (WDAC), AMSI bypass, OPSEC |
| ACL-Based Attacks | ACL abuse for lateral movement and escalation |
| Advanced Features | LAPS, SID Filtering, Selective Authentication, PAW, Tiered Administration |
| Temporal Group Membership | Time-based access control attacks |

#### Cost

| Option | Price |
|---|---|
| On-Demand (30 days lab) | $249 |
| Bootcamp (instructor-led, 30 days lab) | $299 |
| Extended lab options | 60/90 day add-ons available |
| Retake fee | $99 |

#### Validity

3 years. Renewal at no additional cost via Altered Security's renewal process.

#### Target Job Roles
- Red Team Operator
- Active Directory Security Specialist
- Penetration Tester (internal network)
- Purple Team Member
- Security Research Analyst

#### Average Salary Impact

- Red Teamers with CRTP: **$110K–$170K** (range based on experience)
- Typical entry into red team roles: $90K–$120K
- Senior red team operators: $140K–$170K+

#### Industry Recognition

Widely cited as a prerequisite for more advanced red team certifications (CRTE, CRTO). Recognized in government, banking, and enterprise security hiring. Excellent practical value relative to cost.

---

### 2.10 PNPT — Practical Network Penetration Tester

**Full Name:** Practical Network Penetration Tester
**Issuing Body:** TCM Security
**Difficulty:** Intermediate

#### Background

PNPT was created by Heath Adams (The Cyber Mentor) as a legitimate, affordable alternative to OSCP with a focus on real-world penetration testing workflows including client communication. The included free lifetime retake policy and live debrief component make it unique in the industry.

#### Exam Format

- **Duration:** 5 full days to complete the penetration test assessment
- **Report:** 2 additional days to write a professional penetration test report
- **Debrief:** 15-minute live oral debrief with senior penetration testers
- **Retakes:** Lifetime free retakes included

#### What the Exam Covers

- OSINT and external reconnaissance
- Internal Active Directory network compromise
- A/V and egress bypassing
- Lateral and vertical network movement
- Domain Controller compromise
- Professional written penetration test report
- Live client debrief (oral defense of findings)

#### Cost

| Item | Cost |
|---|---|
| Exam Voucher (with 12-mo training access) | $499 |
| Lifetime retakes | Included |

#### Validity

Does not expire. Vouchers do not expire. Training access: 12 months from purchase.

#### Bundled Training Courses

The PNPT includes TCM Security's full penetration testing course bundle covering:
- Practical Ethical Hacking
- Linux Privilege Escalation
- Windows Privilege Escalation
- Open-Source Intelligence (OSINT) Fundamentals
- External Pentest Playbook

#### Target Job Roles
- Junior / Mid-Level Penetration Tester
- Offensive Security Consultant
- Bug Bounty Hunter (supplemental credential)
- Security Analyst (offensive track)

#### Average Salary Impact

- Entry-level penetration testers with PNPT: **$90,000+** (New York)
- Mid-level: $100K–$130K with experience
- Community and employer recognition growing rapidly in 2025–2026

#### Industry Recognition

Gaining significant momentum in 2025–2026. Respected for its practical rigor and honest representation of real-world skills. Increasingly accepted in job postings alongside or as an alternative to OSCP. Strong community backing from the TCM Security ecosystem.

---

### 2.11 OSWE — OffSec Web Expert

**Full Name:** OffSec Web Expert
**Issuing Body:** OffSec (Offensive Security)
**Difficulty:** Advanced

#### Background

OSWE is one of three certifications that compose OSCE3 (the OffSec elite trifecta alongside OSEP and OSED). The companion course is WEB-300: Advanced Web Attacks and Exploitation. It focuses exclusively on white-box (source code review) web application exploitation — a skill set largely absent from OSCP and CEH.

#### Exam Format

- **Duration:** 47 hours 45 minutes (practical exam)
- **Report:** 24 hours to upload documentation after exam ends
- **Format:** White-box exploitation — source code provided, no black-box guessing
- **Targets:** 2 web applications requiring complete exploitation chain development

#### WEB-300 Course (17 Modules)

| Topic Area | Details |
|---|---|
| Source Code Analysis | Manual code review methodologies, pattern identification |
| Authentication Bypass | Type juggling, logic flaws, insecure comparisons |
| Advanced SQL Injection | SQLi chains leading to Remote Code Execution |
| Server-Side Template Injection (SSTI) | Multiple frameworks (Jinja2, Twig, Freemarker) |
| Deserialization | .NET, Java, and PHP deserialization vulnerabilities |
| Cross-Site Scripting (Advanced) | XSS to account takeover chains |
| XML External Entity (XXE) | Server-side XXE exploitation |
| File Upload Vulnerabilities | Bypass techniques, polyglots, RCE via upload |
| OAuth Vulnerabilities | OAuth token theft, state parameter attacks |
| Second-Order SQL Injection | Stored injection patterns, delayed exploitation |
| Remote Code Execution Chains | Multi-step RCE from seemingly low-severity bugs |
| Script Exploitation | Python and PHP exploit development from scratch |
| 20 Challenge Labs | Additional practice machines for exam preparation |

#### Cost

| Option | Price |
|---|---|
| WEB-300 Course + Exam Bundle | $1,749 |
| Learn One Subscription | $2,749/year |
| Exam Retake | $249 |

#### Validity

OSWE is a lifetime credential (no expiry). Completing OSWE counts toward OSCE3.

#### Target Job Roles
- Web Application Penetration Tester
- Bug Bounty Hunter (web-specialist)
- Application Security Engineer (offensive)
- Vulnerability Researcher
- Red Team Operator (web-focused)

#### Average Salary Impact

- Web application penetration testers with OSWE: **$120K–$160K**
- OSCE3-complete professionals: command significant premium
- Frequently listed in 6-figure web security job postings as preferred/required

#### Industry Recognition

Elite-tier web security certification. Recognized as proof of deep, practical web exploitation skills. OSCE3 (OSWE + OSEP + OSED) is the most respected complete OffSec credential stack in offensive security.

---

### 2.12 eJPT — eLearnSecurity Junior Penetration Tester

**Full Name:** eLearnSecurity Junior Penetration Tester (eJPTv2)
**Issuing Body:** INE Security (formerly eLearnSecurity)
**Difficulty:** Beginner

#### Background

The eJPT is the ideal first hands-on security certification. Unlike Security+ (MCQ only), eJPT requires actual exploitation in a live lab environment. It is the recommended first practical certification for anyone entering offensive security before tackling PNPT or OSCP.

#### Exam Format

- **Duration:** 48 hours (practical lab environment)
- **Format:** Open-book — notes, documentation, and reference materials permitted
- **Questions:** Mixed practical tasks + knowledge checks

#### Core Exam Domains

| Domain | Coverage |
|---|---|
| Assessment Methodology | Penetration testing planning, scoping, and professional reporting |
| Host and Network Penetration Testing | Network scanning, service enumeration, vulnerability identification, exploitation |
| Web Application Penetration Testing | SQLi, XSS, directory traversal, authentication bypass |
| Networking Fundamentals | TCP/IP, routing, protocols relevant to pen testing |

#### Cost

| Option | Cost |
|---|---|
| eJPT + 3 months INE Fundamentals | $249 (includes exam voucher) |
| INE Fundamentals Annual | $299/year (includes exam voucher + broader content) |

#### Prerequisites

- Active INE subscription + valid eJPT exam voucher
- No formal prerequisites — beginner-friendly

#### Validity

Does not expire.

#### Target Job Roles
- Junior Penetration Tester
- SOC Analyst (offensive fundamentals)
- IT Security Graduate

#### Average Salary Impact

- Junior Penetration Testers: **$87,105** average (Glassdoor)
- Senior Penetration Testers: **$97,666** average (progression path)

#### Industry Recognition

Growing recognition as a credible entry-level practical cert. Increasingly cited in job postings for junior security analyst and junior pen tester roles. The low cost ($249) and practical format make it the highest-value entry credential currently available.

---

### 2.13 BSCP — Burp Suite Certified Practitioner

**Full Name:** Burp Suite Certified Practitioner
**Issuing Body:** PortSwigger (creators of Burp Suite)
**Difficulty:** Intermediate

#### Background

BSCP is an official certification from PortSwigger, the company that develops Burp Suite — the most widely used web application security testing tool in the world. Passing BSCP demonstrates deep knowledge of web security vulnerabilities, the mindset to exploit them, and proficiency with Burp Suite in a live exam environment.

#### Exam Format

- **Duration:** 4 hours
- **Structure:** 2 web applications, each with 3 stages
  - **Stage 1:** Gain access to any user account
  - **Stage 2:** Escalate to admin access (privilege escalation or account compromise)
  - **Stage 3:** Use admin access to read `/home/carlos/secret` from the server filesystem
- **Environment:** Fully practical, no MCQ

#### Vulnerability Coverage

The exam draws from the full PortSwigger Web Security Academy curriculum including:

| Category | Topics |
|---|---|
| Injection | SQLi (manual + filter bypass), Command Injection, XXE |
| Authentication | Brute force, multi-factor bypass, OAuth flaws |
| Access Control | IDOR, parameter tampering, horizontal/vertical escalation |
| Server-Side | SSRF, SSTI, deserialization |
| Client-Side | XSS (reflected, stored, DOM), CSRF, CORS misconfigs |
| Advanced | HTTP request smuggling, Web cache poisoning, JWT attacks |
| Prototype Pollution | Client-side and server-side prototype pollution |
| GraphQL | GraphQL API security testing |
| Race Conditions | Timing attacks, parallel request exploitation |

#### Cost

$99 — the lowest-priced practical certification on this list.

#### Validity

5 years.

#### Target Job Roles
- Web Application Penetration Tester
- Bug Bounty Hunter
- Application Security Engineer
- Security Researcher

#### Average Salary Impact

- Web application security roles: **$100K–$140K** (role-dependent)
- Bug bounty earnings are separate but BSCP demonstrates credible skill to invite-only platforms

#### Industry Recognition

Rapidly growing recognition in web security and bug bounty communities. The $99 price point and genuine technical difficulty make it exceptional value. Frequently cited on HackerOne and Bugcrowd profiles as a credential indicator. Used by security teams to validate web-testing competency of external consultants.

---

### 2.14 GPEN — GIAC Penetration Tester

**Full Name:** GIAC Penetration Tester
**Issuing Body:** GIAC (Global Information Assurance Certification) / SANS Institute
**Difficulty:** Intermediate

#### Background

GPEN is the flagship penetration testing certification from GIAC/SANS, the premier security training organization for government, military, and enterprise professionals. Unlike OSCP (pure practical), GPEN is a knowledge-based exam tied to SANS course SEC560: Enterprise Penetration Testing.

#### Exam Format

- **Questions:** 82 (multiple choice + lab questions with terminal interaction)
- **Duration:** 180 minutes
- **Passing Score:** 73% (updated July 12, 2025)
- **Delivery:** Remote proctored (ProctorU) or in-person (PearsonVUE)
- **Open book:** GIAC exams are open book (printed notes allowed)

#### Exam Topics

| Topic Area | Coverage |
|---|---|
| Pre-Engagement & Scoping | Rules of engagement, legal frameworks, scoping documents |
| Reconnaissance & Footprinting | Target profiling, DNS interrogation, network mapping, OSINT |
| Scanning and Enumeration | Nmap, vulnerability scanners, protocol analysis |
| Exploitation | Shellcode injection, known CVEs, post-exploit access |
| Password Attacks | Hash cracking, brute-force, credential stuffing, rainbow tables |
| Privilege Escalation | Windows/Linux escalation, token manipulation, service exploitation |
| Pivoting and Lateral Movement | Tunneling, proxy chains, network pivoting |
| Active Directory Attacks | Kerberos attacks, domain exploitation |
| Cloud Penetration Testing | Azure overview, Azure integration and attack techniques |
| Reporting | Professional penetration test report writing standards |

#### Cost

| Item | Cost |
|---|---|
| GPEN Exam | $999 |
| Exam Retake | $899 |
| Attempt Extension | $479 |
| SANS SEC560 Course (recommended) | $5,000–$8,000 |

#### Validity

4 years. Renewal requires 36 CPE (Continuing Professional Experience) credits.

#### Target Job Roles
- Penetration Tester
- Red Team Operator
- Security Consultant
- Federal/Government Security Analyst
- Network Security Engineer

#### Average Salary Impact

- Average US salary: **$117,000–$130,000**
- Payscale (2025): **$117,000** annual average
- Premium reflects SANS/GIAC reputation in government and enterprise

#### Industry Recognition

Highly valued in US federal government, military, and defense contractor environments. GIAC certifications are frequently listed in DoD/DISA contract requirements. SANS GPEN is considered on par with OSCP for government security roles and often exceeds OSCP recognition in compliance-heavy enterprise environments.

---

## 3. What Amazon, Google & Microsoft Require

### 3.1 Amazon (AWS)

**Security Engineer / Penetration Testing Engineer — AWS Proactive Security**

Based on publicly available Amazon job postings and their hiring criteria:

**Preferred/Accepted Certifications:**
- AWS Certified Security — Specialty (most aligned, naturally)
- OSCP (listed as preferred in penetration testing roles)
- CISSP (for senior security architect roles)
- CEH (for compliance-adjacent roles)
- CISA, GIAC (noted in various postings)

**Typical Requirements:**
- Bachelor's degree in Computer Science, Engineering, or related field
- 5+ years of experience with AWS security architecture
- Experience with cloud-native security tools (GuardDuty, Security Hub, IAM)
- Strong programming skills (Python, Go, Java)
- Experience with penetration testing and red team operations (for offensive roles)
- Knowledge of OWASP Top 10, MITRE ATT&CK, CVE research

**Key Observation:** Amazon security roles heavily favor AWS-native knowledge and its own Security Specialty certification. For penetration testing engineer roles specifically, OSCP or equivalent practical experience is preferred. CISSP is more commonly requested for senior engineering and architect roles.

---

### 3.2 Google

**Security Engineer, Red Team — Google**

Based on Google Careers job postings for red team and security engineering roles:

**Preferred/Listed Certifications:**
- OSCP (listed explicitly in multiple red team job postings)
- OSCE, OSEP, OSEE (listed for senior red team roles)
- CCSAS (Certified Cloud Security Architecture Specialist)
- CCT INF (CREST Certified Infrastructure Tester)
- Relevant SANS/GIAC courses and certifications

**Minimum Qualifications (typical):**
- 3 years experience with penetration testing and red teaming (network, web, mobile, cloud, social engineering, scripting, tool development)
- Experience creating security tools and programming (Python, C#, etc.)

**Preferred Qualifications (senior):**
- 5 years of penetration testing and red teaming experience
- Security tool development
- Source code review experience
- Reverse engineering skills

**Compensation:** US base salary for Red Team Security Consultant at Google: **$113,000–$161,000 + bonus + equity + benefits**

**Key Observation:** Google explicitly lists OffSec certifications (OSCP, OSCE, OSEP, OSEE) in its red team job postings. CISSP is less commonly required for technical roles — Google prioritizes practical skills and tool development ability. Google Professional Cloud Security Engineer is naturally valued for GCP-focused security roles.

---

### 3.3 Microsoft

**Security Engineer / Red Team Engineer — Microsoft**

Based on Microsoft Careers job postings and certification guidance:

**Expected/Preferred Certifications:**
- AZ-500 (Azure Security Engineer Associate) — strongly aligned to Azure security engineering roles
- SC-200 (Security Operations Analyst) — required/preferred for SOC and detection engineering
- OSCP (for penetration testing and red team roles)
- CISSP (for senior security architect roles)
- Microsoft Security stack certifications (SC-100, SC-300, SC-400)

**Typical Requirements:**
- Proficiency with Microsoft Defender XDR, Microsoft Sentinel, Defender for Cloud
- Experience with Azure AD / Microsoft Entra ID
- KQL (Kusto Query Language) proficiency
- Incident response and threat hunting experience
- For red team roles: OSCP or equivalent hands-on pentesting certification

**Key Observation:** Microsoft security roles divide into two tracks — defensive (SOC/detection engineering, requiring SC-200 + AZ-500) and offensive (red team, requiring OSCP + practical skills). Microsoft strongly prefers its own certification ecosystem but accepts OSCP for offensive roles.

---

### Summary Table: Big Tech Certification Preferences

| Company | Cloud Cert Preferred | Offensive Cert Preferred | Senior/Architecture |
|---|---|---|---|
| **Amazon (AWS)** | AWS Security Specialty (SCS-C03) | OSCP | CISSP |
| **Google** | Google Cloud Security Engineer | OSCP, OSCE, OSEP, OSEE | CISSP (some roles) |
| **Microsoft** | AZ-500, SC-200 | OSCP | CISSP, SC-100 |

---

## 4. Company-Owned Cloud Security Certifications — Full Domain Breakdowns

### 4.1 AWS Certified Security — Specialty (SCS-C03)

**Current Exam Version:** SCS-C03 (launched December 2, 2025)
**Cost:** $300 | **Validity:** 3 years | **Format:** 65 questions (50 scored), 170 minutes

#### Domain 1: Detection (16%)

- Implement and manage security monitoring using AWS services
- Configure AWS CloudTrail for API activity logging and management events
- Set up Amazon CloudWatch and CloudWatch Logs for metric-based alerting
- Enable and manage AWS Config for resource compliance and configuration drift
- Configure Amazon GuardDuty for threat intelligence and anomaly detection
- Implement AWS Security Hub to aggregate and normalize findings
- Set up Amazon Detective for investigation and root cause analysis
- Enable VPC Flow Logs, DNS query logs, and S3 access logging
- Collect and analyze logs using Amazon Athena and AWS Glue
- Build centralized logging using Amazon OpenSearch Service / CloudWatch Logs Insights

#### Domain 2: Incident Response (14%)

- Automate incident response using AWS Lambda and Step Functions
- Create playbooks using AWS Systems Manager Automation
- Isolate compromised EC2 instances using security groups and VPC NACLs
- Use AWS Systems Manager Session Manager for forensic access to instances
- Preserve volatile data and disk images for forensic analysis
- Remediate exposed credentials via AWS IAM and Secrets Manager rotation
- Revoke IAM credentials and rotate access keys using AWS Config rules
- Implement Amazon S3 bucket policies to prevent further exposure
- Apply containment strategies using AWS WAF, Shield, and Firewall Manager
- Conduct post-incident analysis and apply lessons learned

#### Domain 3: Infrastructure Security (18%)

- Design edge security using Amazon CloudFront, AWS WAF, and Shield
- Implement network isolation using VPC security groups and NACLs
- Configure private connectivity with AWS PrivateLink and VPC endpoints
- Deploy AWS Network Firewall for deep packet inspection
- Implement AWS Firewall Manager for centralized policy management
- Secure container workloads using Amazon ECR scanning and ECS/EKS security
- Configure AWS Systems Manager Patch Manager for vulnerability management
- Implement AWS Inspector for EC2 and ECR vulnerability assessments
- Harden AMIs using EC2 Image Builder and golden image pipelines
- Secure serverless architectures using Lambda function policies and VPC integration
- Implement Secure Supply Chain using AWS CodeArtifact and signing

#### Domain 4: Identity and Access Management (20%)

- Design and implement IAM policies using least-privilege principles
- Manage IAM roles, users, groups, and permission boundaries
- Implement AWS Organizations SCPs (Service Control Policies) for guardrails
- Configure AWS IAM Identity Center (formerly SSO) for federated access
- Manage cross-account access using resource-based and identity-based policies
- Implement ABAC (Attribute-Based Access Control) with IAM tags and conditions
- Configure AWS Cognito for user authentication in applications
- Secure service-to-service authentication using IAM roles for EC2/Lambda
- Implement just-in-time privileged access using AWS IAM Identity Center
- Audit IAM configurations using IAM Access Analyzer and Access Advisor

#### Domain 5: Data Protection (18%)

- Implement encryption at rest using AWS KMS (Customer Managed Keys, CMKs)
- Configure BYOK (Bring Your Own Key) using AWS CloudHSM
- Manage TLS/SSL certificates using AWS Certificate Manager (ACM)
- Encrypt S3 data using SSE-S3, SSE-KMS, and SSE-C options
- Implement S3 Object Lock for WORM (Write Once Read Many) compliance
- Configure Amazon Macie for sensitive data discovery and classification
- Protect data in transit using TLS enforcement on API Gateway, ALB, and S3
- Implement database encryption for RDS, Aurora, DynamoDB, and Redshift
- Manage secrets using AWS Secrets Manager with automatic rotation
- Implement data residency controls using S3 bucket policies and SCPs
- **Generative AI Security (new 2025–2026):** Secure Amazon Bedrock workloads, implement guardrails for LLM applications, protect model training data, use GuardDuty ML threat detection

#### Domain 6: Security Foundations and Governance (14%)

- Implement AWS Well-Architected Framework Security Pillar
- Apply security best practices across AWS account structures
- Use AWS Trusted Advisor for security checks and cost optimization
- Implement multi-account security strategies using AWS Control Tower
- Apply NIST CSF, CIS Benchmarks, and PCI DSS controls in AWS
- Manage compliance and audit evidence using AWS Audit Manager
- Implement tagging strategies for cost allocation and security governance
- Understand AWS shared responsibility model
- Use AWS Artifact for accessing compliance reports and agreements

---

### 4.2 Google Professional Cloud Security Engineer

**Cost:** $200 | **Validity:** 2–3 years | **Format:** 60 questions, 120 minutes, ~70% passing score

#### Section 1: Configuring Access within a Cloud Solution Environment (~25%)

- **IAM and Service Accounts:**
  - Design and implement IAM policies (predefined vs. custom roles)
  - Configure service account creation, binding, and impersonation
  - Implement Workload Identity Federation for external identities
  - Apply principle of least privilege using IAM Recommender
  - Manage IAM conditions for time-based or attribute-based access
  - Audit IAM policies using Policy Analyzer and IAM Recommender

- **BeyondCorp and Zero Trust:**
  - Configure Access Context Manager policies
  - Implement BeyondCorp Enterprise for context-aware access
  - Configure Identity-Aware Proxy (IAP) for application access
  - Implement Endpoint Verification for device posture checks

- **Resource Hierarchy and Organization Policies:**
  - Apply Organization Policies to restrict resource configurations
  - Configure folder and project-level IAM inheritance
  - Implement VPC Service Controls perimeters

#### Section 2: Configuring Network Security (~22%)

- **VPC and Firewall Rules:**
  - Design VPC architecture with firewall rules and network tags
  - Implement Hierarchical Firewall Policies
  - Configure Private Google Access and Private Service Connect

- **Network Security Services:**
  - Deploy and configure Cloud Armor (WAF rules, DDoS protection)
  - Implement Cloud CDN with HTTPS enforcement
  - Configure Google Cloud Load Balancing with SSL policies
  - Deploy Cloud NAT for outbound traffic control
  - Use Packet Mirroring for network traffic analysis

- **Interconnect and VPN Security:**
  - Secure Cloud Interconnect and Cloud VPN configurations
  - Implement Shared VPC for centralized network security
  - Configure VPC Flow Logs for traffic analysis and anomaly detection

#### Section 3: Ensuring Data Protection (~23%)

- **Key Management:**
  - Implement Cloud KMS for symmetric and asymmetric key management
  - Configure Customer-Managed Encryption Keys (CMEK) across services
  - Use Cloud HSM for hardware-backed key management
  - Implement Customer-Supplied Encryption Keys (CSEK) for GCS

- **Data Loss Prevention:**
  - Configure DLP API for scanning and de-identifying sensitive data
  - Implement data classification and labeling with Cloud Data Catalog
  - Use DLP inspection templates for PII, PCI, and PHI data types

- **Secret and Certificate Management:**
  - Use Secret Manager for API key and credential management
  - Manage TLS certificates with Certificate Manager and ACM
  - Implement certificate rotation and pinning strategies

- **AI/ML Security (new 2025–2026):**
  - Apply security and privacy controls for Vertex AI workloads
  - Manage training data security and access controls
  - Implement guardrails for generative AI applications on Google Cloud

#### Section 4: Managing Operations (~17%)

- **Security Command Center (SCC):**
  - Configure SCC Standard and Premium tiers
  - Manage and respond to SCC findings (vulnerabilities, misconfigs, threats)
  - Configure SCC Event Threat Detection and Container Threat Detection

- **Logging and Monitoring:**
  - Configure Cloud Audit Logs (Admin Activity, Data Access, System Event)
  - Use Cloud Logging for security log aggregation and retention
  - Build security dashboards using Cloud Monitoring and Looker Studio
  - Implement log exports to Cloud Storage, BigQuery, and Pub/Sub
  - Configure log-based alerts and metrics

- **Incident Response:**
  - Use Chronicle SIEM for threat detection and investigation
  - Implement Security Operations Center workflows in Chronicle
  - Apply playbook automation using Security Operations (SOAR) integration

- **Software Supply Chain Security:**
  - Configure Binary Authorization for container image signing
  - Use Cloud Build with supply chain security controls
  - Implement Artifact Registry scanning with Container Analysis
  - Apply SLSA (Supply-chain Levels for Software Artifacts) framework

#### Section 5: Supporting Compliance Requirements (~13%)

- **Regulatory Frameworks:**
  - Map Google Cloud controls to PCI DSS, HIPAA, GDPR, and SOC 2
  - Use Compliance Reports Manager (formerly Compliance Resource Center)
  - Implement Assured Workloads for FedRAMP, IL4, and CJIS compliance
  - Configure Access Transparency and Access Approval for regulated industries

- **Compliance Automation:**
  - Use Forseti Security / Security Command Center for policy compliance
  - Implement Policy Controller (Anthos Config Management)
  - Apply Organization Policy Constraints for compliance enforcement
  - Generate compliance evidence and audit trails

---

### 4.3 AZ-500 Full Syllabus (as of January 2026)

**Cost:** $165 | **Validity:** Annual (free online renewal) | **Retiring:** August 31, 2026

#### Domain 1: Secure Identity and Access (15–20%)

**Manage security controls for identity and access:**
- Manage Azure built-in role assignments
- Manage custom roles (Azure roles and Microsoft Entra roles)
- Plan and manage Azure resources in Microsoft Entra Privileged Identity Management (settings and assignments)
- Implement Multi-Factor Authentication (MFA) for Azure resources
- Implement Conditional Access policies for cloud resources

**Manage Microsoft Entra application access and managed identities:**
- Manage access to enterprise applications in Microsoft Entra ID (including OAuth permission grants)
- Manage Microsoft Entra app registrations
- Configure app registration permission scopes
- Manage app registration permission consent
- Manage and use service principals
- Manage managed identities

#### Domain 2: Secure Networking (20–25%)

**Plan and implement security for virtual networks:**
- Plan and implement Network Security Groups (NSGs) and Application Security Groups (ASGs)
- Manage virtual networks using Azure Virtual Network Manager
- Plan and implement User-Defined Routes (UDRs)
- Plan and implement Virtual Network peering and VPN gateway
- Plan and implement Virtual WAN including secured virtual hub
- Secure VPN connectivity (point-to-site and site-to-site)
- Implement encryption over ExpressRoute
- Configure firewall settings on Azure resources
- Monitor network security using Network Watcher

**Plan and implement security for private access to Azure resources:**
- Plan and implement virtual network Service Endpoints
- Plan and implement Private Endpoints
- Plan and implement Private Link services
- Plan and implement network integration for Azure App Service and Azure Functions
- Plan and implement network security configurations for App Service Environment (ASE)
- Plan and implement network security configurations for Azure SQL Managed Instance

**Plan and implement security for public access to Azure resources:**
- Plan and implement TLS for applications (App Service and API Management)
- Plan, implement, and manage Azure Firewall (including Firewall Manager and policies)
- Plan and implement Azure Application Gateway
- Plan and implement Azure Front Door including CDN
- Plan and implement Web Application Firewall (WAF)
- Recommend when to use Azure DDoS Protection Standard

#### Domain 3: Secure Compute, Storage, and Databases (20–25%)

**Plan and implement advanced security for compute:**
- Plan and implement remote access to VMs (Azure Bastion and JIT VM access)
- Configure network isolation for Azure Kubernetes Service (AKS)
- Secure and monitor AKS
- Configure authentication for AKS
- Configure security monitoring for Azure Container Instances (ACIs)
- Configure security monitoring for Azure Container Apps (ACAs)
- Manage access to Azure Container Registry (ACR)
- Configure disk encryption (ADE, encryption at host, confidential disk encryption)
- Recommend security configurations for Azure API Management

**Plan and implement security for storage:**
- Configure access control for storage accounts
- Manage storage account access keys
- Select and configure appropriate method for Azure Files access
- Select and configure appropriate method for Azure Blob Storage access
- Configure data protection (soft delete, backups, versioning, immutable storage)
- Configure Bring Your Own Key (BYOK)
- Enable double encryption at Azure Storage infrastructure level

**Plan and implement security for Azure SQL Database and Azure SQL Managed Instance:**
- Enable Microsoft Entra database authentication
- Enable database auditing
- Plan and implement dynamic masking
- Implement Transparent Data Encryption (TDE)
- Recommend when to use Azure SQL Database Always Encrypted

#### Domain 4: Secure Azure Using Microsoft Defender for Cloud and Microsoft Sentinel (30–35%)

**Implement and manage enforcement of cloud governance policies:**
- Create, assign, and interpret policies and initiatives in Azure Policy
- Configure Azure Key Vault network settings
- Configure access to Key Vault (vault access policies and RBAC)
- Manage certificates, secrets, and keys
- Configure key rotation
- Perform backup and recovery of certificates, secrets, and keys
- Implement security controls to protect backups
- Implement security controls for asset management

**Manage security posture using Microsoft Defender for Cloud:**
- Identify and remediate security risks using Secure Score and Inventory
- Assess compliance against security frameworks
- Manage compliance standards in Microsoft Defender for Cloud
- Add custom standards to Defender for Cloud
- Connect hybrid and multi-cloud environments (AWS and GCP)
- Implement and use Microsoft Defender External Attack Surface Management (EASM)

**Configure and manage threat protection using Microsoft Defender for Cloud:**
- Enable cloud workload protection plans
- Configure Microsoft Defender for Servers, Databases, and Storage
- Implement and manage agentless scanning for VMs
- Implement Microsoft Defender Vulnerability Management for Azure VMs
- Connect to and configure Defender for Cloud DevOps Security (GitHub, Azure DevOps, GitLab)

**Configure and manage security monitoring and automation solutions:**
- Manage and respond to security alerts in Defender for Cloud
- Configure workflow automation in Defender for Cloud
- Monitor network security events and performance using Azure Monitor DCRs
- Configure data connectors in Microsoft Sentinel
- Enable analytics rules in Microsoft Sentinel
- Configure automation in Microsoft Sentinel

---

### 4.4 SC-200 Full Syllabus (as of April 2026)

**Cost:** $165 | **Validity:** Annual (free online renewal)

*Note: The April 16, 2026 update significantly restructured this exam. The following reflects the current version.*

#### Domain 1: Manage a Security Operations Environment (40–45%)

**Configure automation for Microsoft Defender XDR and Microsoft Sentinel:**
- Configure email notifications in Defender XDR (incidents, actions, threat analytics)
- Configure and tune alert notifications in Defender XDR
- Configure Microsoft Defender for Endpoint advanced features
- Configure rules settings and custom data collection in Defender for Endpoint
- Configure security policies for Defender for Endpoint (including ASR rules)
- Manage automated investigation and response capabilities in Defender XDR
- Configure automatic attack disruption in Defender XDR
- Configure device groups, permissions, and automation levels in Defender for Endpoint
- Create and configure automation rules in Microsoft Sentinel
- Create and configure Microsoft Sentinel playbooks

**Configure the Microsoft Sentinel SIEM and platform:**
- Specify Microsoft Sentinel roles and permissions
- Manage data retention for XDR and Sentinel tables (Analytics, Data lake, XDR tiers)
- Create and configure Microsoft Sentinel workbooks
- Optimize the Sentinel platform (SOC optimization recommendations)

**Ingest data into the Microsoft Sentinel SIEM and platform:**
- Select data connectors based on data source requirements
- Configure Windows Security Events collection using Windows Security Events via AMA
- Plan and configure Windows Security Events collection via WEF
- Configure Syslog via AMA and CEF via AMA connectors
- Configure Azure activities collection via Azure Policy and resource diagnostic settings
- Ingest threat indicators into Microsoft Sentinel
- Create custom log tables in the workspace

**Configure detections:**
- Create custom detection rules using Advanced Hunting in Defender XDR
- Manage custom detection rules in Defender XDR
- Configure and manage analytics rules in Sentinel (scheduled, NRT, threat intelligence, ML)
- Analyze attack vector coverage using the MITRE ATT&CK matrix
- Configure anomalies in Microsoft Sentinel

#### Domain 2: Respond to Security Incidents (35–40%)

**Respond to alerts and incidents in Microsoft Defender XDR:**
- Investigate and remediate threats using Microsoft Defender for Office 365
- Investigate and remediate threats identified by Microsoft Purview
- Investigate and remediate alerts from Microsoft Defender for Cloud workload protections
- Investigate and remediate security risks from Microsoft Defender for Cloud Apps
- Investigate and remediate compromised identities from Microsoft Entra ID
- Investigate and remediate security alerts from Microsoft Defender for Identity
- Investigate and remediate alerts from Microsoft Sentinel
- Investigate incidents using agentic AI and embedded Copilot for Security
- Investigate complex attacks (multi-stage, multi-domain, lateral movement)
- Manage security incidents using case management

**Respond to alerts and incidents in Microsoft Defender for Endpoint:**
- Investigate device timelines
- Perform actions on devices (live response, collecting investigation packages)
- Perform evidence and entity investigation
- Investigate and remediate automatic attack disruption incidents

**Investigate Microsoft 365 activities to identify threats:**
- Investigate threats using Audit from Microsoft Purview
- Investigate threats using Content Search in Microsoft Purview
- Investigate threats using Microsoft Graph activity logs

#### Domain 3: Perform Threat Hunting (20–25%)

**Detect threats using Microsoft Defender XDR:**
- Identify the appropriate table for KQL queries
- Identify threats using KQL (Advanced Hunting)
- Create Advanced Hunting queries across Defender XDR tables
- Interpret threat analytics in Microsoft Defender XDR
- Create hunting graphs including blast radius analysis
- Analyze entity relationships using Sentinel Graph

**Detect threats using the Microsoft Sentinel platform:**
- Create and monitor hunting queries
- Create and manage KQL jobs in Data lake
- Create and manage Summary rule tables for querying
- Hunt for threats using Notebooks (including Sentinel MCP Server connection)

---

## 5. Rankings — Best Cert by Career Path

### 5.1 Best Certs for FAANG / Big Tech Security Jobs

| Rank | Certification | Rationale |
|---|---|---|
| 1 | **CISSP** | Most requested senior security credential. CISSP holders at FAANG-tier earn $200K–$300K+ total comp. Payback under 2 weeks. |
| 2 | **AWS Security Specialty** (SCS-C03) | Critical for Amazon/AWS roles. Highest dollar ROI: $300 exam, $18K–$25K salary bump. |
| 3 | **Google Cloud Security Engineer** | Required alignment for Google Cloud roles. Highest average North American salary of any cert in this list ($201K). |
| 4 | **OSCP / OSCP+** | Explicitly listed in Google and Amazon red team/offensive security job postings. |
| 5 | **AZ-500 + SC-200** | Required combination for Microsoft security engineering roles. |

**Strategic recommendation:** For FAANG security roles, target **CISSP + one cloud specialty cert** (AWS, Google, or Azure depending on target company). CISSP provides the senior-level credibility; cloud certs demonstrate environment-specific expertise.

---

### 5.2 Best Certs for Penetration Testing Career

| Rank | Certification | Why |
|---|---|---|
| 1 | **OSCP / OSCP+** | Gold standard. Explicitly required in 35%+ of pen testing job postings. Validates real-world exploitation ability in a 24-hour practical exam. No other cert carries this universal weight. |
| 2 | **PNPT** | Best value alternative. $499, lifetime retakes, includes debrief. Rapidly gaining employer acceptance. Ideal companion or precursor to OSCP. |
| 3 | **GPEN** | Required for federal/government pen testing contracts. Open-book exam tied to SANS SEC560. Excellent for DoD/defense contractor roles. |
| 4 | **eJPT** | Best entry point before OSCP. Practical, affordable ($249), beginner-accessible. Demonstrates you can actually exploit systems. |
| 5 | **CEH** | Only if job postings specifically require it. Multiple-choice format limits practitioner credibility. Skip for OSCP if given a choice. |

**Strategic progression:** eJPT → PNPT → OSCP → GPEN (if targeting federal work) or OSWE (if specializing in web app testing)

---

### 5.3 Best Certs for Red Team Work

| Rank | Certification | Why |
|---|---|---|
| 1 | **OSCP / OSCP+** | Baseline requirement for virtually all red team roles. Active Directory component (40% of exam) directly relevant. |
| 2 | **CRTP** | Best dedicated Active Directory red team cert. Exceptional value ($249). Teaches real AD attack chains including ADCS, Kerberos, and forest trust abuse. |
| 3 | **OSWE** | Web-focused component of red team operations. White-box source code analysis skills are highly differentiated. |
| 4 | **GPEN** | Strong for enterprise red team roles. Azure attack content added in 2025 makes it more relevant to modern environments. |
| 5 | **CRTO** (honorable mention) | Certified Red Team Operator by Zero-Point Security. Focuses on Cobalt Strike C2 operations. Increasingly listed in red team job postings. |

**Advanced red team stack:** OSCP + CRTP + OSWE = strong full-stack red teamer. OSCP + OSEP + OSED + OSWE = OSCE3 (elite OffSec credential).

---

### 5.4 Best Certs for Bug Bounty

| Rank | Certification | Why |
|---|---|---|
| 1 | **BSCP** | Directly validates web exploitation skills that map 1:1 to bug bounty findings. $99 cost. 5-year validity. PortSwigger's own cert proves Burp Suite mastery. |
| 2 | **OSWE** | Deep source code analysis and web exploitation skills. White-box methodology translates to program-specific source code access at big companies. |
| 3 | **OSCP / OSCP+** | Validates general exploitation methodology. Useful for infrastructure bug bounty and invite-only programs. |
| 4 | **eJPT** | Entry-level signal to bug bounty platforms and private programs that a hunter has validated foundational skills. |

**Note:** Bug bounty does not require certifications — skill and a strong portfolio are primary. However, certs provide credibility for invite-only programs and for companies that want to hire bounty hunters onto internal teams.

---

### 5.5 Best Cert for Overall ROI

| Rank | Certification | Cost | Salary Boost | Payback |
|---|---|---|---|---|
| 1 | **CISSP** | $749 | +$25K–$35K/yr | < 2 weeks |
| 2 | **AWS Security Specialty** | $300 | +$18K–$25K/yr | < 1 week |
| 3 | **CompTIA Security+** | $425 | +$5K–$10K/yr | < 1 month |
| 4 | **OSCP** | $1,749 | +$20K–$30K/yr | < 3 weeks |
| 5 | **BSCP** | $99 | +$10K–$20K/yr (role) | < 1 week |

---

## 6. Salary Comparison Table

| Certification | Level | Avg US Salary | Entry | Mid | Senior |
|---|---|---|---|---|---|
| AWS Security Specialty | Advanced | $158K–$200K | $120K | $158K | $200K+ |
| Google Cloud Security Eng. | Advanced | $152K–$201K | $110K | $152K | $200K+ |
| CISSP | Advanced | $131K–$165K | $100K | $131K | $200K+ (FAANG) |
| OSCP / OSCP+ | Advanced | $120K–$151K | $85K | $120K | $168K+ |
| OSWE | Advanced | $120K–$160K | $90K | $130K | $160K+ |
| AZ-500 | Intermediate | $120K–$145K | $90K | $126K | $145K+ |
| CRTP | Beginner–Int | $110K–$170K | $90K | $130K | $170K+ |
| GPEN | Intermediate | $117K–$130K | $100K | $117K | $130K+ |
| PNPT | Intermediate | $90K–$130K | $75K | $100K | $130K+ |
| SC-200 | Intermediate | $101K–$150K | $79K | $101K | $150K+ |
| CEH | Intermediate | $90K–$110K | $75K | $95K | $110K+ |
| BSCP | Intermediate | $100K–$140K | $80K | $110K | $140K+ |
| Security+ | Entry | $85K–$105K | $70K | $88K | $105K+ |
| eJPT | Beginner | $80K–$97K | $65K | $87K | $97K+ |

*Salaries reflect US market data compiled from ZipRecruiter, Glassdoor, Payscale, and ISC2 reports as of Q1–Q2 2026.*

---

## 7. ROI Analysis

### Full ROI Breakdown

| Certification | Exam Cost | Total Investment (with training) | Annual Salary Boost | Payback Period | 5-Year Value |
|---|---|---|---|---|---|
| **AWS Security Specialty** | $300 | $500–$2,000 | +$18K–$25K | < 1 week | $90K–$125K |
| **CISSP** | $749 | $1,500–$3,000 | +$25K–$35K | < 2 weeks | $125K–$175K |
| **BSCP** | $99 | $99–$500 | +$10K–$20K | < 1 week | $50K–$100K |
| **Security+** | $425 | $500–$1,500 | +$5K–$10K | < 1 month | $25K–$50K |
| **OSCP** | $1,749 | $2,000–$3,000 | +$20K–$30K | < 3 weeks | $100K–$150K |
| **CRTP** | $249 | $250–$500 | +$15K–$25K (role entry) | < 1 week | $75K–$125K |
| **PNPT** | $499 | $500–$1,000 | +$10K–$20K | < 1 month | $50K–$100K |
| **AZ-500** | $165 | $500–$1,500 | +$10K–$20K | < 2 weeks | $50K–$100K |
| **eJPT** | $249 | $249–$500 | Career entry | Entry enabler | Career-defining |
| **CEH** | $1,200+ | $2,500–$4,000 | +$5K–$15K | 2–4 months | $25K–$75K |
| **GPEN** | $999 | $6,000–$9,000 (with SANS) | +$15K–$25K | 3–6 months | $75K–$125K |

**GPEN/SANS ROI caveat:** The GPEN exam alone costs $999, but SANS training (SEC560) costs $5,000–$8,000. Employers in government/defense often reimburse SANS training, changing the ROI calculation significantly.

---

## 8. Certification Roadmaps

### Roadmap A — Penetration Testing Career (0 to 3 years)

```
[MONTH 1–3]   CompTIA Security+ or eJPT
                ↓ Build foundational knowledge
[MONTH 4–8]   PNPT (TCM Security)
                ↓ Practical pen testing with real methodology + debrief
[MONTH 9–18]  OSCP / OSCP+ (PEN-200)
                ↓ Industry-standard practical certification
[YEAR 2–3]    GPEN (if targeting government) OR
              OSWE (if specializing in web apps) OR
              CRTP (if specializing in internal network/AD)
```

**Target salary trajectory:** $70K entry → $90K (PNPT) → $120K (OSCP) → $140K–$160K (specialized)

---

### Roadmap B — Red Team Specialist

```
[MONTH 1–6]   OSCP / OSCP+ (mandatory baseline)
                ↓
[MONTH 7–9]   CRTP (Altered Security — Active Directory focus)
                ↓
[MONTH 10–12] CRTE or CRTO (advanced AD / C2 operations)
                ↓
[YEAR 2+]     OSEP (OffSec Experienced Penetration Tester)
              OSWE (web-focused red team)
              Goal: OSCE3 (OSWE + OSEP + OSED)
```

**Target salary:** $100K (junior) → $130K (CRTP + OSCP) → $160K–$200K+ (senior red team operator)

---

### Roadmap C — FAANG Security Engineer

```
[YEAR 0–1]    CompTIA Security+ (foundation + hiring filter)
                ↓
[YEAR 1–2]    Choose cloud specialty:
              AWS: AWS Solutions Architect → AWS Security Specialty
              Google: Google Associate Cloud Engineer → Google Cloud Security Eng.
              Microsoft: AZ-900 → AZ-500 + SC-200
                ↓
[YEAR 3–5]    CISSP (after meeting 5-year experience requirement)
              [Optional] CCSP (if cloud architect track)
```

**Target total compensation:** $140K (cloud cert) → $200K+ (CISSP + senior at FAANG)

---

### Roadmap D — Bug Bounty Hunter

```
[MONTH 1–3]   PortSwigger Web Security Academy (free) — all labs
                ↓
[MONTH 4–6]   eJPT (foundational practical cert)
                ↓
[MONTH 7–9]   BSCP (Burp Suite Certified Practitioner — $99, directly relevant)
                ↓
[MONTH 10–18] OSCP (for infrastructure bug bounty scope + credibility)
              OSWE (for white-box programs + source code review)
```

**Note:** Certifications are supplementary to skill and a public vulnerability disclosure portfolio. Focus on building a write-up portfolio on HackerOne and Bugcrowd alongside certifications.

---

### Roadmap E — SOC / Blue Team Career

```
[MONTH 1–3]   CompTIA Security+
                ↓
[MONTH 4–8]   SC-200 (Microsoft Security Operations Analyst)
                ↓
[MONTH 9–12]  AZ-500 (Azure Security Engineer — for cloud security roles)
                ↓
[YEAR 2–4]    CISSP (management/architecture track)
              CySA+ (CompTIA — vendor-neutral blue team)
              GCFE / GCIH (GIAC — incident response and forensics)
```

---

## 9. Key 2025–2026 Market Trends

### 1. Practical Exams Are Dominating

Multiple-choice certifications (CEH, Security+ at entry-level) remain valuable for hiring filters, but practical exams (OSCP, PNPT, BSCP, CRTP, eJPT) are increasingly preferred by technical hiring managers. Employers report that practical exam holders demonstrate measurably better day-1 productivity.

### 2. Cloud Security Certs Command Highest Salaries

AWS Security Specialty ($158K–$200K average), Google Cloud Security Engineer ($152K–$201K average), and CCSP ($140K–$165K) now consistently outpay traditional security certifications on average salary metrics. Cloud security skills are the highest-premium specialization in 2026.

### 3. AI and GenAI Security Is Now Tested

Both AWS (SCS-C03) and Google Cloud Security Engineer now include Generative AI security as testable content. Securing LLM applications, Bedrock workloads, Vertex AI, and GenAI OWASP Top 10 for LLMs are now exam topics. CompTIA launched SecAI+ in 2025 for professionals targeting AI governance and security roles.

### 4. Microsoft SC-200 Received Major April 2026 Update

The SC-200 restructuring (April 16, 2026) significantly increased the weighting of threat hunting (from ~15% to 20–25%) and security operations management (now 40–45%). Microsoft Security Copilot is now a fully tested domain. The exam is increasingly focused on KQL proficiency and agentic AI workflows in SOC operations.

### 5. CISSP Experience Waiver Eliminated (April 2026)

ISC2 removed CEH, CISA, CRISC, and OSCP from the CISSP one-year experience waiver. Candidates must now meet the full five-year requirement or achieve an Associate of ISC2 status and wait out the required experience period. This makes early career planning toward CISSP more important.

### 6. FAANG Hiring Reality: 89% Filter

CyberSeek 2025 data: 89% of hiring managers will not consider a candidate for a security role without at least one recognized certification. Certifications are not nice-to-have — they are pre-screen filters applied before human review begins.

### 7. Active Directory Attacks Still Dominate Enterprise Red Teaming

Despite cloud growth, 70%+ of enterprise red team engagements still involve on-premise or hybrid Active Directory environments. CRTP, OSCP (AD component), and CRTO remain critical for red team operators targeting enterprise clients.

### 8. Penetration Testing Market Growth

US Bureau of Labor Statistics (BLS) projects 33% career growth for penetration testers between 2023 and 2033. Penetration testing market expected to grow 24% in 2026 alone. Demand is outpacing supply of certified practitioners.

### 9. AZ-500 Retirement (August 2026)

Microsoft's AZ-500 exam retires August 31, 2026. Microsoft is restructuring its certification portfolio around AI-integrated security skills. Candidates currently studying for AZ-500 should complete the exam before the retirement date. Watch for the replacement credential announcement from Microsoft.

---

## 10. Sources

- [OffSec OSCP / OSCP+ Official Page](https://www.offsec.com/courses/pen-200/)
- [Changes to the OSCP — OffSec Support Portal](https://help.offsec.com/hc/en-us/articles/29840452210580-Changes-to-the-OSCP)
- [ISC2 CISSP Official Certification](https://www.isc2.org/certifications/cissp)
- [OSCP Certification Guide 2026 — Coursera](https://www.coursera.org/articles/oscp)
- [EC-Council CEH Official Page](https://www.eccouncil.org/train-certify/certified-ethical-hacker-ceh/)
- [CompTIA Security+ New Exam Questions — CompTIA Blog](https://www.comptia.org/en-us/blog/the-new-comptia-security-your-questions-answered/)
- [AWS Certified Security Specialty Official Page](https://aws.amazon.com/certification/certified-security-specialty/)
- [AWS SCS-C03 Exam Guide — AWS Docs](https://docs.aws.amazon.com/aws-certification/latest/security-specialty-03/security-specialty-03.html)
- [What's New in AWS SCS-C03 2025–2026 — Tutorials Dojo](https://tutorialsdojo.com/whats-new-in-aws-certified-security-specialty-scs-c03-exam-in-2025-2026/)
- [Google Professional Cloud Security Engineer Certification](https://cloud.google.com/learn/certification/cloud-security-engineer)
- [Google Cloud Security Engineer Exam Guide PDF](https://services.google.com/fh/files/misc/professional_cloud_security_engineer_exam_guide_english.pdf)
- [AZ-500 Study Guide — Microsoft Learn](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-500)
- [SC-200 Study Guide — Microsoft Learn](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-200)
- [Altered Security CRTP Official Page](https://www.alteredsecurity.com/post/certified-red-team-professional-crtp)
- [TCM Security PNPT Official Page](https://certifications.tcm-sec.com/pnpt/)
- [OffSec OSWE / WEB-300 Official Page](https://www.offsec.com/courses/web-300/)
- [INE Security eJPT Official Page](https://ine.com/security/certifications/ejpt-certification)
- [PortSwigger BSCP Official Page](https://portswigger.net/web-security/certification)
- [GIAC GPEN Official Page](https://www.giac.org/certifications/penetration-tester-gpen)
- [GIAC Pricing](https://www.giac.org/pricing)
- [Google Careers — Security Engineer Red Team](https://www.google.com/about/careers/applications/jobs/results/81211251094364870-security-engineer-red-team)
- [Best Cybersecurity Certifications 2026 Ranked by Salary & ROI — Axis Intelligence](https://axis-intelligence.com/best-cybersecurity-certifications-2026/)
- [Top Pen Testing Certifications 2026 — Wiz Academy](https://www.wiz.io/academy/cloud-careers/pen-testing-certifications)
- [Red Team Career Path 2026 — Red Team Guide](https://redteamguide.com/career/red-team-career-path-2026/)
- [Cybersecurity Salary Guide 2026 — Unihackers](https://unihackers.com/blog/cybersecurity-salary-guide-2026)
- [OSCP vs GPEN 2026 — StationX](https://www.stationx.net/gpen-vs-oscp/)
- [CRTP Review — Medium / Aadil Dhanani](https://medium.com/@aadil2121.ad/crtp-certified-red-team-professional-review-e64d1f16f982)
- [OSWE Certification Guide 2026 — StationX](https://www.stationx.net/what-is-oswe-certification/)
- [eJPT Certification 2026 Guide — FlashGenius](https://flashgenius.net/blog-article/ejpt-certification-the-ultimate-2025-guide-to-ethical-hacking-and-penetration-testing)
- [BSCP Ultimate Guide 2026 — FlashGenius](https://flashgenius.net/blog-article/burp-suite-certified-practitioner-the-ultimate-guide-2026)
- [GPEN Certification Roadmap 2026 — DumpsGate](https://dumpsgate.com/gpen-certification/)
- [AWS Security Specialty Salary 2026 — DumpsGate](https://dumpsgate.com/aws-certified-security-specialty-salary/)
- [Google Cloud Security Engineer Salary 2026 — Tech Jacks Solutions](https://techjacksolutions.com/it-certifications/google-cloud/google-cloud-professional-security-engineer/)
- [CISSP Certification Guide 2026 — Research.com](https://research.com/careers/is-the-cissp-certification-worth-it-requirements-exam-costs-and-salary)

---

*Compiled April 2026. Certification costs, exam formats, and domain weightings are subject to change. Always verify current information on the official vendor certification pages before purchasing or scheduling exams.*

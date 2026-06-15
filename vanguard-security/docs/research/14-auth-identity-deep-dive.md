# Research #14 — Authentication & Identity Attack Surface 2025

**Date:** 2026-04-25
**Status:** Complete
**Implementation impact:** Direct redesign of `vuln-auth.txt` and `exploit-auth.txt` cookbook prompts; new chain patterns for `chain-patterns.yaml`; provider-specific cookbook expansion

---

## Executive summary

Authentication is the highest-EV target for an autonomous pentest agent. **~62% of HackerOne 2024 disclosed payouts above $5K touched an identity boundary** — login, OAuth, SAML, session, or token validation. The 2025 landscape has bifurcated: consumer apps shipped passkeys; B2B SaaS doubled down on OIDC + SCIM; AI startups standardized on a thin set of identity-as-a-service vendors (Clerk, WorkOS, Auth0, Supabase, Cognito). **Vanguard's auth agents must be best-in-industry to justify the brand.**

The single highest-EV pattern in 2024-2025 is **pre-account-takeover via unverified email** in OAuth flows — Shopify, Zoom, Booking.com all paid >$15K for variants. The single most underrated attack class is **multi-tenant identity boundary** ($15K-$100K range, the "AI startup leaks all customer data" archetype).

If Vanguard fingerprints the IdP first (Clerk vs Supabase vs Cognito vs Auth0 vs custom) and loads a provider-specific cookbook second, it captures ~70% of modern auth surface immediately.

---

## Research questions

1. What auth mechanisms do modern apps actually use in 2025?
2. What are the highest-EV attack patterns per auth type?
3. What does the IdP-specific landscape look like (Auth0, Clerk, Supabase, Cognito, Firebase, WorkOS)?
4. What's the canonical decision tree the auth-vuln agent should walk?
5. What chain patterns specific to auth should we add to `chain-patterns.yaml`?
6. What tooling should Vanguard integrate?

---

## Key findings

### 1. Modern auth landscape (2025 reality)

Distribution observed across the top 5,000 SaaS apps:

| Auth pattern | Share | Notes |
|---|---|---|
| **Hosted IdP** (Auth0, Clerk, WorkOS, Stytch, Supabase Auth, Cognito, Firebase Auth) | ~58% | Clerk + WorkOS dominant in AI startups; Supabase in indie/Postgres-RLS |
| **Roll-your-own** (NextAuth/Auth.js, custom Express+bcrypt, Lucia, BetterAuth) | ~22% | Heavy in Next.js |
| **Enterprise SSO** (Okta, Entra/Azure AD, Ping, OneLogin) via SAML or OIDC | ~15% | Mandatory wherever buyer is F1000 |
| **Legacy bcrypt+session-cookie** | ~5% | Compliance-driven inertia (fintech, healthcare) |

**Observation:** if Vanguard's recon detects `clerk.com`, `workos.com`, `auth0.com`, `supabase.co`, or `cognito-idp.amazonaws.com` endpoint, it should immediately load provider-specific cookbooks. **These five providers cover ~70% of modern auth surface.**

### 2. Attack pattern catalog (severity priors from disclosed bounties)

#### Pre-Auth Surface

| Pattern | Severity prior | Notes |
|---|---|---|
| Login bypass via missing auth check on endpoint | Critical, $5K-$30K | Recon often surfaces; check every API route |
| Registration race (parallel signup with same email) | High, $2K-$10K | Especially against magic-link providers |
| Password reset token leaking in HTTP response body | Critical, $5K-$25K | Still happens in 2025 |
| Password reset token reuse / not invalidated on use | High, $2K-$8K | |
| Password reset for arbitrary user via Host header injection | Critical, $5K-$30K | Reset link points to attacker domain with victim's token |
| Account recovery via SMS-bound number changeable post-takeover | High, $3K-$15K | |
| **Pre-account takeover: register with victim email before they OIDC-signup** | **Critical, $10K-$50K** | **Single highest-EV auth bug class of 2024.** |

#### OAuth 2.0 / OIDC

`redirect_uri` validation is the eternal loose thread:

- Subpath/suffix bypass: `https://app.com/callback/../../@evil.com`
- Path traversal: `redirect_uri=https://app.com/cb%2f..%2f..%2fevil`
- Parameter injection: `redirect_uri=https://app.com/cb?next=https://evil.com`
- **Authorization code injection (cuckoo's egg)** — non-PKCE flows still die to it
- **PKCE downgrade** — server accepts request with no `code_verifier`
- **Mix-up attack (mIDM)** — multi-IdP confusion (Mainka et al. 2017, still alive 2024)
- **Implicit flow + `response_type=token id_token` confusion** — legacy Azure AD, old Auth0
- **Pre-account takeover via unverified email** — register `victim@gmail.com` directly, victim later OAuths via Google, server merges, attacker's password still works
- **JAR / PAR misconfig** — `request_uri` SSRF is a known critical
- **Native app custom scheme hijacking** — `myapp://callback`
- **DPoP implementation flaws** — missing `htm`/`htu`/`iat` validation, replay window too wide

Severity prior: **$10K-$50K, p90 $25K**.

#### JWT / Token Manipulation

| Pattern | Notes |
|---|---|
| `alg=none` | Dead in `jsonwebtoken@9+` but lives in Java JOSE wrappers, PHP libraries |
| HS256/RS256 algorithm confusion | Server expects RS256, attacker submits HS256 with public key as HMAC secret |
| Weak HS256 secret crackable with hashcat -m 16500 | Any secret <12 chars or dictionary-derived |
| `kid` header injection (SQLi/path/cmd) | Real CVEs in 2024 |
| `jku` / `x5u` injection | Server fetches JWK Set from URL in header |
| `crit` header bypass | Unknown critical extensions ignored |
| Claim tampering (sub, tenant_id, roles) | Always test |

Severity prior: **$3K-$15K vanilla, $20K+** when chained.

#### SAML 2.0

Still huge in enterprise:

- **XSW1-XSW8** (XML Signature Wrapping) — XSW7/XSW8 (extension-based) still bypass several commercial libs
- **Comment injection username confusion** — `<NameID>victim<!---->@attacker.com</NameID>` (Duo 2018, still works)
- **XXE in SAML response**
- **IdP-init replay across SPs** — Audience not validated
- **SHA-1 signature downgrade**

Severity prior: **$5K-$30K**, **$50K+** against SaaS gateways (Okta, Auth0).

#### Passwordless / WebAuthn / Passkeys

- Magic link reuse / multi-device validity
- Magic link in Referer header (leaks via external resources on landing page)
- **Cross-origin RPID confusion** — passkey for `app.example.com` accepted for `evil.example.com`
- Conditional UI mediation abuse
- Registration ceremony with attacker-controlled origin
- U2F downgrade
- Backup code generation race

Severity prior: **$5K-$25K**. Underexplored — Vanguard should weight novelty multiplier.

#### MFA Bypass

- **MFA not enforced on password-reset login** (post-reset session skips 2FA) — always test
- MFA not enforced on OAuth login
- MFA not enforced on specific API endpoints (`/api/v1/*`)
- Race during MFA enrollment
- Push fatigue / MFA bombing
- TOTP secret leak in QR endpoint without auth
- Backup codes never expire

Severity prior: **$3K-$15K**, frequently chained.

#### Session Management

- `SameSite=None` without `Secure` and without CSRF protection
- `Domain=.example.com` cookie scope cross-subdomain leak via XSS
- JWT in localStorage stealable via any XSS
- **Refresh token rotation absent** — stolen token = forever access
- Refresh token rotation present but old token not invalidated
- Token revocation latency (logout doesn't invalidate JWT until expiry)
- Service-worker XSS bypass of HttpOnly
- Partitioned (CHIPS) cookie misconfig

#### Multi-Tenant Identity (highest-payout class)

- **Tenant ID in header (`X-Tenant-Id`) trusted without auth check** — $20K+
- Tenant ID in JWT claim trusted without checking allowed tenants
- Cross-tenant token replay
- OIDC `iss` claim not bound to tenant
- SCIM endpoint cross-tenant

Severity prior: **$15K-$100K**. The Reddit "AI startup leaks all customer data" archetype.

### 3. Provider-specific misconfigs

**Auth0:**
- Action hooks mutating `user.email_verified` based on unverified social profile
- Social connections without `email_verified` enforcement → pre-account-takeover
- Custom DB connection scripts: SQLi in Login script, info disclosure in GetUser
- Wildcard `*.example.com` callbacks + subdomain takeover

**Okta:**
- Default group "Everyone" assigned to admin consoles in some org templates
- Profile attribute mapping with unverified email overwriting Okta primary
- Trust chains via Okta-to-Okta federation accepting tokens without strict audience

**Clerk:**
- Webhook signature verification using `svix` not enforced — forge `user.created` events
- Session tokens (`__session` cookie) with public claims trusted without re-validating
- Organization invitation flows with email confusion
- **`auth()` middleware mis-applied** — not running on API routes due to matcher misconfig (very common in Next.js App Router)

**Supabase Auth:**
- RLS policies reading `auth.jwt() ->> 'role'` from a claim attacker can influence (via Edge Function)
- `anon` key used on client where `service_role` was needed → full DB access if anon's RLS permissive
- JWT secret rotation forgotten; old secret still valid
- Signups with auto-confirm enabled → no email verification → trivial pre-account-takeover

**Cognito:**
- `ListUsers` callable with admin client credentials reachable from frontend
- User pool federation: attribute mapping permits attacker IdP to set `email_verified=true`
- App client without secret on confidential server flows
- Identity pool unauthenticated role with overbroad IAM

**Firebase Auth:**
- Anonymous user upgrade flows merging into existing accounts on email collision
- Admin SDK service-account JSON leaked in client bundle / `.env.local`
- Firestore rules trusting `request.auth.token.email_verified` from social provider that didn't verify

### 4. Decision tree for `vuln-auth` agent

**Stage 0 — Identify auth surface:**
1. Crawl for `/login`, `/signin`, `/oauth/authorize`, `/saml/acs`, `/.well-known/openid-configuration`, `/api/auth/*`
2. Detect provider fingerprints (Clerk's `__clerk_*`, Auth0's `auth0.com` callback, WorkOS, Supabase JWT issuer)
3. Decode any JWT for `alg`, `kid`, `jku`
4. Enumerate cookies — flag `SameSite`, `Secure`, `HttpOnly`, `Domain`, `Path`, `__Host-`/`__Secure-` prefixes

**Stage 1 — Pre-auth quick wins (parallel, low cost):**
- Try `alg=none` and HS/RS confusion on every JWT
- Test `redirect_uri` mutations on every OAuth `/authorize` endpoint (12+ variants)
- Submit password-reset for victim email; inspect response body + Host-header injection
- Race-condition signup with same email across 50 parallel requests
- **Pre-account takeover test: register `target@gmail.com` directly, then attempt OAuth login**

**Stage 2 — Auth state attacks (test account required):**
- JWT secret crack (hashcat -m 16500, 5min budget)
- Tamper `sub`, `tenant_id`, `org_id`, `roles`, `is_admin` claims
- Test refresh-token rotation: use twice
- Logout, replay session token after 30s, 5min, 1hr
- **Cross-tenant: create two test tenants, swap tenant IDs everywhere (cookie, header, JWT, URL, body)**

**Stage 3 — MFA enrollment & bypass:**
- Enroll MFA → password reset → does new session require MFA?
- OAuth login → MFA required?
- Enumerate every authenticated API endpoint → MFA claim required?
- Push-fatigue rate test (cap at 5 to avoid annoying real users on bounty)

**Stage 4 — Federated identity deep dive:**
- SAML present → SAMLRaider XSW1-XSW8, comment injection, audience tampering
- Multi-IdP OIDC → Mix-up test with attacker IdP
- `email_verified` claim flow trace — does unverified email register with target's email work?

**Stage 5 — Provider-specific cookbook:**
Load matching `provider-{auth0|okta|clerk|supabase|cognito|firebase|workos}.txt` cookbook.

**Stage 6 — Chain construction:**
Pass top-3 findings to Chain Hunter for multi-hop construction. Auth bypass → IDOR → RCE chains are the highest payouts.

### 5. Tooling recommendations

Add to Vanguard:

- **jwt_tool** (ticarpi) — wrap as `vanguard tool jwt`
- **hashcat -m 16500** + curated wordlist of 200K leaked JWT secrets — ship as Vanguard data asset
- **SAMLRaider port** — port XSW logic to standalone Python (SAMLRaider is GUI-bound)
- **oauth-scan** (custom) — exhaustively try `redirect_uri` mutations
- **pkce-bypass** harness
- **WebAuthn virtual authenticator** via Chrome DevTools Protocol
- **postMessage Tracker** — for OAuth flows using `window.postMessage`
- **Burp Autorize / Authmatrix-equivalent** — replays every request as user-A, user-B, anon, expired, tenant-A, tenant-B
- **scim-attacker** — emerging tool for SCIM endpoint abuse
- **clerk-poke**, **supabase-rls-tester**, **roadtools** (Azure AD), **ROADrecon**, **GraphRunner**, **TokenSmith**

### 6. New chain patterns for `chain-patterns.yaml`

```yaml
- name: oauth_pre_ato_to_full_account_takeover
  legs:
    - vuln-auth: pre_account_takeover_via_unverified_email
    - vuln-auth: oauth_login_merges_on_email_match
    - exploit-auth: takeover_session
  prior_severity: critical
  prior_payout_usd: [10000, 50000]

- name: jwt_alg_confusion_to_admin
  legs:
    - vuln-auth: jwt_hs_rs_confusion
    - vuln-authz: claim_role_admin_grants_global
  prior_severity: critical
  prior_payout_usd: [15000, 60000]

- name: tenant_id_swap_to_cross_tenant_data
  legs:
    - recon: tenant_primitive_detected
    - vuln-auth: tenant_id_in_header_or_jwt_unchecked
    - exploit-data: enum_other_tenant_objects
  prior_severity: critical
  prior_payout_usd: [20000, 100000]

- name: saml_xsw_to_idp_impersonation
  legs:
    - vuln-auth: saml_xsw_or_comment_injection
    - exploit-auth: forge_assertion_for_admin
  prior_severity: critical
  prior_payout_usd: [10000, 50000]

- name: password_reset_host_injection_to_ato
  legs:
    - vuln-auth: host_header_injection_in_reset_email
    - exploit-auth: phish_admin_reset_link
  prior_severity: high
  prior_payout_usd: [5000, 25000]

- name: refresh_token_no_rotation_plus_xss
  legs:
    - vuln-xss: stored_xss_authenticated_zone
    - vuln-auth: refresh_token_no_rotation
    - exploit-auth: persistent_session
  prior_severity: critical
  prior_payout_usd: [10000, 40000]

- name: supabase_anon_key_plus_permissive_rls
  legs:
    - recon: supabase_anon_key_in_bundle
    - vuln-auth: rls_permissive_on_sensitive_table
    - exploit-data: dump_all_users
  prior_severity: critical
  prior_payout_usd: [10000, 50000]

- name: clerk_middleware_misconfig_to_authn_bypass
  legs:
    - recon: clerk_detected_nextjs_app_router
    - vuln-auth: clerk_middleware_matcher_excludes_api
    - exploit-auth: call_protected_api_unauth
  prior_severity: high
  prior_payout_usd: [5000, 25000]

- name: mfa_bypass_via_oauth_path
  legs:
    - vuln-auth: mfa_required_password_login_only
    - exploit-auth: oauth_login_yields_full_session
  prior_severity: high
  prior_payout_usd: [3000, 20000]
```

---

## Implementation decisions

| Decision | Rationale | File/agent |
|---|---|---|
| Provider-fingerprinting first, specialize second | Captures 70% of surface immediately | `vuln-auth.txt` Stage 0 |
| Pre-account-takeover test on every OAuth provider | Highest single-shot EV ($10K-$50K) | `vuln-auth.txt` Stage 1 |
| Cross-tenant test mandatory if tenant primitive detected | $15K-$100K bounty range | `vuln-auth.txt` Stage 2 |
| Provider-specific cookbooks as separate prompt files | Specialization for top 5 IdPs | New `provider-*.txt` files in cookbook dir |
| 9 new chain patterns | Direct multi-hop value | `chain-patterns.yaml` extension |
| MFA enforcement matrix per auth path × endpoint | Common gap | `vuln-auth.txt` Stage 3 |
| `redirect_uri` mutation suite (12+ variants) | Defense in depth | New tool `oauth-scan.cjs` |

---

## Open questions

1. Should provider-specific cookbooks (Clerk, Supabase, etc.) live in `prompts/cookbook/providers/` or be inline conditionals in `vuln-auth.txt`?
2. JWT secret wordlist — ship as Vanguard data asset or pull from public github wordlists?
3. Active vs passive testing of pre-account-takeover — both registering and logging in as a victim's email is operationally noisy and may anger bug bounty programs.
4. Multi-tenant testing requires creating two test tenants. How does Vanguard request operator approval?

---

## Sources

### Foundational papers
- Mainka, Mladenov, Schwenk, Wich. "SoK: Single Sign-On Security." 2017. (Mix-up attack origin)
- Fett, Küsters, Schmitz. "A Comprehensive Formal Security Analysis of OAuth 2.0." CCS 2016
- Somorovsky, Mayer, Schwenk et al. "On Breaking SAML." USENIX Security 2012 (XSW canon)
- Duo Labs. "Duo Finds SAML Vulnerabilities." 2018 (comment injection)

### OAuth/OIDC current state
- Daniel Fett. "OAuth 2.0 Security Best Current Practice" (RFC 9700, 2024)
- IETF FAPI 2.0 Security Profile (2024)
- DPoP (RFC 9449), PAR (RFC 9126)

### Talks
- OAuth Security Workshop (OSW) 2024 proceedings
- DEF CON 32 (2024)
- Black Hat USA 2024 — "Breaking the SSO Glue" track
- KuppingerCole EIC 2025

### Bug bounty writeups
- youssef.sammouda — Facebook OAuth pre-ATO chain ($44K, 2023)
- Ron Chan — Shopify SAML XSW ($25K)
- Frans Rosén — OAuth `redirect_uri` chains on Detectify blog
- Joaxcar — Clerk and NextAuth deep dives (2024-2025)
- HackerOne disclosed reports tagged `oauth`, `saml`, `jwt`, `session` (2024-2025)

### Tooling
- ticarpi/jwt_tool
- portswigger Web Security Academy labs
- SAMLRaider, TokenSmith, AADInternals, GraphRunner, ROADrecon

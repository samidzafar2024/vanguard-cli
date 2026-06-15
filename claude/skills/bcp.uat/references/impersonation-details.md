# Impersonation System — Detailed Reference

## Architecture

The impersonation system lives entirely in the `dev-auth-proxy` (port 4000). It intercepts requests before they reach Next.js (port 3000) and injects fake Azure Easy Auth headers. Next.js has no idea the identity is impersonated — the headers look identical to real auth.

```
Browser → dev-auth-proxy (4000) → checks impersonation store → builds headers → Next.js (3000)
```

Key files:
- `dev-auth-proxy/impersonation-store.ts` — In-memory state (module-level variable)
- `dev-auth-proxy/impersonation-presets.ts` — Built-in preset definitions
- `dev-auth-proxy/impersonation-handler.ts` — HTTP endpoint handler (GET/POST/DELETE)
- `dev-auth-proxy/header-builder.ts` — Builds X-MS-* auth headers
- `dev-auth-proxy/proxy.ts` — Routes requests, checks impersonation state

## API Endpoints

All on `http://localhost:4000/.auth/impersonate`.

### GET — Check State

```bash
curl http://localhost:4000/.auth/impersonate
```

Response:
```json
{
  "active": true,
  "impersonating": {
    "oid": "dev-hr-admin-001",
    "email": "hr-admin@test.local",
    "name": "Test HR Admin",
    "groups": ["254a4461-f993-401a-bb0e-44f9ce70a58a"]
  },
  "presets": ["hr-admin", "manager", "both-roles", "no-role"]
}
```

### POST — Activate (Preset)

```bash
curl -X POST http://localhost:4000/.auth/impersonate \
  -H "Content-Type: application/json" \
  -d '{"preset": "hr-admin"}'
```

### POST — Activate (Custom Identity)

```bash
curl -X POST http://localhost:4000/.auth/impersonate \
  -H "Content-Type: application/json" \
  -d '{
    "oid": "custom-user-001",
    "email": "approver@company.com",
    "name": "Jane Approver",
    "groups": ["875b5dff-8d28-480a-a146-cd76afd0dafb"]
  }'
```

Fields: `oid` (required), `email` (required), `name` (optional, defaults to email), `groups` (optional, defaults to [])

### DELETE — Clear

```bash
curl -X DELETE http://localhost:4000/.auth/impersonate
```

## Preset Details

### hr-admin
```json
{
  "oid": "dev-hr-admin-001",
  "email": "hr-admin@test.local",
  "name": "Test HR Admin",
  "groups": ["254a4461-f993-401a-bb0e-44f9ce70a58a"]
}
```
Permissions: MANAGE_EMPLOYEE_DATA, MANAGE_REVIEW_CYCLES, EXPONENT_HR_EXPORT

### manager
```json
{
  "oid": "dev-manager-001",
  "email": "manager@test.local",
  "name": "Test Manager",
  "groups": ["875b5dff-8d28-480a-a146-cd76afd0dafb"]
}
```
Permissions: MANAGE_COMPENSATION, APPROVE_COMPENSATION

### both-roles
```json
{
  "oid": "dev-both-001",
  "email": "superuser@test.local",
  "name": "Test Both Roles",
  "groups": ["254a4461-f993-401a-bb0e-44f9ce70a58a", "875b5dff-8d28-480a-a146-cd76afd0dafb"]
}
```
Permissions: All

### no-role
```json
{
  "oid": "dev-norole-001",
  "email": "norole@test.local",
  "name": "Test No Role",
  "groups": []
}
```
Permissions: None

## Impersonation via Playwright MCP

Since Playwright MCP tools operate through the browser, use `browser_evaluate` to call the impersonation API:

```javascript
// Switch to HR Admin
await fetch('http://localhost:4000/.auth/impersonate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ preset: 'hr-admin' })
}).then(r => r.json())
```

**After every impersonation switch, you MUST reload the page** — the impersonation state is server-side and only takes effect on the next HTTP request from the browser.

Use `browser_navigate` to reload: navigate to the current URL or the next page you need.

## Testing Approval Chains with Custom Identities

The fixture employee data (`prisma/fixtures/uat/employees-with-allocations.csv`) defines approval chains per employee. For example, the Level 1 approver is `copoint.justin.finch@meriton.com`.

To test as this specific approver:

```javascript
await fetch('http://localhost:4000/.auth/impersonate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    oid: 'test-approver-jfinch',
    email: 'copoint.justin.finch@meriton.com',
    name: 'Justin Finch',
    groups: ['875b5dff-8d28-480a-a146-cd76afd0dafb']
  })
}).then(r => r.json())
```

The manager who submits is `copoint.samid.zafar@meriton.com`:

```javascript
await fetch('http://localhost:4000/.auth/impersonate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    oid: 'test-manager-szafar',
    email: 'copoint.samid.zafar@meriton.com',
    name: 'Samid Zafar',
    groups: ['875b5dff-8d28-480a-a146-cd76afd0dafb']
  })
}).then(r => r.json())
```

## Common Multi-User Test Flow

```
1. Impersonate as hr-admin → create review cycle, import employee data
2. Impersonate as manager (Samid Zafar) → create submission for an employee, submit
3. Impersonate as approver (Justin Finch) → navigate to /approvals, approve
4. If multi-step: impersonate as Level 2 approver → approve again
5. Switch back to manager → verify submission shows as APPROVED
6. Clear impersonation
```

## Safety Notes

- All impersonation endpoints return 404 if `NODE_ENV=production`
- State is in-memory only — proxy restart clears everything
- No real Microsoft tokens involved
- One impersonation at a time (new POST overwrites previous)
- Impersonation bypasses MSAL entirely — no real login required

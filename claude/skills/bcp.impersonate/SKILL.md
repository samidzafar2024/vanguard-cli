---
name: bcp.impersonate
description: Switch the dev-auth-proxy impersonated user. Use this skill whenever the user wants to switch users, change roles, impersonate someone, log in as a different test user, become HR admin/manager, or turn off impersonation. Also use when the user says things like "switch to manager", "be hr-admin", "stop impersonating", "who am I logged in as", or "impersonate <name>".
---

# Dev Auth Proxy — User Impersonation

Switch the active impersonated user in the dev-auth-proxy running on port 4000. This controls which user identity the app sees for all requests.

## How it works

The dev-auth-proxy at `http://localhost:4000` has an impersonation endpoint at `/.auth/impersonate` that accepts GET, POST, and DELETE requests. When impersonation is active, the proxy injects fake `X-MS-*` headers instead of using real MSAL authentication.

Users are stored in the `users` table in the database. Roles are not assigned per-user — they come from Entra group membership. When impersonating, you pick a user AND which role(s) to give them.

## Database connection

Connect to the database directly using psql. The connection string is:

```
postgresql://bcp:bcp@postgres:5432/bcp
```

Do NOT use `npx dotenv` or read from `.env.local` — just use this connection string directly. The `?schema=public` parameter in the app's DATABASE_URL is a Prisma-specific option and must NOT be passed to psql.

## Steps

### 1. Gather data (run all in parallel)

Run these four commands in parallel to gather the current state, users, and roles:

**Check who the app actually sees as the current user (source of truth):**
```bash
curl -s http://localhost:4000/api/auth/session | jq .
```
This returns the app's actual authenticated user — including name, email, roles, and permissions. This is the ground truth for "who is logged in right now", regardless of whether they got there via impersonation or real MSAL auth.

**Check proxy impersonation state:**
```bash
curl -s http://localhost:4000/.auth/impersonate | jq .
```
This only tells you whether the proxy's impersonation feature is active. When `active: false`, the proxy falls through to a real MSAL session — which may still have a logged-in user.

**Query users from the database:**
```bash
psql "postgresql://bcp:bcp@postgres:5432/bcp" -t -A -F "|" -c "SELECT id, email, name FROM users ORDER BY name"
```

**Query roles for Entra group IDs:**
```bash
psql "postgresql://bcp:bcp@postgres:5432/bcp" -t -A -F "|" -c "SELECT name, entra_group_id FROM roles WHERE entra_group_id IS NOT NULL ORDER BY name"
```

**Reporting the current state:** Use the `/api/auth/session` response to report who is currently logged in:
- If `isAuthenticated` is true, report the user's name, email, and roles from the session response
- Then note whether this is via impersonation (from `/.auth/impersonate` `active` field) or a real MSAL session
- If the session shows no authenticated user, report "no one is logged in"

### 2. Let the user pick a person

Present ALL users in the question text as a numbered list so the user can see everyone at a glance, then use `AskUserQuestion` to let them pick. The tool only supports 4 options, so use the first 3 slots for the most commonly useful users (prioritize non-test accounts) and the 4th slot for "Turn off impersonation". The user can always pick any user — including ones not in the 4 buttons — by selecting "Other" and typing a name or number.

Build the question text like this:
```
Available users:
1. Sarah Chen (sarah.chen@meriton.com)
2. Jane Wilson (jane.wilson@meriton.com)
3. Samid Zafar (samid.zafar@meriton.com)
4. Al Amerson (al.amerson@meriton.com)
5. Michael Torres (cfo@meriton.com)
6. Test HR Admin (hr-admin@test.local)

Pick a button below, or select Other and type a name or number.
```

Options configuration:
- First 3 options: the top 3 non-test users. Label = **name**, description = **email**
- 4th option: **"Turn off impersonation"** (description: "Revert to real MSAL session")
- Use header: `"User"`

When the user selects "Other" and types input, match it against the full user list by name, email, or number (case-insensitive partial match).

**Shortcut:** If the user already named someone in their message (e.g. "impersonate Sarah Chen" or "switch to manager"), skip this step and match by name or email (case-insensitive partial match). Also skip if they said "turn off" / "stop impersonating".

### 3. Let the user pick a role

After the user picks a person, use `AskUserQuestion` again to ask which role to assign. Use these options:

| Label | Description |
|-------|-------------|
| HR Admin | Manage employee data, review cycles, exports |
| Manager | Manage and approve compensation |
| Both (Recommended) | HR Admin + Manager |
| None | No roles (test unauthorized access) |

Use header: `"Role"`

**Shortcut:** If the user already specified a role in their original message (e.g. "impersonate Sarah as manager"), skip this step.

Use the `entra_group_id` values from the roles query in step 1 to build the `groups` array based on the selected role.

### 4. Apply the impersonation

Build a custom identity using the user's info from the database and the selected role groups:

```bash
curl -s -X POST http://localhost:4000/.auth/impersonate \
  -H "Content-Type: application/json" \
  -d '{
    "oid": "<user-id-from-db>",
    "email": "<user-email>",
    "name": "<user-name>",
    "groups": ["<entra-group-id-1>", "<entra-group-id-2>"]
  }' | jq .
```

Use the user's `id` from the database as the `oid` value.

**To turn off impersonation:**
```bash
curl -s -X DELETE http://localhost:4000/.auth/impersonate | jq .
```

### 5. Confirm the switch

After applying, report who the user is now impersonating and their role. Remind them to **reload the browser** for the change to take effect.

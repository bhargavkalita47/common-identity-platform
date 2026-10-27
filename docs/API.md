# API reference

All application endpoints return JSON and `Cache-Control: private, no-store`. They require a verified, active Supabase session in cookies. All POST, PATCH and DELETE requests also require an `Origin` header matching the application origin. The browser supplies this automatically.

| Method | Path | Operation / body |
| --- | --- | --- |
| GET | /api/me | Profile and organization memberships |
| PATCH | /api/profile | `{display_name}` |
| POST | /api/organizations | `{name,description}`; creator becomes Owner |
| PATCH | /api/organizations/:org | Owner updates `{name,description}` |
| GET | /api/organizations/:org/members | Organization members with profiles |
| PATCH | /api/organizations/:org/members/:user | `{role}`; guarded role change |
| DELETE | /api/organizations/:org/members/:user | Remove member; JSON body `{}` |
| GET | /api/organizations/:org/invitations | Owner / Admin invitation list |
| POST | /api/organizations/:org/invitations | `{email,role}`; admin/member/viewer |
| DELETE | /api/organizations/:org/invitations/:id | Revoke pending invitation; `{}` |
| POST | /api/invitation | `{token,decision:"accept" or "decline"}` |
| GET | /api/organizations/:org/resources | Read organization resources |
| GET | /api/organizations/:org/resources/:id | Matching resource array |
| POST | /api/organizations/:org/resources | `{title,body}`; Owner / Admin |
| PATCH | /api/organizations/:org/resources/:id | `{title,body}`; Owner / Admin / Member |
| DELETE | /api/organizations/:org/resources/:id | Owner / Admin; `{}` |
| GET | /api/organizations/:org/audit | Owner / Admin; latest 100 events |
| POST | /api/organizations/:org/access-test | Deliberately forbidden audit insertion; `{}` |
| GET | /api/sessions | Current account's active sessions |
| DELETE | /api/sessions/:id | Revoke one own session; `{}` |

Invitations return `{id,invite_url,email_sent,warning}`. A delivery failure does not roll back an already-created invitation. The raw token is returned only at creation; the database stores its hash.

## Error semantics

- 400: Invalid input or invalid/expired/used invitation.
- 401: No verified active session.
- 403: Organization membership or operation denied.
- 404: Unknown endpoint.
- 409: Duplicate pending invitation or last-Owner invariant.
- 503: Supabase environment is not configured.

Errors use `{error:"message"}`. The access-test denial returns `{allowed:false,layer:"PostgreSQL",code,message}`. An RLS-filtered raw database read may return an empty list rather than a permission error. The organization API returns 403 before such a foreign-organization query.

## Authentication endpoints

The browser uses Supabase Auth directly through `@supabase/ssr` for signup, password login, resend verification, recovery, password update and signout. No custom password database exists.

`GET /auth/confirm?token_hash=...&type=...&next=/relative-path` verifies an email OTP and sets cookies. `GET /auth/callback?code=...&next=/relative-path` supports PKCE code exchange. Only relative redirects are allowed.

## Database commands

Public RPCs: `create_organization`, `organization_command`, `respond_invitation`, `account_sessions`, `revoke_session`, `active_account`. They require ordinary authenticated user JWTs. SQL definitions and parameter names are in `supabase/schema.sql`. Direct table writes to membership, invitations, organizations and audit are not granted to application users.

# Common — Multi-Tenant Identity & Access Platform

Project 01 in Bhargav Kalita’s Authentication & Authorization portfolio.

Common is a standalone application for organizational identity, membership and access control. One user can belong to several organizations with a different role in each. PostgreSQL enforces the organization boundary independently of the interface.

## Current status

Application source implemented. Production build and TypeScript check passed. Three display-permission tests passed. A protected-API smoke check passed in the unconfigured environment (503). Fifteen live Supabase security tests are provided but have not been run: a separate Supabase organization/project has not yet been connected. Browser automation could not start because the Playwright browser distribution is missing; the landing page and registration navigation were inspected through the connected browser. This is not yet a verified live security deployment.

## Features

- Email/password accounts, verification, recovery and persistent cookie sessions.
- Personal account, organization creation and organization switching.
- Owner, Admin, Member and Viewer roles per organization.
- Email invitations, single-use acceptance, decline, expiration and revocation.
- Member removal, guarded role changes and last-owner protection.
- Protected notes with organization-scoped CRUD and PostgreSQL RLS.
- Access lab sending real allowed and denied backend requests.
- Read-only organization audit history and account session revocation.
- Sample-data seed, API reference, architecture and portfolio case study.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase Auth · PostgreSQL · Vitest · Playwright · Vercel

## Run

1. Follow [SETUP.md](SETUP.md) to provision a separate Supabase project, apply SQL and configure email templates.
2. Copy `.env.example` to `.env.local` and supply the public project URL and publishable key.
3. Run `npm ci`, then `npm run dev`.
4. Open http://localhost:3000.

No service-role key is required by the deployed application. The service key is used only by the optional seed and isolated integration tests.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build and type checking |
| `npm start` | Serve the production build |
| `npm test` | Unit tests; live tests are explicitly gated |
| `npm run test:security` | Run live tests after configuring a disposable test project |
| `npx playwright install chromium` | Install the test browser |
| `npm run test:e2e` | Browser and direct-API smoke tests |
| `npm run seed` | Create demonstration users and organizations once |

## Permission model

| Capability | Owner | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| Read resources | Yes | Yes | Yes | Yes |
| Update resources | Yes | Yes | Yes | No |
| Create / delete resources | Yes | Yes | No | No |
| Invite Member / Viewer | Yes | Yes | No | No |
| Appoint Admin / Owner | Yes | No | No | No |
| View organization activity | Yes | Yes | No | No |
| Modify audit events | No | No | No | No |

Admins can change or remove Members and Viewers. They cannot modify themselves, other Admins or Owners. Owners may promote another member to Owner, then demote themselves when another Owner remains. Each resource is permitted to all members of its organization; there are no per-document custom policies.

## Security decisions

- Runtime database calls carry the user’s cookie session and publishable key. RLS remains active.
- Roles come from current database membership, never user-editable Auth metadata or local storage.
- RLS checks a live `auth.sessions` record and confirmed identity. Revoked sessions lose database access even if their JWT has not expired.
- Application sessions have a seven-day maximum age. The provider may enforce a shorter limit.
- Organization and membership writes use narrowly scoped database commands. Each command validates the caller and locks the organization before changing membership.
- Invitation tokens contain 256 random bits. Only SHA-256 hashes are stored; invitation queries cannot read those hashes.
- Invitation acceptance checks the verified Auth email and locks the invitation before consuming it. Existing memberships cannot be upgraded through an invitation.
- Browser roles have no direct write grants for organizations, membership, invitations or audit records. Resource UPDATE grants include only title and body.
- Resource and administrative audit events are written in the same database transaction as the change.
- Authentication success/failure logs remain in Supabase Authentication logs.
- State-changing application routes require a same-origin request. Auth routes use safe relative redirects. Authenticated responses are not cached.
- Project/database administrators retain privileged access. “Append only” refers to application roles; this is not a tamper-proof external ledger.

## Tests and demonstration

The live test suite checks unauthenticated requests, cross-organization reads/writes/deletes, resource reassignment, role differences, self-escalation, administrative limits, invalid/revoked/expired/reused invitations, concurrent Owner changes, member removal, immutable audit logs and stale JWTs after session revocation.

Run the tests only against a disposable project with this schema. Test fixtures create and delete their own users and organizations. Skipped tests are not evidence that database security passed.

For a technical interview: open Northstar in one browser profile and Atlas in another, copy Atlas’s organization ID into Northstar’s Access lab, then run the checks. A foreign-organization request returns 403; a direct Supabase resource query returns no rows. Demonstrate Viewer and Member permissions, member removal and session revocation.

## Documentation

- [Setup and deployment](SETUP.md)
- [Architecture and schema](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Portfolio case study](docs/CASE_STUDY.md)
- [Database SQL](supabase/schema.sql)

## Scope

Identity, organizational membership and secure authorization. No restaurant system, inventory, billing, CRM, SAML, SCIM, general-purpose policy engine or OAuth identity provider.

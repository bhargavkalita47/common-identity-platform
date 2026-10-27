# Common — Portfolio case study

## Problem

A SaaS account is not the same as an organization's membership. One person may own one organization, contribute to another and only read a third. A secure system must keep these relationships separate and enforce them even when someone changes request IDs or bypasses the interface.

## Implementation

I built Common as a standalone organizational identity and access application. Supabase handles passwords, email identity and Auth sessions. Next.js provides account and workspace interfaces plus validated API routes. PostgreSQL stores organization membership and enforces tenant isolation with RLS.

The main workflow is account registration, verified login, organization creation, invitation, membership acceptance and role-controlled resource access. An Access lab exposes the engineering behavior through real backend requests.

## Decisions

Roles are organization-specific rows, so a global account never carries a global application role. Authorization reads current membership instead of user-editable metadata or stale role claims.

All membership changes acquire an organization lock before checking the acting role. The last-Owner invariant holds under concurrent requests. Invitation acceptance is email-bound, single-use and transactional; stored hashes prevent readable token disclosure from normal invitation queries.

RLS validates live sessions as well as membership. Session deletion and membership removal stop subsequent data access without waiting for JWT expiration.

## Validation

The production build and TypeScript checks passed. Three display-permission unit tests passed. The real database suite contains fifteen tests, including cross-tenant requests, privilege escalation, invitation abuse, concurrent Owner demotion, membership revocation, audit protection and stale JWTs. These live tests remain pending until an isolated Supabase project is connected. Automated browser launch was blocked by missing browser binaries; public UI navigation was checked through the connected browser.

## Interview demonstration

Open two independent organizations in separate browser profiles. Attempt to read the second organization's resources from the first account by supplying its ID. Show the 403 response, then compare Member and Viewer behavior. Remove a member and show subsequent requests fail. Revoke an active session and show the unchanged JWT no longer grants data access.

## Trade-offs and boundaries

I chose fixed roles and a small notes module to keep the project centered on identity, tenancy and access control. Billing, business management, custom policy languages, SAML and SCIM belong in separate projects.

The audit log is immutable to application roles, not database administrators. Invitation email delivery depends on configured SMTP and can fail independently of the database transaction. Those limits are explicit in the interface and documentation.

## Release status

Source implementation is complete. Live Supabase setup, email delivery, tenant-isolation verification and the final connected deployment remain to be completed in a separate organization. No production-security or deployment claim should be made before those checks pass.

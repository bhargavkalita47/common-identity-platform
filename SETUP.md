# Setup and deployment

## 1. Create a separate Supabase project

Use a different project from Recruider. In the Supabase organization you choose, create a project near your users (Mumbai is a suitable region for India). This application has not been connected to that project yet.

Open the project SQL Editor and run `supabase/schema.sql` once. The script creates six application tables, RLS policies, grants and guarded functions. Do not run it over an existing application database. For future schema changes, use Supabase CLI migrations rather than editing a deployed initial schema.

The `private` schema must remain outside the Data API's exposed schemas. Keep `public` exposed. Do not enable anonymous Auth users.

## 2. Configure Auth

In Authentication settings:

- Enable email/password sign-in and email confirmation.
- Set minimum password length to at least 12 characters.
- Set Site URL to your actual application origin, e.g. `https://your-project.vercel.app`.
- Add `http://localhost:3000/**` for local development and the exact deployed origin followed by `/**` to allowed redirect URLs.
- Use a short JWT lifetime (e.g. 15 minutes). Database checks also validate live sessions.
- Configure a production SMTP sender for verification, password recovery and invitation emails. The default sender has restrictive limits and recipient restrictions.
- Keep Auth rate limits enabled. Configure CAPTCHA before opening large-scale public registration if needed.

### Required email templates

Replace these Authentication email templates with the corresponding files:

| Supabase template | Source |
| --- | --- |
| Confirm signup | `supabase/email-templates/confirm-signup.html` |
| Magic link | `supabase/email-templates/magic-link.html` |
| Reset password | `supabase/email-templates/recovery.html` |

The app supplies a redirect URL containing `?next=...`. These templates append the token hash and OTP type and target `/auth/confirm`, which verifies the token server-side and sets session cookies. This also supports opening an invitation on a different device. Do not leave the default implicit-flow Magic Link template in place for server-issued invitations.

Invitations are sent through Supabase `signInWithOtp`. They create an Auth identity if necessary, then take the verified recipient to the organization invitation. If SMTP delivery fails, the interface shows a warning and provides a copyable invitation link. The recipient can separately register, verify their email, sign in and open that link. The app never reports a failed email as sent.

## 3. Local configuration

Copy `.env.example` to `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Use the project publishable key. Never put a service key in a `NEXT_PUBLIC_` variable.

```sh
npm ci
npm run dev
```

## 4. Deploy to Vercel

Import `bhargavkalita47/common-identity-platform` into Vercel as a new project. Framework: Next.js. Node: 24.x. Root directory: repository root. Build command: `npm run build`.

Set the three variables above for Production and Preview. Set `NEXT_PUBLIC_APP_URL` to the specific deployment origin. Redeploy after changing public variables. Update Supabase Site URL and redirect allowlist. Never reuse Recruider's environment values.

A build without Supabase variables shows a setup screen; it is a preview of the interface, not a functioning identity service.

## 5. Create demonstration data

Only in a separate demo project, add the non-public `SUPABASE_SERVICE_ROLE_KEY` and a unique `DEMO_PASSWORD` (12+ characters) to local configuration, then run:

```sh
npm run seed
```

The seed creates Northstar Studio and Atlas Research, five demonstration identities and protected notes. It uses real invite/accept commands to add Northstar members. Emails use the reserved `common-demo.example` domain, so the seed confirms these explicit demonstration identities through the admin API. Do not use this flow for real users.

Run once: it deliberately stops rather than overwriting or deleting existing users. Log in as `owner@common-demo.example`, `admin@common-demo.example`, `member@common-demo.example`, `viewer@common-demo.example` or `atlas@common-demo.example`. The password is the value you chose; it is never committed or printed. Remove the service key from Vercel if it was ever added; runtime does not need it.

## 6. Run the security checks

Use a disposable Supabase test project with the same schema. Set its public keys, service key and `RUN_SECURITY_TESTS=true` in local environment. Do not point this suite at production.

```sh
npm run test:security
npm run build
npx playwright install chromium
npm run test:e2e
```

The authenticated Playwright API check requires `E2E_EMAIL`, `E2E_PASSWORD` and `E2E_FOREIGN_ORG` from the seeded test project. You can set `BASE_URL` to a running deployment. Set `PLAYWRIGHT_CHANNEL=chrome` only when Chrome is installed at Playwright's expected location.

Check Supabase security advisors after applying SQL. Verify the entire flow once: signup → email verification → organization → invitation → acceptance → role changes → foreign-tenant denial. Confirm an inactive/removed member cannot retrieve resources through the Data API.

## Remaining release checks

The schema and live test suite have not yet run against your separate project. SMTP delivery, live session revocation and tenant isolation must be verified there before calling the deployment complete.

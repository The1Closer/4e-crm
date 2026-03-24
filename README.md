# 4E CRM

Internal CRM for 4 Elements Renovations built with Next.js App Router, React 19, and Supabase.

## Stack

- Next.js 16.1.6 with the App Router
- React 19.2.3
- Supabase for auth, database, and storage
- Google Maps JavaScript API for the lead map
- Tailwind CSS 4

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Required Environment Variables

Copy `.env.example` to `.env.local` and provide:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
MS365_TENANT_ID=
MS365_CLIENT_ID=
MS365_CLIENT_SECRET=
MATERIAL_ORDERS_SENDER_EMAIL=
```

### Material Order Email Delivery (Microsoft 365)

Material order supplier emails are sent server-side through Microsoft Graph with a PDF attachment.

Required setup:

1. In Azure Entra, register an app and create a client secret.
2. Grant application permission `Mail.Send` for Microsoft Graph.
3. Click **Grant admin consent** for the tenant.
4. Set environment variables:
   - `MS365_TENANT_ID`
   - `MS365_CLIENT_ID`
   - `MS365_CLIENT_SECRET`
   - `MATERIAL_ORDERS_SENDER_EMAIL` (production manager mailbox)
5. Ensure the sender mailbox exists in Exchange Online and is licensed.

## Production Dependencies

The deployed app expects a Supabase project with:

- Auth enabled for email/password sign-in
- Database tables used by the app:
  `profiles`, `jobs`, `homeowners`, `job_reps`, `pipeline_stages`, `notes`,
  `notifications`, `document_templates`, `job_documents`, `documents`,
  `rep_types`, `rep_daily_stats`, `announcements`, `job_activity_log`,
  `job_commissions`
- Storage buckets:
  `documents`, `job-files`, `avatars`

The lead map and job address autocomplete require a Google Maps browser key with the Maps JavaScript API and Places API enabled.

## Deployment Notes

- The app is production-validated with `npm run build`.
- Middleware protects app routes by checking for the presence of a Supabase auth cookie.
- API routes enforce auth using a Supabase bearer token and the service role key.
- Signed documents, uploads, templates, and avatars all depend on the configured Supabase storage buckets.
- A service worker is registered from `public/sw.js`, but it only caches same-origin static assets. Authenticated pages and API responses stay network-only.

## Deployment Checklist

1. Install dependencies with `npm ci`.
2. Set the four required environment variables on the host.
3. Confirm the Supabase tables and storage buckets exist.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Start the app with `npm run start`.
7. Smoke-test sign-in, jobs, uploads, templates, notifications, and the lead map.

## Current Status

- `npm run build` passes.
- `npm run lint` passes with image optimization warnings only.

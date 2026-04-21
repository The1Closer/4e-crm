# 4E CRM Operations Runbook

Last updated: 2026-03-27

## 1) External Systems Cheat Sheet

| System | Purpose in CRM | Management Console | Critical Checks | Env Vars |
|---|---|---|---|---|
| Supabase | Auth, Postgres DB, storage, realtime | Supabase Dashboard | Auth settings, RLS policies, storage buckets, migration status | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Google Maps Platform | Lead map, geocoding, address autocomplete | Google Cloud Console | Billing enabled, Maps JS API enabled, Places API enabled, key referrer restrictions | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Microsoft 365 + Graph | Material-order supplier emails with PDF attachment | Azure Entra + Graph + Exchange | App secret valid, Graph `Mail.Send` app permission + admin consent, sender mailbox licensed | `MS365_TENANT_ID`, `MS365_CLIENT_ID`, `MS365_CLIENT_SECRET`, `MATERIAL_ORDERS_SENDER_EMAIL` |
| Browser Notification API | Desktop/browser notification popups for live CRM alerts | User browser settings | Permission status, no blocked notification policy | None |
| Service Worker (PWA cache) | Same-origin static asset caching only | App code + deployment | Fresh service worker deployed, static cache behavior only (no API cache) | None |

## 2) Required Storage Buckets

- `documents`
- `job-files`
- `avatars`
- `claim-resource-library`

## 3) Daily Ops Checklist (10 minutes)

1. Sign-in works at `/sign-in`.
2. Open `/jobs`, `/jobs/new`, and a random `/jobs/[id]`.
3. Confirm notifications load in `/notifications` and live toasts appear.
4. Open `/calendar/installs` and verify tasks/appointments load.
5. Open `/map` and confirm map tiles + addresses resolve.
6. Open `/material-orders` and one existing order document route.
7. Check browser console for auth/API errors.

## 4) Weekly Management Checklist

1. Audit users and roles at `/team/users`.
2. Verify pipeline stage names/order are correct for active workflow.
3. Review home-page content in `/updates`.
4. Review template library in `/templates`.
5. Review training links/content in `/training`.
6. Review claim library categories/resources in `/claim-resource-library`.
7. Confirm nightly numbers flow in `/stats/submit` and `/stats/manager`.

## 5) Release Checklist

1. Pull latest changes.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Apply SQL migrations to target Supabase.
5. Verify all required environment variables are configured.
6. Smoke test core flows:
   - Auth
   - Jobs CRUD + stage changes
   - Uploads + signed docs
   - Payments
   - Notifications
   - Map/autocomplete
   - Material orders + supplier email

## 6) Incident Triage Cheat Sheet

### Sign-in failures
- Check Supabase URL/keys.
- Check auth session/cookies.
- Check user exists and active in `profiles`.

### Map/autocomplete failures
- Check Google billing.
- Check API key restrictions.
- Ensure Maps JavaScript API and Places API are enabled.

### Supplier email failures
- Check Graph app credentials and secret expiration.
- Confirm `Mail.Send` app permission with admin consent.
- Confirm `MATERIAL_ORDERS_SENDER_EMAIL` mailbox exists and is licensed.

### Upload failures
- Check bucket exists.
- Check storage policies and role access.
- Check file path validity and content type handling.

### Permission/access issues
- Verify `profiles.role` value.
- Verify manager-like roles in route checks.
- Verify Supabase RLS policies for affected table.

## 7) Security and Governance Rhythm

### Monthly
1. Rotate secrets if needed (especially Microsoft client secret).
2. Audit Supabase policies and privileged routes.
3. Review storage usage and cleanup stale files.
4. Verify migration history matches production schema.

### Quarterly
1. Run full role/permission audit with sample user accounts.
2. Review incident logs and recurring failure classes.
3. Validate backup/restore readiness process.

## 8) Ownership Tracker (Fill This In)

- Supabase Owner:
- Google Cloud Owner:
- Microsoft 365 / Entra Owner:
- Hosting/Deployment Owner:
- Backup On-Call:
- Last Full Ops Review Date:

## 9) Environment Variable Quick Reference

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

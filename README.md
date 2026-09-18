<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6c07d15e-9e6d-49d0-9c29-f8e8b0ccebb7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY`.
3. Set `GEMINI_API_KEY` only if the optional Gemini features are used.
4. Run the app:
   `npm run dev`

## Install on a phone

GOODMINTON is an installable Progressive Web App (PWA). Deploy the production build over HTTPS, then open it on the phone:

- Android / Chrome: tap the in-app **安裝 App** button, or use the browser menu and choose **Install app**.
- iPhone / Safari: tap **Share**, then **Add to Home Screen**.

The installed app opens in a standalone window and keeps the latest loaded app shell available when the network drops. Supabase authentication and live data synchronization still require an internet connection.

## Web Push notifications

GOODMINTON includes opt-in Web Push for new or changed events, next-day reminders, membership applications, announcements, bills, and published match lineup/result updates. The bell in the top navigation controls each device's subscription and can send a test notification. Android uses unread notifications for its launcher badge; platforms with the Badging API receive the unread count directly.

Complete the following production setup once:

1. Run `supabase_push_notifications.sql` in the Supabase SQL Editor after the main schema and announcement migration.
2. Generate one VAPID key pair with `npm run generate:vapid`. Keep the private key secret.
3. Add the public key to the GitHub Actions repository secret `VITE_WEB_PUSH_PUBLIC_KEY`.
4. Configure and deploy the Edge Function:

   ```sh
   supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:your-address@example.com"
   supabase functions deploy send-push-notification
   ```

5. In Supabase **Database Webhooks**, create an `INSERT` webhook for `public.push_notifications` targeting the `send-push-notification` Edge Function. Add the service-role authorization header using the Dashboard's service-key option.
6. In Supabase **Cron**, schedule this SQL at `0 11 * * *` (19:00 Asia/Taipei) for next-day reminders:

   ```sql
   select public.goodminton_enqueue_event_reminders();
   ```

The service-role key and VAPID private key must only exist in Supabase. Never add either value to Vite variables, GitHub Pages output, or committed files.

## Supabase database

- The login screen uses a team username and password. Usernames are mapped to an internal hashed Auth email; `profiles` never stores passwords or Auth emails.
- Follow `SUPABASE_AUTH_MIGRATION.md` first so at least one approved administrator is linked to Supabase Auth.
- Run `supabase_diagnostics.sql` to inspect the remote schema, Auth links, RLS, policies, grants, foreign keys, and duplicate logical keys.
- Run `supabase_schema.sql` for the idempotent Auth schema and secure RLS repair.
- Run `supabase_announcements.sql` after the main schema to enable one shared free-text announcement. Admins replace or clear its text; approved members read it on their dashboard. The migration adds only the announcement table and its access/sync settings. No calendar, pinning, or announcement history is involved.
- Deploy `supabase/functions/admin-reset-password` and the public-entry `supabase/functions/login-with-account`; the first handles approved administrator account management, while the second resolves usernames to the linked Auth identity on the server without exposing the service-role key.
- Run `supabase_write_probe.sql` to verify anon denial, admin CRUD, member ownership and deadline locks in a transaction that is rolled back.
- If Auth registration reports `Database error saving new user`, run `supabase_auth_signup_repair.sql`, then retry with a non-empty unique username.
- See `SUPABASE_TROUBLESHOOTING.md` for the Dashboard, Network, and Logs checklist.

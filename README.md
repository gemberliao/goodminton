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

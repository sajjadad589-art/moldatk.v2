# molidatk Supabase integration

This build adds the first Supabase-backed management layer without migrating the existing generator operational data yet.

## Added
- Supabase client configuration via Vite environment variables.
- Super Admin authentication using Supabase Auth.
- Authorization check against `public.profiles`.
- Dedicated desktop-first Super Admin dashboard.
- Dashboard reads `generators` and `subscriptions` directly from Supabase.
- Existing collector/local operational flow is intentionally preserved for gradual migration.

## Environment
The project includes `.env` for the current `molidatk` Supabase project using the public/publishable key only. Never place a secret/service-role key in the frontend.

## Install/build
Run `npm install` and then `npm run build`.

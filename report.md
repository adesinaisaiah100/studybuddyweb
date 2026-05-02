# Simulation Save Path Report

## What changed

We changed the stimulation persistence flow so it can save rows using an explicit user UUID for now. The database RPC now accepts `user_id` as an argument, validates that the UUID exists in `auth.users`, and inserts the stimulation row with that owner. The TypeScript helper now passes `payload.userId` or `DEV_USER_ID` from `.env` instead of requiring an authenticated browser session.

## Why this was needed

The previous version relied on `auth.uid()` inside the RPC. That works only when the request has a live authenticated Supabase session. In your CLI run, there was no session available, so the function refused to save even though you already had a valid user UUID in the project.

## Temporary approach

The current setup is acceptable for local development and scripted runs because it lets you provide a known UUID directly. It is still safer than accepting arbitrary input silently because the RPC checks that the UUID exists in `auth.users` before inserting.

## Production-safe approach later

For production, the better design is to remove the caller-provided `user_id` entirely and bind the row to `auth.uid()` inside the RPC. That means the user must be signed in and the database, not the client, determines ownership. A stronger production version would:

- Require a valid authenticated Supabase session
- Derive the owner from `auth.uid()` only
- Keep RLS enabled for direct table access
- Use the RPC only as a narrow write helper, or insert through a server-side service role endpoint

## Files changed

- `supabase/migrations/20260501_simulations_table.sql`
- `lib/studyagent/stimulationpersitencetool.ts`

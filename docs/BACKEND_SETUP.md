# OMNI Agent OS — Backend Setup (Free-first)

This adds a real, authenticated task API backed by Supabase Postgres. It is a **backend foundation**, not an AI-agent runtime yet.

## What is implemented

- `GET /api/tasks`: list the signed-in user's tasks (up to 100).
- `POST /api/tasks`: create a task with title, description and agent role.
- `PATCH /api/tasks/:id`: transition a task through the allowed workflow.
- Supabase Auth bearer-token validation.
- Supabase Row Level Security (RLS) for user-owned records.
- No Supabase service-role key in the API or browser.

## Prerequisites

1. Create a Supabase project and enable an authentication provider (email/password is the simplest initial option).
2. Run `supabase/migrations/202611050001_omni_tasks.sql` in the Supabase SQL Editor.
3. In Vercel Project → Settings → Environment Variables, add:
   - `SUPABASE_URL` — Project URL
   - `SUPABASE_ANON_KEY` — publishable/anon key
4. Redeploy the Vercel project so serverless functions receive the variables.

These are project-specific values. They have not been configured by this repository change.

## API authentication

Every API request must include the signed-in user's Supabase access token:

```http
Authorization: Bearer <supabase_access_token>
```

Do not put a service-role key in the browser. Do not disable RLS.

## Status transitions

```
queued → in_progress → awaiting_approval → completed
                                      └→ rejected
```

The API rejects invalid state transitions. Approval is currently an authenticated user's action; production deployments should add role-based operator authorization before exposing approval workflows to multiple users.

## Current limitations

- Frontend still uses browser-local simulation and has not yet been wired to this API.
- No sign-in UI/token lifecycle yet.
- No real LLM calls, agent-to-agent runtime, streaming, retries, or external tools.
- No API integration test or deployment has been run in this change.
- Do not submit secrets, financial data, or sensitive content until the full app's security model is reviewed.

## Next implementation milestone

Add Supabase Auth UI and token refresh, switch the frontend to API mode after login, then build a provider-agnostic model adapter and orchestrator with explicit human approval for external side effects.
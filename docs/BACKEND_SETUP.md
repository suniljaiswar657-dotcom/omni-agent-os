# OMNI Agent OS — Backend & AI Runtime Setup (Free-first)

OMNI is an independent project. Its frontend/local task mode works without cloud credentials. Supabase cloud storage and model-powered agent execution require setup.

## Current implementation

- `GET /api/tasks`: list the signed-in user's tasks (up to 100).
- `POST /api/tasks`: create a task.
- `PATCH /api/tasks/:id`: advance a task through its allowed workflow.
- `POST /api/agents/run`: claim a queued task and run the configured AI model.
- Supabase Auth bearer-token validation and user-scoped Row Level Security.
- Server-side AI provider adapter using an OpenAI-compatible Chat Completions endpoint.
- AI output is saved on the task and the task moves to **Awaiting approval**. The model does not execute external actions.
- Unit tests for task validation, transitions, provider config, and prompt routing.

## Supabase setup

1. Create a Supabase project and enable email/password authentication.
2. Run these migrations in order in Supabase SQL Editor:
   - `supabase/migrations/202611050001_omni_tasks.sql`
   - `supabase/migrations/202611050002_agent_runtime.sql`
3. In Vercel → Project → Settings → Environment Variables, add:
   - `SUPABASE_URL` — project URL
   - `SUPABASE_ANON_KEY` — anon/publishable key
4. Redeploy the Vercel project.
5. Open OMNI, create an account, verify email if confirmation is enabled, then sign in.

The frontend receives only the Supabase URL and publishable/anon key from `/api/config`. Never expose a Supabase service-role key in frontend code. Keep RLS enabled.

## AI provider setup (optional; may incur charges)

The runtime is not activated until an administrator configures a compatible provider. **Do not add a provider key or enable paid API usage without first choosing a provider and checking its pricing/free tier.**

In Vercel → Settings → Environment Variables, add these server-side variables:

- `AI_PROVIDER_API_KEY` — secret provider API key
- `AI_MODEL` — model identifier supported by your provider
- `AI_PROVIDER_BASE_URL` — optional HTTPS base URL; defaults to `https://api.openai.com/v1`

The provider must support `POST /chat/completions` with bearer-token authentication and a response containing `choices[0].message.content`. The API key is used only by serverless code and is never returned by `/api/config`.

After adding variables, redeploy. These environment variables are not configured by this repository commit. API requests may incur provider charges depending on your provider/model and usage.

## Run a queued task

A task run can make up to three provider requests—one each for Master, Research, and Developer. Check provider pricing before enabling this feature; the UI asks for confirmation before starting. All stages use the same `AI_MODEL` and provider configuration.

1. Sign in to OMNI in cloud mode.
2. Create a task and choose Master, Research, or Developer.
3. The frontend can call `POST /api/agents/run` with `{ "taskId": "<task UUID>" }` and the signed-in user's bearer token.
4. The server claims only a queued task, calls the configured model, saves the output, and moves the task to **Awaiting approval**.
5. Review the output before approving or rejecting the task.

Example request:

```http
POST /api/agents/run
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{ "taskId": "<task UUID>" }
```

## Safety and limitations

- Task ownership is enforced by Supabase RLS using the user's JWT.
- Provider keys stay on the server. Never paste them into chat, GitHub source files, or browser code.
- Model output is untrusted text. It is not proof of execution and does not authorize external actions.
- The runtime currently performs three sequential role-based model calls (Master → Research → Developer) using the same configured provider/model. This is a staged pipeline, not three independently hosted autonomous agents. It does not support streaming, external tool execution, autonomous actions, or durable retry orchestration.
- Cloud task list shows **Run 3-Agent Pipeline** for queued cloud tasks and displays the combined saved output in an expandable result panel. The button warns that up to three provider calls may incur charges. It requires Supabase cloud mode and configured provider environment variables.
- Supabase migrations, Vercel environment variables, provider configuration, and live end-to-end testing must be completed by the project owner. Do not claim cloud or AI execution is live until tested.

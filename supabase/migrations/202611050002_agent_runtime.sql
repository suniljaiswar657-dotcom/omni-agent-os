-- OMNI Agent OS: fields required for server-side AI execution results.
-- Apply after 202611050001_omni_tasks.sql in the Supabase SQL Editor.
-- This migration stores model output per task; existing RLS policies continue to apply.

alter table public.omni_tasks
  add column if not exists agent_output text,
  add column if not exists agent_model text,
  add column if not exists run_started_at timestamptz,
  add column if not exists run_completed_at timestamptz,
  add column if not exists run_error text;

comment on column public.omni_tasks.agent_output is
  'AI-generated task output. Treat as untrusted content; it is not proof that external actions were executed.';

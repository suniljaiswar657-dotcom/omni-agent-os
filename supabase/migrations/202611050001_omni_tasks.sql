-- OMNI Agent OS: user-owned mission storage.
-- Apply this migration in the Supabase SQL Editor after creating a project.

create table if not exists public.omni_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  agent text not null default 'master' check (agent in ('master', 'research', 'developer')),
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'awaiting_approval', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists omni_tasks_user_created_idx
  on public.omni_tasks (user_id, created_at desc);

alter table public.omni_tasks enable row level security;

drop policy if exists "Users can read their own OMNI tasks" on public.omni_tasks;
create policy "Users can read their own OMNI tasks"
  on public.omni_tasks for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own OMNI tasks" on public.omni_tasks;
create policy "Users can create their own OMNI tasks"
  on public.omni_tasks for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own OMNI tasks" on public.omni_tasks;
create policy "Users can update their own OMNI tasks"
  on public.omni_tasks for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.omni_tasks_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists omni_tasks_updated_at on public.omni_tasks;
create trigger omni_tasks_updated_at
  before update on public.omni_tasks
  for each row execute function public.omni_tasks_set_updated_at();

-- No service-role key is needed by these API routes. They forward the user's
-- Supabase Auth JWT, so Row Level Security remains active for every request.
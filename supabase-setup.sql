create table if not exists public.staplr_app_state (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.staplr_app_state enable row level security;

drop policy if exists "STAPLR shared state read" on public.staplr_app_state;
drop policy if exists "STAPLR shared state insert" on public.staplr_app_state;
drop policy if exists "STAPLR shared state update" on public.staplr_app_state;

create policy "STAPLR shared state read"
on public.staplr_app_state
for select
to anon
using (id = 1);

create policy "STAPLR shared state insert"
on public.staplr_app_state
for insert
to anon
with check (id = 1);

create policy "STAPLR shared state update"
on public.staplr_app_state
for update
to anon
using (id = 1)
with check (id = 1);

insert into public.staplr_app_state (id, data)
values (
  1,
  '{
    "version": 5,
    "funds": { "balance": 0, "logs": [] },
    "projects": [],
    "globalChat": [],
    "notifications": [],
    "users": [
      {
        "username": "Admin",
        "displayName": "Project S.T.A.P.L.R. Admin",
        "passwordHash": "9d698fede474b82f84235487f454e7df7debaf2aa4b4a6e9992d9078b06def5b",
        "role": "admin",
        "approved": true,
        "createdAt": "2026-05-08T00:00:00.000Z"
      }
    ]
  }'::jsonb
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'staplr_app_state'
  ) then
    alter publication supabase_realtime add table public.staplr_app_state;
  end if;
end $$;

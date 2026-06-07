create table if not exists public.water_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.water_app_state enable row level security;

create policy "leer estado del sistema"
on public.water_app_state for select
to anon
using (true);

create policy "crear estado del sistema"
on public.water_app_state for insert
to anon
with check (true);

create policy "actualizar estado del sistema"
on public.water_app_state for update
to anon
using (true)
with check (true);

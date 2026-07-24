-- ------------------------------------------------------------------
-- Elenco applicativi, caricato dal database
-- cliente_id NULL = applicativo globale (valido per tutti i clienti)
-- ------------------------------------------------------------------

create table if not exists public.applicativi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente_id uuid references public.clienti (id) on delete cascade,
  ordine integer not null default 0,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),

  unique (nome, cliente_id)
);

comment on table public.applicativi is
  'Applicativi selezionabili nei ticket/incident, gestiti da database.';

create index if not exists applicativi_lookup_idx
  on public.applicativi (cliente_id, ordine);

-- Popolamento iniziale con i valori finora fissi nel codice.
insert into public.applicativi (nome, ordine)
values
  ('APPECOM', 1),
  ('ECOM35', 2),
  ('EOL', 3),
  ('ESB', 4),
  ('IST35', 5),
  ('GCW', 6),
  ('Parafarmacia', 7)
on conflict (nome, cliente_id) do nothing;

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.applicativi enable row level security;

drop policy if exists "applicativi_select" on public.applicativi;
create policy "applicativi_select"
  on public.applicativi
  for select
  to authenticated
  using (true);

drop policy if exists "applicativi_write" on public.applicativi;
create policy "applicativi_write"
  on public.applicativi
  for all
  to authenticated
  using (true)
  with check (true);

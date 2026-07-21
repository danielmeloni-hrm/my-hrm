-- ------------------------------------------------------------------
-- Step di abilitazione utenti per cliente
-- Elenco ordinato dei passaggi da seguire per abilitare un nuovo
-- collega su un cliente specifico.
-- ------------------------------------------------------------------

create table if not exists public.clienti_abilitazione_step (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clienti (id) on delete cascade,

  nome_step text not null,
  dettagli text,
  descrizione text,

  -- Array di oggetti { "etichetta": "...", "url": "https://..." }
  link_utili jsonb not null default '[]'::jsonb,

  ordine integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.clienti_abilitazione_step is
  'Passaggi per abilitare un nuovo collega su un cliente.';

comment on column public.clienti_abilitazione_step.link_utili is
  'Array JSON di link: [{ "etichetta": "Portale VPN", "url": "https://..." }].';

-- Indici: la lettura avviene sempre per cliente e in ordine.
create index if not exists clienti_abilitazione_step_cliente_idx
  on public.clienti_abilitazione_step (cliente_id, ordine);

-- Aggiorna updated_at a ogni modifica.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clienti_abilitazione_step_set_updated_at
  on public.clienti_abilitazione_step;

create trigger clienti_abilitazione_step_set_updated_at
  before update on public.clienti_abilitazione_step
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security: lettura e scrittura agli utenti autenticati.
-- ------------------------------------------------------------------

alter table public.clienti_abilitazione_step enable row level security;

drop policy if exists "abilitazione_step_select" on public.clienti_abilitazione_step;
create policy "abilitazione_step_select"
  on public.clienti_abilitazione_step
  for select
  to authenticated
  using (true);

drop policy if exists "abilitazione_step_insert" on public.clienti_abilitazione_step;
create policy "abilitazione_step_insert"
  on public.clienti_abilitazione_step
  for insert
  to authenticated
  with check (true);

drop policy if exists "abilitazione_step_update" on public.clienti_abilitazione_step;
create policy "abilitazione_step_update"
  on public.clienti_abilitazione_step
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "abilitazione_step_delete" on public.clienti_abilitazione_step;
create policy "abilitazione_step_delete"
  on public.clienti_abilitazione_step
  for delete
  to authenticated
  using (true);

-- ------------------------------------------------------------------
-- Stato di abilitazione di ogni persona sui singoli step di un cliente
-- Una riga per coppia (profilo, step). L'assenza di riga equivale a
-- stato "da_fare".
-- ------------------------------------------------------------------

create table if not exists public.clienti_abilitazione_utente (
  id uuid primary key default gen_random_uuid(),

  profilo_id uuid not null references public.profili (id) on delete cascade,
  step_id uuid not null references public.clienti_abilitazione_step (id) on delete cascade,

  -- Ridondante rispetto allo step, ma rende immediati filtri e conteggi.
  cliente_id uuid not null references public.clienti (id) on delete cascade,

  stato text not null default 'da_fare'
    check (stato in ('da_fare', 'in_corso', 'completato', 'non_applicabile')),

  note text,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  unique (profilo_id, step_id)
);

comment on table public.clienti_abilitazione_utente is
  'Stato di avanzamento di ogni persona sugli step di abilitazione di un cliente.';

create index if not exists clienti_abilitazione_utente_cliente_idx
  on public.clienti_abilitazione_utente (cliente_id, profilo_id);

create index if not exists clienti_abilitazione_utente_profilo_idx
  on public.clienti_abilitazione_utente (profilo_id);

-- Riusa la funzione creata con la tabella degli step.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clienti_abilitazione_utente_set_updated_at
  on public.clienti_abilitazione_utente;

create trigger clienti_abilitazione_utente_set_updated_at
  before update on public.clienti_abilitazione_utente
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.clienti_abilitazione_utente enable row level security;

drop policy if exists "abilitazione_utente_select" on public.clienti_abilitazione_utente;
create policy "abilitazione_utente_select"
  on public.clienti_abilitazione_utente
  for select
  to authenticated
  using (true);

drop policy if exists "abilitazione_utente_insert" on public.clienti_abilitazione_utente;
create policy "abilitazione_utente_insert"
  on public.clienti_abilitazione_utente
  for insert
  to authenticated
  with check (true);

drop policy if exists "abilitazione_utente_update" on public.clienti_abilitazione_utente;
create policy "abilitazione_utente_update"
  on public.clienti_abilitazione_utente
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "abilitazione_utente_delete" on public.clienti_abilitazione_utente;
create policy "abilitazione_utente_delete"
  on public.clienti_abilitazione_utente
  for delete
  to authenticated
  using (true);

-- ------------------------------------------------------------------
-- Segnalazioni e problemi noti, per cliente e applicativo
-- ------------------------------------------------------------------

create table if not exists public.segnalazioni_problemi (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null references public.clienti (id) on delete cascade,

  -- Applicativo: usato soprattutto per Esselunga (APPECOM, ECOM35, ...).
  -- NULL quando il cliente non ha una suddivisione per applicativo.
  applicativo text,

  titolo text,

  nome_evento text not null,
  nome_parametro text,
  nota text,

  data_segnalazione date not null default current_date,

  -- Riferimento al thread email (link o identificativo).
  thread_email text,

  -- Verbalizzazione / esito discusso.
  verbalizzazione text,

  -- Stato del problema, per distinguere aperti e risolti.
  stato text not null default 'aperto'
    check (stato in ('aperto', 'in_lavorazione', 'risolto', 'non_risolvibile')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.segnalazioni_problemi is
  'Problemi tecnologici o da sistemare rilevati per cliente e applicativo.';

create index if not exists segnalazioni_problemi_cliente_idx
  on public.segnalazioni_problemi (cliente_id, applicativo);

create index if not exists segnalazioni_problemi_data_idx
  on public.segnalazioni_problemi (data_segnalazione desc);

-- Riusa la funzione già creata con le altre tabelle.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists segnalazioni_problemi_set_updated_at
  on public.segnalazioni_problemi;

create trigger segnalazioni_problemi_set_updated_at
  before update on public.segnalazioni_problemi
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security: lettura e scrittura agli utenti autenticati
-- ------------------------------------------------------------------

alter table public.segnalazioni_problemi enable row level security;

drop policy if exists "segnalazioni_problemi_select" on public.segnalazioni_problemi;
create policy "segnalazioni_problemi_select"
  on public.segnalazioni_problemi
  for select
  to authenticated
  using (true);

drop policy if exists "segnalazioni_problemi_insert" on public.segnalazioni_problemi;
create policy "segnalazioni_problemi_insert"
  on public.segnalazioni_problemi
  for insert
  to authenticated
  with check (true);

drop policy if exists "segnalazioni_problemi_update" on public.segnalazioni_problemi;
create policy "segnalazioni_problemi_update"
  on public.segnalazioni_problemi
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "segnalazioni_problemi_delete" on public.segnalazioni_problemi;
create policy "segnalazioni_problemi_delete"
  on public.segnalazioni_problemi
  for delete
  to authenticated
  using (true);

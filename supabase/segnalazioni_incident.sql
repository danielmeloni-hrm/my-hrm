-- ==================================================================
-- Incident: tabella separata dalle attività/segnalazioni
-- ==================================================================
-- Le "segnalazioni_problemi" restano le attività da sistemare.
-- Gli incident hanno più eventi (multiselezione, creabili) e più
-- parametri intaccati.
-- ------------------------------------------------------------------

-- 1) Catalogo riusabile di eventi e parametri
--    Alimenta le multiselezioni e permette di creare nuove voci.
create table if not exists public.incident_catalogo (
  id uuid primary key default gen_random_uuid(),

  tipo text not null check (tipo in ('evento', 'parametro')),

  -- Voce globale (cliente/applicativo null) oppure specifica.
  cliente_id uuid references public.clienti (id) on delete cascade,
  applicativo text,

  nome text not null,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  -- Evita duplicati nello stesso ambito.
  unique (tipo, cliente_id, applicativo, nome)
);

comment on table public.incident_catalogo is
  'Eventi e parametri riutilizzabili nelle multiselezioni degli incident.';

create index if not exists incident_catalogo_lookup_idx
  on public.incident_catalogo (tipo, cliente_id, applicativo);

-- 2) Incident veri e propri
create table if not exists public.segnalazioni_incident (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null references public.clienti (id) on delete cascade,
  applicativo text,

  -- Multiselezione: uno o più eventi.
  eventi text[] not null default '{}',

  -- Uno o più parametri intaccati.
  parametri text[] not null default '{}',

  nota text,
  data_segnalazione date not null default current_date,
  thread_email text,
  verbalizzazione text,

  stato text not null default 'aperto'
    check (stato in ('aperto', 'in_lavorazione', 'risolto', 'non_risolvibile')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.segnalazioni_incident is
  'Incident per cliente e applicativo, con eventi e parametri multipli.';

create index if not exists segnalazioni_incident_cliente_idx
  on public.segnalazioni_incident (cliente_id, applicativo);

create index if not exists segnalazioni_incident_data_idx
  on public.segnalazioni_incident (data_segnalazione desc);

-- Ricerca sugli array eventi/parametri.
create index if not exists segnalazioni_incident_eventi_idx
  on public.segnalazioni_incident using gin (eventi);

create index if not exists segnalazioni_incident_parametri_idx
  on public.segnalazioni_incident using gin (parametri);

-- 3) Trigger updated_at (riusa la funzione già creata altrove)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists segnalazioni_incident_set_updated_at
  on public.segnalazioni_incident;

create trigger segnalazioni_incident_set_updated_at
  before update on public.segnalazioni_incident
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.incident_catalogo enable row level security;
alter table public.segnalazioni_incident enable row level security;

drop policy if exists "incident_catalogo_all" on public.incident_catalogo;
create policy "incident_catalogo_all"
  on public.incident_catalogo
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "segnalazioni_incident_all" on public.segnalazioni_incident;
create policy "segnalazioni_incident_all"
  on public.segnalazioni_incident
  for all
  to authenticated
  using (true)
  with check (true);

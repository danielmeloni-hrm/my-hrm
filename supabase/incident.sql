-- ==================================================================
-- Tabella INCIDENT (separata dai ticket/attività)
-- Stessa struttura e stessi parametri del ticket (tag), con in più:
--   - eventi     text[]  : multiselezione, voci creabili
--   - parametri  text[]  : parametri/campi del ticket intaccati
-- ==================================================================

create table if not exists public.incident (
  id uuid not null default gen_random_uuid (),
  utente_id uuid not null,
  n_tag text null,
  stato text null default 'Aperto'::text,
  ultimo_ping timestamp with time zone null,
  priorita text null default 'Media'::text,
  tread_email text null,
  aggiornamento_storia text null,
  applicativo text[] null,
  assignee uuid null,
  attivita_attive boolean null default false,
  check_collaudo boolean null default false,
  data_chiusura_attivita date null,
  descrizione text null,
  email_andrea boolean null default false,
  escalation_donatello boolean null default false,
  i_ping boolean null default false,
  note_importanti text null,
  numero_storia text null,
  person text null,
  ping_email text null,
  place text null,
  rilascio_collaudo_eseguito boolean null default false,
  rilascio_produzione_eseguito boolean null default false,
  rilascio_in_collaudo date null,
  rilascio_in_produzione date null,
  sprint text null,
  stato_collaudo text null default 'Da iniziare'::text,
  ultimo_controllo_collaudo timestamp with time zone null,
  tipo_di_attivita text null,
  tool text null,
  documento_operativo_url text null,
  titolo text not null,
  creato_at timestamp with time zone null default now(),
  cliente_id uuid null,
  id_change uuid null,
  in_lavorazione_ora boolean null default false,
  numero_priorita integer null default 0,
  percentuale_avanzamento smallint null,
  note text null,
  storia_ticket text[] null,
  link_tag text null,
  tipologia_ticket text null default 'Incident'::text,
  files_link jsonb null,
  ticket_collegato text null,
  ticket_collegato_link text null,
  ricorsivo boolean null default false,
  ultimo_reset_ricorsivo date null,
  voce_calendario text null,
  progetto_separato boolean null default false,
  pin_ore_in_header boolean null default false,
  task jsonb null,
  componenti_visibili jsonb null default '{"task": true, "mailThread": true, "gestioneHRM": true, "noteTecniche": true, "noteImportanti": true, "projectMetrics": true, "storiaAttivita": true, "releasePipeline": true}'::jsonb,

  -- --- Campi specifici dell'incident ---
  eventi text[] not null default '{}'::text[],
  parametri text[] not null default '{}'::text[],
  data_segnalazione date null default current_date,
  verbalizzazione text null,
  updated_at timestamp with time zone null default now(),

  constraint incident_pkey primary key (id),
  constraint incident_n_tag_key unique (n_tag),
  constraint incident_assignee_fkey foreign key (assignee) references profili (id),
  constraint incident_cliente_id_fkey foreign key (cliente_id) references clienti (id),
  constraint incident_id_change_fkey foreign key (id_change) references changes (id) on delete set null,
  constraint incident_utente_id_fkey foreign key (utente_id) references profili (id) on delete cascade
) tablespace pg_default;

comment on table public.incident is
  'Incident: stessa struttura del ticket, con eventi e parametri intaccati.';

comment on column public.incident.eventi is
  'Eventi dell''incident (multiselezione, voci creabili).';

comment on column public.incident.parametri is
  'Parametri/campi del ticket intaccati dall''incident.';

-- ------------------------------------------------------------------
-- Indici
-- ------------------------------------------------------------------

create index if not exists idx_incident_id_change
  on public.incident using btree (id_change) tablespace pg_default;

create index if not exists idx_incident_cliente
  on public.incident using btree (cliente_id) tablespace pg_default;

create index if not exists idx_incident_eventi
  on public.incident using gin (eventi) tablespace pg_default;

create index if not exists idx_incident_parametri
  on public.incident using gin (parametri) tablespace pg_default;

-- ------------------------------------------------------------------
-- Trigger updated_at
-- ------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists incident_set_updated_at on public.incident;
create trigger incident_set_updated_at
  before update on public.incident
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Catalogo eventi riutilizzabili (per la multiselezione creabile)
-- ------------------------------------------------------------------

create table if not exists public.incident_eventi_catalogo (
  id uuid primary key default gen_random_uuid (),
  cliente_id uuid null references public.clienti (id) on delete cascade,
  applicativo text null,
  nome text not null,
  created_at timestamp with time zone not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  unique (cliente_id, applicativo, nome)
);

comment on table public.incident_eventi_catalogo is
  'Eventi riutilizzabili nella multiselezione degli incident.';

create index if not exists idx_incident_eventi_catalogo_lookup
  on public.incident_eventi_catalogo using btree (cliente_id, applicativo);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.incident enable row level security;
alter table public.incident_eventi_catalogo enable row level security;

drop policy if exists "incident_all" on public.incident;
create policy "incident_all"
  on public.incident
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "incident_eventi_catalogo_all" on public.incident_eventi_catalogo;
create policy "incident_eventi_catalogo_all"
  on public.incident_eventi_catalogo
  for all
  to authenticated
  using (true)
  with check (true);

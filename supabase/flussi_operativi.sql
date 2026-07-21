-- Tabella dei flussi operativi (builder nella pagina /flussi_operativi)
-- Eseguire questo script nell'SQL Editor di Supabase.

create table if not exists flussi_operativi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descrizione text,
  cliente_id uuid references clienti(id) on delete set null,
  -- Elementi del flusso (step / azioni / decisioni) con titolo,
  -- descrizione, descrizione completa, link e campi da valorizzare
  elementi jsonb not null default '[]'::jsonb,
  -- Tag liberi del flusso (es. ["CHG", "Incident", "Rilasci"])
  tags jsonb not null default '[]'::jsonb,
  creato_da uuid references profili(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table flussi_operativi enable row level security;

-- Gestionale interno: tutti gli utenti autenticati possono leggere e gestire i flussi
create policy "flussi_operativi_select" on flussi_operativi
  for select to authenticated using (true);

create policy "flussi_operativi_insert" on flussi_operativi
  for insert to authenticated with check (true);

create policy "flussi_operativi_update" on flussi_operativi
  for update to authenticated using (true);

create policy "flussi_operativi_delete" on flussi_operativi
  for delete to authenticated using (true);

-- Realtime (se la publication esiste già, aggiunge solo la tabella)
alter publication supabase_realtime add table flussi_operativi;

-- MIGRAZIONE (solo se la tabella esiste già senza la colonna tags):
-- alter table flussi_operativi add column if not exists tags jsonb not null default '[]'::jsonb;

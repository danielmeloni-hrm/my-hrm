-- ------------------------------------------------------------------
-- Sezione "Sviluppo" sui Documenti Operativi
-- Elenco libero di voci "cosa dovrà essere sviluppato" per un
-- documento operativo, ognuna con il proprio stato:
--   - Sviluppato
--   - Non Sviluppato
--   - Sostituito dal documento n°...
--
-- Se in precedenza è stata applicata una versione con colonne
-- singole (sviluppo_descrizione / sviluppo_stato /
-- sviluppo_sostituito_da), questo script le rimuove e le sostituisce
-- con un'unica colonna jsonb che contiene la lista di voci.
-- ------------------------------------------------------------------

alter table public.documenti_operativi
  drop constraint if exists documenti_operativi_sviluppo_stato_check;

alter table public.documenti_operativi
  drop column if exists sviluppo_descrizione,
  drop column if exists sviluppo_stato,
  drop column if exists sviluppo_sostituito_da;

alter table public.documenti_operativi
  add column if not exists sviluppo_voci jsonb not null default '[]'::jsonb;

comment on column public.documenti_operativi.sviluppo_voci is
  'Elenco di voci "cosa dovrà essere sviluppato" per questo documento operativo. '
  'Ogni voce è un oggetto: { "id": "...", "descrizione": "...", '
  '"stato": "Sviluppato" | "Non Sviluppato" | "Sostituito", "sostituito_da": "..." }.';

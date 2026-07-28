-- ==================================================================
-- Incident: aggiunta INC padre
--   inc_padre       text : numero dell'INC padre (aperto a monte)
--   inc_padre_link  text : URL dell'INC padre
--
-- Flusso: si apre prima l'INC padre, poi l'INC figlio (il "mio" INC,
-- cioè n_tag). Il filtro "N° INC vuoto ma INC padre presente" trova
-- gli incident con inc_padre valorizzato ma n_tag ancora vuoto.
-- ==================================================================

alter table public.incident
  add column if not exists inc_padre text null,
  add column if not exists inc_padre_link text null;

comment on column public.incident.inc_padre is
  'Numero dell''INC padre aperto a monte (l''INC figlio è n_tag).';

comment on column public.incident.inc_padre_link is
  'URL dell''INC padre.';

-- Indice utile al filtro "INC figlio ancora da aprire".
create index if not exists idx_incident_inc_padre
  on public.incident using btree (inc_padre) tablespace pg_default;

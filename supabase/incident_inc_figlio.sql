-- ==================================================================
-- Incident: inversione logica padre/figlio
--   Prima: n_tag = INC figlio, inc_padre = INC padre
--   Ora:   n_tag = INC PADRE,  inc_figlio = INC FIGLIO
--
-- Rinomina le colonne inc_padre → inc_figlio (e relativo link/indice).
-- ==================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'incident'
      and column_name = 'inc_padre'
  ) then
    alter table public.incident rename column inc_padre to inc_figlio;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'incident'
      and column_name = 'inc_padre_link'
  ) then
    alter table public.incident rename column inc_padre_link to inc_figlio_link;
  end if;
end $$;

-- Se le colonne non esistevano affatto, le creiamo.
alter table public.incident
  add column if not exists inc_figlio text null,
  add column if not exists inc_figlio_link text null;

comment on column public.incident.inc_figlio is
  'Numero dell''INC figlio (aperto a valle). Il padre è ora n_tag.';

comment on column public.incident.inc_figlio_link is
  'URL dell''INC figlio.';

-- Rinomina/crea l'indice.
alter index if exists idx_incident_inc_padre rename to idx_incident_inc_figlio;

create index if not exists idx_incident_inc_figlio
  on public.incident using btree (inc_figlio) tablespace pg_default;

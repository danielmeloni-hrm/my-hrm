-- ------------------------------------------------------------------
-- Segnalazioni e problemi: aggiornamenti
--   - nome_evento non è più obbligatorio in creazione
--   - applicativo diventa multi-valore (una segnalazione può
--     riguardare più applicativi, tipicamente per Esselunga)
-- ------------------------------------------------------------------

alter table public.segnalazioni_problemi
  alter column nome_evento drop not null;

alter table public.segnalazioni_problemi
  alter column applicativo type text[]
  using case
    when applicativo is null then null
    else array[applicativo]
  end;

comment on column public.segnalazioni_problemi.applicativo is
  'Applicativi coinvolti (soprattutto per Esselunga: APPECOM, ECOM35, ...). NULL quando il cliente non ha una suddivisione per applicativo.';

comment on column public.segnalazioni_problemi.nome_evento is
  'Nome evento (opzionale). Più segnalazioni possono essere create insieme separando i nomi con una virgola in fase di creazione.';

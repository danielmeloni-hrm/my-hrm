-- ------------------------------------------------------------------
-- Normalizzazione dei valori di ticket.stato
--
-- Contesto: la pagina di dettaglio ticket usava una lista di stati
-- hardcoded e divergente da STATO_TICKET_LIST
-- (@/components/parametri_ticket/attivita), unica lista usata da
-- "Tutte Attività" e "I miei ticket".
--
-- Conseguenza: gli stati salvati dal dettaglio non trovavano
-- corrispondenza nelle altre pagine, che mostravano di conseguenza
-- lo stato sbagliato (la <select> ripiegava sulla prima opzione).
--
-- Questo script riallinea i valori già presenti a database.
-- È idempotente: può essere eseguito più volte senza effetti.
-- ------------------------------------------------------------------

-- 1. Controllo preventivo: valori attualmente fuori dalla lista canonica.
--    Eseguire prima degli UPDATE per sapere cosa verrà toccato.
select stato, count(*) as ticket_interessati
from public.ticket
where stato is not null
  and stato not in (
    'Non Iniziato',
    'In stand-by',
    'Attività Sospesa',
    'In lavorazione',
    'In attesa Sviluppo',
    'In attesa risposta Sviluppatore',
    'Attenzione Business',
    'Attenzione di Andrea',
    'Completato - In attesa di chiusura',
    'Completato',
    'Cancellato'
  )
group by stato
order by ticket_interessati desc;

-- ------------------------------------------------------------------
-- 2. Riallineamento dei due valori divergenti noti.
-- ------------------------------------------------------------------

update public.ticket
set stato = 'Attenzione di Andrea'
where stato = 'Attenzione Andrea';

update public.ticket
set stato = 'Completato - In attesa di chiusura'
where stato = 'Completato - In attesa di chiusura TAG';

-- ------------------------------------------------------------------
-- 3. Verifica finale: deve restituire zero righe.
-- ------------------------------------------------------------------

select stato, count(*) as ticket_residui
from public.ticket
where stato is not null
  and stato not in (
    'Non Iniziato',
    'In stand-by',
    'Attività Sospesa',
    'In lavorazione',
    'In attesa Sviluppo',
    'In attesa risposta Sviluppatore',
    'Attenzione Business',
    'Attenzione di Andrea',
    'Completato - In attesa di chiusura',
    'Completato',
    'Cancellato'
  )
group by stato;

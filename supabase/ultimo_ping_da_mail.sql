-- ------------------------------------------------------------------
-- ticket.ultimo_ping aggiornato all'arrivo di una mail
--
-- Le mail finiscono in mail_threads tramite un flusso esterno che non
-- tocca la tabella ticket: all'arrivo di una mail ultimo_ping restava
-- quindi fermo al valore precedente, e con lui tutto ciò che ci si basa
-- (ticket fermi, overdue del thread, card "Ultimo ping" della home).
--
-- L'aggiornamento non può stare nel frontend: l'inserimento avviene a
-- database, quando nessuno ha l'applicazione aperta. Serve un trigger.
--
-- Scelte:
--  * ultimo_ping si muove SOLO IN AVANTI. Non viene ricalcolato dal
--    massimo delle mail, altrimenti un ping registrato a mano per un
--    contatto non-email (una telefonata) verrebbe arretrato alla data
--    dell'ultima mail.
--  * le righe di solo collegamento non contano: non sono mail, e la
--    loro data_invio è scelta a mano al momento del collegamento.
--  * un thread è globale: se la riga ha un topic, l'aggiornamento
--    raggiunge tutti i ticket collegati a quel topic, non solo quello
--    della riga inserita. Il confronto è sull'uguaglianza esatta del
--    topic, non su una normalizzazione: duplicare qui la pulizia dei
--    prefissi R:/I:/RE: significherebbe doverla tenere allineata con
--    quella TypeScript, che è il modo sicuro per farle divergere.
-- ------------------------------------------------------------------

create or replace function public.aggiorna_ultimo_ping_da_mail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data timestamptz;
  v_topic text;
begin
  -- Riga di solo collegamento: non è una mail ricevuta o inviata.
  if coalesce(new.linked_manually, false)
     or new.link_status = 'manual'
     or new.tread ->> 'type' = 'thread_link'
     or new.tread ->> 'tipo' = 'thread_link' then
    return new;
  end if;

  -- Data della mail: le colonne della riga più le date dentro l'array
  -- jsonb `emails`, che è dove il flusso esterno mette i messaggi.
  -- I cast possono fallire su valori scritti male: in quel caso si
  -- ripiega sulle sole colonne tipizzate invece di bloccare l'insert.
  begin
    select max(d) into v_data
    from (
      select new.received_at as d
      union all
      select new.sent_at
      union all
      select nullif(btrim(new.data_invio::text), '')::timestamptz
      union all
      select greatest(
        nullif(btrim(e ->> 'received_at'), '')::timestamptz,
        nullif(btrim(e ->> 'sent_at'), '')::timestamptz
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(new.emails) = 'array' then new.emails
          else '[]'::jsonb
        end
      ) as e
    ) as date_candidate;
  exception
    when others then
      v_data := greatest(new.received_at, new.sent_at);
  end;

  if v_data is null then
    return new;
  end if;

  -- Una mail con data nel futuro è quasi sempre un fuso o un orologio
  -- sbagliato del mittente: non deve spingere avanti l'ultimo ping.
  if v_data > now() + interval '1 day' then
    return new;
  end if;

  v_topic := nullif(btrim(coalesce(new.topic, '')), '');

  update public.ticket t
  set ultimo_ping = v_data
  where (t.ultimo_ping is null or t.ultimo_ping < v_data)
    and t.n_tag in (
      select m.n_tag
      from public.mail_threads m
      where m.n_tag is not null
        and v_topic is not null
        and m.topic = v_topic
      union
      select new.n_tag
    );

  return new;
end;
$$;

comment on function public.aggiorna_ultimo_ping_da_mail() is
  'Porta avanti ticket.ultimo_ping quando una mail entra in mail_threads.';

drop trigger if exists trg_ultimo_ping_da_mail on public.mail_threads;

create trigger trg_ultimo_ping_da_mail
  after insert or update of received_at, sent_at, data_invio, emails, topic, n_tag
  on public.mail_threads
  for each row
  execute function public.aggiorna_ultimo_ping_da_mail();

-- ------------------------------------------------------------------
-- Vista di appoggio: ultima mail per ogni ticket.
--
-- Serve al controllo e al recupero qui sotto, ed è comoda anche solo per
-- guardare i dati. Segue le stesse regole del trigger: le righe di solo
-- collegamento non contano come mail, ma il ticket che sta attaccato a un
-- thread PER SOLO collegamento eredita comunque le mail di quel thread,
-- perché un thread è globale.
-- ------------------------------------------------------------------

create or replace view public.ultima_mail_per_ticket as
with riga_mail as (
  -- Le mail vere, con la loro data e il topic del thread.
  select
    m.n_tag,
    nullif(btrim(coalesce(m.topic, '')), '') as topic,
    greatest(
      m.received_at,
      m.sent_at,
      (
        select max(greatest(
          nullif(btrim(e ->> 'received_at'), '')::timestamptz,
          nullif(btrim(e ->> 'sent_at'), '')::timestamptz
        ))
        from jsonb_array_elements(
          case when jsonb_typeof(m.emails) = 'array' then m.emails
               else '[]'::jsonb end
        ) as e
      )
    ) as data_mail
  from public.mail_threads m
  where not coalesce(m.linked_manually, false)
    and coalesce(m.link_status, '') <> 'manual'
    and coalesce(m.tread ->> 'type', '') <> 'thread_link'
    and coalesce(m.tread ->> 'tipo', '') <> 'thread_link'
),
aggancio as (
  -- Come un ticket è agganciato a un thread: con una mail propria oppure
  -- con una riga di collegamento. Qui le righe di collegamento servono.
  select distinct
    m.n_tag,
    nullif(btrim(coalesce(m.topic, '')), '') as topic
  from public.mail_threads m
  where m.n_tag is not null
)
select
  a.n_tag,
  max(r.data_mail) as ultima_mail
from aggancio a
join riga_mail r
  on r.n_tag = a.n_tag
  or (a.topic is not null and r.topic = a.topic)
where r.data_mail is not null
  -- Una mail datata nel futuro è quasi sempre un fuso o un orologio
  -- sbagliato del mittente: non conta, né qui né nel trigger.
  and r.data_mail <= now() + interval '1 day'
group by a.n_tag;

comment on view public.ultima_mail_per_ticket is
  'Data dell ultima mail di ogni ticket, thread globali compresi.';

-- ------------------------------------------------------------------
-- Controllo: quali ticket hanno un ultimo_ping più vecchio dell ultima
-- mail arrivata. Da eseguire PRIMA del recupero, per sapere quante
-- righe verranno toccate.
-- ------------------------------------------------------------------

select
  t.n_tag,
  t.ultimo_ping,
  u.ultima_mail,
  u.ultima_mail - t.ultimo_ping as ritardo
from public.ticket t
join public.ultima_mail_per_ticket u on u.n_tag = t.n_tag
where t.ultimo_ping is null or t.ultimo_ping < u.ultima_mail
order by ritardo desc nulls last;

-- ------------------------------------------------------------------
-- Recupero dello storico: allinea i ticket già a database.
-- Si muove solo in avanti, come il trigger. È idempotente.
-- ------------------------------------------------------------------

update public.ticket t
set ultimo_ping = u.ultima_mail
from public.ultima_mail_per_ticket u
where u.n_tag = t.n_tag
  and (t.ultimo_ping is null or t.ultimo_ping < u.ultima_mail);

-- ------------------------------------------------------------------
-- Verifica finale: la query di controllo qui sopra deve tornare vuota.
-- ------------------------------------------------------------------

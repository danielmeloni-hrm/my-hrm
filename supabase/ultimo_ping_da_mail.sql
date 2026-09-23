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
-- Regole:
--
--  * Un THREAD È GLOBALE. Se lo stesso thread è collegato a più ticket,
--    la mail aggiorna ultimo_ping su TUTTI quei ticket.
--
--  * Un TICKET PUÒ AVERE PIÙ THREAD. Il suo ultimo_ping è la data della
--    mail più recente fra tutti i suoi thread: siccome il valore si
--    muove solo in avanti, una mail vecchia su un secondo thread non lo
--    fa arretrare.
--
--  * ultimo_ping si muove SOLO IN AVANTI. Non viene ricalcolato dal
--    massimo delle mail, altrimenti un ping registrato a mano per un
--    contatto non-email (una telefonata) verrebbe arretrato.
--
--  * Le righe di solo collegamento non contano come mail: la loro
--    data_invio è scelta a mano al momento del collegamento. Servono
--    però a sapere QUALI ticket sono attaccati al thread.
--
--  * I ticket collegati si riconoscono dalla CHIAVE NORMALIZZATA del
--    thread, non dall'uguaglianza esatta del topic: Outlook antepone
--    all'oggetto R:, I:, RE:, FW: e un confronto esatto lascerebbe
--    fuori proprio i ticket agganciati con l'oggetto rimaneggiato, o
--    con il solo subject valorizzato.
--    La normalizzazione qui sotto è la stessa di normalizeThreadName in
--    src/lib/mail-thread-utils.ts: sono due implementazioni della stessa
--    regola e vanno tenute allineate.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- Normalizzazione del nome di un thread
-- ------------------------------------------------------------------

create or replace function public.normalizza_nome_thread(valore text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(
          regexp_replace(
            btrim(coalesce(valore, '')),
            -- Prefissi di risposta/inoltro di Outlook, in più lingue e
            -- ripetibili ("R: I: R: oggetto"), forme numerate comprese
            -- ("RE[2]:"). I token più lunghi vanno prima, così "RE:"
            -- non viene letto come "R:".
            '^([[:space:]]*(ANTW|DOORST|FWD|RIF|RES|RE|FW|TR|AW|WG|RV|SV|VS|VB|R|I)[[:space:]]*(\[[0-9]+\])?[[:space:]]*:[[:space:]]*)+',
            '',
            'i'
          )
        ),
        '[[:space:]]+', ' ', 'g'
      )
    ),
    ''
  );
$$;

comment on function public.normalizza_nome_thread(text) is
  'Nome thread senza prefissi Outlook, minuscolo, spazi collassati. Deve restare allineata a normalizeThreadName in src/lib/mail-thread-utils.ts.';

-- Chiave del thread di una riga: topic se c'è, altrimenti l'oggetto,
-- altrimenti il nome salvato dentro tread. Stesso ordine di precedenza
-- di getRowThreadKey lato TypeScript.
create or replace function public.chiave_thread(
  p_topic text,
  p_subject text,
  p_nome_thread text
)
returns text
language sql
immutable
as $$
  select coalesce(
    public.normalizza_nome_thread(p_topic),
    public.normalizza_nome_thread(p_subject),
    public.normalizza_nome_thread(p_nome_thread)
  );
$$;

-- Senza indice il trigger calcolerebbe la chiave su ogni riga della
-- tabella a ogni mail in arrivo.
create index if not exists mail_threads_chiave_thread_idx
  on public.mail_threads (
    public.chiave_thread(topic, subject, tread ->> 'nome_thread')
  );

-- ------------------------------------------------------------------
-- Trigger
-- ------------------------------------------------------------------

create or replace function public.aggiorna_ultimo_ping_da_mail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data timestamptz;
  v_chiave text;
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

  v_chiave := public.chiave_thread(
    new.topic,
    new.subject,
    new.tread ->> 'nome_thread'
  );

  -- Il thread è globale: si aggiornano TUTTI i ticket agganciati a
  -- questo thread, riconosciuti dalla chiave normalizzata, più quello
  -- della riga appena arrivata.
  update public.ticket t
  set ultimo_ping = v_data
  where (t.ultimo_ping is null or t.ultimo_ping < v_data)
    and t.n_tag in (
      select m.n_tag
      from public.mail_threads m
      where m.n_tag is not null
        and v_chiave is not null
        and public.chiave_thread(
              m.topic, m.subject, m.tread ->> 'nome_thread'
            ) = v_chiave
      union
      select new.n_tag
    );

  return new;
end;
$$;

comment on function public.aggiorna_ultimo_ping_da_mail() is
  'Porta avanti ticket.ultimo_ping su tutti i ticket del thread quando arriva una mail.';

drop trigger if exists trg_ultimo_ping_da_mail on public.mail_threads;

create trigger trg_ultimo_ping_da_mail
  after insert or update of
    received_at, sent_at, data_invio, emails, topic, subject, n_tag
  on public.mail_threads
  for each row
  execute function public.aggiorna_ultimo_ping_da_mail();

-- ------------------------------------------------------------------
-- Vista di appoggio: ultima mail per ogni ticket.
--
-- Stesse regole del trigger. Un ticket con più thread prende il massimo
-- fra tutti; un ticket attaccato a un thread solo da un collegamento
-- eredita comunque le mail di quel thread.
-- ------------------------------------------------------------------

create or replace view public.ultima_mail_per_ticket as
with riga_mail as (
  -- Le mail vere, con la loro data e la chiave del thread.
  select
    m.n_tag,
    public.chiave_thread(m.topic, m.subject, m.tread ->> 'nome_thread') as chiave,
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
  -- Come un ticket è attaccato a un thread: con una mail propria oppure
  -- con una riga di collegamento. Qui le righe di collegamento servono.
  select distinct
    m.n_tag,
    public.chiave_thread(m.topic, m.subject, m.tread ->> 'nome_thread') as chiave
  from public.mail_threads m
  where m.n_tag is not null
)
select
  a.n_tag,
  max(r.data_mail) as ultima_mail
from aggancio a
join riga_mail r
  on r.n_tag = a.n_tag
  or (a.chiave is not null and r.chiave = a.chiave)
where r.data_mail is not null
  -- Una mail datata nel futuro è quasi sempre un fuso o un orologio
  -- sbagliato del mittente: non conta, né qui né nel trigger.
  and r.data_mail <= now() + interval '1 day'
group by a.n_tag;

comment on view public.ultima_mail_per_ticket is
  'Data dell ultima mail di ogni ticket, thread globali e multi-thread compresi.';

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

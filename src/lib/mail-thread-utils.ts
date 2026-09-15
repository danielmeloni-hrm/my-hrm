/**
 * Utility condivise per i thread email.
 *
 * Un thread email è GLOBALE: lo stesso thread può essere collegato a più
 * ticket e Outlook antepone all'oggetto un prefisso di risposta/inoltro
 * che cambia a ogni giro:
 *
 *   TAG01588307 -> Proposta accesso degli interessati (GDPR)
 *   R: TAG01588307 -> Proposta accesso degli interessati (GDPR)
 *   I: TAG01588307 -> Proposta accesso degli interessati (GDPR)
 *
 * Sono lo stesso thread. Il nome corretto è quello in `topic`, impostato
 * a mano; `subject` è l'oggetto grezzo arrivato da Outlook e va ripulito
 * prima di essere confrontato.
 *
 * Tutto ciò che raggruppa, confronta o conta thread deve passare da qui:
 * duplicare la normalizzazione in ogni pagina è esattamente il motivo per
 * cui lo stesso thread compariva più volte.
 */

/**
 * Prefissi di risposta/inoltro di Outlook, in più lingue e ripetibili
 * ("R: I: R: oggetto"). Include le forme numerate tipo "RE[2]:".
 * I token più lunghi vanno prima, così "RE:" non viene letto come "R:".
 */
const OUTLOOK_PREFIX_REGEX =
  /^(?:\s*(?:ANTW|DOORST|FWD|RIF|RES|RE|FW|TR|AW|WG|RV|SV|VS|VB|R|I)\s*(?:\[\d+\])?\s*:\s*)+/i

/** Rimuove i prefissi Outlook mantenendo maiuscole e punteggiatura originali. */
export function stripOutlookPrefixes(value?: string | null): string {
  if (!value) return ''

  let previous = value.trim()
  let current = previous.replace(OUTLOOK_PREFIX_REGEX, '').trim()

  // Il replace è già ricorsivo grazie al "+", ma un secondo giro copre
  // i casi con caratteri invisibili incollati da Outlook fra un prefisso
  // e l'altro.
  while (current !== previous) {
    previous = current
    current = current.replace(OUTLOOK_PREFIX_REGEX, '').trim()
  }

  return current
}

/**
 * Chiave di confronto di un nome thread: senza prefissi, minuscolo,
 * spazi collassati. Da usare SOLO per confrontare, mai per mostrare.
 */
export function normalizeThreadName(value?: string | null): string {
  return stripOutlookPrefixes(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface StoredEmail {
  html?: string | null
  text?: string | null
  index?: number
  subject?: string | null
  direction?: 'inbound' | 'outbound' | null
  from_email?: string | null
  received_at?: string | null
  sent_at?: string | null
  body_preview?: string | null
  outlook_message_id?: string | null
  internet_message_id?: string | null
  [key: string]: unknown
}

export interface ThreadNote {
  id: string
  nota: string
  created_at: string
}

/** Riga della tabella mail_threads. */
export interface MailThreadRow {
  id: string
  n_tag: string | null
  topic: string | null
  subject: string | null
  contenuto: string | null
  data_invio: string | null
  created_at: string | null
  body_html?: string | null
  from_email?: string | null
  to_emails?: unknown[] | null
  cc_emails?: unknown[] | null
  outlook_message_id?: string | null
  internet_message_id?: string | null
  direction?: 'inbound' | 'outbound' | null
  received_at?: string | null
  sent_at?: string | null
  linked_manually?: boolean | null
  linked_at?: string | null
  link_status?: 'auto' | 'manual' | 'unlinked' | null
  emails?: StoredEmail[] | null
  tread?: {
    type?: string
    tipo?: string
    nome_thread?: string
    note?: ThreadNote[]
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

/** Email di un thread, con il riferimento alla riga che la contiene. */
export interface ThreadEmail extends StoredEmail {
  uniqueId: string
  parentRowId: string
  date: string | null
}

export interface ThreadGroup {
  /** Chiave normalizzata: identifica il thread a livello globale. */
  key: string
  /** Nome da mostrare, nella forma corretta (topic se presente). */
  nome: string
  rows: MailThreadRow[]
  /** Righe create collegando a mano il thread a un ticket. */
  linkRows: MailThreadRow[]
  /** Tutte le email del thread, dalla più vecchia alla più recente. */
  emails: ThreadEmail[]
  notes: Array<ThreadNote & { sourceRowId: string }>
  /** n_tag dei ticket a cui il thread risulta collegato. */
  nTags: string[]
  /** Data dell'ultima mail inviata o ricevuta; null se il thread non ne ha. */
  ultimaMail: string | null
}

/**
 * Nome da mostrare per una riga: il topic impostato a mano ha la
 * precedenza, altrimenti l'oggetto Outlook ripulito dai prefissi.
 * `contenuto` NON è un ripiego valido: contiene il corpo della mail.
 */
export function getRowDisplayName(row: MailThreadRow): string {
  const topic = (row.topic || '').trim()
  if (topic) return stripOutlookPrefixes(topic) || topic

  const subject = stripOutlookPrefixes(row.subject)
  if (subject) return subject

  const nomeThread = stripOutlookPrefixes(row.tread?.nome_thread)
  if (nomeThread) return nomeThread

  return 'Thread senza nome'
}

/**
 * Chiave del thread. Righe con topic diverso ma stesso oggetto normalizzato
 * finiscono nello stesso gruppo, che è il comportamento voluto: è lo stesso
 * thread visto prima e dopo una risposta.
 */
export function getRowThreadKey(row: MailThreadRow): string {
  const fromTopic = normalizeThreadName(row.topic)
  if (fromTopic) return fromTopic

  const fromSubject = normalizeThreadName(row.subject)
  if (fromSubject) return fromSubject

  const fromNomeThread = normalizeThreadName(row.tread?.nome_thread)
  if (fromNomeThread) return fromNomeThread

  // Ultima spiaggia: la riga resta un gruppo a sé, senza trascinare
  // dentro altre righe per errore.
  return `riga:${row.id}`
}

/** True se la riga è un collegamento manuale, non una mail importata. */
export function isThreadLinkRow(row: MailThreadRow): boolean {
  return (
    row.linked_manually === true ||
    row.link_status === 'manual' ||
    row.tread?.type === 'thread_link' ||
    row.tread?.tipo === 'thread_link'
  )
}

export function stripHtml(html?: string | null): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstValidDate(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (!Number.isNaN(time)) return value
  }
  return null
}

/** Data di una singola mail: quando è stata ricevuta o inviata. */
export function getStoredEmailDate(email: StoredEmail): string | null {
  return firstValidDate(email.received_at, email.sent_at)
}

/**
 * Data della riga come mail. `created_at` è quando la riga è finita a
 * database, non quando la mail è passata: va usato solo come ripiego
 * e mai per una riga di solo collegamento.
 */
export function getRowMailDate(row: MailThreadRow): string | null {
  return firstValidDate(row.received_at, row.sent_at, row.data_invio)
}

/** Estrae le email contenute nella riga, normalizzate. */
export function getRowEmails(row: MailThreadRow): ThreadEmail[] {
  if (!Array.isArray(row.emails) || row.emails.length === 0) {
    // Una riga importata senza array `emails` è comunque una mail.
    if (isThreadLinkRow(row)) return []

    const date = getRowMailDate(row)
    if (!date && !row.body_html && !row.contenuto) return []

    return [
      {
        uniqueId: `${row.id}-0`,
        parentRowId: row.id,
        date,
        subject: row.subject,
        direction: row.direction ?? null,
        from_email: row.from_email ?? null,
        received_at: row.received_at ?? null,
        sent_at: row.sent_at ?? null,
        html: row.body_html ?? null,
        text: row.contenuto ?? null,
      },
    ]
  }

  return row.emails.map((email, index) => ({
    ...email,
    uniqueId: `${row.id}-${
      email.outlook_message_id || email.internet_message_id || index
    }`,
    parentRowId: row.id,
    date: getStoredEmailDate(email) || getRowMailDate(row),
  }))
}

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

/**
 * Raggruppa le righe in thread globali.
 *
 * Il raggruppamento NON tiene conto di n_tag: lo stesso thread collegato a
 * più ticket resta un thread solo, con l'elenco dei ticket in `nTags`.
 * Per la card di un singolo ticket si filtrano prima le righe.
 */
export function groupRowsIntoThreads(rows: MailThreadRow[]): ThreadGroup[] {
  const map = new Map<string, ThreadGroup>()
  /** Gruppi il cui nome arriva già da un topic esplicito. */
  const nomeDaTopic = new Set<string>()

  for (const row of rows) {
    const key = getRowThreadKey(row)

    if (!map.has(key)) {
      map.set(key, {
        key,
        nome: getRowDisplayName(row),
        rows: [],
        linkRows: [],
        emails: [],
        notes: [],
        nTags: [],
        ultimaMail: null,
      })
    }

    const group = map.get(key)!
    group.rows.push(row)

    // Il nome definitivo è quello di una riga con topic esplicito: è il
    // nome corretto, non l'oggetto rimaneggiato da Outlook. La prima riga
    // con topic vince, le successive non lo sovrascrivono.
    if ((row.topic || '').trim() && !nomeDaTopic.has(key)) {
      group.nome = getRowDisplayName(row)
      nomeDaTopic.add(key)
    }

    if (isThreadLinkRow(row)) {
      group.linkRows.push(row)
    }

    for (const email of getRowEmails(row)) {
      group.emails.push(email)
      group.ultimaMail = maxDate(group.ultimaMail, email.date)
    }

    const nTag = (row.n_tag || '').trim()
    if (nTag && !group.nTags.includes(nTag)) {
      group.nTags.push(nTag)
    }

    for (const note of row.tread?.note || []) {
      group.notes.push({ ...note, sourceRowId: row.id })
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      emails: group.emails.sort(
        (a, b) =>
          new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
      ),
      notes: group.notes.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
      nTags: group.nTags.sort(),
    }))
    .sort((a, b) => {
      // I thread senza mail datate finiscono in fondo, non in cima.
      if (!a.ultimaMail && !b.ultimaMail) return a.nome.localeCompare(b.nome)
      if (!a.ultimaMail) return 1
      if (!b.ultimaMail) return -1
      return new Date(b.ultimaMail).getTime() - new Date(a.ultimaMail).getTime()
    })
}

/** Formattazioni condivise, così le due pagine mostrano le date allo stesso modo. */
export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStoredEmailText(email: ThreadEmail): string {
  return email.text || email.body_preview || stripHtml(email.html) || ''
}

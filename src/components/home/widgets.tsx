"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import NoteWidget from "./NoteWidget";
import {
  getCaricoTeam,
  getDistribuzioneStati,
  getGiorniAttesaBusiness,
  getGiorniFermo,
  getMotiviNotifica,
  getPingInfo,
  getProssimeScadenze,
  getSlaInfo,
  getTempiRisoluzione,
  isBloccatoDaBusiness,
  isPingScaduto,
  isTicketAperto,
  isTicketFermo,
  isTicketUrgente,
  filtraTicketCard,
  valoreCampoCard,
  etichettaCampoCard,
  type HomeWidgetId,
  type TicketLike,
  type CustomCardConfig,
} from "@/lib/home-widgets";

export type HomeData = {
  tickets: TicketLike[];
  profili: TicketLike[];
  userId: string | null;
};

type WidgetProps = {
  data: HomeData;
};

/* ------------------------------------------------------------------ */
/* Elementi condivisi                                                  */
/* ------------------------------------------------------------------ */

function WidgetEmpty({ testo }: { testo: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <CheckCircle2 size={28} className="text-emerald-500/30" />
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {testo}
      </p>
    </div>
  );
}

function TicketRow({
  ticket,
  badge,
  badgeTone = "slate",
}: {
  ticket: TicketLike;
  badge?: string;
  badgeTone?: "slate" | "red" | "amber" | "blue" | "emerald";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-50 text-red-600 border border-red-100",
    amber: "bg-amber-50 text-amber-700 border border-amber-100",
    blue: "bg-blue-50 text-blue-700 border border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  };

  return (
    <Link
      href={`/ticket/${ticket.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {ticket.n_tag && (
            <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">
              {ticket.n_tag}
            </span>
          )}
          {ticket.clienti?.nome && (
            <span className="truncate text-[10px] font-bold uppercase tracking-tight text-slate-300">
              {ticket.clienti.nome}
            </span>
          )}
        </div>

        <p className="truncate text-[13px] font-semibold text-slate-800">
          {ticket.titolo}
        </p>
      </div>

      {badge && (
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${tones[badgeTone]}`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

/**
 * Riga estesa: tag · titolo · cliente su una riga, nota importante sotto.
 */
function TicketRowConNota({
  ticket,
  badge,
  badgeTone = "amber",
}: {
  ticket: TicketLike;
  badge?: string;
  badgeTone?: "amber" | "red";
}) {
  const nota = String(ticket.note_importanti ?? "").trim();

  const tones: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 border border-amber-100",
    red: "bg-red-50 text-red-600 border border-red-100",
  };

  return (
    <Link
      href={`/ticket/${ticket.id}`}
      className="block rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-slate-800">
          {ticket.n_tag && (
            <span className="font-black text-slate-400">{ticket.n_tag}</span>
          )}
          {ticket.n_tag && <span className="text-slate-300"> — </span>}
          {ticket.titolo}
          {ticket.clienti?.nome && (
            <>
              <span className="text-slate-300"> — </span>
              <span className="font-bold uppercase tracking-tight text-slate-400">
                {ticket.clienti.nome}
              </span>
            </>
          )}
        </p>

        {badge && (
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${tones[badgeTone]}`}
          >
            {badge}
          </span>
        )}
      </div>

      {nota ? (
        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-slate-500">
          <span className="font-black uppercase tracking-tight text-slate-400">
            Nota:{" "}
          </span>
          {nota}
        </p>
      ) : (
        <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-300">
          Nessuna nota importante
        </p>
      )}
    </Link>
  );
}

function ScrollList({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Widget                                                              */
/* ------------------------------------------------------------------ */

function AttivitaAssegnate({ data }: WidgetProps) {
  const miei = useMemo(
    () =>
      data.tickets
        .filter(
          (ticket) =>
            isTicketAperto(ticket) &&
            data.userId &&
            String(ticket.assignee ?? "") === data.userId
        )
        .sort(
          (a, b) =>
            (a.numero_priorita ?? 99) - (b.numero_priorita ?? 99) ||
            new Date(a.creato_at ?? 0).getTime() -
              new Date(b.creato_at ?? 0).getTime()
        ),
    [data]
  );

  if (miei.length === 0) {
    return <WidgetEmpty testo="Nessuna attività assegnata" />;
  }

  return (
    <ScrollList>
      {miei.map((ticket) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          badge={ticket.stato ?? undefined}
          badgeTone={ticket.in_lavorazione_ora ? "blue" : "slate"}
        />
      ))}
    </ScrollList>
  );
}

function TicketUrgenti({ data }: WidgetProps) {
  const urgenti = useMemo(
    () =>
      data.tickets
        .filter(isTicketUrgente)
        .sort(
          (a, b) =>
            new Date(a.creato_at ?? 0).getTime() -
            new Date(b.creato_at ?? 0).getTime()
        ),
    [data]
  );

  if (urgenti.length === 0) {
    return <WidgetEmpty testo="Nessun ticket urgente" />;
  }

  return (
    <ScrollList>
      {urgenti.map((ticket) => {
        const giorni = ticket.creato_at
          ? Math.floor(
              (Date.now() - new Date(ticket.creato_at).getTime()) / 86_400_000
            )
          : null;

        return (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            badge={giorni !== null ? `${giorni}g` : "Alta"}
            badgeTone="red"
          />
        );
      })}
    </ScrollList>
  );
}

function SlaInScadenza({ data }: WidgetProps) {
  const righe = useMemo(() => {
    const now = new Date();

    return data.tickets
      .map((ticket) => ({ ticket, sla: getSlaInfo(ticket, now) }))
      .filter(({ sla }) => sla.scaduto || sla.inScadenza)
      .sort((a, b) => (a.sla.giorniResidui ?? 0) - (b.sla.giorniResidui ?? 0));
  }, [data]);

  if (righe.length === 0) {
    return <WidgetEmpty testo="Nessuno SLA a rischio" />;
  }

  return (
    <ScrollList>
      {righe.map(({ ticket, sla }) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          badge={
            sla.scaduto
              ? `Scaduto ${Math.abs(sla.giorniResidui ?? 0)}g`
              : sla.giorniResidui === 0
                ? "Scade oggi"
                : `${sla.giorniResidui}g`
          }
          badgeTone={sla.scaduto ? "red" : "amber"}
        />
      ))}
    </ScrollList>
  );
}

function AttivitaFerme({ data }: WidgetProps) {
  const ferme = useMemo(() => {
    const now = new Date();

    return data.tickets
      .filter((ticket) => isTicketFermo(ticket, now))
      .map((ticket) => ({ ticket, giorni: getGiorniFermo(ticket, now) ?? 0 }))
      .sort((a, b) => b.giorni - a.giorni);
  }, [data]);

  if (ferme.length === 0) {
    return <WidgetEmpty testo="Tutto in movimento" />;
  }

  return (
    <ScrollList>
      {ferme.map(({ ticket, giorni }) => (
        <TicketRowConNota
          key={ticket.id}
          ticket={ticket}
          badge={`Fermo ${giorni}g`}
          badgeTone={giorni > 90 ? "red" : "amber"}
        />
      ))}
    </ScrollList>
  );
}

function BloccatiBusiness({ data }: WidgetProps) {
  const bloccati = useMemo(() => {
    const now = new Date();

    return data.tickets
      .filter(isBloccatoDaBusiness)
      .map((ticket) => ({
        ticket,
        giorni: getGiorniAttesaBusiness(ticket, now) ?? 0,
      }))
      .sort((a, b) => b.giorni - a.giorni);
  }, [data]);

  if (bloccati.length === 0) {
    return <WidgetEmpty testo="Nessun blocco lato business" />;
  }

  return (
    <ScrollList>
      {bloccati.map(({ ticket, giorni }) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          badge={`Attesa ${giorni}g`}
          badgeTone={giorni > 15 ? "red" : "amber"}
        />
      ))}
    </ScrollList>
  );
}

function UltimoPing({ data }: WidgetProps) {
  const scaduti = useMemo(() => {
    const now = new Date();

    return data.tickets
      .filter((ticket) => isPingScaduto(ticket, now))
      .map((ticket) => ({ ticket, ping: getPingInfo(ticket, now) }))
      .sort((a, b) => {
        // I "mai pingati" vanno in cima, poi i più vecchi.
        if (a.ping.giorniDaUltimoPing === null) return -1;
        if (b.ping.giorniDaUltimoPing === null) return 1;

        return b.ping.giorniDaUltimoPing - a.ping.giorniDaUltimoPing;
      });
  }, [data]);

  if (scaduti.length === 0) {
    return <WidgetEmpty testo="Tutti i ticket sono stati pingati" />;
  }

  return (
    <ScrollList>
      {scaduti.map(({ ticket, ping }) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          badge={
            ping.ultimoPing
              ? ping.ultimoPing.toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })
              : "Mai pingato"
          }
          badgeTone="red"
        />
      ))}
    </ScrollList>
  );
}

function NotificheImportanti({ data }: WidgetProps) {
  const righe = useMemo(
    () =>
      data.tickets
        .map((ticket) => ({ ticket, motivi: getMotiviNotifica(ticket) }))
        .filter(({ motivi }) => motivi.length > 0)
        .sort((a, b) => b.motivi.length - a.motivi.length),
    [data]
  );

  if (righe.length === 0) {
    return <WidgetEmpty testo="Nessuna segnalazione aperta" />;
  }

  return (
    <ScrollList>
      {righe.map(({ ticket, motivi }) => (
        <Link
          key={ticket.id}
          href={`/ticket/${ticket.id}`}
          className="block rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="shrink-0 text-amber-500" />
            <p className="truncate text-[13px] font-semibold text-slate-800">
              {ticket.n_tag ? `${ticket.n_tag} — ` : ""}
              {ticket.titolo}
            </p>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1">
            {motivi.map((motivo) => (
              <span
                key={motivo}
                className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-amber-700"
              >
                {motivo}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </ScrollList>
  );
}

function ProssimeScadenze({ data }: WidgetProps) {
  const scadenze = useMemo(() => getProssimeScadenze(data.tickets), [data]);

  if (scadenze.length === 0) {
    return <WidgetEmpty testo="Nessun rilascio nei prossimi 14 giorni" />;
  }

  return (
    <ScrollList>
      {scadenze.map((scadenza) => (
        <TicketRow
          key={`${scadenza.ticket.id}-${scadenza.tipo}`}
          ticket={scadenza.ticket}
          badge={`${scadenza.tipo} · ${scadenza.data.toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "2-digit",
          })}`}
          badgeTone={scadenza.tipo === "Produzione" ? "emerald" : "blue"}
        />
      ))}
    </ScrollList>
  );
}

function CaricoTeam({ data }: WidgetProps) {
  const carico = useMemo(
    () => getCaricoTeam(data.tickets, data.profili),
    [data]
  );

  if (carico.length === 0) {
    return <WidgetEmpty testo="Nessun ticket aperto" />;
  }

  const massimo = Math.max(...carico.map((persona) => persona.aperti), 1);

  return (
    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
      {carico.map((persona) => (
        <div key={persona.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-bold text-slate-800">
              {persona.nome}
            </span>

            <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-black">
              {persona.urgenti > 0 && (
                <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-red-600">
                  {persona.urgenti} urg
                </span>
              )}
              {persona.fermi > 0 && (
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700">
                  {persona.fermi} fermi
                </span>
              )}
              <span className="text-slate-900">{persona.aperti}</span>
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#0150a0]"
              style={{ width: `${(persona.aperti / massimo) * 100}%` }}
            />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
            Avanzamento medio {persona.avanzamentoMedio}% · {persona.inLavorazione}{" "}
            in lavorazione
          </p>
        </div>
      ))}
    </div>
  );
}

const CHART_COLORS = [
  "#0150a0",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#475569",
];

function GraficoStati({ data }: WidgetProps) {
  const distribuzione = useMemo(
    () => getDistribuzioneStati(data.tickets),
    [data]
  );

  if (distribuzione.length === 0) {
    return <WidgetEmpty testo="Nessun dato disponibile" />;
  }

  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={distribuzione}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="stato"
            width={110}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            formatter={(value) => [`${value} ticket`, "Totale"]}
          />
          <Bar dataKey="totale" radius={[0, 6, 6, 0]}>
            {distribuzione.map((entry, index) => (
              <Cell
                key={entry.stato}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoTempi({ data }: WidgetProps) {
  const tempi = useMemo(() => getTempiRisoluzione(data.tickets), [data]);

  if (tempi.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <Inbox size={28} className="text-slate-200" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Nessun ticket chiuso da analizzare
        </p>
      </div>
    );
  }

  const media =
    Math.round(
      (tempi.reduce((sum, item) => sum + item.giorniMedi, 0) / tempi.length) * 10
    ) / 10;

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-black tracking-tighter text-slate-900">
          {media}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          giorni medi di risoluzione
        </span>
      </div>

      <div className="h-[200px] w-full sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tempi} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey="mese" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value, name) =>
                name === "giorniMedi"
                  ? [`${value} giorni`, "Media"]
                  : [`${value}`, "Ticket chiusi"]
              }
            />
            <Line
              type="monotone"
              dataKey="giorniMedi"
              stroke="#0150a0"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Registro                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Card personalizzata                                                 */
/* ------------------------------------------------------------------ */

export function TicketCustom({
  data,
  config,
}: {
  data: HomeData;
  config: CustomCardConfig;
}) {
  const ticket = useMemo(
    () => filtraTicketCard(data.tickets, config, data.userId),
    [data.tickets, data.userId, config]
  );

  if (config.modo === "conteggio") {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <span className="text-4xl font-black tracking-tighter text-slate-900">
          {ticket.length}
        </span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          ticket
        </span>
      </div>
    );
  }

  if (ticket.length === 0) {
    return <WidgetEmpty testo="Nessun ticket con questi filtri" />;
  }

  const campi = config.campi.length > 0 ? config.campi : ["stato"];

  if (config.modo === "tabella") {
    return (
      <div className="max-h-[340px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="py-2 pr-2 text-[10px] font-black uppercase tracking-tight text-slate-400">
                Ticket
              </th>
              {campi.map((campo) => (
                <th
                  key={campo}
                  className="px-2 py-2 text-[10px] font-black uppercase tracking-tight text-slate-400"
                >
                  {etichettaCampoCard(campo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ticket.map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
              >
                <td className="py-2 pr-2">
                  <Link
                    href={`/ticket/${t.id}`}
                    className="font-semibold text-[#0150a0] hover:underline"
                  >
                    {t.n_tag || t.titolo || "—"}
                  </Link>
                </td>
                {campi.map((campo) => (
                  <td key={campo} className="px-2 py-2 text-slate-600">
                    {valoreCampoCard(t, campo)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Modalità lista
  return (
    <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
      {ticket.map((t) => (
        <Link
          key={t.id}
          href={`/ticket/${t.id}`}
          className="block rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="flex items-center gap-2">
            {t.n_tag && (
              <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">
                {t.n_tag}
              </span>
            )}
            <p className="truncate text-[13px] font-semibold text-slate-800">
              {t.titolo || "—"}
            </p>
          </div>

          {campi.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {campi.map((campo) => (
                <span
                  key={campo}
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                >
                  <span className="text-slate-400">
                    {etichettaCampoCard(campo)}:{" "}
                  </span>
                  {valoreCampoCard(t, campo)}
                </span>
              ))}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

export const WIDGET_COMPONENTS: Record<
  HomeWidgetId,
  (props: WidgetProps) => React.ReactElement
> = {
  attivita_assegnate: AttivitaAssegnate,
  ticket_urgenti: TicketUrgenti,
  sla_in_scadenza: SlaInScadenza,
  attivita_ferme: AttivitaFerme,
  bloccati_business: BloccatiBusiness,
  ultimo_ping: UltimoPing,
  note_importanti: NoteWidget,
  notifiche_importanti: NotificheImportanti,
  prossime_scadenze: ProssimeScadenze,
  carico_team: CaricoTeam,
  grafico_stati: GraficoStati,
  grafico_tempi: GraficoTempi,
  // Gestita a parte in HomeDashboard: riceve anche la configurazione.
  ticket_custom: () => <></>,
};

/** Contatore mostrato nell'intestazione della card. */
export function getWidgetCount(
  id: HomeWidgetId,
  data: HomeData
): number | null {
  const now = new Date();

  switch (id) {
    case "attivita_assegnate":
      return data.tickets.filter(
        (ticket) =>
          isTicketAperto(ticket) &&
          data.userId &&
          String(ticket.assignee ?? "") === data.userId
      ).length;

    case "ticket_urgenti":
      return data.tickets.filter(isTicketUrgente).length;

    case "sla_in_scadenza":
      return data.tickets.filter((ticket) => {
        const sla = getSlaInfo(ticket, now);
        return sla.scaduto || sla.inScadenza;
      }).length;

    case "attivita_ferme":
      return data.tickets.filter((ticket) => isTicketFermo(ticket, now)).length;

    case "bloccati_business":
      return data.tickets.filter(isBloccatoDaBusiness).length;

    case "ultimo_ping":
      return data.tickets.filter((ticket) => isPingScaduto(ticket, now)).length;

    case "notifiche_importanti":
      return data.tickets.filter(
        (ticket) => getMotiviNotifica(ticket).length > 0
      ).length;

    case "prossime_scadenze":
      return getProssimeScadenze(data.tickets, 14, now).length;

    default:
      return null;
  }
}

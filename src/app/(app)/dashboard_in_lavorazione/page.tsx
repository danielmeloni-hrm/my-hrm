"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import {
  AppWindow,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  Repeat2,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

type Profile = {
  id: string;
  nome_completo: string | null;
};

type Ticket = {
  id: string;
  titolo?: string | null;
  applicativo?: string[] | null;
  sprint?: string | null;
  assignee?: string | null;
  numero_priorita?: number | null;
  in_lavorazione_ora?: boolean | null;
  stato?: string | null;
  note_importanti?: string | null;
  percentuale_avanzamento?: number | null;
  n_tag?: string | null;
  ricorsivo?: boolean | null;
  clienti?: { nome?: string | null } | null;
  profili?: { nome_completo?: string | null } | null;
  [key: string]: any;
};

type AssigneeKey = string;
type SectionKey = "work" | "sprint" | "recurring";

const UNASSIGNED_KEY = "unassigned";
const RECURRING_POOL_ID = "recurring-pool";

const WORK_ID = (assigneeKey: string) => `work:${assigneeKey}`;
const SPRINT_ID = (assigneeKey: string) => `sprint:${assigneeKey}`;

const parseDroppable = (droppableId: string) => {
  if (droppableId === RECURRING_POOL_ID) {
    return { section: "recurring" as const, key: UNASSIGNED_KEY };
  }

  const [section, key] = droppableId.split(":");
  return { section: section as "work" | "sprint", key: key || UNASSIGNED_KEY };
};

const BRAND = "#0150a0";
const BRAND_BG = "#eaf2fb";
const BRAND_SOFT_TEXT = "#0150a0CC";
const BRAND_BORDER = "#0150a033";
const BRAND_RING = "rgba(1,80,160,0.18)";

export default function TicketsDashboardByAssignee() {
  const supabase = useMemo(() => createClient(), []);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [collapsedSprint, setCollapsedSprint] = useState<Record<string, boolean>>({});
  const [showRecurringSection, setShowRecurringSection] = useState(false);

  const [filterSprint, setFilterSprint] = useState<"Sprint" | "Opex">("Sprint");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCliente, setFilterCliente] = useState<string>("");
  const [filterStato, setFilterStato] = useState<string>("");

  const toggleSprintSection = (key: string) => {
    setCollapsedSprint((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const CLIENT_OPTIONS = useMemo(() => {
    const nomi = tickets
      .map((t) => t.clienti?.nome)
      .filter((nome): nome is string => !!nome);

    return Array.from(new Set(nomi)).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  const refreshTicketsOnly = useCallback(async () => {
    const { data, error } = await supabase
      .from("ticket")
      .select(
        `
          id,
          titolo,
          stato,
          applicativo,
          sprint,
          assignee,
          n_tag,
          in_lavorazione_ora,
          numero_priorita,
          note_importanti,
          ricorsivo,
          percentuale_avanzamento,
          clienti:cliente_id ( nome ),
          profili:assignee ( nome_completo )
        `
      )
      .eq("sprint", filterSprint)
      .not("stato", "in", '("Completato","Completato - In attesa di chiusura TAG")')
      .order("numero_priorita", { ascending: true });

    if (!error && data) {
      setTickets(data as Ticket[]);
    }
  }, [supabase, filterSprint]);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const { data: pData, error: pErr } = await supabase
      .from("profili")
      .select("id, nome_completo")
      .order("nome_completo", { ascending: true });

    if (!pErr && pData) {
      setProfiles(pData as Profile[]);
    }

    await refreshTicketsOnly();
    setLoading(false);
  }, [supabase, refreshTicketsOnly]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`ticket-live-${filterSprint}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket",
        },
        async () => {
          await refreshTicketsOnly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, filterSprint, refreshTicketsOnly]);

  const filteredTickets = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return tickets.filter((t) => {
      const clienteNome = t.clienti?.nome || "";
      const titolo = (t.titolo || "").toLowerCase();
      const appArray = Array.isArray(t.applicativo) ? t.applicativo : [];
      const appString = appArray.join(", ").toLowerCase();

      const matchesSearch =
        s === "" ||
        titolo.includes(s) ||
        clienteNome.toLowerCase().includes(s) ||
        appString.includes(s) ||
        (t.n_tag || "").toLowerCase().includes(s);

      const matchesCliente = filterCliente === "" || clienteNome === filterCliente;
      const matchesStato = filterStato === "" || String(t.stato || "") === filterStato;

      return matchesSearch && matchesCliente && matchesStato;
    });
  }, [tickets, searchTerm, filterCliente, filterStato]);

  const recurringUnassignedTickets = useMemo(() => {
    return filteredTickets
      .filter((t) => t.ricorsivo && !t.assignee)
      .slice()
      .sort((a, b) => (a.numero_priorita ?? 0) - (b.numero_priorita ?? 0));
  }, [filteredTickets]);

  const assigneeColumns = useMemo(() => {
    const byAssignee = new Map<AssigneeKey, Ticket[]>();

    for (const t of filteredTickets.filter((x) => !(x.ricorsivo && !x.assignee))) {
      const k: AssigneeKey = t.assignee ? String(t.assignee) : UNASSIGNED_KEY;
      if (!byAssignee.has(k)) byAssignee.set(k, []);
      byAssignee.get(k)!.push(t);
    }

    const cols = profiles.map((p) => ({
      key: p.id as AssigneeKey,
      name: (p.nome_completo || "Senza Nome").trim(),
      items: byAssignee.get(p.id) || [],
    }));

    const unassignedItems = byAssignee.get(UNASSIGNED_KEY) || [];
    if (unassignedItems.length > 0) {
      cols.unshift({
        key: UNASSIGNED_KEY,
        name: "Senza Assegnatario",
        items: unassignedItems,
      });
    }

    const first = cols[0]?.key === UNASSIGNED_KEY ? cols[0] : null;
    const rest = (first ? cols.slice(1) : cols)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    return first ? [first, ...rest] : rest;
  }, [profiles, filteredTickets]);

  const getSortedList = (assigneeKey: AssigneeKey, section: "work" | "sprint") => {
    const assigneeId = assigneeKey === UNASSIGNED_KEY ? null : assigneeKey;

    const base = filteredTickets.filter((t) => {
      const sameAssignee = assigneeId ? t.assignee === assigneeId : !t.assignee;
      if (t.ricorsivo && !t.assignee) return false;
      return sameAssignee;
    });

    const isWorking = (t: Ticket) => Boolean(t.in_lavorazione_ora);
    const list = section === "work" ? base.filter(isWorking) : base.filter((t) => !isWorking(t));

    return list.slice().sort((a, b) => (a.numero_priorita ?? 0) - (b.numero_priorita ?? 0));
  };

  const renumber = (list: Ticket[], step = 10) =>
    list.map((t, idx) => ({
      ...t,
      numero_priorita: (idx + 1) * step,
    }));

  const ticketBelongsTo = (
    ticket: Ticket,
    assigneeKey: AssigneeKey,
    section: SectionKey
  ) => {
    const assigneeId = assigneeKey === UNASSIGNED_KEY ? null : assigneeKey;
    const sameAssignee = assigneeId ? ticket.assignee === assigneeId : !ticket.assignee;
    const isWorking = Boolean(ticket.in_lavorazione_ora);

    if (section === "recurring") {
      return sameAssignee && !!ticket.ricorsivo;
    }

    if (section === "work") {
      return sameAssignee && isWorking && !ticket.ricorsivo;
    }

    return sameAssignee && !isWorking && !ticket.ricorsivo;
  };

  const getKeyedList = (
    all: Ticket[],
    assigneeKey: AssigneeKey,
    section: SectionKey
  ) => {
    return all
      .filter((t) => ticketBelongsTo(t, assigneeKey, section))
      .slice()
      .sort((a, b) => (a.numero_priorita ?? 0) - (b.numero_priorita ?? 0));
  };

  const replaceList = (
    all: Ticket[],
    assigneeKey: AssigneeKey,
    section: SectionKey,
    newList: Ticket[]
  ) => {
    const replacementMap = new Map(newList.map((t) => [t.id, t]));
    const newIds = new Set(newList.map((t) => t.id));

    return all.map((t) => {
      if (!ticketBelongsTo(t, assigneeKey, section)) return t;
      return replacementMap.get(t.id) ?? (newIds.has(t.id) ? t : t);
    });
  };

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    const samePlace =
      destination.droppableId === source.droppableId &&
      destination.index === source.index;

    if (samePlace) return;

    const src = parseDroppable(source.droppableId);
    const dst = parseDroppable(destination.droppableId);

    const moved = tickets.find((t) => t.id === draggableId);
    if (!moved) return;

    const dstAssigneeId = dst.key === UNASSIGNED_KEY ? null : dst.key;
    const dstInWork = dst.section === "work";

    const srcList = getKeyedList(tickets, src.key, src.section);
    const dstList = getKeyedList(tickets, dst.key, dst.section);

    const srcWithout = srcList.filter((t) => t.id !== draggableId);

    const movedUpdated: Ticket = {
      ...moved,
      assignee: dst.section === "recurring" ? null : dstAssigneeId,
      in_lavorazione_ora: dst.section === "recurring" ? false : dstInWork,
      sprint: filterSprint,
      ricorsivo: dst.section === "recurring" ? true : !!moved.ricorsivo,
    };

    const dstWithout = dstList.filter((t) => t.id !== draggableId);
    const nextDst = [...dstWithout];
    nextDst.splice(destination.index, 0, movedUpdated);

    const renumberedDst = renumber(nextDst, 10);
    const renumberedSrc =
      src.key === dst.key && src.section === dst.section ? [] : renumber(srcWithout, 10);

    const srcIds = new Set(srcList.map((t) => t.id));
    const dstIds = new Set(dstList.map((t) => t.id));
    const replacementMap = new Map<string, Ticket>();

    if (src.key === dst.key && src.section === dst.section) {
      renumberedDst.forEach((t) => replacementMap.set(t.id, t));
    } else {
      renumberedSrc.forEach((t) => replacementMap.set(t.id, t));
      renumberedDst.forEach((t) => replacementMap.set(t.id, t));
    }

    const nextAll = tickets.map((ticket) => {
      if (ticket.id === moved.id) {
        const replacedMoved = replacementMap.get(ticket.id);
        return replacedMoved ?? movedUpdated;
      }

      if (replacementMap.has(ticket.id)) {
        return replacementMap.get(ticket.id)!;
      }

      return ticket;
    });

    setTickets(nextAll);

    const ticketsToUpdate =
      src.key === dst.key && src.section === dst.section
        ? renumberedDst
        : [...renumberedSrc, ...renumberedDst];

    try {
      const updates = ticketsToUpdate.map((t) =>
        supabase
          .from("ticket")
          .update({
            assignee: t.assignee ?? null,
            in_lavorazione_ora: t.in_lavorazione_ora ?? false,
            sprint: t.sprint ?? null,
            ricorsivo: t.ricorsivo ?? false,
            numero_priorita: t.numero_priorita ?? null,
          })
          .eq("id", t.id)
      );

      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);

      if (failed?.error) {
        console.error("Errore durante l'update:", failed.error);
        refreshTicketsOnly();
      }
    } catch (err) {
      console.error("Errore inatteso durante l'update:", err);
      refreshTicketsOnly();
    }
  };
  const hasRecurring = recurringUnassignedTickets.length > 0
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
        <div className="max-w-[2200px] mx-auto">
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm font-bold text-slate-400">Caricamento dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
      <div className="max-w-[2200px] mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h1
              className="text-4xl font-black tracking-tighter flex items-center gap-3"
              style={{ color: BRAND }}
            >
              ATTIVITÀ IN CORSO
            </h1>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: BRAND_SOFT_TEXT }}
            >
              Tutti i ticket con sprint = &quot;{filterSprint}&quot; — drag: work TRUE / sprint FALSE
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="flex bg-white border border-gray-100 rounded-l p-1 shadow-sm">
              {(["Sprint", "Opex"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterSprint(type)}
                  className={`px-6 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    filterSprint === type ? "text-white" : "text-gray-400 hover:text-black"
                  }`}
                  style={filterSprint === type ? { background: BRAND } : {}}
                >
                  {type}
                </button>
              ))}
            </div>

            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca cliente / titolo / app..."
              className="px-4 py-2 rounded-l bg-white border border-gray-100 text-[12px] font-bold outline-none w-72"
              style={{
                boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
              }}
            />

            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="px-4 py-2 rounded-l bg-white border border-gray-100 text-[12px] font-bold outline-none min-w-[160px]"
            >
              <option value="">Tutti i Clienti</option>
              {CLIENT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="mb-8">
            <div
              className="flex items-center justify-between px-5 py-1 rounded-[10px] shadow-sm mb-3 cursor-pointer transition-all"
              style={{
                background: hasRecurring ? "#fef9c3" : "#ecfdf5", // giallo / verde
                color: hasRecurring ? "#ca8a04" : "#059669",       // giallo scuro / verde scuro
                border: hasRecurring
                  ? "1px solid rgba(202,138,4,0.25)"
                  : "1px solid rgba(5,150,105,0.25)",
              }}
              onClick={() => setShowRecurringSection((prev) => !prev)}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-[10px] font-black uppercase shadow-sm border border-white/60"
                  aria-label={
                    showRecurringSection
                      ? "Chiudi attività ricorsive"
                      : "Apri attività ricorsive"
                  }
                >
                  {showRecurringSection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  
                </button>

                <div className="flex items-center gap-2">
                  <Repeat2 size={15} className={hasRecurring ? "text-yellow-600" : "text-green-600"} />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em]">
                      Attività Ricorsive
                    </div>
                    <div className="text-[12px] font-bold opacity-70">
                      Ticket ricorsivi senza assegnatario
                    </div>
                  </div>
                </div>
              </div>

              <span className="text-xs font-black bg-white/70 px-3 py-1 rounded-lg">
                {recurringUnassignedTickets.length}
              </span>
            </div>

            {showRecurringSection && (
              <Droppable droppableId={RECURRING_POOL_ID} direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="rounded-[18px] border border-dashed p-4 min-h-[170px] flex gap-4 overflow-x-auto bg-white/70 transition-all"
                    style={{
                      borderColor: snapshot.isDraggingOver ? BRAND_BORDER : "#e5e7eb",
                      background: snapshot.isDraggingOver
                        ? BRAND_BG
                        : "rgba(255,255,255,0.72)",
                      boxShadow: snapshot.isDraggingOver
                        ? `0 0 0 4px ${BRAND_RING}`
                        : undefined,
                    }}
                  >
                    {recurringUnassignedTickets.map((t, index) => (
                      <Draggable key={t.id} draggableId={t.id} index={index}>
                        {(p, s) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            className="w-[340px] flex-shrink-0"
                          >
                            <TicketCard ticket={t} isDragging={s.isDragging} />
                          </div>
                        )}
                      </Draggable>
                    ))}

                    {provided.placeholder}

                    {recurringUnassignedTickets.length === 0 && (
                      <div className="flex items-center justify-center w-full text-sm font-bold text-slate-400">
                        Nessuna attività ricorsiva senza assegnatario
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            )}
          </div>

          <div className="flex gap-4 overflow-x-auto pb-10 scrollbar-hide items-start">
            {assigneeColumns.map((col) => {
              const workTickets = getSortedList(col.key, "work");
              const sprintTickets = getSortedList(col.key, "sprint");

              return (
                <div
                  key={col.key}
                  className="flex-shrink-0 w-96 bg-[#0150a0]/30 p-3 rounded-[10px] border border-gray-200 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between px-5 py-4 rounded-l bg-white shadow-sm border border-gray-100">
                    <div className="min-w-0">
                      <div className="text-[16px] font-black text-black truncate">{col.name}</div>
                    </div>
                    <span className="text-xs font-black bg-gray-50 px-2 py-0.5 rounded-l text-gray-500">
                      {workTickets.length + sprintTickets.length}
                    </span>
                  </div>

                  <div className="flex flex-col flex-1">
                    <div
                      className="flex items-center justify-between px-5 py-4 rounded-l shadow-sm mb-4"
                      style={{ background: BRAND_BG, color: BRAND }}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        In lavorazione ora
                      </span>
                      <span className="text-xs font-black bg-white/50 px-2 py-0.5 rounded-l">
                        {workTickets.length}
                      </span>
                    </div>

                    <Droppable droppableId={WORK_ID(col.key)}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-4 rounded-[1rem] border border-dashed p-3 transition-all flex-1 min-h-[150px] bg-white/60"
                          style={{
                            borderColor: snapshot.isDraggingOver ? BRAND_BORDER : "#e5e7eb",
                            background: snapshot.isDraggingOver
                              ? BRAND_BG
                              : "rgba(255,255,255,0.6)",
                            boxShadow: snapshot.isDraggingOver
                              ? `0 0 0 4px ${BRAND_RING}`
                              : undefined,
                          }}
                        >
                          {workTickets.map((t, index) => (
                            <Draggable key={t.id} draggableId={t.id} index={index}>
                              {(p, s) => (
                                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                                  <TicketCard ticket={t} isDragging={s.isDragging} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>

                  <div className="flex flex-col flex-1">
                    <div
                      onClick={() => toggleSprintSection(col.key)}
                      className="flex items-center justify-between px-5 py-4 rounded-l bg-gray-100 text-gray-600 shadow-sm mb-4 cursor-pointer hover:bg-gray-200 transition"
                    >
                      {collapsedSprint[col.key] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}

                      <span className="text-[10px] font-black uppercase tracking-widest text-wrap">
                        In {filterSprint}
                      </span>

                      <span className="text-xs font-black bg-white/60 px-2 py-0.5 rounded-lg">
                        {sprintTickets.length}
                      </span>
                    </div>

                    {collapsedSprint[col.key] && (
                      <Droppable droppableId={SPRINT_ID(col.key)}>
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-4 rounded-[1rem] border border-dashed p-3 transition-all flex-1 min-h-[150px] bg-white/60"
                            style={{
                              borderColor: snapshot.isDraggingOver ? "#d1d5db" : "#e5e7eb",
                              background: snapshot.isDraggingOver
                                ? "rgba(243,244,246,0.75)"
                                : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {sprintTickets.map((t, index) => (
                              <Draggable key={t.id} draggableId={t.id} index={index}>
                                {(p, s) => (
                                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                                    <TicketCard ticket={t} isDragging={s.isDragging} />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

function TicketCard({ ticket, isDragging }: { ticket: Ticket; isDragging?: boolean }) {
  const card = (
    <div
      className={`bg-white p-6 rounded-[10px] border shadow-sm hover:shadow-xl transition-all cursor-pointer ${
        isDragging ? "pointer-events-none" : ""
      }`}
      style={{ borderColor: BRAND_BORDER }}
    >
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <span
          className="text-[9px] font-black px-3 py-1 rounded-full uppercase"
          style={{ color: BRAND, background: BRAND_BG }}
        >
          {ticket.clienti?.nome || "N/D"}
        </span>

        {ticket.ricorsivo && (
          <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase bg-violet-50 text-violet-600">
            Ricorsivo
          </span>
        )}

        <div className="ml-auto flex gap-1.5 items-center">
          {ticket.percentuale_avanzamento !== undefined &&
            ticket.percentuale_avanzamento !== null && (
              <span
                className="flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[9px] font-black text-white bg-emerald-500 rounded-full shadow-sm"
                title="Avanzamento"
              >
                {ticket.percentuale_avanzamento}%
              </span>
            )}

          {ticket.numero_priorita !== undefined && ticket.numero_priorita !== null && (
            <span
              className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm"
              title="Priorità"
            >
              {ticket.numero_priorita}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        {ticket.applicativo &&
        Array.isArray(ticket.applicativo) &&
        ticket.applicativo.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {ticket.applicativo.map((app, idx) => (
              <span
                key={idx}
                className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md flex items-center gap-1"
              >
                <AppWindow size={10} />
                {app}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <h3 className="text-[15px] font-bold text-gray-800 leading-tight">
        {ticket.titolo || "—"}
      </h3>

      <h4 className="text-[11px] font-bold text-gray-800 leading-tight">
        {ticket.n_tag || "—"}
      </h4>

      <div className="flex items-center gap-1 mt-1 text-gray-400">
        <TriangleAlert size={10} className="text-yellow-500 stroke-[2.5]" />
        <p className="text-[11px] font-bold uppercase outline-none border-none bg-transparent w-full">
          {ticket.note_importanti || ""}
        </p>
      </div>
    </div>
  );

  if (isDragging) return card;

  return (
    <Link href={`/ticket/${ticket.id}`} className="block">
      {card}
    </Link>
  );
}
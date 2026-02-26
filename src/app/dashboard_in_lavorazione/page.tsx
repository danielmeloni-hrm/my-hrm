'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { AppWindow, User, Users, ChevronRight } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

type Profile = {
  id: string;
  nome_completo: string | null;
};

type Ticket = {
  id: string;
  titolo?: string | null;
  applicativo?: string | null;
  sprint?: string | null;
  assignee?: string | null;
  numero_priorita?: number | null;
  in_lavorazione_ora?: boolean | null;
  clienti?: { nome?: string | null } | null;
  profili?: { nome_completo?: string | null } | null;
  [key: string]: any;
};

type AssigneeKey = string;
const UNASSIGNED_KEY = 'unassigned';
const SPRINT_VALUE = 'Sprint';

const WORK_ID = (assigneeKey: string) => `work:${assigneeKey}`;
const SPRINT_ID = (assigneeKey: string) => `sprint:${assigneeKey}`;
const parseDroppable = (droppableId: string) => {
  const [section, key] = droppableId.split(':');
  return { section: section as 'work' | 'sprint', key: key || UNASSIGNED_KEY };
};

export default function TicketsDashboardByAssignee() {
  const supabase = useMemo(() => createClient(), []);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMe, setFilterMe] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // ✅ Cambio filtro da App a Cliente
  const [filterCliente, setFilterCliente] = useState<string>('');
  const [filterStato, setFilterStato] = useState<string>('');

  // ✅ Generazione dinamica opzioni clienti dai ticket caricati
  const CLIENT_OPTIONS = useMemo(() => {
    const nomi = tickets
      .map((t) => t.clienti?.nome)
      .filter((nome): nome is string => !!nome);
    return Array.from(new Set(nomi)).sort();
  }, [tickets]);

  const workRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [maxWorkHeight, setMaxWorkHeight] = useState(0);
  const SPRINT_OFFSET_PX = 60;

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const { data: pData, error: pErr } = await supabase
      .from('profili')
      .select('id, nome_completo')
      .order('nome_completo', { ascending: true });

    if (!pErr && pData) setProfiles(pData as Profile[]);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let q = supabase
      .from('ticket')
      .select(
        `
        id, titolo,
        applicativo, sprint, assignee, in_lavorazione_ora, numero_priorita,
        clienti:cliente_id ( nome ),
        profili:assignee ( nome_completo )
      `
      )
      .eq('sprint', SPRINT_VALUE)
      .order('numero_priorita', { ascending: true });

    if (filterMe && user) q = q.eq('assignee', user.id);

    const { data, error } = await q;
    if (!error && data) setTickets(data as Ticket[]);

    setLoading(false);
  }, [supabase, filterMe]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ✅ Filtraggio aggiornato per Cliente
  const filteredTickets = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return tickets.filter((t) => {
      const clienteNome = t.clienti?.nome || '';
      const titolo = (t.titolo || '').toLowerCase();
      const app = (t.applicativo || '').toLowerCase();

      const matchesSearch = s === '' || titolo.includes(s) || clienteNome.toLowerCase().includes(s) || app.includes(s);
      
      // Filtro per Cliente (esatto)
      const matchesCliente = filterCliente === '' || clienteNome === filterCliente;
      const matchesStato = filterStato === '' || String(t.stato || '') === filterStato;

      return matchesSearch && matchesCliente && matchesStato;
    });
  }, [tickets, searchTerm, filterCliente, filterStato]);

  const assigneeColumns = useMemo(() => {
    const byAssignee = new Map<AssigneeKey, Ticket[]>();

    for (const t of filteredTickets) {
      const k: AssigneeKey = t.assignee ? String(t.assignee) : UNASSIGNED_KEY;
      if (!byAssignee.has(k)) byAssignee.set(k, []);
      byAssignee.get(k)!.push(t);
    }

    const cols = profiles.map((p) => ({
      key: p.id as AssigneeKey,
      name: (p.nome_completo || 'Senza Nome').trim(),
      items: byAssignee.get(p.id) || [],
    }));

    const unassignedItems = byAssignee.get(UNASSIGNED_KEY) || [];
    if (unassignedItems.length > 0) {
      cols.unshift({ key: UNASSIGNED_KEY, name: 'Senza Assegnatario', items: unassignedItems });
    }

    const first = cols[0]?.key === UNASSIGNED_KEY ? cols[0] : null;
    const rest = (first ? cols.slice(1) : cols).slice().sort((a, b) => a.name.localeCompare(b.name));
    return first ? [first, ...rest] : rest;
  }, [profiles, filteredTickets]);

  const getSortedList = (assigneeKey: AssigneeKey, section: 'work' | 'sprint') => {
    const assigneeId = assigneeKey === UNASSIGNED_KEY ? null : assigneeKey;
    const base = filteredTickets.filter((t) => (assigneeId ? t.assignee === assigneeId : !t.assignee));

    const isWorking = (t: Ticket) => Boolean(t.in_lavorazione_ora);
    const list = section === 'work' ? base.filter(isWorking) : base.filter((t) => !isWorking(t));

    return list.slice().sort((a, b) => (a.numero_priorita ?? 0) - (b.numero_priorita ?? 0));
  };

  const renumber = (list: Ticket[], step = 10) =>
    list.map((t, idx) => ({ ...t, numero_priorita: (idx + 1) * step }));

  const getKeyedList = (all: Ticket[], assigneeKey: AssigneeKey, section: 'work' | 'sprint') => {
    const assigneeId = assigneeKey === UNASSIGNED_KEY ? null : assigneeKey;
    const base = all.filter((t) => (assigneeId ? t.assignee === assigneeId : !t.assignee));
    const isWorking = (t: Ticket) => Boolean(t.in_lavorazione_ora);
    const list = section === 'work' ? base.filter(isWorking) : base.filter((t) => !isWorking(t));
    return list.slice().sort((a, b) => (a.numero_priorita ?? 0) - (b.numero_priorita ?? 0));
  };

  const replaceList = (all: Ticket[], assigneeKey: AssigneeKey, section: 'work' | 'sprint', newList: Ticket[]) => {
    const assigneeId = assigneeKey === UNASSIGNED_KEY ? null : assigneeKey;
    const isWorking = (t: Ticket) => Boolean(t.in_lavorazione_ora);

    return all.map((t) => {
      const sameAssignee = assigneeId ? t.assignee === assigneeId : !t.assignee;
      const sameSection = section === 'work' ? isWorking(t) : !isWorking(t);
      if (!sameAssignee || !sameSection) return t;

      const found = newList.find((x) => x.id === t.id);
      return found ? found : t;
    });
  };

    useEffect(() => {
    const measure = () => {
        // Usiamo scrollHeight invece di offsetHeight per catturare l'altezza 
        // reale del contenuto anche se il container ha un min-height attivo
        const heights = Object.values(workRefs.current)
        .map((el) => {
            if (!el) return 0;
            // Temporaneamente resettiamo il minHeight per misurare il contenuto naturale
            const originalMinHeight = el.style.minHeight;
            el.style.minHeight = '0';
            const height = el.scrollHeight;
            el.style.minHeight = originalMinHeight;
            return height;
        })
        .filter((h) => h > 0);

        const newMax = heights.length ? Math.max(...heights) : 0;
        
        // Aggiorna lo stato solo se l'altezza è effettivamente cambiata
        // per evitare cicli di render infiniti
        setMaxWorkHeight((prev) => (Math.abs(prev - newMax) > 1 ? newMax : prev));
    };

    // Usiamo un doppio frame per garantire che React abbia completato il ciclo di commit
    const handle = requestAnimationFrame(() => {
        requestAnimationFrame(measure);
    });

    window.addEventListener('resize', measure);
    
    return () => {
        cancelAnimationFrame(handle);
        window.removeEventListener('resize', measure);
    };
    // ✅ Monitoriamo solo filteredTickets: se cerchi, filtri per cliente o sposti un ticket, 
    // filteredTickets cambia e noi ricalcoliamo.
    }, [filteredTickets]);

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const samePlace = destination.droppableId === source.droppableId && destination.index === source.index;
    if (samePlace) return;

    const src = parseDroppable(source.droppableId);
    const dst = parseDroppable(destination.droppableId);

    const moved = tickets.find((t) => t.id === draggableId);
    if (!moved) return;

    const dstAssigneeId = dst.key === UNASSIGNED_KEY ? null : dst.key;
    const dstInWork = dst.section === 'work';
    const movedPing = new Date().toISOString();

    const srcList = getKeyedList(tickets, src.key, src.section);
    const dstList = getKeyedList(tickets, dst.key, dst.section);

    const srcWithout = srcList.filter((t) => t.id !== draggableId);

    const movedUpdated: Ticket = {
      ...moved,
      assignee: dstAssigneeId,
      in_lavorazione_ora: dstInWork,
      ultimo_ping: movedPing,
    };

    const dstWithout = dstList.filter((t) => t.id !== draggableId);
    const nextDst = dstWithout.slice();
    nextDst.splice(destination.index, 0, movedUpdated);

    const renumberedDst = renumber(nextDst, 10);
    const renumberedSrc = src.key === dst.key && src.section === dst.section ? [] : renumber(srcWithout, 10);

    let nextAll = tickets.slice();

    if (src.key === dst.key && src.section === dst.section) {
      nextAll = replaceList(nextAll, dst.key, dst.section, renumberedDst);
    } else {
      nextAll = replaceList(nextAll, src.key, src.section, renumberedSrc);
      nextAll = replaceList(nextAll, dst.key, dst.section, renumberedDst);

      const movedFinal = renumberedDst.find((x) => x.id === draggableId);
      if (movedFinal) nextAll = nextAll.map((t) => (t.id === draggableId ? movedFinal : t));
    }

    // Aggiorno UI subito (optimistic)
    setTickets(nextAll);

    // Snapshot per rollback (IMPORTANT: usa nextAll/tickets attuali)
    const prevAll = tickets;

    const { error } = await supabase
    .from('ticket')
    .update({
        assignee: dstAssigneeId,
        in_lavorazione_ora: dstInWork,
        ultimo_ping: movedPing,
    })
    .eq('id', draggableId);

    if (error) {
    console.error('Update fallito:', error);
    setTickets(prevAll); // rollback SOLO se errore
    return;
    }

  if (loading) {
    return (
      <div className="p-20 text-center font-black animate-pulse text-gray-300 italic uppercase">
        Loading Sprint...
      </div>
    );
  }
 }; 
  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
      <div className="max-w-[2200px] mx-auto">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 text-black ">
              ATTIVITÀ IN CORSO
            </h1>
            <p className="text-[10px] font-bold text-blue-600/50 uppercase tracking-[0.3em]">
              Tutti i ticket con sprint = "{SPRINT_VALUE}" — drag: work TRUE / sprint FALSE
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setFilterMe((v) => !v)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                filterMe ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border-gray-100'
              }`}
            >
              {filterMe ? <User size={14} /> : <Users size={14} />} {filterMe ? 'I Miei' : 'Tutti'}
            </button>

            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca cliente / titolo / app..."
              className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold outline-none w-72"
            />

            {/* ✅ Select Filtro Cliente Aggiornato */}
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold outline-none min-w-[160px]"
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

        {/* BOARD */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-10 scrollbar-hide">
            {assigneeColumns.map((col) => {
              const workTickets = getSortedList(col.key, 'work');
              const sprintTickets = getSortedList(col.key, 'sprint');

              return (
                <div
                  key={col.key}
                  className="flex-shrink-0 w-96 bg-gray-50/50 p-3 rounded-[2.5rem] border border-gray-100 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-white shadow-sm border border-gray-100">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Dipendente
                      </div>
                      <div className="text-[16px] font-black text-black truncate">{col.name}</div>
                    </div>
                    <span className="text-xs font-black bg-gray-50 px-2 py-0.5 rounded-lg text-gray-500">
                      {workTickets.length + sprintTickets.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest">In lavorazione ora</span>
                    <span className="text-xs font-black bg-white/40 px-2 py-0.5 rounded-lg">{workTickets.length}</span>
                  </div>

                  <Droppable droppableId={WORK_ID(col.key)}>
                    {(provided, snapshot) => (
                      <div
                        ref={(el) => {
                          provided.innerRef(el);
                          workRefs.current[col.key] = el;
                        }}
                        {...provided.droppableProps}
                        className={`space-y-4 rounded-[2rem] border border-dashed p-3 transition-all ${
                          snapshot.isDraggingOver ? 'bg-blue-50/60 border-blue-200' : 'bg-white/60 border-gray-200'
                        }`}
                        style={{ minHeight: maxWorkHeight ? maxWorkHeight + SPRINT_OFFSET_PX : undefined }}
                      >
                        {workTickets.map((t, index) => (
                          <Draggable key={t.id} draggableId={t.id} index={index}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                <TicketCard ticket={t} isDragging={snapshot.isDragging} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-gray-100 text-gray-600 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest">In sprint</span>
                    <span className="text-xs font-black bg-white/60 px-2 py-0.5 rounded-lg">{sprintTickets.length}</span>
                  </div>

                  <Droppable droppableId={SPRINT_ID(col.key)}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-4 rounded-[2rem] border border-dashed p-3 transition-all ${
                          snapshot.isDraggingOver ? 'bg-gray-100/70 border-gray-300' : 'bg-white/60 border-gray-200'
                        }`}
                      >
                        {sprintTickets.map((t, index) => (
                          <Draggable key={t.id} draggableId={t.id} index={index}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                <TicketCard ticket={t} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  isDragging,
}: {
  ticket: Ticket;
  isDragging?: boolean;
}) {
  const card = (
    <div
      className={`bg-white p-6 rounded-[2rem] border border-blue-200 shadow-sm hover:shadow-xl transition-all cursor-pointer ${
        isDragging ? 'pointer-events-none' : ''
      }`}
    >
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase italic">
          {ticket.clienti?.nome || 'N/D'}
        </span>

        {ticket.applicativo ? (
          <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md flex items-center gap-1">
            <AppWindow size={10} />
            {ticket.applicativo}
          </span>
        ) : null}
      </div>

      <h3 className="text-[13px] font-bold text-gray-800 leading-tight">
        {ticket.titolo || '—'}
      </h3>
    </div>
  );

  if (isDragging) return card;

  return (
    <Link href={`/ticket/${ticket.id}`} className="block">
      {card}
    </Link>
  );
}
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Activity,
  LayoutDashboard,
  Search,
  Settings2,
  User,
  Users,
  X,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  useDroppable,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import TicketCard, { Ticket } from "@/components/ticket/TicketCard";
import TicketDragPreview from "@/components/ticket/TicketDragPreview";
import TicketDetailModal from "@/components/ticket/TicketDetailModal";

const supabase = createClient();

type BoardColumn = {
  id: string;
  label: string;
  group: string;
  bgColorClass: string;
  textColorClass: string;
};

const allBoardColumns: BoardColumn[] = [
  {
    id: "attivita-sospesa",
    label: "Attività Sospesa",
    group: "To-do",
    bgColorClass: "bg-zinc-100",
    textColorClass: "text-zinc-700",
  },
  {
    id: "non-iniziato",
    label: "Non Iniziato",
    group: "To-do",
    bgColorClass: "bg-zinc-100",
    textColorClass: "text-zinc-700",
  },
  {
    id: "in-stand-by",
    label: "In stand-by",
    group: "To-do",
    bgColorClass: "bg-zinc-100",
    textColorClass: "text-zinc-700",
  },
  {
    id: "in-lavorazione",
    label: "In lavorazione",
    group: "In progress",
    bgColorClass: "bg-blue-100",
    textColorClass: "text-blue-700",
  },
  {
    id: "in-attesa-sviluppo",
    label: "In attesa Sviluppo",
    group: "In progress",
    bgColorClass: "bg-amber-100",
    textColorClass: "text-amber-700",
  },
  {
    id: "in-attesa-risposta-sviluppatore",
    label: "In attesa risposta Sviluppatore",
    group: "In progress",
    bgColorClass: "bg-amber-100",
    textColorClass: "text-amber-700",
  },
  {
    id: "attenzione-business",
    label: "Attenzione Business",
    group: "In progress",
    bgColorClass: "bg-violet-100",
    textColorClass: "text-violet-700",
  },
  {
    id: "attenzione-di-andrea",
    label: "Attenzione di Andrea",
    group: "In progress",
    bgColorClass: "bg-pink-100",
    textColorClass: "text-pink-700",
  },
  {
    id: "completato-in-attesa-di-chiusura",
    label: "Completato - In attesa di chiusura",
    group: "Complete",
    bgColorClass: "bg-emerald-100",
    textColorClass: "text-emerald-700",
  },
  {
    id: "completato",
    label: "Completato",
    group: "Complete",
    bgColorClass: "bg-emerald-100",
    textColorClass: "text-emerald-700",
  },
];

const statusToColumnId: Record<string, string> = {
  "Attività Sospesa": "attivita-sospesa",
  "Non Iniziato": "non-iniziato",
  "In stand-by": "in-stand-by",
  "In lavorazione": "in-lavorazione",
  "In attesa Sviluppo": "in-attesa-sviluppo",
  "In attesa risposta Sviluppatore": "in-attesa-risposta-sviluppatore",
  "Attenzione Business": "attenzione-business",
  "Attenzione di Andrea": "attenzione-di-andrea",
  "Completato - In attesa di chiusura": "completato-in-attesa-di-chiusura",
  Completato: "completato",
};

const columnIdToStatus: Record<string, string> = {
  "attivita-sospesa": "Attività Sospesa",
  "non-iniziato": "Non Iniziato",
  "in-stand-by": "In stand-by",
  "in-lavorazione": "In lavorazione",
  "in-attesa-sviluppo": "In attesa Sviluppo",
  "in-attesa-risposta-sviluppatore": "In attesa risposta Sviluppatore",
  "attenzione-business": "Attenzione Business",
  "attenzione-di-andrea": "Attenzione di Andrea",
  "completato-in-attesa-di-chiusura": "Completato - In attesa di chiusura",
  completato: "Completato",
};

const ui = {
  shell: "min-h-screen bg-[#f6f8fb] px-4 pt-6 pb-24",
  container: "max-w-[2600px] mx-auto",
  panel: "bg-white border border-gray-200 rounded-2xl shadow-sm",
  label: "text-[10px] font-black uppercase tracking-widest text-gray-400",
};

const zoomStyles = {
  1: { colWidth: 280, padding: "p-3", title: "text-sm" },
  2: { colWidth: 320, padding: "p-3", title: "text-[13px]" },
  3: { colWidth: 360, padding: "p-2", title: "text-base" },
  4: { colWidth: 400, padding: "p-[18px]", title: "text-lg" },
  5: { colWidth: 440, padding: "p-5", title: "text-xl" },
} as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getDaysDiff(date?: string | null) {
  if (!date) return 999;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 999;
  return Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateShort(date?: string | null) {
  if (!date) return "Mai";
  const d = new Date(date);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

function visibleColumnsArrayToMap(columnIds?: string[] | null) {
  const defaultMap = allBoardColumns.reduce(
    (acc, col) => {
      acc[col.id] = true;
      return acc;
    },
    {} as Record<string, boolean>
  );

  if (!Array.isArray(columnIds) || columnIds.length === 0) {
    return defaultMap;
  }

  const allFalseMap = allBoardColumns.reduce(
    (acc, col) => {
      acc[col.id] = false;
      return acc;
    },
    {} as Record<string, boolean>
  );

  for (const id of columnIds) {
    if (id in allFalseMap) {
      allFalseMap[id] = true;
    }
  }

  return allFalseMap;
}

function visibleColumnsMapToArray(columns: Record<string, boolean>) {
  return allBoardColumns
    .map((col) => col.id)
    .filter((id) => columns[id] !== false);
}

function DroppableColumn({
  id,
  bgColorClass,
  children,
}: {
  id: string;
  bgColorClass: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        `flex-1 space-y-3 min-h-[620px] p-2.5 rounded-2xl ${bgColorClass} bg-opacity-30 border border-white/50 transition-all duration-200`,
        isOver && "ring-4 ring-[#0150a0]/10 bg-white/50 scale-[1.01]"
      )}
    >
      {children}
    </div>
  );
}

export default function SprintBoardRefactor() {
  const [isMounted, setIsMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCliente, setSelectedCliente] = useState("Tutti");
  const [selectedSprint, setSelectedSprint] = useState<
    "Opex" | "Backlog" | "Tutti"
  >("Opex");
  const [filterOnlyExpired, setFilterOnlyExpired] = useState(false);
  const [filterMe, setFilterMe] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [zoomLevel] = useState<1 | 2 | 3 | 4 | 5>(2);

  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    () =>
      allBoardColumns.reduce((acc, col) => {
        acc[col.id] = true;
        return acc;
      }, {} as Record<string, boolean>)
  );

  const currentStyles = zoomStyles[zoomLevel];

  useEffect(() => {
    setIsMounted(true);

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);

      if (user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profili")
          .select("kanban_columns")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Errore caricamento kanban_columns:", profileError.message);
        } else {
          setVisibleColumns(
            visibleColumnsArrayToMap(profileData?.kanban_columns)
          );
        }
      }

      const { data, error } = await supabase
        .from("ticket")
        .select("*, clienti:cliente_id(id, nome), profili:assignee(id, nome, nome_completo)");

      if (error) {
        console.error("Errore caricamento ticket:", error.message);
        return;
      }

      if (data) {
        setTickets(
          data.map((t: any) => ({
            ...t,
            columnId: statusToColumnId[t.stato] || "non-iniziato",
          }))
        );
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("board-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ticket" },
        (payload) => {
          const updatedPatch: Partial<Ticket> = {
            ...(payload.new as Partial<Ticket>),
            columnId:
              statusToColumnId[(payload.new as any).stato] || "non-iniziato",
          };

          setTickets((current) =>
            current.map((t) =>
              t.id === payload.new.id ? ({ ...t, ...updatedPatch } as Ticket) : t
            )
          );

          setSelectedTicket((current) =>
            current?.id === payload.new.id
              ? ({ ...current, ...updatedPatch } as Ticket)
              : current
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveKanbanColumns = async (nextVisibleColumns: Record<string, boolean>) => {
    setVisibleColumns(nextVisibleColumns);

    if (!currentUserId) return;

    const kanbanColumns = visibleColumnsMapToArray(nextVisibleColumns);

    const { error } = await supabase
      .from("profili")
      .update({ kanban_columns: kanbanColumns })
      .eq("id", currentUserId);

    if (error) {
      console.error("Errore salvataggio kanban_columns:", error.message);
    }
  };

  const handleUpdateTicket = async (id: string, patch: Partial<Ticket>) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

    setSelectedTicket((prev) =>
      prev?.id === id ? ({ ...prev, ...patch } as Ticket) : prev
    );

    const { columnId, ...supabasePatch } = patch;

    if (Object.keys(supabasePatch).length === 0) return;

    const { error } = await supabase
      .from("ticket")
      .update(supabasePatch)
      .eq("id", id);

    if (error) {
      console.error("Errore salvataggio:", error.message);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    setActiveTicket(tickets.find((t) => t.id === activeId) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    const activeId = String(active.id);
    let targetColId = String(over.id);

    const overTicket = tickets.find((t) => t.id === targetColId);
    if (overTicket) targetColId = overTicket.columnId;

    const draggedTicket = tickets.find((t) => t.id === activeId);
    if (!draggedTicket || draggedTicket.columnId === targetColId) return;

    const newStatus = columnIdToStatus[targetColId];
    const updatePayload: Partial<Ticket> = {
      stato: newStatus,
      ultimo_ping: new Date().toISOString(),
      in_lavorazione_ora: targetColId === "in-lavorazione",
      columnId: targetColId,
    };

    await handleUpdateTicket(activeId, updatePayload);
  };

  const clientiList = useMemo(() => {
    return Array.from(
      new Set(tickets.map((t) => t.clienti?.nome).filter(Boolean) as string[])
    ).sort();
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        const search = searchQuery.toLowerCase();

        const matchesSearch =
          !searchQuery ||
          t.titolo.toLowerCase().includes(search) ||
          (t.n_tag || "").toLowerCase().includes(search);

        const matchesCliente =
          selectedCliente === "Tutti" || t.clienti?.nome === selectedCliente;

        const matchesSprint =
          selectedSprint === "Tutti" || t.sprint === selectedSprint;

        const matchesExpired =
          !filterOnlyExpired || getDaysDiff(t.ultimo_ping) >= 5;

        const matchesMe = !filterMe || t.assignee === currentUserId;

        return (
          matchesSearch &&
          matchesCliente &&
          matchesSprint &&
          matchesExpired &&
          matchesMe
        );
      })
      .sort((a, b) => {
        if (a.in_lavorazione_ora && !b.in_lavorazione_ora) return -1;
        if (!a.in_lavorazione_ora && b.in_lavorazione_ora) return 1;

        const tagA = a.n_tag || "";
        const tagB = b.n_tag || "";

        return tagB.localeCompare(tagA, undefined, { numeric: true });
      });
  }, [
    tickets,
    searchQuery,
    selectedCliente,
    selectedSprint,
    filterOnlyExpired,
    filterMe,
    currentUserId,
  ]);

  if (!isMounted) {
    return (
      <div className="p-10 text-center font-black uppercase text-gray-300">
        Caricamento Board...
      </div>
    );
  }

  return (
    <div className={ui.shell}>
      <div className={ui.container}>
        <div className="mb-8 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
                <LayoutDashboard size={22} className="text-[#0150a0]" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tighter text-gray-900 uppercase">
                  Opex Board
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#0150a0]">
                  Aggiornamento Realtime Attivo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterOnlyExpired(!filterOnlyExpired)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${
                  filterOnlyExpired
                    ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-200"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                <Activity size={12} className={filterOnlyExpired ? "animate-pulse" : ""} />
                Da pingare
              </button>

              <button
                onClick={() => setFilterMe(!filterMe)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${
                  filterMe
                    ? "bg-[#0150a0] text-white border-[#0150a0] shadow-lg shadow-blue-200"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {filterMe ? <User size={12} /> : <Users size={12} />}
                {filterMe ? "Miei Task" : "Tutti i Task"}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-3.5 bg-white text-gray-500 rounded-xl border border-gray-200 hover:border-gray-400 shadow-sm transition-all"
              >
                <Settings2 size={18} />
              </button>
            </div>
          </div>

          <div className={`${ui.panel} p-4`}>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Cerca titolo, TAG o cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-[#0150a0]/30 focus:bg-white transition-all"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedCliente}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  className="px-6 py-3.5 bg-gray-50 rounded-xl text-[11px] font-black uppercase border border-transparent focus:border-gray-200 outline-none appearance-none cursor-pointer"
                >
                  <option value="Tutti">Tutti i Clienti</option>
                  {clientiList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {(["Opex", "Backlog", "Tutti"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSprint(s)}
                      className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        selectedSprint === s
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 overflow-x-auto pb-10 custom-scrollbar">
            {allBoardColumns.map((col) => {
              if (visibleColumns[col.id] === false) return null;

              const columnTickets = filteredTickets.filter((t) => t.columnId === col.id);

              return (
                <div
                  key={col.id}
                  style={{ width: `${currentStyles.colWidth}px` }}
                  className="flex-shrink-0 flex flex-col gap-4"
                >
                  <div className="px-1">
                    <div
                      className={`flex items-center justify-between px-5 py-4 rounded-2xl ${col.bgColorClass} border border-white shadow-sm`}
                    >
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase opacity-50 tracking-tighter">
                          {col.group}
                        </span>
                        <span
                          className={`text-[11px] font-black uppercase tracking-widest ${col.textColorClass}`}
                        >
                          {col.label}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg bg-white/90 shadow-sm ${col.textColorClass}`}
                      >
                        {columnTickets.length}
                      </span>
                    </div>
                  </div>

                  <DroppableColumn id={col.id} bgColorClass={col.bgColorClass}>
                    <SortableContext
                      items={columnTickets.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {columnTickets.map((t) => (
                          <TicketCard
                            key={t.id}
                            ticket={t}
                            currentStyles={currentStyles}
                            setSelectedTicket={setSelectedTicket}
                            handleUpdateTicket={handleUpdateTicket}
                            setTickets={setTickets}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DroppableColumn>
                </div>
              );
            })}
          </div>

          <DragOverlay adjustScale={true}>
            {activeTicket && (
              <div className="rotate-2 scale-[1.05] shadow-2xl">
                <TicketDragPreview ticket={activeTicket} currentStyles={currentStyles} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <TicketDetailModal
        selectedTicket={selectedTicket}
        setSelectedTicket={setSelectedTicket}
        handleUpdateTicket={handleUpdateTicket}
        formatDateShort={formatDateShort}
        ui={ui}
        cn={cn}
        handleToggleInLavorazione={(ticket) =>
          handleUpdateTicket(ticket.id, {
            in_lavorazione_ora: !ticket.in_lavorazione_ora,
          })
        }
        addLogNoteToDb={async (id, logs) => {
          await supabase.from("ticket").update({ storia_ticket: logs }).eq("id", id);
        }}
      />

      {showSettings && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/20 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-sm bg-white h-full shadow-2xl p-6 animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter">
                  Impostazioni Board
                </h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Personalizza la tua vista
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-150px)] pr-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                Visibilità Colonne
              </p>

              {allBoardColumns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    const nextVisibleColumns = {
                      ...visibleColumns,
                      [col.id]: !visibleColumns[col.id],
                    };

                    saveKanbanColumns(nextVisibleColumns);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-3 h-3 rounded-full ${col.bgColorClass} border border-black/5`}
                    />
                    <span className="text-[11px] font-bold text-gray-700 uppercase">
                      {col.label}
                    </span>
                  </div>

                  <div
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      visibleColumns[col.id] !== false ? "bg-[#0150a0]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${
                        visibleColumns[col.id] !== false ? "left-6" : "left-1"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
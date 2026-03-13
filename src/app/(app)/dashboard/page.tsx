"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Activity,
  ChevronRight,
  Circle,
  Filter,
  LayoutDashboard,
  PlayCircle,
  Search,
  Settings2,
  TriangleAlert,
  User,
  Users,
  X,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  useDroppable,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const supabase = createClient();

type Cliente = {
  nome: string;
  id: string;
};

type Profilo = {
  id: string;
  nome?: string;
  nome_completo?: string;
  avatar_url?: string;
};

type Ticket = {
  id: string;
  titolo: string;
  n_tag?: string;
  note_importanti?: string;
  applicativo?: string | string[];
  percentuale_avanzamento?: number;
  ultimo_ping?: string | null;
  in_lavorazione_ora?: boolean;
  stato?: string;
  sprint?: "Sprint" | "Backlog" | "Tutti";
  assignee?: string;
  profili?: Profilo | null;
  clienti?: Cliente | null;
  columnId: string;
  descrizione?: string;
  board_status?: string;
};

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
  3: { colWidth: 360, padding: "p-4", title: "text-base" },
  4: { colWidth: 400, padding: "p-[18px]", title: "text-lg" },
  5: { colWidth: 440, padding: "p-5", title: "text-xl" },
} as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateShort(date?: string | null) {
  if (!date) return "Mai";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getDaysDiff(date?: string | null) {
  if (!date) return 999;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 999;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getPingStyles(date?: string | null) {
  const diff = getDaysDiff(date);
  if (diff >= 10) {
    return {
      icon: "text-red-500 animate-pulse",
      container: "text-red-600",
    };
  }
  if (diff >= 5) {
    return {
      icon: "text-amber-500",
      container: "text-amber-600",
    };
  }
  return {
    icon: "text-emerald-500",
    container: "text-emerald-600",
  };
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
        `flex-1 space-y-3 min-h-[620px] p-2.5 rounded-2xl ${bgColorClass} bg-opacity-30 border border-white/50 transition-all`,
        isOver && "ring-2 ring-[#0150a0]/20 bg-white/40"
      )}
    >
      {children}
    </div>
  );
}

function SortableTicketCard({
  ticket,
  currentStyles,
  setSelectedTicket,
  handleUpdateTicket,
  setTickets,
}: {
  ticket: Ticket;
  currentStyles: { padding: string; title: string };
  setSelectedTicket: React.Dispatch<React.SetStateAction<Ticket | null>>;
  handleUpdateTicket: (id: string, patch: Partial<Ticket>) => void;
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: { type: "ticket", ticket },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const pingStyles = getPingStyles(ticket.ultimo_ping);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setSelectedTicket({ ...ticket })}
      className={`bg-white ${currentStyles.padding} rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer`}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 z-10 cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-gray-100 touch-none"
        title="Trascina ticket"
      >
        <div className="flex flex-col gap-[2px]">
          <span className="block w-4 h-[2px] bg-gray-300 rounded" />
          <span className="block w-4 h-[2px] bg-gray-300 rounded" />
          <span className="block w-4 h-[2px] bg-gray-300 rounded" />
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleUpdateTicket(ticket.id, {
            in_lavorazione_ora: !ticket.in_lavorazione_ora,
          });
        }}
        className="absolute top-3 right-3 z-10"
      >
        {ticket.in_lavorazione_ora ? (
          <PlayCircle size={18} className="text-red-500 animate-pulse" />
        ) : (
          <Circle size={18} className="text-gray-200 hover:text-red-300" />
        )}
      </button>

      <div className="pr-7 pl-7 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-black text-[#0150a0] bg-[#e6eef8] px-2 py-1 rounded-lg uppercase tracking-widest truncate max-w-[120px]">
            {ticket.clienti?.nome || "N/D"}
          </span>

          <input
            onClick={(e) => e.stopPropagation()}
            className="text-[9px] font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg uppercase outline-none border border-transparent focus:border-gray-200 w-20 text-center"
            value={
              Array.isArray(ticket.applicativo)
                ? ticket.applicativo.join(", ")
                : ticket.applicativo || ""
            }
            placeholder="APP"
            onBlur={(e) =>
              handleUpdateTicket(ticket.id, { applicativo: e.target.value })
            }
            onChange={(e) =>
              setTickets((prev) =>
                prev.map((t) =>
                  t.id === ticket.id
                    ? { ...t, applicativo: e.target.value }
                    : t
                )
              )
            }
          />

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              min="0"
              max="100"
              value={ticket.percentuale_avanzamento || 0}
              onChange={(e) =>
                handleUpdateTicket(ticket.id, {
                  percentuale_avanzamento: Math.min(
                    100,
                    Math.max(0, parseInt(e.target.value) || 0)
                  ),
                })
              }
              className={`w-12 h-7 text-[10px] font-black text-center rounded-lg border outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                (ticket.percentuale_avanzamento || 0) > 0
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-gray-200 bg-gray-50 text-gray-400"
              }`}
            />
            {(ticket.percentuale_avanzamento || 0) > 0 && (
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-white/80 pointer-events-none">
                %
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <textarea
            rows={2}
            onClick={(e) => e.stopPropagation()}
            className={`${currentStyles.title} w-full font-black text-gray-900 leading-tight outline-none border-none resize-none bg-transparent focus:text-[#0150a0]`}
            value={ticket.titolo}
            onBlur={(e) =>
              handleUpdateTicket(ticket.id, { titolo: e.target.value })
            }
            onChange={(e) =>
              setTickets((prev) =>
                prev.map((t) =>
                  t.id === ticket.id ? { ...t, titolo: e.target.value } : t
                )
              )
            }
          />

          <textarea
            rows={1}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-bold uppercase outline-none border-none bg-transparent w-full text-gray-500"
            value={ticket.n_tag || ""}
            placeholder="TAG"
            onBlur={(e) =>
              handleUpdateTicket(ticket.id, { n_tag: e.target.value })
            }
            onChange={(e) =>
              setTickets((prev) =>
                prev.map((t) =>
                  t.id === ticket.id ? { ...t, n_tag: e.target.value } : t
                )
              )
            }
          />

          <div className="flex items-start gap-1.5 text-gray-500">
            <TriangleAlert size={10} className="text-amber-500 mt-[2px] shrink-0" />
            <input
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] font-bold uppercase outline-none border-none bg-transparent w-full text-gray-600"
              value={ticket.note_importanti || ""}
              placeholder="Note importanti"
              onBlur={(e) =>
                handleUpdateTicket(ticket.id, {
                  note_importanti: e.target.value,
                })
              }
              onChange={(e) =>
                setTickets((prev) =>
                  prev.map((t) =>
                    t.id === ticket.id
                      ? { ...t, note_importanti: e.target.value }
                      : t
                  )
                )
              }
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity size={10} className={pingStyles.icon} />
            <span
              className={`text-[10px] font-black uppercase truncate ${pingStyles.container}`}
            >
              {formatDateShort(ticket.ultimo_ping)}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTicket({ ...ticket });
            }}
            className="p-1.5 bg-gray-900 text-white rounded-lg hover:bg-[#0150a0] transition-all"
          >
            <ChevronRight size={10} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${ticket.percentuale_avanzamento || 0}%` }}
        />
      </div>
    </div>
  );
}

function TicketDragPreview({
  ticket,
  currentStyles,
}: {
  ticket: Ticket;
  currentStyles: { padding: string; title: string };
}) {
  const pingStyles = getPingStyles(ticket.ultimo_ping);

  return (
    <div
      className={`bg-white ${currentStyles.padding} rounded-2xl border border-gray-200 shadow-2xl relative overflow-hidden w-[320px] cursor-grabbing`}
    >
      <div className="pr-7 pl-7 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-black text-[#0150a0] bg-[#e6eef8] px-2 py-1 rounded-lg uppercase tracking-widest truncate max-w-[120px]">
            {ticket.clienti?.nome || "N/D"}
          </span>

          <span className="text-[9px] font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg uppercase">
            {Array.isArray(ticket.applicativo)
              ? ticket.applicativo.join(", ")
              : ticket.applicativo || "APP"}
          </span>

          <div
            className={`w-12 h-7 text-[10px] font-black text-center rounded-lg border flex items-center justify-center ${
              (ticket.percentuale_avanzamento || 0) > 0
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            {ticket.percentuale_avanzamento || 0}%
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={`${currentStyles.title} w-full font-black text-gray-900 leading-tight`}>
            {ticket.titolo}
          </p>

          <p className="text-[10px] font-bold uppercase text-gray-500">
            {ticket.n_tag || "TAG"}
          </p>

          <div className="flex items-start gap-1.5 text-gray-500">
            <TriangleAlert size={10} className="text-amber-500 mt-[2px] shrink-0" />
            <p className="text-[10px] font-bold uppercase text-gray-600">
              {ticket.note_importanti || "Note importanti"}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity size={10} className={pingStyles.icon} />
            <span className={`text-[10px] font-black uppercase truncate ${pingStyles.container}`}>
              {formatDateShort(ticket.ultimo_ping)}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${ticket.percentuale_avanzamento || 0}%` }}
        />
      </div>
    </div>
  );
}

function SprintBoardRefactor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCliente, setSelectedCliente] = useState("Tutti");
  const [selectedSprint, setSelectedSprint] = useState<"Sprint" | "Backlog" | "Tutti">("Sprint");
  const [filterOnlyExpired, setFilterOnlyExpired] = useState(false);
  const [filterMe, setFilterMe] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [zoomLevel] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const currentStyles = zoomStyles[zoomLevel];

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    return Object.keys(columnIdToStatus).reduce(
      (acc, id) => ({
        ...acc,
        [id]: true,
      }),
      {}
    );
  });

  useEffect(() => {
    async function loadTickets() {
      const supabaseClient = createClient();

      const { data, error } = await supabaseClient
        .from("ticket")
        .select("*, clienti:cliente_id(id, nome), profili:assignee(id, nome, nome_completo)");

      if (error) {
        console.error("Errore caricamento tickets:", error);
        return;
      }

      const mappedTickets: Ticket[] = (data || []).map((ticket: any) => ({
        ...ticket,
        columnId:
          ticket.columnId ||
          statusToColumnId[ticket.stato] ||
          statusToColumnId[ticket.board_status] ||
          "non-iniziato",
      }));

      setTickets(mappedTickets);
    }

    loadTickets();
  }, []);

  useEffect(() => {
    async function loadCurrentUser() {
      const supabaseClient = createClient();

      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser();

      if (error) {
        console.error("Errore caricamento utente:", error);
        return;
      }

      setCurrentUserId(user?.id ?? null);
    }

    loadCurrentUser();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const ticket = tickets.find((t) => t.id === activeId) || null;
    setActiveTicket(ticket);
  }

  function handleDragCancel(_event?: DragCancelEvent) {
    setActiveTicket(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveTicket(null);

    if (!over) return;

    const activeTicketId = String(active.id);
    let targetColumnId = String(over.id);

    const overTicket = tickets.find((t) => t.id === targetColumnId);
    if (overTicket) {
      targetColumnId = overTicket.columnId;
    }

    const draggedTicket = tickets.find((t) => t.id === activeTicketId);
    if (!draggedTicket) return;

    if (draggedTicket.columnId === targetColumnId) return;

    const newStatus = columnIdToStatus[targetColumnId];
    if (!newStatus) return;

    const movedPing = new Date().toISOString();
    const isInWork = targetColumnId === "in-lavorazione";

    const previousTickets = [...tickets];

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === activeTicketId
          ? {
              ...ticket,
              columnId: targetColumnId,
              stato: newStatus,
              ultimo_ping: movedPing,
              in_lavorazione_ora: isInWork,
            }
          : ticket
      )
    );

    setSelectedTicket((prev) =>
      prev && prev.id === activeTicketId
        ? {
            ...prev,
            columnId: targetColumnId,
            stato: newStatus,
            ultimo_ping: movedPing,
            in_lavorazione_ora: isInWork,
          }
        : prev
    );

    try {
      const { error } = await supabase
        .from("ticket")
        .update({
          stato: newStatus,
          ultimo_ping: movedPing,
          in_lavorazione_ora: isInWork,
        })
        .eq("id", activeTicketId);

      if (error) throw error;
    } catch (error: any) {
      console.error("Errore drag&drop:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      setTickets(previousTickets);
    }
  }

  const clientiList = useMemo(() => {
    return Array.from(
      new Set(tickets.map((t) => t.clienti?.nome).filter(Boolean) as string[])
    ).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        !searchQuery ||
        ticket.titolo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.n_tag || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCliente =
        selectedCliente === "Tutti" || ticket.clienti?.nome === selectedCliente;

      const matchesSprint =
        selectedSprint === "Tutti" || ticket.sprint === selectedSprint;

      const matchesExpired =
        !filterOnlyExpired || getDaysDiff(ticket.ultimo_ping) >= 5;

      const matchesMe = !filterMe || ticket.assignee === currentUserId;

      return (
        matchesSearch &&
        matchesCliente &&
        matchesSprint &&
        matchesExpired &&
        matchesMe
      );
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

  function handleUpdateTicket(id: string, patch: Partial<Ticket>) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setSelectedTicket((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  return (
    <div className={`${ui.shell} relative`}>
      <div className={ui.container}>
        <div className="mb-8 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-200">
                <LayoutDashboard size={18} className="text-[#0150a0]" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase leading-none">
                  Sprint Board
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0150a0] mt-1">
                  {filterOnlyExpired
                    ? "Focus: da pingare"
                    : filterMe
                    ? "Task assegnati a me"
                    : "Vista completa"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterOnlyExpired(!filterOnlyExpired)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  filterOnlyExpired
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                <Activity size={12} className={filterOnlyExpired ? "animate-pulse" : ""} />
                Da pingare
              </button>

              <button
                onClick={() => setFilterMe(!filterMe)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  filterMe
                    ? "bg-[#0150a0] text-white border-[#0150a0]"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {filterMe ? <User size={12} /> : <Users size={12} />}
                {filterMe ? "Miei" : "Tutti"}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-3 bg-white text-gray-500 rounded-xl border border-gray-200 hover:text-[#0150a0] transition-all shadow-sm"
              >
                <Settings2 size={16} />
              </button>
            </div>
          </div>

          <div className={`${ui.panel} p-3 lg:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Cerca titolo o tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none border border-gray-200 focus:bg-white focus:border-[#0150a0]/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="relative min-w-[200px]">
                <Filter
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                  size={12}
                />
                <select
                  value={selectedCliente}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 bg-gray-50 rounded-xl text-[11px] font-black uppercase outline-none border border-gray-200 appearance-none cursor-pointer"
                >
                  <option value="Tutti">Tutti i Clienti</option>
                  {clientiList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex bg-gray-100 p-1 rounded-xl">
                {(["Sprint", "Backlog", "Tutti"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSprint(s)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-5 overflow-x-auto pb-8">
            {allBoardColumns.map((col) => {
              if (visibleColumns[col.id] === false) return null;

              const columnTickets = filteredTickets.filter((t) => t.columnId === col.id);
              const { bgColorClass, textColorClass } = col;

              return (
                <div
                  key={col.id}
                  style={{ width: `${currentStyles.colWidth}px` }}
                  className="flex-shrink-0 flex flex-col gap-3 transition-all duration-300"
                >
                  <div className="px-1">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1 ml-2">
                      {col.group}
                    </p>
                    <div
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl ${bgColorClass} border border-white/60 shadow-sm`}
                    >
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest truncate ${textColorClass}`}
                      >
                        {col.label}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-lg bg-white/80 ${textColorClass}`}
                      >
                        {columnTickets.length}
                      </span>
                    </div>
                  </div>

                  <DroppableColumn id={col.id} bgColorClass={bgColorClass}>
                    <SortableContext
                      items={columnTickets.map((ticket) => ticket.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {columnTickets.map((ticket) => (
                        <SortableTicketCard
                          key={ticket.id}
                          ticket={ticket}
                          currentStyles={currentStyles}
                          setSelectedTicket={setSelectedTicket}
                          handleUpdateTicket={handleUpdateTicket}
                          setTickets={setTickets}
                        />
                      ))}
                    </SortableContext>
                  </DroppableColumn>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeTicket ? (
              <div className="rotate-1 scale-[1.02] pointer-events-none">
                <TicketDragPreview
                  ticket={activeTicket}
                  currentStyles={currentStyles}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] p-4 flex items-center justify-center"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="w-full max-w-5xl bg-white rounded-[28px] shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 lg:px-8 py-5 border-b border-gray-200 bg-white flex items-start justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0150a0] bg-[#e6eef8] px-2.5 py-1 rounded-lg">
                    {selectedTicket.clienti?.nome || "N/D"}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                    {Array.isArray(selectedTicket.applicativo)
                      ? selectedTicket.applicativo.join(", ")
                      : selectedTicket.applicativo || "APP"}
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-gray-900 leading-tight pr-8">
                  {selectedTicket.titolo}
                </h2>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 lg:p-8 overflow-y-auto space-y-6 bg-[#f8fafc]">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Cliente</p>
                  <p className="mt-2 text-sm font-bold text-gray-900">
                    {selectedTicket.clienti?.nome || "N/D"}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Applicativo</p>
                  <input
                    value={
                      Array.isArray(selectedTicket.applicativo)
                        ? selectedTicket.applicativo.join(", ")
                        : selectedTicket.applicativo || ""
                    }
                    onChange={(e) =>
                      setSelectedTicket({ ...selectedTicket, applicativo: e.target.value })
                    }
                    onBlur={(e) =>
                      handleUpdateTicket(selectedTicket.id, { applicativo: e.target.value })
                    }
                    className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Avanzamento</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-700">Progresso</span>
                      <span className="text-sm font-black text-emerald-600">
                        {selectedTicket.percentuale_avanzamento || 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${selectedTicket.percentuale_avanzamento || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className={ui.label}>Titolo</p>
                <textarea
                  rows={2}
                  value={selectedTicket.titolo}
                  onChange={(e) => setSelectedTicket({ ...selectedTicket, titolo: e.target.value })}
                  onBlur={(e) => handleUpdateTicket(selectedTicket.id, { titolo: e.target.value })}
                  className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base font-black text-gray-900 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Tag</p>
                  <textarea
                    rows={3}
                    value={selectedTicket.n_tag || ""}
                    onChange={(e) => setSelectedTicket({ ...selectedTicket, n_tag: e.target.value })}
                    onBlur={(e) => handleUpdateTicket(selectedTicket.id, { n_tag: e.target.value })}
                    className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none resize-none"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Note importanti</p>
                  <textarea
                    rows={3}
                    value={selectedTicket.note_importanti || ""}
                    onChange={(e) =>
                      setSelectedTicket({ ...selectedTicket, note_importanti: e.target.value })
                    }
                    onBlur={(e) =>
                      handleUpdateTicket(selectedTicket.id, {
                        note_importanti: e.target.value,
                      })
                    }
                    className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className={ui.label}>Descrizione</p>
                <textarea
                  rows={6}
                  value={selectedTicket.descrizione || ""}
                  onChange={(e) =>
                    setSelectedTicket({ ...selectedTicket, descrizione: e.target.value })
                  }
                  onBlur={(e) =>
                    handleUpdateTicket(selectedTicket.id, { descrizione: e.target.value })
                  }
                  className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Ultimo ping</p>
                  <p className="mt-2 text-sm font-bold text-gray-900">
                    {formatDateShort(selectedTicket.ultimo_ping)}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Sprint</p>
                  <p className="mt-2 text-sm font-bold text-gray-900">
                    {selectedTicket.sprint || "N/D"}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className={ui.label}>Live</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-full",
                        selectedTicket.in_lavorazione_ora
                          ? "bg-red-500 animate-pulse"
                          : "bg-gray-300"
                      )}
                    />
                    <span className="text-sm font-bold text-gray-900">
                      {selectedTicket.in_lavorazione_ora ? "In lavorazione ora" : "Non attivo"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed bottom-4 right-4 w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-40">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-black uppercase tracking-widest text-gray-700">
              Visibilità Colonne
            </p>
            <button
              onClick={() => setShowSettings(false)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {allBoardColumns.map((col) => (
              <div
                key={col.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${col.bgColorClass}`} />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">
                    {col.label}
                  </span>
                </div>

                <button
                  onClick={() => toggleColumn(col.id)}
                  className={`w-10 h-5 rounded-full transition-all relative ${
                    visibleColumns[col.id] !== false ? "bg-black" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${
                      visibleColumns[col.id] !== false ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SprintBoardRefactor;
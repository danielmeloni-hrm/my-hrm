"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  ChevronRight,
  Circle,
  PlayCircle,
  TriangleAlert,
  AlertTriangle,
  X,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- TIPI ---
export type Cliente = { nome: string; id: string };
export type Profilo = { id: string; nome?: string; nome_completo?: string; avatar_url?: string };

export type Ticket = {
  id: string;
  titolo: string;
  stato: string;
  n_tag?: string | null;
  numero_priorita?: number | null;
  percentuale_avanzamento?: number | null;
  applicativo?: string[] | string | null;
  note_importanti?: string | null;
  in_lavorazione_ora?: boolean;
  ultimo_ping?: string | null;
  sprint?: string | null;
  assignee?: string | null;
  clienti?: {
    id: string;
    nome: string;
  } | null;
  profili?: {
    id: string;
    nome?: string | null;
    nome_completo?: string | null;
    avatar_url?: string | null;
  } | null;
  columnId: string;
};

type TicketCardProps = {
  ticket: Ticket;
  currentStyles: { padding: string; title: string };
  setSelectedTicket: React.Dispatch<React.SetStateAction<Ticket | null>>;
  handleUpdateTicket: (id: string, patch: Partial<Ticket>) => void;
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
};

// --- UTILS ---
function formatDateShort(date?: string | null) {
  if (!date) return "Mai";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
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
  if (diff >= 10) return { icon: "text-red-500 animate-pulse", container: "text-red-600" };
  if (diff >= 5) return { icon: "text-amber-500", container: "text-amber-600" };
  return { icon: "text-emerald-500", container: "text-emerald-600" };
}

// --- COMPONENTE PRINCIPALE ---
export default function TicketCard({
  ticket,
  currentStyles,
  setSelectedTicket,
  handleUpdateTicket,
  setTickets,
}: TicketCardProps) {
  
  // Stati per monitoraggio modifiche esterne
  const [showConflictPopup, setShowConflictPopup] = useState(false);
  const [variazioni, setVariazioni] = useState<string[]>([]);
  
  // Ref per tracciare lo stato precedente e l'attività dell'utente corrente
  const prevTicketRef = useRef<Ticket>(ticket);
  const isEditing = useRef(false);

  // Gestori Focus/Blur per evitare falsi allarmi durante l'editing locale
  const handleFocus = () => {
    isEditing.current = true;
  };

  const handleBlur = (id: string, patch: Partial<Ticket>) => {
    isEditing.current = false;
    handleUpdateTicket(id, patch);
    // Aggiorniamo il ref immediatamente dopo il nostro salvataggio
    prevTicketRef.current = { ...ticket, ...patch };
  };

  useEffect(() => {
    // Se l'utente sta modificando questo specifico ticket, non mostriamo popup
    if (isEditing.current) {
      prevTicketRef.current = ticket;
      return;
    }

    const prev = prevTicketRef.current;
    const current = ticket;

    // Controllo discrepanze se l'ID è lo stesso (aggiornamento dati)
    if (prev.id === current.id) {
      const diffs: string[] = [];

      if (prev.in_lavorazione_ora !== current.in_lavorazione_ora) {
        diffs.push(`Stato: ${current.in_lavorazione_ora ? "In corso" : "Fermato"}`);
      }
      if (prev.percentuale_avanzamento !== current.percentuale_avanzamento) {
        diffs.push(`Avanzamento: ${current.percentuale_avanzamento}%`);
      }
      if (prev.titolo !== current.titolo && prev.titolo !== "") {
        diffs.push(`Titolo modificato da un collega`);
      }
      if (prev.n_tag !== current.n_tag) {
        diffs.push(`TAG aggiornati`);
      }

      if (diffs.length > 0) {
        setVariazioni(diffs);
        setShowConflictPopup(false);
        // Nasconde il popup automaticamente dopo 8 secondi
        const timer = setTimeout(() => setShowConflictPopup(false), 8000);
        return () => clearTimeout(timer);
      }
    }
    
    prevTicketRef.current = ticket;
  }, [ticket]);

  // DND-KIT logic
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
      {...attributes}
      {...listeners}
      onClick={() => setSelectedTicket({ ...ticket })}
      className={`relative rounded-xl border transition-all duration-500 overflow-hidden group cursor-grab active:cursor-grabbing touch-none ${
        showConflictPopup 
          ? "bg-yellow-50 border-yellow-400 shadow-xl ring-2 ring-yellow-400 animate-[pulse_3s_infinite]" 
          : "bg-white border-gray-200 shadow-sm hover:shadow-md"
      } ${currentStyles.padding}`}
    >
      
      {/* POPUP MODIFICA ESTERNA */}
      {showConflictPopup && (
        <div 
          className="absolute inset-x-2 top-2 z-50 animate-in fade-in zoom-in duration-300"
          onClick={(e) => { e.stopPropagation(); setShowConflictPopup(false); }}
        >
          <div className="bg-yellow-500 text-white p-3 rounded-lg shadow-2xl border border-yellow-600 relative overflow-hidden">
            <div className="absolute right-[-10px] bottom-[-10px] opacity-10 pointer-events-none">
              <AlertTriangle size={60} />
            </div>

            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <Activity size={14} className="animate-pulse text-white" />
                <h4 className="text-[10px] font-black uppercase tracking-tighter">Aggiornamento Live</h4>
              </div>
              <X size={14} className="cursor-pointer hover:bg-black/10 rounded" />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold line-clamp-1 opacity-90">{ticket.titolo}</p>
              <div className="pt-1 border-t border-white/20">
                {variazioni.map((mod, i) => (
                  <div key={i} className="text-[9px] font-black flex items-center gap-1">
                    <div className="w-1 h-1 bg-white rounded-full" /> {mod.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASTO PLAY/STOP */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleUpdateTicket(ticket.id, { in_lavorazione_ora: !ticket.in_lavorazione_ora });
        }}
        className="absolute top-3 right-3 z-10"
      >
        {ticket.in_lavorazione_ora ? (
          <PlayCircle size={18} className="text-red-500 animate-pulse" />
        ) : (
          <Circle size={18} className="text-gray-200 hover:text-red-400 transition-colors" />
        )}
      </button>

      {/* CONTENUTO VISIBILE */}
      <div className={`space-y-3 transition-all duration-300 ${showConflictPopup ? "blur-[1px] opacity-30 pointer-events-none" : ""}`}>
        
        {/* HEADER: CLIENTE, APP, % */}
        <div className="flex items-center gap-2 flex-wrap pr-6">
          <span className="text-[9px] font-black text-[#0150a0] bg-[#e6eef8] px-2 py-1 rounded-lg uppercase tracking-widest truncate max-w-[100px]">
            {ticket.clienti?.nome || "N/D"}
          </span>

          <input
            onFocus={handleFocus}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-[9px] font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg uppercase outline-none border border-transparent focus:border-gray-300 w-16 text-center"
            value={Array.isArray(ticket.applicativo) ? ticket.applicativo.join(", ") : ticket.applicativo || ""}
            placeholder="APP"
            onBlur={(e) => handleBlur(ticket.id, { applicativo: e.target.value })}
            onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, applicativo: e.target.value } : t))}
          />

          <div className="relative" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <input
              onFocus={handleFocus}
              type="number"
              min="0"
              max="100"
              value={ticket.percentuale_avanzamento || 0}
              onBlur={(e) => handleBlur(ticket.id, { percentuale_avanzamento: parseInt(e.target.value) || 0 })}
              onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, percentuale_avanzamento: parseInt(e.target.value) || 0 } : t))}
              className={`w-11 h-7 text-[10px] font-black text-center rounded-lg border outline-none ${
                (ticket.percentuale_avanzamento || 0) > 0 ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-200 bg-gray-50 text-gray-400"
              }`}
            />
            {(ticket.percentuale_avanzamento || 0) > 0 && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-black text-white/70 pointer-events-none">%</span>
            )}
          </div>
        </div>

        {/* TITOLO E TAG */}
        <div className="space-y-1.5">
          <textarea
            onFocus={handleFocus}
            rows={2}
            className={`${currentStyles.title} w-full font-black text-gray-900 leading-tight outline-none border-none resize-none bg-transparent focus:text-[#0150a0]`}
            value={ticket.titolo}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => handleBlur(ticket.id, { titolo: e.target.value })}
            onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, titolo: e.target.value } : t))}
          />

          <textarea
            onFocus={handleFocus}
            rows={1}
            className="text-[10px] font-bold uppercase outline-none border-none bg-transparent w-full text-gray-400 hover:text-gray-600 focus:text-gray-900"
            value={ticket.n_tag || ""}
            placeholder="TAG"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => handleBlur(ticket.id, { n_tag: e.target.value })}
            onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, n_tag: e.target.value } : t))}
          />

          {/* NOTE IMPORTANTI */}
          <div className="flex items-start gap-1.5 text-gray-500">
            <TriangleAlert size={10} className="text-amber-500 mt-[2px] shrink-0" />
            <input
              onFocus={handleFocus}
              className="text-[10px] font-bold uppercase outline-none border-none bg-transparent w-full text-gray-600 focus:text-black"
              value={ticket.note_importanti || ""}
              placeholder="Note importanti"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => handleBlur(ticket.id, { note_importanti: e.target.value })}
              onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, note_importanti: e.target.value } : t))}
            />
          </div>
        </div>

        {/* FOOTER: DATA PING */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity size={10} className={pingStyles.icon} />
            <span className={`text-[10px] font-black uppercase truncate ${pingStyles.container}`}>
              {formatDateShort(ticket.ultimo_ping)}
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setSelectedTicket({ ...ticket }); }}
            className="p-1.5 bg-gray-900 text-white rounded-lg hover:bg-[#0150a0] transition-all"
          >
            <ChevronRight size={10} />
          </button>
        </div>
      </div>

      {/* PROGRESS BAR FONDO CARD */}
      <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
        <div
          className="h-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${ticket.percentuale_avanzamento || 0}%` }}
        />
      </div>
    </div>
  );
}
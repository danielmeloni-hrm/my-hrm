"use client";

import React from "react";
import { Activity, TriangleAlert } from "lucide-react";
import type { Ticket } from "./TicketCard";

type TicketDragPreviewProps = {
  ticket: Ticket;
  currentStyles: { padding: string; title: string };
};

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

export default function TicketDragPreview({
  ticket,
  currentStyles,
}: TicketDragPreviewProps) {
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

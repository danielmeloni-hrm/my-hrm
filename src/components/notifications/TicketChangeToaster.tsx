"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, BellRing, PencilLine, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  subscribeTicketNotifications,
  subscribeNotePings,
  type TicketChangeNotification,
  type NotePingNotification,
} from "@/lib/ticket-notifications";

type Toast =
  | ({ kind: "change"; key: string } & TicketChangeNotification)
  | ({ kind: "ping"; key: string } & NotePingNotification);

const AUTO_DISMISS_MS = 10000;
const MAX_VISIBLE_TOASTS = 4;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Popup realtime a destra.
 *
 * - Blu: un collega ha modificato un ticket assegnato all'utente
 *   (o glielo ha tolto/assegnato). Click → apre il ticket.
 * - Giallo: un collega ha menzionato l'utente con @ in una nota.
 *   Click → apre direttamente la nota nel Note Board.
 *
 * Montato una sola volta nel layout (app), attivo su tutte le pagine.
 */
export default function TicketChangeToaster() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Recupera l'utente autenticato (lato client, sessione Supabase)
  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.user) {
        setUserId(null);
        return;
      }
      setUserId(data.user.id);
    });

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const pushToast = (toast: Toast) => {
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE_TOASTS - 1)), toast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.key !== toast.key));
    }, AUTO_DISMISS_MS);
  };

  const makeKey = (id: string) =>
    `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Modifiche ticket (popup blu)
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeTicketNotifications(supabase, (payload) => {
      if (!payload) return;
      if (!payload.recipients?.includes(userId)) return;
      if (payload.authorId === userId) return;

      pushToast({ ...payload, kind: "change", key: makeKey(payload.ticketId) });
    });

    return unsubscribe;
  }, [supabase, userId]);

  // Ping da menzione @ nelle note (popup giallo)
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeNotePings(supabase, (payload) => {
      if (!payload) return;
      if (payload.targetUserId !== userId) return;
      if (payload.authorId === userId) return;

      pushToast({ ...payload, kind: "ping", key: makeKey(payload.noteId) });
    });

    return unsubscribe;
  }, [supabase, userId]);

  const dismiss = (key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  };

  const openToast = (toast: Toast) => {
    dismiss(toast.key);

    if (toast.kind === "ping") {
      // Apre direttamente la nota: evento custom per il Note Board già
      // montato + navigazione con query param per gli altri casi
      window.dispatchEvent(
        new CustomEvent("myhrm:open-note", {
          detail: { noteId: toast.noteId },
        })
      );
      router.push(`/note_board?note=${toast.noteId}`);
      return;
    }

    router.push(`/ticket/${toast.ticketId}`);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => {
        const isPing = toast.kind === "ping";

        const accentClasses = isPing
          ? "border-l-amber-400 bg-amber-50"
          : "border-l-[#0150a0] bg-white";

        return (
          <div
            key={toast.key}
            role="button"
            tabIndex={0}
            onClick={() => openToast(toast)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openToast(toast);
              }
            }}
            className={`animate-app-fade-in pointer-events-auto cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 border-l-4 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.18)] transition-all hover:-translate-x-0.5 hover:shadow-[0_4px_8px_rgba(15,23,42,0.08),0_20px_40px_-12px_rgba(15,23,42,0.24)] ${accentClasses}`}
            title={isPing ? "Apri la nota" : "Apri il ticket"}
          >
            <div className="flex items-start gap-3 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isPing
                    ? "bg-amber-100 text-amber-600"
                    : "bg-[#e6eef8] text-[#0150a0]"
                }`}
              >
                {isPing ? <AtSign size={16} /> : <BellRing size={16} />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="truncate text-[13px] font-black uppercase tracking-tight text-slate-900"
                    title={
                      toast.kind === "ping"
                        ? toast.noteTitle || undefined
                        : toast.ticketTitle || undefined
                    }
                  >
                    {toast.kind === "ping"
                      ? `Ping • ${toast.noteTitle || "Nota"}`
                      : toast.ticketTag ||
                        toast.ticketTitle ||
                        `Ticket ${toast.ticketId}`}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(toast.key);
                    }}
                    className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Chiudi notifica"
                  >
                    <X size={14} />
                  </button>
                </div>

                {toast.kind === "ping" ? (
                  <p className="mt-1.5 text-xs font-semibold text-amber-700">
                    Ti ha menzionato in una nota — clicca per aprirla
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {toast.changes.map((change, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs font-semibold text-slate-700"
                      >
                        <PencilLine
                          size={11}
                          className="mt-0.5 shrink-0 text-slate-400"
                        />
                        <span className="break-words">{change}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className={`mt-2 flex items-center justify-between border-t pt-2 ${
                    isPing ? "border-amber-200/70" : "border-slate-100"
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isPing ? "Ping di" : "Modificato da"}{" "}
                    <span
                      className={isPing ? "text-amber-600" : "text-[#0150a0]"}
                    >
                      {toast.authorName}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {formatTime(toast.at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

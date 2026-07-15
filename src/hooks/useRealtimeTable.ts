"use client";

import { useEffect, useRef } from "react";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

type UseRealtimeTableOptions = {
  /** Client Supabase (browser) */
  supabase: SupabaseClient;
  /** Nome della tabella da osservare */
  table: string;
  /** Evento da osservare (default: tutti) */
  event?: RealtimeEvent;
  /** Filtro opzionale, es. `assignee=eq.${userId}` */
  filter?: string;
  /** Callback invocata a ogni cambiamento */
  onChange: (
    payload: RealtimePostgresChangesPayload<Record<string, any>>
  ) => void;
  /** Disabilita la subscription (default: attiva) */
  enabled?: boolean;
};

/**
 * Hook condiviso per le subscription Supabase Realtime.
 *
 * Gestisce creazione canale, cleanup e nome canale univoco.
 * La callback è tenuta in un ref: non serve memoizzarla e la
 * subscription non viene ricreata a ogni render.
 *
 * Esempio:
 * ```ts
 * useRealtimeTable({
 *   supabase,
 *   table: "ticket",
 *   onChange: () => refetch(),
 * });
 * ```
 */
export function useRealtimeTable({
  supabase,
  table,
  event = "*",
  filter,
  onChange,
  enabled = true,
}: UseRealtimeTableOptions) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    // Nome canale univoco per evitare collisioni tra pagine/istanze
    const channelName = `rt-${table}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        // @ts-expect-error - overload postgres_changes con event dinamico
        "postgres_changes",
        { event, schema: "public", table, ...(filter ? { filter } : {}) },
        (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
          onChangeRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, table, event, filter, enabled]);
}

export default useRealtimeTable;

"use client";

import { Suspense } from "react";
import { TicketPlus } from "lucide-react";
import NewTicketInner from "./NewTicketInner";
import AppPage from "@/components/ui/AppPage";
import AppCard from "@/components/ui/AppCard";

export default function Page() {
  return (
    // Il titolo vive dentro NewTicketInner insieme al selettore di tipologia:
    // qui non lo ripetiamo per evitare due intestazioni.
    <AppPage maxWidth="full">
      <Suspense
        fallback={
          <AppCard className="flex min-h-[400px] items-center justify-center">
            <span className="animate-pulse text-sm font-black uppercase tracking-widest text-slate-300">
              Caricamento...
            </span>
          </AppCard>
        }
      >
        <NewTicketInner />
      </Suspense>
    </AppPage>
  );
}
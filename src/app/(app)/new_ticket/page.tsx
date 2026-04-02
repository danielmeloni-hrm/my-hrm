"use client";

import { Suspense } from "react";
import NewTicketInner from "./NewTicketInner";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-300 animate-pulse">
          CARICAMENTO...
        </div>
      }
    >
      <NewTicketInner />
    </Suspense>
  );
}
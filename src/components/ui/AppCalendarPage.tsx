// src/components/ui/AppCalendarPage.tsx

import { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

type AppCalendarPageProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
};

export default function AppCalendarPage({
  title = "Calendario",
  subtitle = "Gestione attività, appuntamenti e risorse",
  actions,
  filters,
  legend,
  children,
}: AppCalendarPageProps) {
  return (
    <div className="h-full bg-[#FBFBFB] p-6 lg:p-8">
      <div className="flex h-full flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {title}
                </h1>

                {subtitle && (
                  <p className="mt-1 text-sm text-slate-500">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {actions && (
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>

          {(filters || legend) && (
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
              {filters && (
                <div className="flex flex-wrap items-center gap-2">
                  {filters}
                </div>
              )}

              {legend && (
                <div className="flex flex-wrap items-center gap-3">
                  {legend}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
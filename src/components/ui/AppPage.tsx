import { ReactNode } from "react";
import { theme } from "@/styles/theme";

type AppPageProps = {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: "full" | "xl" | "2xl" | "4xl" | "7xl";
  className?: string;
};

/**
 * Le pagine occupano tutta la larghezza disponibile: i valori restano per
 * compatibilità, ma solo i formati stretti (form, dialoghi) restano limitati.
 */
const maxWidthClass = {
  full: "max-w-none",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-none",
  "7xl": "max-w-none",
};

export default function AppPage({
  title,
  subtitle,
  icon,
  actions,
  children,
  maxWidth = "7xl",
  className = "",
}: AppPageProps) {
  return (
    <div
      className={`min-h-full ${theme.page.background} ${theme.page.padding} ${theme.page.text} ${className}`}
    >
      <div
        className={`animate-app-fade-in mx-auto w-full ${maxWidthClass[maxWidth]}`}
      >
        {(title || subtitle || actions) && (
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              {icon && (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 text-[var(--brand)] shadow-sm sm:h-12 sm:w-12">
                  {icon}
                </div>
              )}

              <div className="min-w-0">
                {title && (
                  <h1 className={`truncate ${theme.text.pageTitle}`}>{title}</h1>
                )}

                {subtitle && (
                  <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                )}
              </div>
            </div>

            {actions && (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

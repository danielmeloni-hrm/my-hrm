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

const maxWidthClass = {
  full: "max-w-none",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "7xl": "max-w-7xl",
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
    <div className={`${theme.page.background} ${theme.page.padding} ${theme.page.text} ${className}`}>
      <div className={`mx-auto w-full ${maxWidthClass[maxWidth]}`}>
        {(title || subtitle || actions) && (
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              {icon && (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm">
                  {icon}
                </div>
              )}

              <div>
                {title && (
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {title}
                  </h1>
                )}

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
        )}

        {children}
      </div>
    </div>
  );
}
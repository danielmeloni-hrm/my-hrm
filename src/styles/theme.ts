/**
 * Token di stile condivisi.
 *
 * I colori usano utility Tailwind che puntano a variabili CSS (vedi
 * globals.css): al cambio tema le stesse classi cambiano resa, quindi qui
 * non servono varianti dark: esplicite.
 */
export const theme = {
  colors: {
    appBg: "bg-[var(--page-bg)]",
    sidebarBg: "bg-white",
    cardBg: "bg-white",
    border: "border-slate-200",
    text: "text-slate-900",
    muted: "text-slate-500",
    brand: "text-[var(--brand)]",
  },

  page: {
    background: "bg-[var(--page-bg)]",
    /** Più respiro: le pagine restano leggibili anche su schermi larghi. */
    padding: "px-4 py-6 md:px-8 md:py-10 lg:px-12",
    text: "text-slate-900",
  },

  card: {
    base: "rounded-3xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)] transition-all duration-200",
    padded:
      "rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 sm:p-6",
    hover:
      "hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-[var(--shadow-card-hover)]",
  },

  layout: {
    main: "flex-1 h-screen overflow-y-auto relative",
  },

  button: {
    base: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-bg)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    primary: "bg-slate-900 text-[#ffffff] shadow-sm hover:bg-slate-800",
    secondary:
      "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-[#ffffff] shadow-sm hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  },

  /** Tipografia condivisa. */
  text: {
    pageTitle: "text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl",
    sectionTitle: "text-base font-bold tracking-tight text-slate-900",
    label:
      "text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:text-[11px]",
    muted: "text-sm text-slate-500",
  },
};

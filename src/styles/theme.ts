export const theme = {
  colors: {
    appBg: "bg-[#FBFBFB]",
    sidebarBg: "bg-white",
    cardBg: "bg-white",
    border: "border-slate-200",
    text: "text-slate-900",
    muted: "text-slate-500",
    brand: "text-[#0150a0]",
  },

  page: {
    background: "bg-[#FBFBFB]",
    padding: "p-4 md:p-6 lg:p-8",
    text: "text-slate-900",
  },

  card: {
    base: "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition-shadow duration-200",
    padded:
      "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition-shadow duration-200",
    hover:
      "hover:border-slate-300/80 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.14)]",
  },

  layout: {
    main: "flex-1 h-screen overflow-y-auto relative",
  },

  button: {
    base: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0150a0]/40 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    primary: "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
    secondary:
      "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  },
};

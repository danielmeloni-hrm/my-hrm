// src/lib/sidebar-color.ts
// Calcolo dei colori derivati dallo sfondo scelto per la sidebar.

export const SIDEBAR_COLOR_PRESETS = [
  { value: "", label: "Predefinito" },
  { value: "#0150a0", label: "Blu HRM" },
  { value: "#0f172a", label: "Notte" },
  { value: "#1f2937", label: "Grafite" },
  { value: "#065f46", label: "Verde bosco" },
  { value: "#7c2d12", label: "Terracotta" },
  { value: "#4c1d95", label: "Viola" },
  { value: "#0e7490", label: "Petrolio" },
  { value: "#f1f5f9", label: "Grigio chiaro" },
] as const;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** Luminanza relativa secondo WCAG: serve a decidere il colore del testo. */
export function getLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);

  const canale = (valore: number) => {
    const c = valore / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * canale(r) + 0.7152 * canale(g) + 0.0722 * canale(b);
}

export function isColoreScuro(hex: string) {
  return getLuminance(hex) < 0.45;
}

export type SidebarPalette = {
  /** Sfondo della sidebar. */
  background: string | undefined;
  /** Testo delle voci non attive. */
  testo: string | undefined;
  /** Testo attenuato (etichette, icone di servizio). */
  testoSoft: string | undefined;
  /** Testo delle voci in evidenza. */
  testoForte: string | undefined;
  /** Sfondo della voce attiva. */
  attivoBg: string | undefined;
  /** Sfondo al passaggio del mouse. */
  hoverBg: string | undefined;
  /** Bordo di separazione. */
  bordo: string | undefined;
  /** true quando lo sfondo è scuro. */
  scuro: boolean;
};

/**
 * Deriva l'intera palette dal colore scelto.
 * Con colore assente si torna alle classi predefinite (nessuno stile inline).
 */
export function getSidebarPalette(colore?: string | null): SidebarPalette {
  if (!isHexColor(colore)) {
    return {
      background: undefined,
      testo: undefined,
      testoSoft: undefined,
      testoForte: undefined,
      attivoBg: undefined,
      hoverBg: undefined,
      bordo: undefined,
      scuro: false,
    };
  }

  const scuro = isColoreScuro(colore);

  return {
    background: colore,
    testo: scuro ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.72)",
    testoSoft: scuro ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.5)",
    testoForte: scuro ? "#ffffff" : "#0f172a",
    attivoBg: scuro ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.08)",
    hoverBg: scuro ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
    bordo: scuro ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)",
    scuro,
  };
}

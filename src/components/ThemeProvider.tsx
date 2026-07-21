"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "myhrm-theme";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Script eseguito prima del primo paint: evita il lampeggio chiaro
 * quando l'utente ha scelto il tema scuro.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';
var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.dataset.theme=m;
}catch(e){}})();`;

type ThemeContextValue = {
  /** Preferenza scelta dall'utente. */
  mode: ThemeMode;
  /** Tema effettivamente applicato. */
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolved: "light",
  setMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return "light" as const;

  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());

  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = mode;

  return dark ? ("dark" as const) : ("light" as const);
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Allineamento allo stato già applicato dallo script inline.
  useEffect(() => {
    const salvato = localStorage.getItem(THEME_STORAGE_KEY);
    const iniziale = isThemeMode(salvato) ? salvato : "system";

    setModeState(iniziale);
    setResolved(applyTheme(iniziale));

    // Se su questo dispositivo non c'è ancora una scelta, prendiamo
    // quella salvata sul profilo, così il tema segue l'utente.
    if (isThemeMode(salvato)) return;

    let annullato = false;

    fetch("/api/settings/theme")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (annullato || !json?.ok || !isThemeMode(json.theme)) return;
        if (json.theme === "system") return;

        setModeState(json.theme);
        setResolved(applyTheme(json.theme));

        try {
          localStorage.setItem(THEME_STORAGE_KEY, json.theme);
        } catch {
          // ignorata: il tema resta valido per la sessione
        }
      })
      .catch(() => {});

    return () => {
      annullato = true;
    };
  }, []);

  // Se la preferenza è "system", seguiamo i cambi del sistema operativo.
  useEffect(() => {
    if (mode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setResolved(applyTheme(next));

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage non disponibile: il tema resta valido per la sessione.
    }

    // Persistenza lato server, senza bloccare l'interfaccia.
    fetch("/api/settings/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

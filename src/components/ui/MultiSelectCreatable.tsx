"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";

type Props = {
  /** Voci selezionate. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Voci proposte (catalogo). */
  options: string[];
  /** Chiamata quando l'utente crea una voce nuova. */
  onCreate?: (nome: string) => void;
  placeholder?: string;
};

/**
 * Selezione multipla con ricerca e creazione di nuove voci.
 * Le voci scelte restano come chip rimovibili; digitando si filtra il
 * catalogo e, se il testo non esiste, si può aggiungerlo.
 */
export default function MultiSelectCreatable({
  value,
  onChange,
  options,
  onCreate,
  placeholder = "Cerca o aggiungi...",
}: Props) {
  const [query, setQuery] = useState("");
  const [aperto, setAperto] = useState(false);

  const filtrate = useMemo(() => {
    const q = query.trim().toLowerCase();
    const disponibili = options.filter((o) => !value.includes(o));

    if (!q) return disponibili;

    return disponibili.filter((o) => o.toLowerCase().includes(q));
  }, [options, value, query]);

  const testo = query.trim();
  const esisteGia =
    testo.length > 0 &&
    [...options, ...value].some(
      (o) => o.toLowerCase() === testo.toLowerCase()
    );

  function aggiungi(nome: string) {
    const pulito = nome.trim();
    if (!pulito || value.includes(pulito)) return;

    onChange([...value, pulito]);
    setQuery("");
  }

  function creaNuovo() {
    const pulito = testo;
    if (!pulito) return;

    onCreate?.(pulito);
    aggiungi(pulito);
  }

  function rimuovi(nome: string) {
    onChange(value.filter((v) => v !== nome));
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-2 focus-within:border-[#0150a0]">
        {value.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-[#0150a0]"
          >
            {v}
            <button
              type="button"
              onClick={() => rimuovi(v)}
              className="text-[#0150a0]/60 hover:text-[#0150a0]"
              aria-label={`Rimuovi ${v}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAperto(true);
          }}
          onFocus={() => setAperto(true)}
          onBlur={() => setTimeout(() => setAperto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtrate.length > 0 && !esisteGia) {
                // Enter con testo che non esiste: crea; altrimenti seleziona il primo.
                aggiungi(filtrate[0]);
              } else if (!esisteGia && testo) {
                creaNuovo();
              } else if (esisteGia) {
                aggiungi(testo);
              }
            }

            if (e.key === "Backspace" && !query && value.length > 0) {
              rimuovi(value[value.length - 1]);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>

      {aperto && (filtrate.length > 0 || (testo && !esisteGia)) && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {filtrate.map((o) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aggiungi(o)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Check size={13} className="text-gray-300" />
              {o}
            </button>
          ))}

          {testo && !esisteGia && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={creaNuovo}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm font-semibold text-[#0150a0] hover:bg-blue-50"
            >
              <Plus size={13} />
              Crea &ldquo;{testo}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

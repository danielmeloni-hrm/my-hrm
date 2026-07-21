"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ModalPortalProps = {
  children: React.ReactNode;
  /** Blocca lo scorrimento della pagina sottostante (default: true). */
  bloccaScroll?: boolean;
};

/**
 * Monta il contenuto su document.body.
 *
 * Serve perché un antenato con transform, filter, backdrop-filter o
 * will-change diventa il riferimento degli elementi position:fixed: il
 * modale finirebbe ancorato a quel contenitore invece che allo schermo,
 * risultando spostato o tagliato. Dal body questo non può succedere.
 */
export default function ModalPortal({
  children,
  bloccaScroll = true,
}: ModalPortalProps) {
  const [montato, setMontato] = useState(false);

  useEffect(() => {
    setMontato(true);
  }, []);

  useEffect(() => {
    if (!bloccaScroll || typeof document === "undefined") return;

    const precedente = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = precedente;
    };
  }, [bloccaScroll]);

  if (!montato || typeof document === "undefined") return null;

  return createPortal(children, document.body);
}

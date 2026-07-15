"use client";

import { useState } from "react";
import SublimeEmbed from "@/components/SublimeEmbed";
import AppPage from "@/components/ui/AppPage";

type Tab = {
  id: number | string;
  content: string;
};

export default function Page() {
  const [tabs] = useState<Tab[]>([
    {
      id: "notes.ts",
      content: `const message = "Ciao mondo";
console.log(message);`,
    },
  ]);

  const [activeTabId, setActiveTabId] = useState<number | string>("notes.ts");

  const localStreamStatus = "connected";

  return (
    <AppPage title="Test" subtitle="Pagina di prova" maxWidth="4xl">
      <div />
    </AppPage>
  );
}
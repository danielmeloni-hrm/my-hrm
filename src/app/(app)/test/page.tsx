"use client";

import { useState } from "react";
import SublimeEmbed from "@/components/SublimeEmbed";

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
    <div style={{ padding: 40 }}>
      <h1>Note Board</h1>

     
    </div>
  );
}
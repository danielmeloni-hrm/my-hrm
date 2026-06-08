"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiChatWidget() {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    const token = await getToken();

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: userMessage,
        conversationId,
      }),
    });

    const data = await res.json();

    if (data.conversationId) {
      setConversationId(data.conversationId);
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.answer || data.details || data.error || "Errore AI",
      },
    ]);

    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00529F] shadow-xl hover:scale-105 transition"
      >
        <img
          src="/brand/ai-assistant.png"
          alt="Assistente AI"
          className="h-13 w-13 object-contain"
        />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] h-[560px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00529F]">
              <img
                src="/brand/ai-assistant.png"
                alt="Assistente AI"
                className="h-10  w-10 object-contain"
              />
            </div>

            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Assistente MyHRM
              </h2>
              <p className="text-xs text-slate-500">
                Ticket, clienti, documenti e attività
              </p>
            </div>

            <button
                onClick={() => {
                    setOpen(false);
                    setConversationId(null);
                    setMessages([]);
                    setInput("");
                }}
                className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                ✕
                </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5 space-y-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Ciao, sono l’assistente AI di MyHRM. Puoi chiedermi informazioni
                su ticket, clienti e documenti operativi.
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#00529F] text-white rounded-br-md"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  Sto analizzando i dati...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <div className="flex items-end gap-2">
              <textarea
                className="max-h-24 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#00529F]"
                placeholder="Scrivi una domanda..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />

              <button
                onClick={sendMessage}
                disabled={loading}
                className="h-11 rounded-2xl bg-[#00529F] px-5 text-sm font-medium text-white hover:bg-[#003F7A] disabled:opacity-50"
              >
                Invia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type PendingAction = {
  action: {
    action: "update_ticket" | "close_ticket" | "add_ticket_note" | "create_ticket";
    ticketId: string | null;
    ticketLabel: string | null;
    summary: string;
    changes: { campo: string; valore: string }[];
  };
  signature: string;
};

const ACTION_LABELS: Record<string, string> = {
  update_ticket: "Aggiornamento ticket",
  close_ticket: "Chiusura ticket",
  add_ticket_note: "Nota su ticket",
  create_ticket: "Creazione ticket",
};

export default function AiChatWidget() {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const previousAction = pendingAction;

    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
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
          pendingAction: previousAction,
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
          content:
              typeof data.answer === "string"
                ? data.answer
                : typeof data.details === "string"
                  ? data.details
                  : typeof data.error === "string"
                    ? data.error
                    : JSON.stringify(data.answer || data.details || data.error || data, null, 2),
        },
      ]);

      setPendingAction((data.pendingAction as PendingAction) ?? null);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Si è verificato un errore durante la richiesta.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function resolveAction(confirmed: boolean) {
    if (!pendingAction || executingAction) return;

    setExecutingAction(true);

    try {
      const token = await getToken();

      const res = await fetch("/api/ai/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pendingAction, conversationId, confirmed }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.answer ||
            data.error ||
            "Non sono riuscito a completare l'operazione.",
        },
      ]);

      setPendingAction(null);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Si è verificato un errore durante l'esecuzione dell'azione.",
        },
      ]);
    } finally {
      setExecutingAction(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00529F] shadow-xl transition hover:scale-105"
      >
        <Bot className="h-8 w-8 text-[#ffffff]" />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00529F]">
              <Bot className="h-7 w-7 text-[#ffffff]" />
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

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-5">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Ciao, sono l’assistente AI di MyHRM. Puoi chiedermi informazioni
                su ticket, clienti, documenti operativi e thread email.
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
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-md bg-[#00529F] text-[#ffffff]"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-strong:text-slate-900">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {pendingAction && (
              <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
                <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-100/70 px-4 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                    {ACTION_LABELS[pendingAction.action.action] ?? "Azione"}
                  </span>
                  <span className="truncate text-[10px] font-bold text-amber-700">
                    {pendingAction.action.ticketLabel}
                  </span>
                </div>

                <div className="px-4 py-3">
                  <p className="mb-2 text-sm font-bold text-amber-900">
                    {pendingAction.action.summary}
                  </p>

                  <div className="space-y-1">
                    {pendingAction.action.changes.map((change, index) => (
                      <div
                        key={`${change.campo}-${index}`}
                        className="flex items-start justify-between gap-2 rounded-xl bg-white px-3 py-1.5 text-[11px]"
                      >
                        <span className="font-black text-slate-500">
                          {change.campo}
                        </span>
                        <span className="text-right font-bold text-slate-900">
                          {change.valore}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => resolveAction(true)}
                      disabled={executingAction}
                      className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-[#ffffff] hover:bg-green-700 disabled:opacity-50"
                    >
                      {executingAction ? "Eseguo..." : "Conferma"}
                    </button>

                    <button
                      type="button"
                      onClick={() => resolveAction(false)}
                      disabled={executingAction}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                disabled={loading || !input.trim()}
                className="h-11 rounded-2xl bg-[#00529F] px-5 text-sm font-medium text-[#ffffff] hover:bg-[#003F7A] disabled:opacity-50"
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
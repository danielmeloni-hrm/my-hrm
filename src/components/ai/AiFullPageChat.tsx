"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

type PendingActionChange = {
  campo: string;
  valore: string;
};

type PendingAction = {
  action: {
    action: "update_ticket" | "close_ticket" | "add_ticket_note" | "create_ticket";
    ticketId: string | null;
    ticketLabel: string | null;
    summary: string;
    changes: PendingActionChange[];
  };
  signature: string;
};

const ACTION_LABELS: Record<string, string> = {
  update_ticket: "Aggiornamento ticket",
  close_ticket: "Chiusura ticket",
  add_ticket_note: "Nota su ticket",
  create_ticket: "Creazione ticket",
};

export default function AiFullPageChat() {
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);

  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renaming, setRenaming] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function loadConversations() {
    const token = await getToken();

    const res = await fetch("/api/ai/conversation", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setConversations(data.conversations || []);
  }

  async function loadMessages(id: string) {
    if (sendingRef.current) return;

    const token = await getToken();

    const res = await fetch(`/api/ai/conversation/${id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setMessages(data.messages || []);
    setConversationId(id);
    setInput("");
    setPendingAction(null);
  }

  async function newChat() {
  if (sendingRef.current || loading) return;

  setLoading(true);

  try {
    const token = await getToken();

    const res = await fetch("/api/ai/conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Nuova chat",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Errore creazione nuova chat");
    }

    setConversationId(data.conversation.id);
    setMessages([]);
    setInput("");
    setPendingAction(null);
    setEditingConversationId(null);
    setEditingTitle("");

    await loadConversations();
  } catch (error) {
    console.error("Errore nuova chat:", error);
    alert("Non sono riuscito a creare una nuova chat.");
  } finally {
    setLoading(false);
  }
}

  function startRename(conv: Conversation) {
    if (sendingRef.current) return;
    setEditingConversationId(conv.id);
    setEditingTitle(conv.title || "Conversazione");
  }

  function cancelRename() {
    setEditingConversationId(null);
    setEditingTitle("");
  }

  async function renameConversation(id: string) {
    const title = editingTitle.trim();
    if (!title || renaming) return;

    setRenaming(true);

    try {
      const token = await getToken();

      const res = await fetch(`/api/ai/conversation/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Errore durante la rinomina");
      }

      setConversations((prev) =>
        prev.map((conv) => (conv.id === id ? { ...conv, title } : conv))
      );

      setEditingConversationId(null);
      setEditingTitle("");
      await loadConversations();
    } catch (error) {
      console.error("Errore rinomina conversazione:", error);
      alert("Non sono riuscito a rinominare la conversazione.");
    } finally {
      setRenaming(false);
    }
  }

  async function sendMessage() {
    const userMessage = input.trim();
    if (!userMessage || sendingRef.current) return;

    // La proposta aperta viene inviata al server come contesto: il messaggio
    // successivo può correggerla ("scusa, era il collaudo").
    const previousAction = pendingAction;

    sendingRef.current = true;
    setLoading(true);
    setInput("");
    setEditingConversationId(null);

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
          content: data.answer || data.details || data.error || "Errore AI",
        },
      ]);

      // null => la proposta precedente non è più valida e va tolta.
      setPendingAction((data.pendingAction as PendingAction) ?? null);

      try {
        await loadConversations();
      } catch (error) {
        console.warn("Refresh conversazioni fallito:", error);
      }
    } catch (error) {
      console.error("Errore invio messaggio AI:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Si è verificato un errore durante la richiesta all'assistente AI.",
        },
      ]);
    } finally {
      sendingRef.current = false;
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
        body: JSON.stringify({
          pendingAction,
          conversationId,
          confirmed,
        }),
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
    } catch (error) {
      console.error("Errore esecuzione azione AI:", error);

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

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pendingAction]);

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
      <aside className="hidden w-80 shrink-0 border-r border-gray-100 bg-gray-50/80 p-4 md:flex md:flex-col">
        <button
          type="button"
          onClick={() => newChat()}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00529F] px-4 py-3 text-sm font-black text-[#ffffff] shadow-sm transition hover:bg-[#003F7A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={17} />
          Nuova chat
        </button>

        <div className="mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
          Conversazioni
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {conversations.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-xs font-bold text-gray-400">
              Nessuna conversazione salvata.
            </div>
          )}

          {conversations.map((conv) => {
            const isActive = conversationId === conv.id;
            const isEditing = editingConversationId === conv.id;

            return (
              <div
                key={conv.id}
                className={`group rounded-2xl border px-3 py-3 transition ${
                  isActive
                    ? "border-[#00529F] bg-[#00529F] text-[#ffffff] shadow-sm"
                    : "border-gray-100 bg-white text-gray-700 hover:border-blue-100 hover:bg-blue-50/40"
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editingTitle}
                      disabled={renaming}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          renameConversation(conv.id);
                        }

                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-900 outline-none focus:border-[#00529F]"
                    />

                    <button
                      type="button"
                      onClick={() => renameConversation(conv.id)}
                      disabled={renaming || !editingTitle.trim()}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-600 text-[#ffffff] disabled:opacity-50"
                      title="Salva nome"
                    >
                      {renaming ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>

                    <button
                      type="button"
                      onClick={cancelRename}
                      disabled={renaming}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-600 disabled:opacity-50"
                      title="Annulla"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => loadMessages(conv.id)}
                      disabled={loading}
                      className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="truncate text-sm font-black">
                        {conv.title || "Conversazione"}
                      </div>
                      <div
                        className={`mt-1 truncate text-[11px] font-bold ${
                          isActive ? "text-blue-100" : "text-gray-400"
                        }`}
                      >
                        Assistente AI MyHRM
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => startRename(conv)}
                      disabled={loading}
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isActive
                          ? "bg-white/15 text-[#ffffff] hover:bg-white/25"
                          : "bg-gray-50 text-gray-400 opacity-100 hover:bg-gray-100 hover:text-[#00529F] md:opacity-0 md:group-hover:opacity-100"
                      }`}
                      title="Rinomina conversazione"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="border-b border-gray-100 bg-white px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00529F] text-[#ffffff] shadow-sm">
                <Bot size={24} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-gray-900">
                    Assistente AI MyHRM
                  </h1>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#00529F]">
                    Gemini
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Chiedi informazioni su ticket, clienti, documenti operativi e mail.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={newChat}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-600 transition hover:border-blue-100 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
            >
              <Plus size={15} />
              Nuova
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white px-6 py-6">
          <div className="mx-auto max-w-4xl space-y-5">
            {messages.length === 0 && (
              <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100 bg-blue-50/50 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00529F] text-[#ffffff]">
                      <Sparkles size={22} />
                    </div>
                    <div>
                      <h2 className="font-black text-gray-900">Come posso aiutarti?</h2>
                      <p className="text-sm font-medium text-gray-500">
                        Fai una domanda sui dati del gestionale.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 p-5 md:grid-cols-3">
                  {[
                    "Quali ticket sono aperti?",
                    "Qual è l’ultimo documento di APPECOM?",
                    "Mostrami i clienti con attività recenti.",
                  ].map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      disabled={loading}
                      className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left text-sm font-bold text-gray-700 transition hover:border-blue-100 hover:bg-blue-50/60 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#00529F] text-[#ffffff]">
                    <Bot size={18} />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-[24px] px-5 py-4 text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "rounded-br-md bg-[#00529F] text-[#ffffff]"
                      : "rounded-bl-md border border-gray-100 bg-white text-gray-800"
                  }`}
                >
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="space-y-2">{children}</ul>,
                      li: ({ children }) => (
                        <li className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00529F]" />
                          <span>{children}</span>
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-black text-gray-900">{children}</strong>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {pendingAction && (
              <div className="flex justify-start">
                <div className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-[#ffffff]">
                  <AlertTriangle size={18} />
                </div>

                <div className="w-full max-w-[82%] overflow-hidden rounded-[24px] rounded-bl-md border border-amber-200 bg-amber-50 shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-100/70 px-5 py-3">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-800">
                      {ACTION_LABELS[pendingAction.action.action] ?? "Azione"}
                    </span>

                    <span className="truncate text-[11px] font-bold text-amber-700">
                      {pendingAction.action.ticketLabel}
                    </span>
                  </div>

                  <div className="px-5 py-4">
                    <p className="mb-3 text-sm font-bold text-amber-900">
                      {pendingAction.action.summary}
                    </p>

                    <div className="space-y-1.5">
                      {pendingAction.action.changes.map((change, index) => (
                        <div
                          key={`${change.campo}-${index}`}
                          className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs"
                        >
                          <span className="font-black text-gray-500">
                            {change.campo}
                          </span>
                          <span className="text-right font-bold text-gray-900">
                            {change.valore}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => resolveAction(true)}
                        disabled={executingAction}
                        className="flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-xs font-black text-[#ffffff] shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {executingAction ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Check size={15} />
                        )}
                        Conferma
                      </button>

                      <button
                        type="button"
                        onClick={() => resolveAction(false)}
                        disabled={executingAction}
                        className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X size={15} />
                        Annulla
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#00529F] text-[#ffffff]">
                  <Bot size={18} />
                </div>

                <div className="flex items-center gap-2 rounded-[24px] rounded-bl-md border border-gray-100 bg-white px-5 py-4 text-sm font-bold text-gray-500 shadow-sm">
                  <Loader2 className="animate-spin" size={16} />
                  Sto analizzando i dati...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <footer className="border-t border-gray-100 bg-white p-5">
          <div className="mx-auto flex max-w-4xl items-end gap-3">
            <textarea
              className="max-h-32 min-h-[52px] flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#00529F] focus:bg-white focus:ring-2 focus:ring-[#00529F]/15"
              placeholder="Scrivi una domanda..."
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }
              }}
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex h-[52px] items-center gap-2 rounded-2xl bg-[#00529F] px-6 text-sm font-black text-[#ffffff] shadow-sm transition hover:bg-[#003F7A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={17} />
              Invia
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

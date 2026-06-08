"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

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

export default function AiFullPageChat() {
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function loadConversations() {
    const token = await getToken();

    const res = await fetch("/api/ai/conversations", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setConversations(data.conversations || []);
  }

  async function loadMessages(id: string) {
    const token = await getToken();

    const res = await fetch(`/api/ai/conversations/${id}/messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setMessages(data.messages || []);
    setConversationId(id);
  }

  async function newChat() {
    setConversationId(null);
    setMessages([]);
    setInput("");
  }

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

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
        content: data.answer || data.error || "Errore AI",
      },
    ]);

    await loadConversations();
    setLoading(false);
  }

  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <div className="flex h-[calc(100vh-120px)] border rounded-xl overflow-hidden bg-white">
      <aside className="w-72 border-r p-4 overflow-y-auto bg-gray-50">
        <button
          onClick={newChat}
          className="w-full mb-4 rounded-lg bg-black text-white px-4 py-2"
        >
          + Nuova chat
        </button>

        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadMessages(conv.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                conversationId === conv.id
                  ? "bg-black text-white"
                  : "bg-white hover:bg-gray-100"
              }`}
            >
              {conv.title || "Conversazione"}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="border-b p-4">
          <h1 className="text-xl font-semibold">Assistente AI MyHRM</h1>
          <p className="text-sm text-gray-500">
            Chiedi informazioni su ticket, clienti, documenti e mail.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-gray-400">
              Scrivi una domanda per iniziare.
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-3xl rounded-xl p-4 whitespace-pre-wrap ${
                msg.role === "user"
                  ? "ml-auto bg-black text-white"
                  : "mr-auto bg-gray-100 text-black"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {loading && (
            <div className="mr-auto bg-gray-100 rounded-xl p-4">
              Gemini sta analizzando...
            </div>
          )}
        </div>

        <div className="border-t p-4 flex gap-2">
          <textarea
            className="flex-1 border rounded-lg p-3 min-h-[60px]"
            placeholder="Esempio: quali ticket sono ancora aperti?"
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
            className="rounded-lg bg-black text-white px-6"
          >
            Invia
          </button>
        </div>
      </main>
    </div>
  );
}
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Elemental orb icon (matches nav logo palette) ─────────────────────────────
function OrbIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(14,14)" stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0,-11 L-9.5,5.5 L9.5,5.5Z" />
        <line x1="-4.8" y1="-2.5" x2="4.8" y2="-2.5" />
      </g>
      <g transform="translate(42,14)" stroke="#d4a017" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0,11 L-9.5,-5.5 L9.5,-5.5Z" />
        <line x1="-4.8" y1="2.5" x2="4.8" y2="2.5" />
      </g>
      <g transform="translate(14,42)" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0,-11 L-9.5,5.5 L9.5,5.5Z" />
      </g>
      <g transform="translate(42,42)" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0,11 L-9.5,-5.5 L9.5,-5.5Z" />
      </g>
    </svg>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

// ── Suggested questions ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  "How does attacking work?",
  "What is elemental threshold?",
  "How do I cast a spell?",
  "What happens at Death's Door?",
];

// ── Main widget ───────────────────────────────────────────────────────────────
export function AskTheSorcerers() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      const assistantId = crypto.randomUUID();
      // Add placeholder for the assistant message
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              ...messages,
              { role: "user", content: userMsg.content },
            ],
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const current = accumulated;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: current } : m
            )
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Sorry, I couldn't answer that: ${msg}` }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleSuggestion(q: string) {
    sendMessage(q);
  }

  function handleClose() {
    abortRef.current?.abort();
    setIsOpen(false);
  }

  return (
    <>
      {/* ── Floating trigger button ───────────────────────────────────────── */}
      <button
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        title="Ask the Sorcerers"
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-200
          border border-amber-600/50
          ${
            isOpen
              ? "bg-gray-800 hover:bg-gray-700"
              : "bg-gray-900 hover:bg-gray-800 hover:scale-105 hover:shadow-amber-900/40 hover:shadow-xl"
          }
        `}
        aria-label={isOpen ? "Close Ask the Sorcerers" : "Ask the Sorcerers"}
      >
        {isOpen ? (
          <svg
            className="w-5 h-5 text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <OrbIcon size={32} />
        )}
      </button>

      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      <div
        className={`
          fixed bottom-24 right-4 sm:right-6 z-50
          w-[calc(100vw-2rem)] sm:w-96
          max-h-[calc(100vh-8rem)]
          flex flex-col
          bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl
          transition-all duration-200 origin-bottom-right
          ${
            isOpen
              ? "scale-100 opacity-100 pointer-events-auto"
              : "scale-95 opacity-0 pointer-events-none"
          }
        `}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-800 shrink-0">
          <OrbIcon size={22} />
          <div className="flex-1 min-w-0">
            <h2
              className="text-sm font-semibold text-amber-400 leading-none"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              Ask the Sorcerers
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Rules &amp; card expert · Rulebook · FAQ · Codex
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors px-1.5 py-1 rounded"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 text-center pt-2">
                Ask anything about Sorcery rules, card interactions, or game
                mechanics.
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    disabled={isLoading}
                    className="text-left text-xs px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-amber-700/50 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`
                  max-w-[85%] text-sm leading-relaxed rounded-xl px-3 py-2.5 whitespace-pre-wrap
                  ${
                    m.role === "user"
                      ? "bg-amber-600/20 border border-amber-700/40 text-amber-50"
                      : "bg-gray-800 border border-gray-700 text-gray-100"
                  }
                `}
              >
                {m.content ||
                  (m.role === "assistant" && isLoading ? (
                    <TypingDots />
                  ) : null)}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-3 py-3 border-t border-gray-800 shrink-0"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a rules question…"
            disabled={isLoading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-9 h-9 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            aria-label="Send"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}

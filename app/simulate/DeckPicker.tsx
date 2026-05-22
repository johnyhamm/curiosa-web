"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DeckIndexEntry } from "@/lib/decks";

interface SearchResponse {
  results: DeckIndexEntry[];
  total: number;
}

function elementDot(el: string) {
  const colors: Record<string, string> = {
    Air:   "bg-sky-400",
    Earth: "bg-green-500",
    Fire:  "bg-red-500",
    Water: "bg-blue-500",
  };
  return colors[el] ?? "bg-gray-500";
}

interface DeckPickerProps {
  label: string;
  value: string;
  onChange: (deckId: string, deckName?: string) => void;
  accentColor: "amber" | "sky";
}

export function DeckPicker({ label, value, onChange, accentColor }: DeckPickerProps) {
  const [open, setOpen]               = useState(false);
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState<DeckIndexEntry[] | null>(null);
  const [loading, setLoading]         = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const queryRef  = useRef<HTMLInputElement>(null);

  const accent = accentColor === "amber"
    ? { ring: "focus:border-amber-500", btn: "bg-amber-500 hover:bg-amber-400 text-gray-950", dot: "bg-amber-500" }
    : { ring: "focus:border-sky-500",   btn: "bg-sky-500   hover:bg-sky-400   text-gray-950", dot: "bg-sky-500"   };

  // ── Search ──────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort_by: "views", limit: "20" });
      if (q.trim()) params.set("q", q.trim());
      const res  = await fetch(`/api/decks/search?${params}`);
      const data = (await res.json()) as SearchResponse;
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load top decks when panel first opens
  useEffect(() => {
    if (open && results === null) {
      doSearch("");
      setTimeout(() => queryRef.current?.focus(), 50);
    }
  }, [open, results, doSearch]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Select a deck ────────────────────────────────────────────────────────────
  function select(deck: DeckIndexEntry) {
    onChange(deck.id, deck.name);
    setSelectedName(deck.name);
    setOpen(false);
  }

  // ── Clear manual input tracking when user pastes a raw ID ───────────────────
  function handleRawChange(v: string) {
    setSelectedName(null);
    onChange(v);
  }

  const displayValue = value;

  return (
    <div ref={panelRef} className="flex flex-col gap-1 relative">
      <label className="text-sm font-medium text-gray-300">{label}</label>

      {/* Main input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={displayValue}
          onChange={e => handleRawChange(e.target.value)}
          placeholder="ID or https://curiosa.io/decks/..."
          className={`flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white
            placeholder-gray-500 focus:outline-none ${accent.ring} transition-colors text-sm`}
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${open
              ? "bg-gray-700 text-white"
              : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
            }`}
          title="Browse decks"
        >
          {open ? "✕ Close" : "Browse ▾"}
        </button>
      </div>

      {/* Selected name hint */}
      {selectedName && (
        <div className="text-xs text-gray-500 -mt-0.5 pl-1 truncate">
          Selected: <span className="text-gray-300">{selectedName}</span>
        </div>
      )}

      {/* Search panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-900 border border-gray-700
          rounded-xl shadow-2xl shadow-black/60 overflow-hidden">

          {/* Search bar */}
          <div className="flex gap-2 p-3 border-b border-gray-800">
            <input
              ref={queryRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch(query)}
              placeholder="Search by name or avatar…"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white
                placeholder-gray-500 focus:outline-none focus:border-gray-500 text-sm"
            />
            <button
              onClick={() => doSearch(query)}
              disabled={loading}
              className={`shrink-0 ${accent.btn} font-semibold px-4 py-2 rounded-lg text-sm
                transition-colors disabled:opacity-50`}
            >
              {loading ? "…" : "Search"}
            </button>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto">
            {loading && results === null && (
              <div className="text-center text-gray-500 text-sm py-6">Loading…</div>
            )}

            {!loading && results !== null && results.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-6">No decks found.</div>
            )}

            {results && results.map(deck => (
              <button
                key={deck.id}
                onClick={() => select(deck)}
                className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors
                  border-b border-gray-800/50 last:border-0 flex items-start gap-3"
              >
                {/* Element dots */}
                <div className="flex gap-1 mt-1 shrink-0">
                  {deck.elements.length > 0
                    ? deck.elements.slice(0, 3).map(el => (
                        <span key={el} className={`w-2 h-2 rounded-full ${elementDot(el)}`} />
                      ))
                    : <span className="w-2 h-2 rounded-full bg-gray-700" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{deck.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    @{deck.username || "unknown"}
                    {deck.avatarName && (
                      <span className="text-gray-600"> · {deck.avatarName}</span>
                    )}
                    {deck.format && (
                      <span className="text-gray-700"> · {deck.format}</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-xs text-gray-500 shrink-0 text-right">
                  <div><span className="text-pink-400">♥</span> {deck.likes.toLocaleString()}</div>
                  <div><span className="text-gray-600">↗</span> {deck.views.toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>

          {results && results.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 text-right">
              Showing top {results.length} by views
            </div>
          )}
        </div>
      )}
    </div>
  );
}

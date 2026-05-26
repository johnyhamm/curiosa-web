"use client";

import { useState, useEffect, useRef } from "react";
import type { DeckIndexEntry } from "@/lib/decks";
import type { SavedBuilderDeck } from "@/lib/builder-deck";
import { useDeckSearch } from "@/lib/deck-client-cache";

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
  /** If provided and non-empty, show a "My Decks" tab in the browse panel. */
  savedDecks?: SavedBuilderDeck[];
  /** Called when the user picks one of their own saved builder decks. */
  onBuilderDeck?: (deck: SavedBuilderDeck) => void;
}

export function DeckPicker({
  label, value, onChange, accentColor, savedDecks, onBuilderDeck,
}: DeckPickerProps) {
  const [open, setOpen]                 = useState(false);
  const [query, setQuery]               = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [panelTab, setPanelTab]         = useState<"mine" | "search">("mine");
  const panelRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  const hasSavedDecks = (savedDecks?.length ?? 0) > 0;

  const accent = accentColor === "amber"
    ? { ring: "focus:border-amber-500" }
    : { ring: "focus:border-sky-500" };

  // Client-side search — instant once the index is loaded (no round-trips).
  const { results, isLoading, isLiveFallback } = useDeckSearch(query, "", "views", 20);

  // When panel opens, default to "mine" if saved decks are available.
  useEffect(() => {
    if (open) setPanelTab(hasSavedDecks ? "mine" : "search");
  }, [open, hasSavedDecks]);

  // Focus search input when switching to the search tab.
  useEffect(() => {
    if (open && panelTab === "search") setTimeout(() => queryRef.current?.focus(), 50);
  }, [open, panelTab]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function select(deck: DeckIndexEntry) {
    onChange(deck.id, deck.name);
    setSelectedName(deck.name);
    setOpen(false);
    setQuery("");
  }

  function selectBuilderDeck(deck: SavedBuilderDeck) {
    // Signal parent with a "builder:" prefix so it knows not to treat this as
    // a curiosa.io ID. The parent's onBuilderDeck handler will load the override.
    onChange("builder:" + deck.id, deck.name);
    onBuilderDeck?.(deck);
    setSelectedName("My Deck: " + deck.name);
    setOpen(false);
  }

  function handleRawChange(v: string) {
    setSelectedName(null);
    onChange(v);
  }

  // Don't render the raw ID in the text input when a builder deck is active.
  const displayValue = value.startsWith("builder:") ? "" : value;

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
          className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            open
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

      {/* Browse panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-900 border border-gray-700
          rounded-xl shadow-2xl shadow-black/60 overflow-hidden">

          {/* Tabs — only shown when the user has saved decks */}
          {hasSavedDecks && (
            <div className="flex gap-1 p-2 border-b border-gray-800 bg-gray-950/40">
              <button
                type="button"
                onClick={() => setPanelTab("mine")}
                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  panelTab === "mine"
                    ? "bg-amber-500 text-gray-950"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                My Decks
              </button>
              <button
                type="button"
                onClick={() => setPanelTab("search")}
                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  panelTab === "search"
                    ? "bg-amber-500 text-gray-950"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Curiosa.io
              </button>
            </div>
          )}

          {/* My Decks list */}
          {hasSavedDecks && panelTab === "mine" ? (
            <div className="max-h-72 overflow-y-auto">
              {savedDecks!.map(deck => {
                const cardCount = deck.e.reduce((s, e) => s + e[1], 0);
                return (
                  <button
                    key={deck.id}
                    onClick={() => selectBuilderDeck(deck)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors
                      border-b border-gray-800/50 last:border-0"
                  >
                    <div className="text-sm font-medium text-white">{deck.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {deck.av ? `Avatar: ${deck.av}` : "No avatar"}
                      <span className="ml-2 text-gray-600">{cardCount} cards</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Curiosa.io search */
            <>
              {/* Filter bar */}
              <div className="flex items-center gap-2 p-3 border-b border-gray-800">
                <input
                  ref={queryRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter by name or avatar…"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white
                    placeholder-gray-500 focus:outline-none focus:border-gray-500 text-sm"
                />
                {(isLoading || isLiveFallback) && (
                  <span className="text-xs text-gray-500 shrink-0">
                    {isLiveFallback ? "Searching…" : "Loading…"}
                  </span>
                )}
              </div>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto">
                {isLoading && (
                  <div className="text-center text-gray-500 text-sm py-6">Loading deck index…</div>
                )}
                {!isLoading && results.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-6">No decks found.</div>
                )}
                {results.map(deck => (
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

              {results.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 text-right">
                  {isLiveFallback
                    ? "Searching all decks…"
                    : query
                      ? `${results.length} matching`
                      : `Top ${results.length} by views`}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

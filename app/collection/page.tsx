"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Card } from "@/lib/cards";
import type { CollectionMap } from "@/lib/collection";
import { useAuthSafe } from "@/lib/useAuthSafe";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "mine" | "browse";

const ELEMENTS = ["Water", "Earth", "Fire", "Air"];
const TYPES    = ["Minion", "Magic", "Artifact", "Aura", "Site", "Avatar"];

// ─── Quantity control ─────────────────────────────────────────────────────────

function QtyControl({
  qty,
  onChange,
  disabled,
}: {
  qty: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, qty - 1))}
        disabled={disabled || qty === 0}
        className="w-7 h-7 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-base font-bold transition-colors flex items-center justify-center"
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-mono font-semibold text-white tabular-nums">
        {qty}
      </span>
      <button
        onClick={() => onChange(qty + 1)}
        disabled={disabled}
        className="w-7 h-7 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-base font-bold transition-colors flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

// ─── Card row ─────────────────────────────────────────────────────────────────

function CollectionCardRow({
  card,
  qty,
  onQtyChange,
}: {
  card: Card;
  qty: number;
  onQtyChange: (name: string, qty: number) => void;
}) {
  const elements = card.elements
    ? card.elements.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const elementColor: Record<string, string> = {
    Water: "text-sky-400",
    Earth: "text-yellow-600",
    Fire:  "text-orange-400",
    Air:   "text-violet-400",
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors ${qty > 0 ? "bg-amber-950/10" : ""}`}>
      {/* Card name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white truncate">{card.name}</span>
          {qty > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold">
              ×{qty}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500">{card.guardian.type}</span>
          {card.guardian.rarity && (
            <span className="text-xs text-gray-600">· {card.guardian.rarity}</span>
          )}
          {elements.map((el) => (
            <span key={el} className={`text-xs font-medium ${elementColor[el] ?? "text-gray-400"}`}>
              {el}
            </span>
          ))}
        </div>
      </div>

      {/* Quantity control */}
      <QtyControl qty={qty} onChange={(n) => onQtyChange(card.name, n)} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const { isSignedIn, isLoaded } = useAuthSafe();

  const [tab, setTab]               = useState<Tab>("mine");
  const [collection, setCollection] = useState<CollectionMap>({});
  const [colLoading, setColLoading] = useState(true);

  // Browse tab
  const [query, setQuery]           = useState("");
  const [elementFilter, setElementFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [results, setResults]       = useState<Card[]>([]);
  const [searching, setSearching]   = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimistic qty update debounce
  const saveTimer = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Load collection ──────────────────────────────────────────────────────

  const loadCollection = useCallback(async () => {
    setColLoading(true);
    try {
      const res = await fetch("/api/collection");
      if (res.ok) {
        const data = (await res.json()) as { collection: CollectionMap };
        setCollection(data.collection);
      }
    } catch { /* ignore */ }
    finally { setColLoading(false); }
  }, []);

  useEffect(() => {
    if (isSignedIn) loadCollection();
    else setColLoading(false);
  }, [isSignedIn, loadCollection]);

  // ── Quantity change (optimistic + debounced save) ─────────────────────────

  const handleQtyChange = useCallback((cardName: string, newQty: number) => {
    const key = cardName.trim().toLowerCase();

    // Optimistic update
    setCollection((prev) => {
      const next = { ...prev };
      if (newQty <= 0) {
        delete next[key];
      } else {
        next[key] = {
          cardName: key,
          qty: newQty,
          foilQty: prev[key]?.foilQty ?? 0,
          updatedAt: new Date().toISOString(),
        };
      }
      return next;
    });

    // Debounced API call — groups rapid +/- clicks into one request
    const existing = saveTimer.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      saveTimer.current.delete(key);
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardName, qty: newQty }),
      });
    }, 600);
    saveTimer.current.set(key, t);
  }, []);

  // ── Card search (browse tab) ──────────────────────────────────────────────

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query && !elementFilter && !typeFilter) { setResults([]); return; }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const p = new URLSearchParams({ limit: "60" });
        if (query)         p.set("q", query);
        if (elementFilter) p.set("element", elementFilter);
        if (typeFilter)    p.set("type", typeFilter);
        const res = await fetch(`/api/cards/search?${p}`);
        if (res.ok) setResults((await res.json()) as Card[]);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, elementFilter, typeFilter]);

  // ── Owned cards (mine tab) ────────────────────────────────────────────────

  const ownedEntries = Object.values(collection).filter((e) => e.qty > 0);
  const totalCopies  = ownedEntries.reduce((s, e) => s + e.qty, 0);

  // ── Not signed in ────────────────────────────────────────────────────────

  if (isLoaded && !isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-amber-400 mb-4" style={{ fontFamily: "var(--font-cinzel)" }}>
          My Collection
        </h1>
        <p className="text-gray-400 mb-6">Sign in to track your Sorcery card collection.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>
        My Collection
      </h1>
      <p className="text-gray-400 text-sm mb-6">
        Track the cards you own. Use the toggle in the Deck Builder to filter by your collection.
      </p>

      {/* Stats bar */}
      {!colLoading && (
        <div className="flex gap-6 mb-6 text-sm">
          <div>
            <span className="text-2xl font-bold text-amber-400">{ownedEntries.length}</span>
            <span className="text-gray-500 ml-1.5">unique cards</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-amber-400">{totalCopies}</span>
            <span className="text-gray-500 ml-1.5">total copies</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {(["mine", "browse"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-amber-500 text-gray-950"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "mine" ? "My Collection" : "Browse & Add"}
          </button>
        ))}
      </div>

      {/* ── MY COLLECTION TAB ── */}
      {tab === "mine" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {colLoading ? (
            <div className="py-12 text-center text-gray-600 text-sm">Loading…</div>
          ) : ownedEntries.length === 0 ? (
            <div className="py-16 text-center text-gray-600 text-sm">
              No cards yet — switch to <span className="text-amber-400">Browse & Add</span> to find cards.
            </div>
          ) : (
            <div>
              {ownedEntries
                .sort((a, b) => a.cardName.localeCompare(b.cardName))
                .map((entry) => (
                  <div
                    key={entry.cardName}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors bg-amber-950/10"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white capitalize">{entry.cardName}</span>
                        <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold">
                          ×{entry.qty}
                        </span>
                      </div>
                    </div>
                    <QtyControl
                      qty={entry.qty}
                      onChange={(n) => handleQtyChange(entry.cardName, n)}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── BROWSE & ADD TAB ── */}
      {tab === "browse" && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
            <input
              type="text"
              placeholder="Search card name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2 flex-wrap">
              <select
                value={elementFilter}
                onChange={(e) => setElementFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
              >
                <option value="">All Elements</option>
                {ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
              >
                <option value="">All Types</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {!query && !elementFilter && !typeFilter ? (
              <div className="py-12 text-center text-gray-600 text-sm">
                Search or filter to find cards to add.
              </div>
            ) : searching ? (
              <div className="py-12 text-center text-gray-600 text-sm">Searching…</div>
            ) : results.length === 0 ? (
              <div className="py-12 text-center text-gray-600 text-sm">No cards found.</div>
            ) : (
              results.map((card) => (
                <CollectionCardRow
                  key={card.name}
                  card={card}
                  qty={collection[card.name.trim().toLowerCase()]?.qty ?? 0}
                  onQtyChange={handleQtyChange}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

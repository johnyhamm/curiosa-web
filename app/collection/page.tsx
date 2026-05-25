"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Card } from "@/lib/cards";
import type { CollectionMap } from "@/lib/collection";
import { cardImageUrl } from "@/lib/card-images";
import { useAuthSafe } from "@/lib/useAuthSafe";

// ─── Constants ────────────────────────────────────────────────────────────────

// Card display width in the grid
const CARD_W = 150;
// Portrait card height  (63:88 ratio)
const CARD_H = Math.round(CARD_W * (88 / 63));          // ≈ 210
// Site card — displayed landscape (88:63), so container height = CARD_W * (63/88)
const SITE_H = Math.round(CARD_W * (63 / 88));          // ≈ 107
// The portrait CSS element that gets rotated inside the site container
// It must have the same ratio as the source image (portrait 63:88).
// Its dimensions are SITE_H × CARD_W  (swapped, so rotate(90°) yields CARD_W × SITE_H)
const SITE_INNER_W = SITE_H;  // = 107  (width of the inner portrait element)
const SITE_INNER_H = CARD_W;  // = 150  (height of the inner portrait element)

const ELEMENTS = ["Water", "Earth", "Fire", "Air"];
const TYPES    = ["Minion", "Magic", "Artifact", "Aura", "Site", "Avatar"];

// ─── Card image component ─────────────────────────────────────────────────────

function CardImage({ card }: { card: Card }) {
  const imgUrl  = cardImageUrl(card.name);
  const isSite  = card.guardian.type === "Site";
  const [failed, setFailed] = useState(false);

  if (!imgUrl || failed) {
    // Fallback placeholder
    return (
      <div
        className="bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs text-center px-2"
        style={{ width: CARD_W, height: isSite ? SITE_H : CARD_H }}
      >
        No image
      </div>
    );
  }

  if (isSite) {
    /**
     * Site cards are landscape in play but source images are portrait (63:88).
     * To render correctly at CARD_W × SITE_H (landscape):
     *  1. Outer container: CARD_W wide, SITE_H tall, overflow:hidden
     *  2. Inner img:  SITE_INNER_W × SITE_INNER_H (portrait, same 63:88 ratio)
     *     centred then rotated 90° clockwise — this swaps the dimensions visually
     *     so it appears as CARD_W × SITE_H landscape without any clipping.
     */
    return (
      <div
        className="relative overflow-hidden rounded-lg shadow-md shadow-black/40"
        style={{ width: CARD_W, height: SITE_H }}
      >
        <img
          src={imgUrl}
          alt={card.name}
          onError={() => setFailed(true)}
          loading="lazy"
          style={{
            position:   "absolute",
            left:       "50%",
            top:        "50%",
            width:      SITE_INNER_W,
            height:     SITE_INNER_H,
            maxWidth:   "none",
            objectFit:  "cover",
            transform:  `translate(${-SITE_INNER_W / 2}px, ${-SITE_INNER_H / 2}px) rotate(90deg)`,
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt={card.name}
      onError={() => setFailed(true)}
      loading="lazy"
      className="rounded-lg shadow-md shadow-black/40 block"
      style={{ width: CARD_W, height: CARD_H, objectFit: "cover" }}
    />
  );
}

// ─── Collection card tile ─────────────────────────────────────────────────────

function CollectionCardTile({
  card,
  qty,
  onQtyChange,
}: {
  card: Card;
  qty: number;
  onQtyChange: (name: string, qty: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Image with qty badge overlay */}
      <div className="relative" style={{ width: CARD_W }}>
        <CardImage card={card} />
        {qty > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-amber-500 text-gray-950 text-xs font-black px-1.5 py-0.5 rounded-full shadow-lg leading-none">
            ×{qty}
          </div>
        )}
      </div>

      {/* Name */}
      <div
        className="text-xs text-gray-300 font-medium leading-tight text-center"
        style={{ width: CARD_W, maxWidth: CARD_W }}
        title={card.name}
      >
        <span className="line-clamp-2">{card.name}</span>
      </div>

      {/* Qty controls */}
      <div className="flex items-center justify-center gap-1.5">
        <button
          onClick={() => onQtyChange(card.name, Math.max(0, qty - 1))}
          disabled={qty === 0}
          className="w-7 h-7 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white font-bold transition-colors flex items-center justify-center text-base"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-mono font-semibold text-white tabular-nums">
          {qty}
        </span>
        <button
          onClick={() => onQtyChange(card.name, qty + 1)}
          className="w-7 h-7 rounded-md bg-gray-800 hover:bg-gray-700 text-white font-bold transition-colors flex items-center justify-center text-base"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Card grid ────────────────────────────────────────────────────────────────

function CardGrid({
  cards,
  collection,
  onQtyChange,
}: {
  cards: Card[];
  collection: CollectionMap;
  onQtyChange: (name: string, qty: number) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-4">
      {cards.map((card) => (
        <CollectionCardTile
          key={card.name}
          card={card}
          qty={collection[card.name.trim().toLowerCase()]?.qty ?? 0}
          onQtyChange={onQtyChange}
        />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "mine" | "browse";

export default function CollectionPage() {
  const { isSignedIn, isLoaded } = useAuthSafe();

  const [tab, setTab]               = useState<Tab>("mine");
  const [collection, setCollection] = useState<CollectionMap>({});
  const [colLoading, setColLoading] = useState(true);

  // Cards loaded for "My Collection" tab
  const [ownedCards, setOwnedCards]         = useState<Card[]>([]);
  const [ownedLoading, setOwnedLoading]     = useState(false);

  // Browse tab
  const [query, setQuery]                   = useState("");
  const [elementFilter, setElementFilter]   = useState("");
  const [typeFilter, setTypeFilter]         = useState("");
  const [results, setResults]               = useState<Card[]>([]);
  const [searching, setSearching]           = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save map
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
    else            setColLoading(false);
  }, [isSignedIn, loadCollection]);

  // ── Load card objects for owned cards ───────────────────────────────────

  useEffect(() => {
    const owned = Object.values(collection).filter((e) => e.qty > 0);
    if (owned.length === 0) { setOwnedCards([]); return; }

    setOwnedLoading(true);
    const names = owned.map((e) => e.cardName).join(",");
    fetch(`/api/cards/batch?names=${encodeURIComponent(names)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((cards) => setOwnedCards((cards as Card[]).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setOwnedCards([]))
      .finally(() => setOwnedLoading(false));
  }, [collection]);

  // ── Quantity change (optimistic + debounced save) ─────────────────────────

  const handleQtyChange = useCallback((cardName: string, newQty: number) => {
    const key = cardName.trim().toLowerCase();

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
        const p = new URLSearchParams({ limit: "80" });
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

  // ── Stats ────────────────────────────────────────────────────────────────

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>
        My Collection
      </h1>
      <p className="text-gray-400 text-sm mb-6">
        Track the cards you own. The Deck Builder can filter by your collection.
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
      <div className="flex gap-1 mb-8 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
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
        <>
          {colLoading || ownedLoading ? (
            <div className="py-16 text-center text-gray-600 text-sm">Loading…</div>
          ) : ownedCards.length === 0 ? (
            <div className="py-16 text-center text-gray-600 text-sm">
              No cards yet —{" "}
              <button onClick={() => setTab("browse")} className="text-amber-400 hover:underline">
                Browse & Add
              </button>{" "}
              to find cards.
            </div>
          ) : (
            <CardGrid
              cards={ownedCards}
              collection={collection}
              onQtyChange={handleQtyChange}
            />
          )}
        </>
      )}

      {/* ── BROWSE & ADD TAB ── */}
      {tab === "browse" && (
        <div className="flex flex-col gap-6">
          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search card name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <select
              value={elementFilter}
              onChange={(e) => setElementFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Elements</option>
              {ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Types</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Results */}
          {!query && !elementFilter && !typeFilter ? (
            <div className="py-12 text-center text-gray-600 text-sm">
              Search or filter to find cards to add to your collection.
            </div>
          ) : searching ? (
            <div className="py-12 text-center text-gray-600 text-sm">Searching…</div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-gray-600 text-sm">No cards found.</div>
          ) : (
            <CardGrid
              cards={results}
              collection={collection}
              onQtyChange={handleQtyChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Card } from "@/lib/cards";
import { cardImageUrl } from "@/lib/card-images";

const ELEMENTS = ["", "air", "earth", "fire", "water"] as const;
const TYPES = ["", "Minion", "Magic", "Artifact", "Aura", "Site"] as const;
const RARITIES = ["", "Common", "Uncommon", "Rare", "Exceptional", "Elite", "Unique"] as const;

function elementColor(el: string | null | undefined): string {
  if (!el) return "text-gray-400";
  switch (el.toLowerCase()) {
    case "air":   return "text-sky-400";
    case "earth": return "text-green-400";
    case "fire":  return "text-red-400";
    case "water": return "text-blue-400";
    default:      return "text-gray-400";
  }
}

function rarityColor(rarity: string | null | undefined): string {
  if (!rarity) return "text-gray-400";
  switch (rarity.toLowerCase()) {
    case "unique":      return "text-amber-300";
    case "elite":       return "text-purple-300";
    case "exceptional": return "text-pink-300";
    case "rare":        return "text-blue-300";
    case "uncommon":    return "text-green-300";
    default:            return "text-gray-400";
  }
}

function CardCard({ card }: { card: Card }) {
  const g = card.guardian;
  const imgUrl = cardImageUrl(card.name);
  const isSite = g.type === "Site";
  const thresholds = Object.entries(g.thresholds ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k ? k[0].toUpperCase() : "?"}${v}`)
    .join(" ");

  return (
    <div className="grid gap-4 items-start" style={{ gridTemplateColumns: `minmax(0, 1fr) ${isSite && imgUrl ? "280px" : "200px"}` }}>

      {/* ── Card details ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2 hover:border-gray-700 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-white text-lg leading-tight">{card.name}</h3>
          <span className={`text-xs font-semibold shrink-0 ${rarityColor(g.rarity)}`}>
            {g.rarity}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-gray-800 rounded px-2 py-0.5 text-gray-300">{g.type}</span>
          {card.subTypes && (
            <span className="bg-gray-800 rounded px-2 py-0.5 text-gray-400">{card.subTypes}</span>
          )}
          {card.elements && (
            <span className={`bg-gray-800 rounded px-2 py-0.5 font-medium ${elementColor(card.elements)}`}>
              {card.elements}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          {g.cost != null && (
            <span>Cost: <span className="text-white font-medium">{g.cost}</span></span>
          )}
          {thresholds && (
            <span>Thresh: <span className="text-amber-400 font-medium font-mono text-xs">{thresholds}</span></span>
          )}
          {(g.attack != null || g.defence != null) && (
            <span>
              ATK <span className="text-red-400 font-medium">{g.attack ?? "—"}</span>
              {" / "}
              DEF <span className="text-blue-400 font-medium">{g.defence ?? "—"}</span>
              {g.life != null && (
                <> / LIFE <span className="text-green-400 font-medium">{g.life}</span></>
              )}
            </span>
          )}
        </div>

        {g.rulesText && (
          <p className="text-gray-400 text-sm leading-relaxed border-t border-gray-800 pt-2 mt-1 whitespace-pre-wrap">
            {g.rulesText}
          </p>
        )}

        <div className="text-xs text-gray-600 mt-auto pt-1">
          Sets: {card.sets.map((s) => s.name).join(", ")}
        </div>
      </div>

      {/* ── Card image — separate container ── */}
      {imgUrl && (
        <div className="w-full">
          {isSite ? (
            // Site cards are landscape — column is 280px wide.
            // Source images are portrait (63:88). To display landscape at 280×200:
            //   CSS element must also be portrait (200×280) so objectFit:cover
            //   fills without clipping, then rotate(90°) swaps it to 280×200 visually.
            <div
              className="relative overflow-hidden rounded-lg shadow-lg shadow-black/50 w-full"
              style={{ height: "200px" }}
            >
              <img
                src={imgUrl}
                alt={card.name}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "200px",
                  height: "280px",
                  maxWidth: "none",
                  objectFit: "cover",
                  objectPosition: "center",
                  transform: "translate(-100px, -140px) rotate(90deg)",
                }}
                loading="lazy"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
              />
            </div>
          ) : (
            <img
              src={imgUrl}
              alt={card.name}
              className="w-full h-auto rounded-lg shadow-lg shadow-black/50 block"
              loading="lazy"
              onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
            />
          )}
        </div>
      )}

    </div>
  );
}

function CardsPageContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [element, setElement] = useState("");
  const [type, setType] = useState("");
  const [rarity, setRarity] = useState("");
  const [results, setResults] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query)   params.set("q", query);
      if (element) params.set("element", element);
      if (type)    params.set("type", type);
      if (rarity)  params.set("rarity", rarity);
      params.set("limit", "50");

      const res = await fetch(`/api/cards/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Card[];
      setResults(data);
      setTotal(data.length);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query, element, type, rarity]);

  // Auto-search when arriving from the home page search bar
  useEffect(() => {
    if (initialQ) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2">Card Search</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Search all Sorcery: Contested Realm cards.
      </p>

      {/* Search controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8 flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search name, rules text, flavor text..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            onClick={search}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-semibold px-6 py-2.5 rounded-lg transition-colors shrink-0"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={element}
            onChange={(e) => setElement(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-sm"
          >
            <option value="">All Elements</option>
            {ELEMENTS.slice(1).map((el) => (
              <option key={el} value={el}>
                {el.charAt(0).toUpperCase() + el.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-sm"
          >
            <option value="">All Types</option>
            {TYPES.slice(1).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-sm"
          >
            <option value="">All Rarities</option>
            {RARITIES.slice(1).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <>
          <p className="text-gray-500 text-sm mb-4">
            {total === 0
              ? "No cards found."
              : `Showing ${results.length} card${results.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex flex-col gap-4 max-w-2xl">
            {results.map((card) => (
              <CardCard key={card.name} card={card} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {results === null && !loading && (
        <div className="text-center py-20 text-gray-600">
          Enter a search query above and press Search.
        </div>
      )}
    </div>
  );
}

export default function CardsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-10 text-gray-500">Loading…</div>}>
      <CardsPageContent />
    </Suspense>
  );
}

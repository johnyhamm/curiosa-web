"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Card } from "@/lib/cards";
import { cardImageUrl } from "@/lib/card-images";

// ─── Filter constants (matching collection page) ──────────────────────────────

const ELEMENTS = ["Water", "Earth", "Fire", "Air"];
const TYPES    = ["Avatar", "Site", "Minion", "Magic", "Artifact", "Aura"];
const RARITIES = ["Ordinary", "Exceptional", "Elite", "Unique"];
const SETS     = ["Alpha", "Beta", "Arthurian Legends", "Dragonlord", "Gothic", "Promotional"];
const SORTS    = [
  { value: "name-asc",    label: "Name A→Z" },
  { value: "name-desc",   label: "Name Z→A" },
  { value: "cost-asc",    label: "Cost ↑" },
  { value: "cost-desc",   label: "Cost ↓" },
  { value: "rarity-asc",  label: "Rarity ↑" },
  { value: "rarity-desc", label: "Rarity ↓" },
];

const EL_COLOUR: Record<string, string> = {
  Water: "bg-sky-900/50 text-sky-400 border-sky-700/40",
  Earth: "bg-yellow-900/40 text-yellow-500 border-yellow-700/40",
  Fire:  "bg-orange-900/40 text-orange-400 border-orange-700/40",
  Air:   "bg-violet-900/40 text-violet-400 border-violet-700/40",
};

// ─── Chip toggle ──────────────────────────────────────────────────────────────

function Chip({ label, active, colour, onClick }: {
  label: string; active: boolean; colour?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? colour ?? "bg-amber-500/20 text-amber-400 border-amber-500/50"
          : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Card result display ──────────────────────────────────────────────────────

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
    <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(0, 1fr) 200px" }}>

      {/* Card details */}
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

      {/* Card image */}
      {imgUrl && (
        <div className="w-full">
          {isSite ? (
            <div
              className="relative overflow-hidden rounded-lg shadow-lg shadow-black/50 w-full"
              style={{ height: "143px" }}
            >
              <img
                src={imgUrl}
                alt={card.name}
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  width: "143px", height: "200px",
                  maxWidth: "none",
                  objectFit: "cover",
                  objectPosition: "center",
                  transform: "translate(-71.5px, -100px) rotate(90deg)",
                }}
                loading="lazy"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
              />
            </div>
          ) : (
            <img
              src={imgUrl}
              alt={card.name}
              className="h-auto rounded-lg shadow-lg shadow-black/50 block"
              style={{ width: "200px" }}
              loading="lazy"
              onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function CardsPageContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query,    setQuery]    = useState(initialQ);
  const [elements, setElements] = useState<string[]>([]);
  const [types,    setTypes]    = useState<string[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [set,      setSet]      = useState("");
  const [sort,     setSort]     = useState("name-asc");

  const [results,  setResults]  = useState<Card[] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [total,    setTotal]    = useState<number | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search ────────────────────────────────────────────────────────────────

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (query)               p.set("q", query);
      if (elements.length === 1) p.set("element", elements[0]);
      if (types.length === 1)    p.set("type", types[0]);
      if (rarities.length === 1) p.set("rarity", rarities[0]);
      if (set)                 p.set("set", set);
      p.set("sort", sort);
      p.set("limit", "50");

      const res = await fetch(`/api/cards/search?${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: Card[]; total: number };

      // Client-side multi-select filtering
      let cards = data.results;
      if (elements.length > 1)
        cards = cards.filter((c) =>
          elements.every((el) => c.elements.toLowerCase().includes(el.toLowerCase()))
        );
      if (types.length > 1)
        cards = cards.filter((c) =>
          types.some((t) => c.guardian.type.toLowerCase().includes(t.toLowerCase()))
        );
      if (rarities.length > 1)
        cards = cards.filter((c) =>
          rarities.some((r) => (c.guardian.rarity ?? "").toLowerCase() === r.toLowerCase())
        );

      setResults(cards);
      setTotal(data.total);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query, elements, types, rarities, set, sort]);

  // Auto-search when arriving with a query param
  useEffect(() => {
    if (initialQ) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search when chips / sort change (only after first search)
  useEffect(() => {
    if (results === null) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(search, 0);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, types, rarities, set, sort]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") search(); };

  // ── Toggle helpers ────────────────────────────────────────────────────────

  const toggleEl      = (el: string) => setElements((p) => p.includes(el) ? p.filter((x) => x !== el) : [...p, el]);
  const toggleType    = (t: string)  => setTypes   ((p) => p.includes(t)  ? p.filter((x) => x !== t)  : [...p, t]);
  const toggleRarity  = (r: string)  => setRarities((p) => p.includes(r)  ? p.filter((x) => x !== r)  : [...p, r]);

  const hasFilters = elements.length > 0 || types.length > 0 || rarities.length > 0 || !!set;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>
        Card Search
      </h1>
      <p className="text-gray-400 mb-8 text-sm">
        Search all Sorcery: Contested Realm cards.
      </p>

      {/* ── Search controls ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8 flex flex-col gap-4">

        {/* Text + sort + button */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search name, rules text, flavor text…"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            onClick={search}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-semibold px-6 py-2.5 rounded-lg transition-colors shrink-0"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Element chips */}
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Element</div>
          <div className="flex flex-wrap gap-2">
            {ELEMENTS.map((el) => (
              <Chip key={el} label={el} active={elements.includes(el)} colour={EL_COLOUR[el]} onClick={() => toggleEl(el)} />
            ))}
          </div>
        </div>

        {/* Type chips */}
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Type</div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip key={t} label={t} active={types.includes(t)} onClick={() => toggleType(t)} />
            ))}
          </div>
        </div>

        {/* Rarity chips */}
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Rarity</div>
          <div className="flex flex-wrap gap-2">
            {RARITIES.map((r) => (
              <Chip
                key={r}
                label={r}
                active={rarities.includes(r)}
                colour={`bg-gray-800 border ${
                  r === "Unique"      ? "text-amber-400 border-amber-500/50 bg-amber-500/10" :
                  r === "Elite"       ? "text-sky-400 border-sky-500/50 bg-sky-500/10" :
                  r === "Exceptional" ? "text-green-400 border-green-500/50 bg-green-500/10" :
                  "text-gray-300 border-gray-500"
                }`}
                onClick={() => toggleRarity(r)}
              />
            ))}
          </div>
        </div>

        {/* Set chips */}
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Set</div>
          <div className="flex flex-wrap gap-2">
            {SETS.map((s) => (
              <Chip key={s} label={s} active={set === s} onClick={() => setSet((prev) => prev === s ? "" : s)} />
            ))}
          </div>
        </div>

        {/* Active filter summary + clear */}
        {hasFilters && (
          <div className="flex items-center justify-between border-t border-gray-800 pt-3">
            <span className="text-xs text-gray-500">
              {total !== null ? `${total} card${total !== 1 ? "s" : ""} match` : "Filters active"}
            </span>
            <button
              onClick={() => { setElements([]); setTypes([]); setRarities([]); setSet(""); }}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
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
            {results.length === 0
              ? "No cards found."
              : `Showing ${results.length} card${results.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex flex-col gap-4 max-w-3xl">
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

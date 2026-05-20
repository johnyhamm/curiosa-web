"use client";

import { useState, useCallback } from "react";
import type { DeckIndexEntry } from "@/lib/decks";
import type { ApiDeckCard } from "@/lib/simulator";

interface DeckApiResponse {
  total: number;
  totalIndexed: number | null;
  results: DeckIndexEntry[];
  source: "index" | "live";
  message?: string;
}

interface FullDeckData {
  decklist: ApiDeckCard[];
  avatar: ApiDeckCard | null;
  meta: {
    name?: string;
    format?: string;
    user?: { username?: string };
    _count?: { likes?: number; views?: number };
  } | null;
}

function elementBadge(el: string) {
  const colors: Record<string, string> = {
    Air: "bg-sky-900/50 text-sky-300",
    Earth: "bg-green-900/50 text-green-300",
    Fire: "bg-red-900/50 text-red-300",
    Water: "bg-blue-900/50 text-blue-300",
  };
  return colors[el] ?? "bg-gray-800 text-gray-400";
}

function DeckRow({
  deck,
  onExpand,
  expanded,
  fullData,
  loadingId,
}: {
  deck: DeckIndexEntry;
  onExpand: (id: string) => void;
  expanded: boolean;
  fullData: FullDeckData | null;
  loadingId: string | null;
}) {
  const isLoading = loadingId === deck.id;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors">
      <div
        className="p-4 cursor-pointer"
        onClick={() => onExpand(deck.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onExpand(deck.id)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base leading-tight">{deck.name}</h3>
              {deck.format && (
                <span className="text-xs bg-gray-800 text-gray-400 rounded px-2 py-0.5">
                  {deck.format}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              by @{deck.username || "unknown"}
              {deck.avatarName && (
                <span className="text-gray-600"> · Avatar: <span className="text-gray-400">{deck.avatarName}</span></span>
              )}
            </div>
            {deck.elements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {deck.elements.map((el) => (
                  <span key={el} className={`text-xs rounded px-1.5 py-0.5 ${elementBadge(el)}`}>
                    {el}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm text-gray-400">
              <span className="text-pink-400">♥</span> {deck.likes.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              <span className="text-gray-500">👁</span> {deck.views.toLocaleString()}
            </div>
            <a
              href={`https://curiosa.io/decks/${deck.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-500 hover:text-amber-400 mt-1 inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              curiosa.io ↗
            </a>
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-600">
          {expanded ? "▲ Collapse" : "▼ Expand deck list"}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 p-4">
          {isLoading && (
            <p className="text-gray-500 text-sm">Loading deck...</p>
          )}
          {fullData && (
            <DeckList data={fullData} deckId={deck.id} />
          )}
        </div>
      )}
    </div>
  );
}

function DeckList({ data, deckId }: { data: FullDeckData; deckId: string }) {
  const { decklist, avatar, meta } = data;

  const byType = new Map<string, Array<{ name: string; qty: number; stats?: string }>>();
  for (const entry of decklist) {
    const type = (entry.card as { type?: string }).type ?? "Other";
    if (!byType.has(type)) byType.set(type, []);
    const t = entry.card as typeof entry.card & {
      attack?: number | null;
      defense?: number | null;
    };
    const stats = t.attack != null ? ` ${t.attack}/${t.defense}` : "";
    byType.get(type)!.push({ name: entry.card.name, qty: entry.quantity, stats });
  }

  const typeOrder = ["Site", "Minion", "Magic", "Artifact", "Aura"];
  const total = decklist.reduce((s, e) => s + (e.quantity ?? 1), 0);

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-semibold text-white">{meta?.name ?? "Deck"}</span>
          <span className="text-gray-500 ml-2">— {total} cards total</span>
        </div>
        <a
          href={`https://curiosa.io/decks/${deckId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-500 hover:text-amber-400 text-xs"
        >
          View on curiosa.io ↗
        </a>
      </div>

      {avatar && (
        <div className="mb-3 p-2 bg-amber-900/20 border border-amber-800/40 rounded text-amber-300">
          Avatar: {avatar.card.name}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {typeOrder.map((t) => {
          const group = byType.get(t);
          if (!group?.length) return null;
          return (
            <div key={t}>
              <div className="font-semibold text-gray-300 mb-1 text-xs uppercase tracking-wide">
                {t}s ({group.length})
              </div>
              <div className="space-y-0.5">
                {group.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-gray-400">
                    <span className="text-amber-500 font-mono w-4 text-right shrink-0">
                      {c.qty}x
                    </span>
                    <span className="flex-1">{c.name}</span>
                    {c.stats && (
                      <span className="text-gray-600 text-xs font-mono">{c.stats}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DecksPage() {
  const [query, setQuery] = useState("");
  const [avatar, setAvatar] = useState("");
  const [sortBy, setSortBy] = useState<"likes" | "views">("views");
  const [results, setResults] = useState<DeckIndexEntry[] | null>(null);
  const [apiResponse, setApiResponse] = useState<DeckApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deckData, setDeckData] = useState<Record<string, FullDeckData>>({});
  const [loadingDeckId, setLoadingDeckId] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query)  params.set("q", query);
      if (avatar) params.set("avatar", avatar);
      params.set("sort_by", sortBy);
      params.set("limit", "30");

      const res = await fetch(`/api/decks/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DeckApiResponse;
      setApiResponse(data);
      setResults(data.results);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query, avatar, sortBy]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  const handleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (deckData[id]) return;

    setLoadingDeckId(id);
    try {
      const res = await fetch(`/api/decks/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FullDeckData;
      setDeckData((prev) => ({ ...prev, [id]: data }));
    } catch (e) {
      console.error("Failed to load deck:", e);
    } finally {
      setLoadingDeckId(null);
    }
  }, [expandedId, deckData]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2">Deck Browser</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Browse 16,000+ public decks from curiosa.io. The first search triggers a background index build if not yet cached.
      </p>

      {/* Search controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8 flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search deck name..."
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

        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Avatar filter (e.g. Necromancer)..."
            className="flex-1 min-w-40 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
          />

          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setSortBy("views")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                sortBy === "views"
                  ? "bg-amber-500 text-gray-950"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Most Viewed
            </button>
            <button
              onClick={() => setSortBy("likes")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                sortBy === "likes"
                  ? "bg-amber-500 text-gray-950"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Most Liked
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Index status message */}
      {apiResponse?.message && (
        <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-3 mb-6 text-blue-300 text-sm">
          {apiResponse.message}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <>
          <p className="text-gray-500 text-sm mb-4">
            {results.length === 0
              ? "No decks found."
              : `Showing ${results.length} deck${results.length !== 1 ? "s" : ""}${
                  apiResponse?.totalIndexed
                    ? ` of ${apiResponse.total.toLocaleString()} matching (${apiResponse.totalIndexed.toLocaleString()} total indexed)`
                    : ` of ${apiResponse?.total ?? results.length}`
                }`}
          </p>
          <div className="flex flex-col gap-3">
            {results.map((deck) => (
              <DeckRow
                key={deck.id}
                deck={deck}
                onExpand={handleExpand}
                expanded={expandedId === deck.id}
                fullData={deckData[deck.id] ?? null}
                loadingId={loadingDeckId}
              />
            ))}
          </div>
        </>
      )}

      {results === null && !loading && (
        <div className="text-center py-20 text-gray-600">
          Enter a search query above and press Search.
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthSafe } from "@/lib/useAuthSafe";
import { useDeckSearch } from "@/lib/deck-client-cache";
import type { DeckIndexEntry } from "@/lib/decks";
import type { ApiDeckCard } from "@/lib/simulator";
import type { SavedBuilderDeck } from "@/lib/builder-deck";

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
  isFavorited,
  onToggleFavorite,
}: {
  deck: DeckIndexEntry;
  onExpand: (id: string) => void;
  expanded: boolean;
  fullData: FullDeckData | null;
  loadingId: string | null;
  isFavorited: boolean;
  onToggleFavorite: (deck: DeckIndexEntry) => void;
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
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <div className="text-sm text-gray-400">
              <span className="text-pink-400">♥</span> {deck.likes.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              <span className="text-gray-500">👁</span> {deck.views.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(deck); }}
                title={isFavorited ? "Remove from saved" : "Save deck"}
                className={`text-xl leading-none transition-all duration-150 active:scale-125 ${
                  isFavorited
                    ? "text-amber-400 scale-110"
                    : "text-gray-600 hover:text-amber-400"
                }`}
              >
                {isFavorited ? "★" : "☆"}
              </button>
              <a
                href={`https://curiosa.io/decks/${deck.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-500 hover:text-amber-400"
                onClick={(e) => e.stopPropagation()}
              >
                curiosa.io ↗
              </a>
            </div>
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-600">
          {expanded ? "▲ Collapse" : "▼ Expand deck list"}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 p-4">
          {isLoading && (
            <p className="text-gray-500 text-sm">Loading deck…</p>
          )}
          {fullData && (
            <DeckList data={fullData} deckId={deck.id} />
          )}
        </div>
      )}
    </div>
  );
}

// Core URL builder — accepts any list of {name, qty} pairs.
function tcgplayerMassEntryUrl(cards: { name: string; qty: number }[]): string {
  const cardStr =
    cards
      .filter((c) => c.qty > 0)
      .map((c) => `${c.qty}+${c.name.replace(/ /g, "+")}`)
      .join("||") + "||";

  const massEntryUrl =
    "https://www.tcgplayer.com/massentry" +
    "?productline=Sorcery+Contested+Realm" +
    "&c=" +
    cardStr;

  return (
    "https://partner.tcgplayer.com/c/7336784/1780961/21018" +
    "?u=" +
    encodeURIComponent(massEntryUrl)
  );
}

// For curiosa.io decks (ApiDeckCard[] + optional avatar)
function buildTCGplayerUrl(decklist: ApiDeckCard[], avatar: ApiDeckCard | null): string {
  const cards = [
    ...decklist,
    ...(avatar ? [avatar] : []),
  ].map((e) => ({ name: e.card.name, qty: e.quantity ?? 1 }));
  return tcgplayerMassEntryUrl(cards);
}

// For user-built decks (SlimEntry[] + optional avatar name)
function buildTCGplayerUrlFromBuilderDeck(entries: [string, number, ...unknown[]][], avatarName: string | null): string {
  const cards = [
    ...entries.map(([name, qty]) => ({ name: name as string, qty: qty as number })),
    ...(avatarName ? [{ name: avatarName, qty: 1 }] : []),
  ];
  return tcgplayerMassEntryUrl(cards);
}

function DeckList({ data, deckId }: { data: FullDeckData; deckId: string }) {
  const { decklist, avatar, meta } = data;

  const byType = new Map<string, Array<{ name: string; qty: number; stats?: string }>>();
  for (const entry of decklist) {
    const type = (entry.card as { type?: string }).type ?? "Other";
    if (!byType.has(type)) byType.set(type, []);
    const t = entry.card as typeof entry.card & { attack?: number | null; defense?: number | null };
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
        <div className="flex items-center gap-3">
          <a
            href={buildTCGplayerUrl(decklist, avatar)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-[#F0A500] hover:bg-[#d4920a] text-gray-950 transition-colors whitespace-nowrap"
            title="Buy this decklist on TCGplayer (affiliate link)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tcgplayer-logo.png" alt="TCGplayer" width={18} height={18} style={{ display: "inline-block", verticalAlign: "middle" }} />
            Buy on TCGplayer
          </a>
          <a
            href={`https://curiosa.io/decks/${deckId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400 text-xs"
          >
            curiosa.io ↗
          </a>
        </div>
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
                    <span className="text-amber-500 font-mono w-4 text-right shrink-0">{c.qty}x</span>
                    <span className="flex-1">{c.name}</span>
                    {c.stats && <span className="text-gray-600 text-xs font-mono">{c.stats}</span>}
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

// ─── My Saved Decks section ───────────────────────────────────────────────────

// ─── Expanded view for a user-built deck ─────────────────────────────────────

function BuilderDeckList({ deck }: { deck: SavedBuilderDeck }) {
  const typeOrder = ["Site", "Minion", "Magic", "Artifact", "Aura"];
  const byType = new Map<string, Array<{ name: string; qty: number }>>();

  for (const [name, qty, , type] of deck.e) {
    const t = (type as string) || "Other";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push({ name: name as string, qty: qty as number });
  }

  return (
    <div className="border-t border-gray-800 p-4 text-sm">
      {deck.av && (
        <div className="mb-3 p-2 bg-amber-900/20 border border-amber-800/40 rounded text-amber-300 text-xs">
          Avatar: {deck.av}
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
                    <span className="text-amber-500 font-mono w-4 text-right shrink-0">{c.qty}x</span>
                    <span className="flex-1">{c.name}</span>
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

// ─── My Saved Decks section ───────────────────────────────────────────────────

function MyDecksSection({ decks }: { decks: SavedBuilderDeck[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (decks.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 shrink-0">
          My Saved Decks
        </h2>
        <div className="flex-1 border-t border-amber-900/40" />
        <span className="text-xs text-gray-600 shrink-0">{decks.length} deck{decks.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex flex-col gap-3">
        {decks.map(deck => {
          const cardCount = deck.e.reduce((s, e) => s + e[1], 0);
          const savedDate = new Date(deck.at).toLocaleDateString(undefined, {
            month: "short", day: "numeric", year: "numeric",
          });
          const expanded = expandedId === deck.id;

          return (
            <div
              key={deck.id}
              className="bg-gray-900 border border-amber-900/30 rounded-xl overflow-hidden hover:border-amber-700/40 transition-colors"
            >
              {/* Header row — click to expand */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : deck.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setExpandedId(expanded ? null : deck.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white text-base leading-tight">{deck.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {deck.av
                        ? <span>Avatar: <span className="text-gray-400">{deck.av}</span></span>
                        : <span className="text-gray-600">No avatar</span>}
                      <span className="ml-2 text-gray-600">· {cardCount} cards · Saved {savedDate}</span>
                    </div>
                  </div>
                  <div
                    className="shrink-0 flex flex-col items-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <a
                        href={`/deckbuilder?load=${deck.id}`}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20
                          text-amber-400 border border-amber-500/20 rounded-lg transition-colors"
                      >
                        Open in Builder →
                      </a>
                      <a
                        href={buildTCGplayerUrlFromBuilderDeck(deck.e, deck.av)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold bg-[#F0A500] hover:bg-[#d4920a]
                          text-gray-950 rounded-lg transition-colors whitespace-nowrap"
                        title="Buy this decklist on TCGplayer (affiliate link)"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tcgplayer-logo.png" alt="TCGplayer" width={18} height={18} style={{ display: "inline-block", verticalAlign: "middle" }} />
            Buy on TCGplayer
                      </a>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  {expanded ? "▲ Collapse" : "▼ Expand deck list"}
                </div>
              </div>

              {/* Expanded decklist */}
              {expanded && <BuilderDeckList deck={deck} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

function DecksPageContent() {
  const { isSignedIn } = useAuthSafe();
  const searchParams = useSearchParams();

  // Filter state — seed from ?q= if coming from home search
  const [query,  setQuery]  = useState(searchParams.get("q") ?? "");
  const [avatar, setAvatar] = useState("");
  const [sortBy, setSortBy] = useState<"likes" | "views">("views");
  const [page,   setPage]   = useState(0);

  // My saved builder decks
  const [myDecks, setMyDecks] = useState<SavedBuilderDeck[]>([]);
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/builder-decks")
      .then(r => r.ok ? r.json() : [])
      .then(d => setMyDecks(d as SavedBuilderDeck[]))
      .catch(console.error);
  }, [isSignedIn]);

  // Client-side search (instant — no API round-trips).
  // Falls back to live API automatically when query has no local matches.
  const { results: allResults, total, isLoading, isLiveFallback } = useDeckSearch(query, avatar, sortBy, 500);

  // Paginate locally
  const pageResults = allResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount   = Math.ceil(allResults.length / PAGE_SIZE);

  // Reset to page 0 whenever filters change
  useEffect(() => { setPage(0); }, [query, avatar, sortBy]);

  // Deck expand
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [deckData,      setDeckData]      = useState<Record<string, FullDeckData>>({});
  const [loadingDeckId, setLoadingDeckId] = useState<string | null>(null);

  const handleExpand = useCallback(async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (deckData[id]) return;
    setLoadingDeckId(id);
    try {
      const res = await fetch(`/api/decks/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FullDeckData;
      setDeckData(prev => ({ ...prev, [id]: data }));
    } catch (e) {
      console.error("Failed to load deck:", e);
    } finally {
      setLoadingDeckId(null);
    }
  }, [expandedId, deckData]);

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favMeta,     setFavMeta]     = useState<Record<string, { name: string; avatar?: string; elements?: string[] }>>({});

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/favorites")
      .then(r => r.json())
      .then((data: { ids: string[]; meta: Record<string, { name: string; avatar?: string; elements?: string[] }> }) => {
        setFavoriteIds(new Set(data.ids));
        setFavMeta(data.meta);
      })
      .catch(console.error);
  }, [isSignedIn]);

  const handleToggleFavorite = useCallback(async (deck: DeckIndexEntry) => {
    if (!isSignedIn) { alert("Sign in to save decks to your profile."); return; }
    const isFav = favoriteIds.has(deck.id);
    if (isFav) {
      setFavoriteIds(prev => { const s = new Set(prev); s.delete(deck.id); return s; });
      await fetch("/api/user/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id }),
      });
    } else {
      setFavoriteIds(prev => new Set([...prev, deck.id]));
      setFavMeta(prev => ({ ...prev, [deck.id]: { name: deck.name, avatar: deck.avatarName ?? undefined, elements: deck.elements } }));
      await fetch("/api/user/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id, name: deck.name, avatar: deck.avatarName ?? undefined, elements: deck.elements }),
      });
    }
  }, [isSignedIn, favoriteIds]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>Deck Explorer</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Browse and search decks from curiosa.io. Results filter instantly.
      </p>

      {/* My Saved Decks */}
      {myDecks.length > 0 && <MyDecksSection decks={myDecks} />}

      {/* Curiosa.io decks heading */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 shrink-0">
          Curiosa.IO Decks
        </h2>
        <div className="flex-1 border-t border-amber-900/40" />
      </div>

      {/* Search controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by deck name or avatar…"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white
              placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded-lg transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={avatar}
            onChange={e => setAvatar(e.target.value)}
            placeholder="Avatar filter (e.g. Necromancer)…"
            className="flex-1 min-w-40 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white
              placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
          />

          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setSortBy("views")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                sortBy === "views" ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
              }`}
            >
              Most Viewed
            </button>
            <button
              onClick={() => setSortBy("likes")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                sortBy === "likes" ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
              }`}
            >
              Most Liked
            </button>
          </div>
        </div>
      </div>

      {/* Result count */}
      {isLoading ? (
        <p className="text-gray-500 text-sm mb-4">Loading deck index…</p>
      ) : isLiveFallback ? (
        <p className="text-gray-500 text-sm mb-4">Searching all decks on curiosa.io…</p>
      ) : (
        <p className="text-gray-500 text-sm mb-4">
          {total === 0 && (query || avatar)
            ? "No decks found."
            : total === 0
            ? ""
            : `${total.toLocaleString()} deck${total !== 1 ? "s" : ""}${query || avatar ? " matching" : ""} · showing ${pageResults.length}`}
        </p>
      )}

      {/* Results */}
      <div className="flex flex-col gap-3">
        {pageResults.map(deck => (
          <DeckRow
            key={deck.id}
            deck={deck}
            onExpand={handleExpand}
            expanded={expandedId === deck.id}
            fullData={deckData[deck.id] ?? null}
            loadingId={loadingDeckId}
            isFavorited={favoriteIds.has(deck.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-white transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-white transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && total === 0 && !query && !avatar && (
        <div className="text-center py-20 text-gray-600">
          Loading deck list…
        </div>
      )}
    </div>
  );
}

export default function DecksPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-10 text-gray-500">Loading…</div>}>
      <DecksPageContent />
    </Suspense>
  );
}

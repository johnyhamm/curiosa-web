"use client";

/**
 * Client-side deck index cache.
 *
 * Load order:
 *   1. Module-level variable (instant — survives React re-renders & SPA navigations)
 *   2. sessionStorage (instant — survives full page reloads within the same tab)
 *   3. /deck-index.json static file (one fetch per session — built at deploy time
 *      from the full curiosa.io catalogue, ~16 000 decks)
 *   4. /api/decks/search API fallback (when static file is empty/unavailable)
 *
 * Live API fallback:
 *   When a text query returns zero local results the hook also fires a live
 *   search against the API so obscure decks that somehow missed the index
 *   are still findable.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { DeckIndexEntry, DeckIndexCache } from "./decks";

const SESSION_KEY = "sorcerysim:deck-index:v2";
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

// ─── Module-level singleton ────────────────────────────────────────────────────

let _decks: DeckIndexEntry[] | null = null;
let _pending: Promise<DeckIndexEntry[]> | null = null;

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readSession(): DeckIndexEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { decks, at } = JSON.parse(raw) as { decks: DeckIndexEntry[]; at: number };
    if (Date.now() - at > SESSION_TTL) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return decks;
  } catch { return null; }
}

function writeSession(decks: DeckIndexEntry[]): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ decks, at: Date.now() })); }
  catch { /* quota exceeded — silently skip */ }
}

// ─── Index load ───────────────────────────────────────────────────────────────

function store(decks: DeckIndexEntry[]): DeckIndexEntry[] {
  _decks = decks;
  writeSession(decks);
  return decks;
}

async function loadDecks(): Promise<DeckIndexEntry[]> {
  if (_pending) return _pending;

  _pending = (async (): Promise<DeckIndexEntry[]> => {
    // 1. Pre-built static file (full catalogue, built at deploy time)
    try {
      const res = await fetch("/deck-index.json");
      if (res.ok) {
        const data = (await res.json()) as DeckIndexCache;
        if (data.decks?.length > 0) return store(data.decks);
      }
    } catch { /* fall through */ }

    // 2. Live API fallback (e.g. first deploy before prebuild has run)
    try {
      const res = await fetch("/api/decks/search?sort_by=views&limit=50");
      if (res.ok) {
        const data = (await res.json()) as { results: DeckIndexEntry[] };
        if (data.results?.length > 0) return store(data.results);
      }
    } catch { /* fall through */ }

    return store([]);
  })();

  return _pending;
}

// ─── Live API search (for queries that return nothing locally) ─────────────────

async function liveSearch(query: string): Promise<DeckIndexEntry[]> {
  const params = new URLSearchParams({ q: query, sort_by: "views", limit: "20" });
  const res = await fetch(`/api/decks/search?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: DeckIndexEntry[] };
  return data.results ?? [];
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useDeckSearch(
  query: string,
  avatar: string,
  sortBy: "likes" | "views",
  limit: number,
): {
  results: DeckIndexEntry[];
  total: number;
  isLoading: boolean;
  /** True when the local index had no matches and we're fetching from the API */
  isLiveFallback: boolean;
} {
  const [decks, setDecks] = useState<DeckIndexEntry[] | null>(() => {
    if (_decks) return _decks;
    const session = readSession();
    if (session) { _decks = session; return session; }
    return null;
  });

  // Live fallback results for queries that miss the local index
  const [liveResults, setLiveResults] = useState<DeckIndexEntry[]>([]);
  const [isLiveFallback, setIsLiveFallback] = useState(false);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the index on first mount if not already available
  useEffect(() => {
    if (decks !== null) return;
    loadDecks().then(setDecks);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side filtered results
  const { localResults, localTotal } = useMemo(() => {
    if (!decks) return { localResults: [], localTotal: 0 };

    const q  = query.trim().toLowerCase();
    const av = avatar.trim().toLowerCase();

    let list = decks.filter(d => {
      if (q  && !d.name.toLowerCase().includes(q)  && !d.avatarName.toLowerCase().includes(q))  return false;
      if (av && !d.avatarName.toLowerCase().includes(av)) return false;
      return true;
    });

    list = [...list].sort((a, b) =>
      sortBy === "likes" ? b.likes - a.likes : b.views - a.views
    );

    return { localResults: list.slice(0, limit), localTotal: list.length };
  }, [decks, query, avatar, sortBy, limit]);

  // If the local index returned nothing for a non-empty query, try the live API
  // after a short debounce so we don't fire on every keystroke.
  useEffect(() => {
    if (!decks) return; // index not loaded yet
    const q = query.trim();

    if (localTotal > 0 || !q) {
      // Local results exist or query is empty — no live fallback needed
      setLiveResults([]);
      setIsLiveFallback(false);
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      return;
    }

    // Debounce: fire 400 ms after the user stops typing
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    liveTimerRef.current = setTimeout(async () => {
      setIsLiveFallback(true);
      const results = await liveSearch(q);
      setLiveResults(results);
      setIsLiveFallback(false);
    }, 400);

    return () => { if (liveTimerRef.current) clearTimeout(liveTimerRef.current); };
  }, [query, localTotal, decks]);

  // Merge: prefer local results; fall back to live when local is empty
  const results = localTotal > 0 ? localResults : liveResults.slice(0, limit);
  const total   = localTotal > 0 ? localTotal   : liveResults.length;

  return {
    results,
    total,
    isLoading: decks === null,
    isLiveFallback,
  };
}

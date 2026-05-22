"use client";

/**
 * Client-side deck index cache.
 *
 * Load order:
 *   1. Module-level variable (instant — survives React re-renders & SPA navigations)
 *   2. sessionStorage (instant — survives full page reloads within the same tab)
 *   3. /deck-index.json static file (one fetch per session, ~200 KB)
 *   4. /api/decks/search fallback (when static file not yet built)
 */

import { useState, useEffect, useMemo } from "react";
import type { DeckIndexEntry, DeckIndexCache } from "./decks";

const SESSION_KEY = "sorcerysim:deck-index:v2";
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

// ─── Module-level singleton ────────────────────────────────────────────────────

/** Shared across every component in the same browser tab. */
let _decks: DeckIndexEntry[] | null = null;

/** In-flight fetch — prevents duplicate requests when multiple components mount. */
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

// ─── Fetch logic ──────────────────────────────────────────────────────────────

function store(decks: DeckIndexEntry[]): DeckIndexEntry[] {
  _decks = decks;
  writeSession(decks);
  return decks;
}

async function loadDecks(): Promise<DeckIndexEntry[]> {
  if (_pending) return _pending;

  _pending = (async (): Promise<DeckIndexEntry[]> => {
    // Try the pre-built static file (fastest, no server logic)
    try {
      const res = await fetch("/deck-index.json");
      if (res.ok) {
        const data = (await res.json()) as DeckIndexCache;
        if (data.decks?.length > 0) return store(data.decks);
      }
    } catch { /* fall through */ }

    // Fall back to the search API
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
} {
  const [decks, setDecks] = useState<DeckIndexEntry[] | null>(() => {
    // Try fast paths synchronously on first render (no loading flash)
    if (_decks) return _decks;
    const session = readSession();
    if (session) { _decks = session; return session; }
    return null;
  });

  useEffect(() => {
    if (decks !== null) return;
    loadDecks().then(setDecks);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { results, total } = useMemo(() => {
    if (!decks) return { results: [], total: 0 };

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

    return { results: list.slice(0, limit), total: list.length };
  }, [decks, query, avatar, sortBy, limit]);

  return { results, total, isLoading: decks === null };
}

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeckSearchResult = {
  id: string;
  name: string;
  format?: string;
  user?: { username?: string };
  elements?: Array<{ name: string }>;
  avatars?: Array<{ card?: { name?: string } }>;
  _count?: { likes?: number; views?: number };
};

export interface DeckIndexEntry {
  id: string;
  name: string;
  username: string;
  format: string;
  avatarName: string;
  elements: string[];
  likes: number;
  views: number;
}

export interface DeckIndexCache {
  builtAt: string;
  totalDecks: number;
  decks: DeckIndexEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_DIR = join(process.env.HOME ?? "~", ".cache", "curiosa-mcp");
const DECK_INDEX_FILE = join(CACHE_DIR, "deck_index.json");

const TRPC = "https://curiosa.io/api/trpc";
const TRPC_HEADERS = {
  "Origin": "https://curiosa.io",
  "Referer": "https://curiosa.io/",
  "User-Agent": "curiosa-mcp/1.0 (personal MCP server)",
};

const DECK_INDEX_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

// ─── In-memory state ──────────────────────────────────────────────────────────

let deckIndexMem: DeckIndexCache | null = null;
let deckIndexBuilding = false;

/**
 * Session-level cache: avatar name (lowercase) → curiosa card ID.
 */
const avatarCardIdCache = new Map<string, string>();

// ─── Deck API helpers ─────────────────────────────────────────────────────────

export function extractDeckId(input: string): string {
  // Accept full URLs like https://curiosa.io/decks/cmixygfzf1j4c30ecqcaanrcj
  const urlMatch = input.match(/decks\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  // Or raw IDs
  return input.trim();
}

export async function fetchDeckFromApi(deckId: string): Promise<{
  decklist: import("./simulator.js").ApiDeckCard[];
  avatar: import("./simulator.js").ApiDeckCard | null;
  meta: {
    name?: string;
    format?: string;
    visibility?: string;
    user?: { username?: string };
    _count?: { likes?: number; views?: number };
  } | null;
}> {
  const input = encodeURIComponent(
    JSON.stringify({
      "0": { json: { id: deckId } },
      "1": { json: { id: deckId } },
      "2": { json: { id: deckId } },
    })
  );
  const res = await fetch(
    `${TRPC}/deck.getDecklistById,deck.getAvatarById,deck.getById?batch=1&input=${input}`,
    { headers: TRPC_HEADERS }
  );
  if (!res.ok) throw new Error(`Deck API error: ${res.status}`);
  const results = await res.json() as Array<{
    result?: { data?: { json: unknown } };
    error?: unknown;
  }>;

  if (results[0]?.error || results[1]?.error) {
    throw new Error(`Deck not found or private: ${deckId}`);
  }

  const decklist = results[0]?.result?.data?.json as import("./simulator.js").ApiDeckCard[] ?? [];
  const avatar   = results[1]?.result?.data?.json as import("./simulator.js").ApiDeckCard | null;
  const meta     = results[2]?.result?.data?.json as {
    name?: string;
    format?: string;
    visibility?: string;
    user?: { username?: string };
    _count?: { likes?: number; views?: number };
  } | null;

  return { decklist, avatar, meta };
}

/**
 * Resolve an avatar name (e.g. "Necromancer") to the curiosa-internal card ID
 * used by deck.search for server-side filtering.
 */
export async function resolveAvatarCardId(avatarName: string): Promise<string | null> {
  const key = avatarName.toLowerCase();
  if (avatarCardIdCache.has(key)) return avatarCardIdCache.get(key)!;

  const seedInput = encodeURIComponent(
    JSON.stringify({ json: { avatar: "*", divider: "all", query: avatarName, filters: [], limit: 5 } })
  );
  const seedRes = await fetch(`${TRPC}/deck.search?input=${seedInput}`, { headers: TRPC_HEADERS });
  if (!seedRes.ok) return null;

  const seedData = await seedRes.json() as {
    result?: { data?: { json?: { decks?: DeckSearchResult[] } } }
  };
  const seedDecks = seedData.result?.data?.json?.decks ?? [];
  const seedDeck = seedDecks.find(d =>
    d.avatars?.some(a => a.card?.name?.toLowerCase().includes(key))
  );
  if (!seedDeck) return null;

  const avInput = encodeURIComponent(JSON.stringify({ "0": { json: { id: seedDeck.id } } }));
  const avRes = await fetch(`${TRPC}/deck.getAvatarById?batch=1&input=${avInput}`, { headers: TRPC_HEADERS });
  if (!avRes.ok) return null;

  const avData = await avRes.json() as Array<{
    result?: { data?: { json?: { card?: { id?: string; name?: string } } } }
  }>;
  const cardId = avData[0]?.result?.data?.json?.card?.id ?? null;

  if (cardId) {
    avatarCardIdCache.set(key, cardId);
  }
  return cardId;
}

/**
 * Fetch ALL pages of a deck search, then sort by views descending.
 */
export async function searchAllDecks(
  query: string,
  avatarCardId?: string,
): Promise<DeckSearchResult[]> {
  const PAGE_SIZE = 100;
  const MAX_WITHOUT_AVATAR = 500;
  const all: DeckSearchResult[] = [];
  let cursor: number | null = null;

  do {
    const params: Record<string, unknown> = {
      avatar: avatarCardId ?? "*",
      divider: "all",
      query,
      filters: [],
      limit: PAGE_SIZE,
    };
    if (cursor !== null) params.cursor = cursor;

    const input = encodeURIComponent(JSON.stringify({ json: params }));
    const res = await fetch(`${TRPC}/deck.search?input=${input}`, { headers: TRPC_HEADERS });
    if (!res.ok) break;

    const data = await res.json() as {
      result?: { data?: { json?: { decks?: DeckSearchResult[]; nextCursor?: number | null } } }
    };
    const page = data.result?.data?.json?.decks ?? [];
    all.push(...page);
    cursor = data.result?.data?.json?.nextCursor ?? null;

    if (!avatarCardId && all.length >= MAX_WITHOUT_AVATAR) break;
  } while (cursor !== null);

  return all.sort((a, b) => (b._count?.views ?? 0) - (a._count?.views ?? 0));
}

// ─── Deck index cache ─────────────────────────────────────────────────────────

function readDeckIndex(): DeckIndexCache | null {
  try {
    return JSON.parse(readFileSync(DECK_INDEX_FILE, "utf8")) as DeckIndexCache;
  } catch { return null; }
}

function writeDeckIndexToDisk(cache: DeckIndexCache): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    // No pretty-print — this file can be 3+ MB
    writeFileSync(DECK_INDEX_FILE, JSON.stringify(cache), "utf8");
    console.error(`[curiosa-web] Deck index saved: ${cache.totalDecks} decks`);
  } catch (err) {
    console.error(`[curiosa-web] Warning: could not save deck index: ${err}`);
  }
}

/** Fetch a single page of all public decks (no avatar/query filter). */
export async function fetchDeckPage(cursor: number | null): Promise<{
  decks: DeckSearchResult[];
  nextCursor: number | null;
}> {
  const params: Record<string, unknown> = {
    avatar: "*", divider: "all", query: "", filters: [], limit: 100,
  };
  if (cursor !== null) params.cursor = cursor;
  const input = encodeURIComponent(JSON.stringify({ json: params }));
  const res = await fetch(`${TRPC}/deck.search?input=${input}`, { headers: TRPC_HEADERS });
  if (!res.ok) return { decks: [], nextCursor: null };
  const data = await res.json() as {
    result?: { data?: { json?: { decks?: DeckSearchResult[]; nextCursor?: number | null } } }
  };
  return {
    decks: data.result?.data?.json?.decks ?? [],
    nextCursor: data.result?.data?.json?.nextCursor ?? null,
  };
}

export function finalizeIndex(raw: DeckSearchResult[], startMs: number): DeckIndexCache {
  // Deduplicate by ID
  const seen = new Set<string>();
  const unique = raw.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });

  const decks: DeckIndexEntry[] = unique.map(d => ({
    id: d.id,
    name: d.name,
    username: d.user?.username ?? "",
    format: d.format ?? "",
    avatarName: d.avatars?.[0]?.card?.name ?? "",
    elements: (d.elements ?? []).map(e => e.name).filter(e => e !== "None"),
    likes: d._count?.likes ?? 0,
    views: d._count?.views ?? 0,
  }));

  const cache: DeckIndexCache = {
    builtAt: new Date().toISOString(),
    totalDecks: decks.length,
    decks,
  };
  writeDeckIndexToDisk(cache);
  deckIndexMem = cache;
  const secs = ((Date.now() - startMs) / 1000).toFixed(1);
  console.error(`[curiosa-web] Deck index built: ${decks.length} decks in ${secs}s`);
  return cache;
}

/** Build a full deck index by fetching all public decks. ~5 min on first run. */
export async function buildDeckIndex(): Promise<DeckIndexCache> {
  const startMs = Date.now();
  const CONCURRENT = 10;
  console.error("[curiosa-web] Building deck index (all public decks, ~5 min)...");

  const first = await fetchDeckPage(null);
  const raw: DeckSearchResult[] = [...first.decks];
  if (!first.nextCursor) return finalizeIndex(raw, startMs);

  const step = first.nextCursor;

  if (step === 100) {
    let offset = step;
    while (offset < 100_000) {
      const batch = Array.from({ length: CONCURRENT }, (_, i) => offset + i * step);
      offset += CONCURRENT * step;

      const results = await Promise.allSettled(batch.map(c => fetchDeckPage(c)));
      let gotAny = false;
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.decks.length > 0) {
          raw.push(...r.value.decks);
          gotAny = true;
        }
      }
      console.error(`[curiosa-web] Index build: ${raw.length} decks...`);
      if (!gotAny) break;
    }
  } else {
    let cursor: number | null = first.nextCursor;
    while (cursor !== null) {
      const page = await fetchDeckPage(cursor);
      raw.push(...page.decks);
      cursor = page.nextCursor;
      if (raw.length % 1000 === 0) {
        console.error(`[curiosa-web] Index build: ${raw.length} decks...`);
      }
    }
  }

  return finalizeIndex(raw, startMs);
}

/**
 * Return the deck index if available (from memory or disk).
 * Automatically triggers a background rebuild if stale or missing.
 * Returns null only on the very first run (no index built yet).
 */
export function getDeckIndex(): DeckIndexCache | null {
  const now = Date.now();

  if (deckIndexMem) {
    const age = now - new Date(deckIndexMem.builtAt).getTime();
    if (age < DECK_INDEX_TTL_MS) return deckIndexMem;
    if (!deckIndexBuilding) {
      deckIndexBuilding = true;
      buildDeckIndex().finally(() => { deckIndexBuilding = false; });
    }
    return deckIndexMem;
  }

  const disk = readDeckIndex();
  if (disk) {
    deckIndexMem = disk;
    const age = now - new Date(disk.builtAt).getTime();
    if (age < DECK_INDEX_TTL_MS) {
      console.error(`[curiosa-web] Loaded deck index from disk: ${disk.totalDecks} decks (built ${new Date(disk.builtAt).toLocaleDateString()})`);
      return disk;
    }
    if (!deckIndexBuilding) {
      deckIndexBuilding = true;
      buildDeckIndex().finally(() => { deckIndexBuilding = false; });
    }
    return disk;
  }

  // No index exists at all — start background build
  if (!deckIndexBuilding) {
    deckIndexBuilding = true;
    console.error("[curiosa-web] No deck index found — starting background build (~5 min)...");
    buildDeckIndex().finally(() => { deckIndexBuilding = false; });
  }
  return null;
}

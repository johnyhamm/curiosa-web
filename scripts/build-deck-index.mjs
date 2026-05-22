#!/usr/bin/env node
/**
 * Fetches the top ~3 000 public decks from curiosa.io and writes them to
 * public/deck-index.json so the client can load them as a static file.
 *
 * Run manually:  npm run build:index
 * Run at deploy: automatically invoked by the "prebuild" npm hook.
 *
 * The script always exits 0 — a failed fetch just writes an empty index and
 * lets the app fall back to its live-search API route.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const OUT        = join(PUBLIC_DIR, "deck-index.json");
const LOCAL_CACHE = join(
  process.env.HOME ?? process.env.USERPROFILE ?? ".",
  ".cache", "curiosa-mcp", "deck_index.json"
);

const TRPC    = "https://curiosa.io/api/trpc";
const HEADERS = {
  Origin:     "https://curiosa.io",
  Referer:    "https://curiosa.io/",
  "User-Agent": "curiosa-mcp/1.0 (personal build script)",
};

const MAX_DECKS  = 3_000;
const PAGE_SIZE  = 100;
const CONCURRENT = 5;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function fetchPage(cursor) {
  const params = { avatar: "*", divider: "all", query: "", filters: [], limit: PAGE_SIZE };
  if (cursor !== null) params.cursor = cursor;
  const input = encodeURIComponent(JSON.stringify({ json: params }));
  const res   = await fetch(`${TRPC}/deck.search?input=${input}`, { headers: HEADERS });
  if (!res.ok) return { decks: [], nextCursor: null };
  const data  = await res.json();
  return {
    decks:      data.result?.data?.json?.decks      ?? [],
    nextCursor: data.result?.data?.json?.nextCursor ?? null,
  };
}

function mapDeck(d) {
  return {
    id:         d.id,
    name:       d.name       ?? "",
    username:   d.user?.username ?? "",
    format:     d.format     ?? "",
    avatarName: d.avatars?.[0]?.card?.name ?? "",
    elements:   (d.elements ?? []).map(e => e.name).filter(e => e !== "None"),
    likes:      d._count?.likes ?? 0,
    views:      d._count?.views ?? 0,
  };
}

function writeIndex(decks, note) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    builtAt:    new Date().toISOString(),
    totalDecks: decks.length,
    decks,
  }));
  console.log(`[build-deck-index] ✓ ${note}: wrote ${decks.length} decks → public/deck-index.json`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Try the local disk cache first (fast path for local devs)
  if (existsSync(LOCAL_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(LOCAL_CACHE, "utf8"));
      const ageDays = (Date.now() - new Date(cached.builtAt).getTime()) / 86_400_000;
      if (ageDays < 7 && cached.decks?.length > 0) {
        writeIndex(cached.decks, `local cache (${Math.round(ageDays * 24)}h old, ${cached.decks.length} decks)`);
        return;
      }
    } catch (e) {
      console.log(`[build-deck-index] Local cache unreadable: ${e.message}`);
    }
  }

  // 2. Fetch from curiosa.io
  console.log(`[build-deck-index] Fetching up to ${MAX_DECKS} decks from curiosa.io…`);
  const raw = [];

  const first = await fetchPage(null);
  raw.push(...first.decks);
  console.log(`[build-deck-index] ${raw.length} decks…`);

  if (first.nextCursor && raw.length < MAX_DECKS) {
    const step = first.nextCursor; // typically 100
    let offset = step;

    while (raw.length < MAX_DECKS) {
      const cursors = [];
      for (let i = 0; i < CONCURRENT && raw.length + cursors.length * PAGE_SIZE < MAX_DECKS; i++) {
        cursors.push(offset + i * step);
      }
      if (cursors.length === 0) break;
      offset += cursors.length * step;

      const settled = await Promise.allSettled(cursors.map(c => fetchPage(c)));
      let gotAny = false;
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value.decks.length > 0) {
          raw.push(...r.value.decks);
          gotAny = true;
        }
      }
      console.log(`[build-deck-index] ${raw.length} decks…`);
      if (!gotAny) break;
    }
  }

  // Deduplicate, map, sort by views, cap
  const seen  = new Set();
  const decks = raw
    .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
    .map(mapDeck)
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_DECKS);

  writeIndex(decks, "fresh fetch");
}

main().catch(err => {
  console.error(`[build-deck-index] Failed: ${err.message}`);
  // Always exit 0 — write an empty index so the app gracefully falls back
  try {
    mkdirSync(PUBLIC_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString(), totalDecks: 0, decks: [] }));
    console.log("[build-deck-index] Wrote empty fallback index.");
  } catch { /* ignore */ }
  process.exit(0);
});

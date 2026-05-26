import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardThresholds {
  air: number;
  earth: number;
  fire: number;
  water: number;
}

export interface CardStats {
  rarity: string;
  type: string;
  rulesText: string;
  cost: number | null;
  attack: number | null;
  defence: number | null;
  life: number | null;
  thresholds: CardThresholds;
}

export interface CardVariant {
  slug: string;
  finish: string;
  product: string;
  artist: string;
  flavorText: string;
  typeText: string;
}

export interface CardSet {
  name: string;
  releasedAt: string;
  metadata: CardStats;
  variants: CardVariant[];
}

export interface Card {
  name: string;
  guardian: CardStats;
  elements: string;
  subTypes: string;
  sets: CardSet[];
}

// ─── Card cache ───────────────────────────────────────────────────────────────

const CACHE_DIR = join(process.env.HOME ?? "~", ".cache", "curiosa-mcp");
const CACHE_FILE = join(CACHE_DIR, "cards.json");
const CARDS_API = "https://api.sorcerytcg.com/api/cards";

/** How long before we bother sending a conditional GET to check for changes. */
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface DiskCache {
  /** When we last successfully downloaded a fresh payload from the API. */
  fetchedAt: string;
  /** When we last sent any request to the API (including 304 responses). */
  checkedAt: string;
  /** ETag returned by the API on the last 200 response. */
  etag: string | null;
  cards: Card[];
}

let cardCache: Card[] = [];

function readDiskCache(): DiskCache | null {
  try {
    const raw = readFileSync(CACHE_FILE, "utf8");
    return JSON.parse(raw) as DiskCache;
  } catch {
    return null;
  }
}

function writeDiskCache(cache: DiskCache): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    console.error(`[curiosa-web] Warning: could not write disk cache: ${err}`);
  }
}

/** Compare two card lists. Returns true if anything differs. */
function diffAndLog(oldCards: Card[], newCards: Card[]): boolean {
  const oldByName = new Map(oldCards.map((c) => [c.name, c]));
  const newByName = new Map(newCards.map((c) => [c.name, c]));

  const added = newCards.filter((c) => !oldByName.has(c.name)).map((c) => c.name);
  const removed = oldCards.filter((c) => !newByName.has(c.name)).map((c) => c.name);

  const changed: string[] = [];
  for (const [name, newCard] of newByName) {
    const old = oldByName.get(name);
    if (!old) continue;
    const g = newCard.guardian;
    const og = old.guardian;
    if (
      g.rulesText !== og.rulesText ||
      g.cost !== og.cost ||
      g.attack !== og.attack ||
      g.defence !== og.defence ||
      g.life !== og.life ||
      g.rarity !== og.rarity ||
      JSON.stringify(g.thresholds) !== JSON.stringify(og.thresholds)
    ) {
      changed.push(name);
    }
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return false;
  }

  if (added.length) console.error(`[curiosa-web] New cards (${added.length}): ${added.join(", ")}`);
  if (removed.length) console.error(`[curiosa-web] Removed cards (${removed.length}): ${removed.join(", ")}`);
  if (changed.length) console.error(`[curiosa-web] Updated cards (${changed.length}): ${changed.join(", ")}`);
  return true;
}

export async function loadCards(): Promise<Card[]> {
  // 1. Return in-memory cache if already loaded this session
  if (cardCache.length > 0) return cardCache;

  const disk = readDiskCache();
  const now = Date.now();

  // 2. Disk cache is fresh — no network call needed
  if (disk) {
    const sinceLastCheck = now - new Date(disk.checkedAt).getTime();
    if (sinceLastCheck < CHECK_INTERVAL_MS) {
      cardCache = disk.cards;
      const days = Math.round(sinceLastCheck / 86_400_000);
      console.log(
        `[curiosa-web] Loaded ${cardCache.length} cards from disk cache ` +
        `(last checked ${days}d ago)`
      );
      return cardCache;
    }
  }

  // 3. Bundled file baked at build time — no network call needed on Vercel cold starts
  try {
    const raw = readFileSync(join(process.cwd(), "public", "cards-data.json"), "utf8");
    const cards = JSON.parse(raw) as Card[];
    if (cards.length > 0) {
      cardCache = cards;
      console.log(`[curiosa-web] Loaded ${cards.length} cards from bundled file`);
      return cardCache;
    }
  } catch { /* file not present — fall through to API */ }

  // 4. Time to check the API — use a conditional GET if we have an ETag
  console.log("[curiosa-web] Checking API for updates...");
  const headers: Record<string, string> = {};
  if (disk?.etag) headers["If-None-Match"] = disk.etag;

  const res = await fetch(CARDS_API, { headers });

  // 304 Not Modified — data unchanged, just bump checkedAt and return cached cards
  if (res.status === 304 && disk) {
    console.log("[curiosa-web] API returned 304 — no changes, using cached data");
    writeDiskCache({ ...disk, checkedAt: new Date().toISOString() });
    cardCache = disk.cards;
    return cardCache;
  }

  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

  // 200 — new payload received, diff against what we had
  const freshCards = (await res.json()) as Card[];
  const newEtag = res.headers.get("etag");
  const now2 = new Date().toISOString();

  if (disk?.cards.length) {
    const changed = diffAndLog(disk.cards, freshCards);
    if (!changed) {
      console.log("[curiosa-web] API returned 200 but card data is identical");
    }
  } else {
    console.log(`[curiosa-web] Initial fetch: loaded ${freshCards.length} cards`);
  }

  cardCache = freshCards;
  writeDiskCache({
    fetchedAt: now2,
    checkedAt: now2,
    etag: newEtag,
    cards: freshCards,
  });
  return cardCache;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalise(s: string): string {
  return s.toLowerCase().trim();
}

export function matchesText(card: Card, query: string): boolean {
  const q = normalise(query);
  return (
    normalise(card.name).includes(q) ||
    normalise(card.guardian.rulesText ?? "").includes(q) ||
    normalise(card.subTypes ?? "").includes(q) ||
    card.sets.some((s) =>
      s.variants.some((v) => normalise(v.flavorText ?? "").includes(q))
    )
  );
}

export function formatCard(card: Card, verbose = false): string {
  const g = card.guardian;
  const thresholds = Object.entries(g.thresholds ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");

  const lines: string[] = [
    `**${card.name}**`,
    `Type: ${g.type}${card.subTypes ? ` — ${card.subTypes}` : ""}`,
    `Element: ${card.elements || "None"}`,
    `Rarity: ${g.rarity}`,
    `Cost: ${g.cost ?? "—"}${thresholds ? `  |  Thresholds: ${thresholds}` : ""}`,
  ];

  if (g.attack !== null || g.defence !== null || g.life !== null) {
    lines.push(
      `Stats: ATK ${g.attack ?? "—"} / DEF ${g.defence ?? "—"} / LIFE ${g.life ?? "—"}`
    );
  }

  if (g.rulesText) lines.push(`\nRules text:\n${g.rulesText}`);

  if (verbose) {
    const setNames = card.sets.map((s) => s.name).join(", ");
    lines.push(`\nSets: ${setNames}`);

    const artists = [
      ...new Set(
        card.sets.flatMap((s) => s.variants.map((v) => v.artist).filter(Boolean))
      ),
    ];
    if (artists.length) lines.push(`Artists: ${artists.join(", ")}`);

    const flavors = card.sets
      .flatMap((s) => s.variants.map((v) => v.flavorText).filter(Boolean))
      .filter((f, i, a) => a.indexOf(f) === i);
    if (flavors.length) lines.push(`\nFlavor text:\n${flavors.join("\n---\n")}`);
  }

  return lines.join("\n");
}

export function getUniqueSets(cards: Card[]): { name: string; releasedAt: string }[] {
  const seen = new Map<string, string>();
  for (const card of cards) {
    for (const s of card.sets) {
      if (!seen.has(s.name)) seen.set(s.name, s.releasedAt);
    }
  }
  return [...seen.entries()]
    .map(([name, releasedAt]) => ({ name, releasedAt }))
    .sort((a, b) => a.releasedAt.localeCompare(b.releasedAt));
}

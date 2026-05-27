/**
 * User card collection — backed by Upstash Redis.
 *
 * Redis layout
 * ────────────
 * Hash key : col:v1:{userId}
 * Field    : normalised card name  (lowercase, trimmed)
 * Value    : JSON string { qty: number, foilQty: number, updatedAt: string }
 *
 * This design is intentionally simple so the upcoming iOS/Android companion
 * app can call the same /api/collection REST endpoints with a Clerk JWT and
 * get/set quantities without any platform-specific logic.
 */

import { redis } from "@/lib/redis";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionCard {
  cardName: string;
  qty:      number;
  foilQty:  number;
  updatedAt: string;
}

/** The full collection as a name → entry map. */
export type CollectionMap = Record<string, CollectionCard>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colKey(userId: string) {
  return `col:v1:${userId}`;
}

export function normalizeCardName(name: string): string {
  return name.trim().toLowerCase();
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch every card in a user's collection.
 * Returns an empty map if Redis is not configured or the user has no collection.
 */
type RawEntry = { qty: number; foilQty: number; updatedAt: string };

export async function getCollection(userId: string): Promise<CollectionMap> {
  if (!redis) return {};

  // Upstash automatically deserializes stored JSON, so values arrive as objects.
  // We also handle the legacy string case (data stored before this fix).
  const raw = await redis.hgetall<Record<string, RawEntry | string>>(colKey(userId));
  if (!raw) return {};

  const result: CollectionMap = {};
  for (const [field, value] of Object.entries(raw)) {
    try {
      const parsed: RawEntry =
        typeof value === "string" ? JSON.parse(value) : value;
      result[field] = { cardName: field, ...parsed };
    } catch {
      // skip malformed entries
    }
  }
  return result;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Set the quantity for a single card.
 * Passing qty=0 and foilQty=0 removes the card from the collection.
 */
export async function setCardQty(
  userId: string,
  cardName: string,
  qty: number,
  foilQty = 0,
): Promise<void> {
  if (!redis) return;

  const key   = colKey(userId);
  const field = normalizeCardName(cardName);

  if (qty <= 0 && foilQty <= 0) {
    await redis.hdel(key, field);
    return;
  }

  const entry: RawEntry = {
    qty:      Math.max(0, qty),
    foilQty:  Math.max(0, foilQty),
    updatedAt: new Date().toISOString(),
  };
  // Store as plain object — Upstash serializes it and deserializes on read.
  await redis.hset(key, { [field]: entry });
}

/**
 * Remove a card from the collection entirely.
 */
export async function removeCard(userId: string, cardName: string): Promise<void> {
  if (!redis) return;
  await redis.hdel(colKey(userId), normalizeCardName(cardName));
}

/**
 * Delete the user's entire collection (removes the Redis hash key).
 */
export async function clearCollection(userId: string): Promise<void> {
  if (!redis) return;
  await redis.del(colKey(userId));
}

/**
 * Bulk-upsert multiple cards at once.
 * Designed for the camera-scanning workflow: scan a stack of cards,
 * send them all in one request.
 * Cards with qty=0 are removed; all others are upserted.
 */
export async function bulkUpdate(
  userId: string,
  updates: { cardName: string; qty: number; foilQty?: number }[],
): Promise<void> {
  if (!redis || updates.length === 0) return;

  const key  = colKey(userId);
  const now  = new Date().toISOString();
  const sets: Record<string, string> = {};
  const dels: string[] = [];

  for (const { cardName, qty, foilQty = 0 } of updates) {
    const field = normalizeCardName(cardName);
    if (qty <= 0 && foilQty <= 0) {
      dels.push(field);
    } else {
      sets[field] = { qty: Math.max(0, qty), foilQty: Math.max(0, foilQty), updatedAt: now } as unknown as string;
    }
  }

  const ops: Promise<unknown>[] = [];
  if (Object.keys(sets).length > 0) ops.push(redis!.hset(key, sets));
  if (dels.length > 0)              ops.push(Promise.all(dels.map(f => redis!.hdel(key, f))));
  await Promise.all(ops);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface CollectionStats {
  uniqueCards: number;
  totalCopies: number;
  totalFoil:   number;
}

export function collectionStats(col: CollectionMap): CollectionStats {
  let totalCopies = 0, totalFoil = 0;
  for (const entry of Object.values(col)) {
    totalCopies += entry.qty;
    totalFoil   += entry.foilQty;
  }
  return { uniqueCards: Object.keys(col).length, totalCopies, totalFoil };
}

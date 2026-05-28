import { Redis } from "@upstash/redis";
import type { SavedBuilderDeck, PublicBuilderDeck } from "@/lib/builder-deck";

// Returns null if env vars aren't configured (local dev without Redis)
function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export const redis = getRedis();

// ─── Key helpers ──────────────────────────────────────────────────────────────

function todayKey() {
  return `sims:daily:${new Date().toISOString().slice(0, 10)}`; // sims:daily:2026-05-25
}

function monthKey() {
  return `sims:monthly:${new Date().toISOString().slice(0, 7)}`; // sims:monthly:2026-05
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function trackSimRun(): Promise<void> {
  if (!redis) return; // silently skip in local dev without Redis
  const daily = todayKey();
  const monthly = monthKey();

  await Promise.all([
    redis.incr("sims:total"),
    redis.incr(daily),
    redis.incr(monthly),
    // Expire daily keys after 120 days
    redis.expire(daily, 60 * 60 * 24 * 120),
  ]);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export interface SimStats {
  total: number;
  today: number;
  thisMonth: number;
  last7Days: number;
  dailyBreakdown: { date: string; count: number }[];
}

export async function getSimStats(): Promise<SimStats> {
  if (!redis) {
    return { total: 0, today: 0, thisMonth: 0, last7Days: 0, dailyBreakdown: [] };
  }

  // Build last 7 day keys
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const dailyKeys = days.map((d) => `sims:daily:${d}`);

  const [total, monthly, ...dailyCounts] = await Promise.all([
    redis.get<number>("sims:total"),
    redis.get<number>(monthKey()),
    ...dailyKeys.map((k) => redis.get<number>(k)),
  ]);

  const dailyBreakdown = days.map((date, i) => ({
    date,
    count: dailyCounts[i] ?? 0,
  }));

  const last7Days = dailyBreakdown.reduce((sum, d) => sum + d.count, 0);

  return {
    total: total ?? 0,
    today: dailyCounts[0] ?? 0,
    thisMonth: monthly ?? 0,
    last7Days,
    dailyBreakdown,
  };
}

// ─── Public Builder Decks ─────────────────────────────────────────────────────

type StoredDeck = Omit<PublicBuilderDeck, "likes" | "userLiked">;

/** Publish a deck snapshot to Redis and add it to the public index. */
export async function publishBuilderDeck(
  deck: SavedBuilderDeck,
  ownerId: string,
  ownerName: string
): Promise<void> {
  if (!redis) return;
  const stored: StoredDeck = {
    id: deck.id,
    name: deck.name,
    av: deck.av,
    e: deck.e,
    ownerId,
    ownerName,
    at: deck.at,
  };
  await Promise.all([
    redis.set(`publicDeck:${deck.id}`, JSON.stringify(stored)),
    redis.zadd("publicDecks", { score: Date.now(), member: deck.id }),
    // Init likes score only if not already present (NX) so republishing doesn't reset likes
    redis.zadd("publicDecksLikes", { nx: true }, { score: 0, member: deck.id }),
  ]);
}

/** Remove a deck from the public index and delete its data + likes. */
export async function unpublishBuilderDeck(deckId: string): Promise<void> {
  if (!redis) return;
  await Promise.all([
    redis.del(`publicDeck:${deckId}`),
    redis.zrem("publicDecks", deckId),
    redis.zrem("publicDecksLikes", deckId),
    redis.del(`deckLikes:${deckId}`),
  ]);
}

/** Fetch a page of deck IDs with their like counts and userLiked flags. */
async function fetchDecks(
  ids: string[],
  viewerUserId: string | null
): Promise<PublicBuilderDeck[]> {
  if (!ids.length) return [];
  const results = await Promise.all(
    ids.map(async (id) => {
      const [raw, likes, userLiked] = await Promise.all([
        redis!.get<string | StoredDeck>(`publicDeck:${id}`),
        redis!.scard(`deckLikes:${id}`),
        viewerUserId
          ? redis!.sismember(`deckLikes:${id}`, viewerUserId)
          : Promise.resolve(0),
      ]);
      if (!raw) return null;
      const stored: StoredDeck =
        typeof raw === "string" ? JSON.parse(raw) : raw;
      return { ...stored, likes: likes ?? 0, userLiked: !!userLiked } as PublicBuilderDeck;
    })
  );
  return results.filter(Boolean) as PublicBuilderDeck[];
}

/** Return the 10 most recently published public decks, newest first. */
export async function getPublicBuilderDecks(
  viewerUserId: string | null
): Promise<PublicBuilderDeck[]> {
  if (!redis) return [];
  const ids = await redis.zrange("publicDecks", 0, 9, { rev: true });
  return fetchDecks(ids as string[], viewerUserId);
}

/** Return the 10 most-liked public decks, highest first. */
export async function getTopLikedDecks(
  viewerUserId: string | null
): Promise<PublicBuilderDeck[]> {
  if (!redis) return [];
  const ids = await redis.zrange("publicDecksLikes", 0, 9, { rev: true });
  return fetchDecks(ids as string[], viewerUserId);
}

/** Toggle a like. Returns new total and whether the user now likes it. */
export async function toggleDeckLike(
  deckId: string,
  userId: string
): Promise<{ liked: boolean; count: number }> {
  if (!redis) return { liked: false, count: 0 };
  const key = `deckLikes:${deckId}`;
  const alreadyLiked = await redis.sismember(key, userId);
  if (alreadyLiked) {
    await redis.srem(key, userId);
    await redis.zincrby("publicDecksLikes", -1, deckId);
  } else {
    await redis.sadd(key, userId);
    await redis.zincrby("publicDecksLikes", 1, deckId);
  }
  const count = (await redis.scard(key)) ?? 0;
  return { liked: !alreadyLiked, count };
}

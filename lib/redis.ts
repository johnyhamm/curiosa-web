import { Redis } from "@upstash/redis";

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

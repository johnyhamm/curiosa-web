import { NextResponse } from "next/server";
import { fetchNewsArticles } from "@/lib/news";

// ── GET /api/news ────────────────────────────────────────────────────────────
// Returns the latest Sorcery news articles as JSON for the mobile app.
// Cached for 6 hours via ISR (the underlying fetch sets revalidate).

export const revalidate = 21600; // 6 hours

export async function GET() {
  const articles = await fetchNewsArticles(15);
  return NextResponse.json(
    { articles },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400" } }
  );
}

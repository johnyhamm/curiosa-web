import { NextResponse } from "next/server";
import { fetchLatestVideos } from "@/lib/youtube";

// ── GET /api/youtube ─────────────────────────────────────────────────────────
// Returns the latest video for each configured Sorcery YouTube channel.

export const revalidate = 3600; // 1 hour

export async function GET() {
  const channels = await fetchLatestVideos();
  return NextResponse.json(
    { channels },
    { headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}

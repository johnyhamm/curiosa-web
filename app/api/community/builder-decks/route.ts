import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPublicBuilderDecks, getTopLikedDecks } from "@/lib/redis";

// ── GET /api/community/builder-decks ─────────────────────────────────────────
// Returns { recent: PublicBuilderDeck[], topLiked: PublicBuilderDeck[] }
// recent  = 10 newest by publish time
// topLiked = 10 most-liked
// If the caller is authenticated, each deck includes userLiked.

export async function GET() {
  const { userId } = await auth();
  const viewerId = userId ?? null;
  const [recent, topLiked] = await Promise.all([
    getPublicBuilderDecks(viewerId),
    getTopLikedDecks(viewerId),
  ]);
  return NextResponse.json({ recent, topLiked });
}

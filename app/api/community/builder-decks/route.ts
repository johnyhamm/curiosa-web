import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPublicBuilderDecks } from "@/lib/redis";

// ── GET /api/community/builder-decks ─────────────────────────────────────────
// Returns the most recent 50 public builder decks, newest first.
// If the caller is authenticated, each deck includes userLiked.

export async function GET() {
  const { userId } = await auth();
  const decks = await getPublicBuilderDecks(userId ?? null);
  return NextResponse.json(decks);
}

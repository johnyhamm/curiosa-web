import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { toggleDeckLike } from "@/lib/redis";

// ── POST /api/community/builder-decks/[id]/like ───────────────────────────────
// Toggles the current user's like on a public deck.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const result = await toggleDeckLike(id, userId);
  return NextResponse.json(result);
}

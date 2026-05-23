import { type NextRequest, NextResponse } from "next/server";
import { loadCards } from "@/lib/cards";

// ── GET /api/cards/batch?names=Card+A,Card+B,... ─────────────────────────────
//
// Returns the full Card objects for each requested name.
// Used by the deck builder to rehydrate a saved deck (which only stores names).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("names") ?? "";
  const names = raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (names.length === 0) return NextResponse.json([]);
  if (names.length > 200) return new NextResponse("Too many names", { status: 400 });

  const allCards = await loadCards();
  const nameSet = new Set(names.map((n) => n.toLowerCase()));
  const found = allCards.filter((c) => nameSet.has(c.name.toLowerCase()));

  return NextResponse.json(found);
}

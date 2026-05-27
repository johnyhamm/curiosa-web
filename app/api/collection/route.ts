/**
 * /api/collection — user card collection REST API.
 *
 * GET    → returns the user's full collection
 * POST   → upserts a single card's quantity
 * DELETE → removes a card (pass ?card=name in query string)
 *
 * Auth: Clerk JWT (works for both web sessions and the future mobile app).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCollection, setCardQty, removeCard, normalizeCardName } from "@/lib/collection";

export const dynamic = "force-dynamic";

// ── GET /api/collection ───────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collection = await getCollection(userId);
  console.log("[Collection GET]", userId.slice(0, 8), "→", Object.keys(collection).length, "cards");
  return NextResponse.json({ collection });
}

// ── POST /api/collection ──────────────────────────────────────────────────────

interface UpsertBody {
  cardName: string;
  qty:      number;
  foilQty?: number;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: UpsertBody;
  try {
    body = await request.json() as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { cardName, qty, foilQty = 0 } = body;
  if (!cardName || typeof qty !== "number") {
    return NextResponse.json({ error: "cardName and qty are required" }, { status: 400 });
  }

  await setCardQty(userId, cardName, Math.max(0, qty), Math.max(0, foilQty));
  console.log("[Collection POST]", userId.slice(0, 8), "→", cardName, "qty:", qty);
  return NextResponse.json({ ok: true, cardName: normalizeCardName(cardName), qty, foilQty });
}

// ── DELETE /api/collection?card={name} ───────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cardName = request.nextUrl.searchParams.get("card");
  if (!cardName) return NextResponse.json({ error: "card query param required" }, { status: 400 });

  await removeCard(userId, cardName);
  return NextResponse.json({ ok: true });
}

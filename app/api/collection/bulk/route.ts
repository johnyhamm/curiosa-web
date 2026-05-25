/**
 * POST /api/collection/bulk
 *
 * Bulk-upsert multiple cards at once — designed for the iOS/Android camera
 * scanner workflow. Scan a stack of cards → send one request → done.
 *
 * Body: { cards: { cardName: string, qty: number, foilQty?: number }[] }
 *
 * Cards with qty = 0 are removed from the collection.
 * Existing entries not included in the payload are left untouched.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { bulkUpdate } from "@/lib/collection";

export const dynamic = "force-dynamic";

interface BulkBody {
  cards: { cardName: string; qty: number; foilQty?: number }[];
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: BulkBody;
  try {
    body = await request.json() as BulkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.cards) || body.cards.length === 0) {
    return NextResponse.json({ error: "cards array is required and must be non-empty" }, { status: 400 });
  }

  if (body.cards.length > 500) {
    return NextResponse.json({ error: "Maximum 500 cards per bulk request" }, { status: 400 });
  }

  await bulkUpdate(userId, body.cards);
  return NextResponse.json({ ok: true, updated: body.cards.length });
}

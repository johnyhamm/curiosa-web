import { NextRequest, NextResponse } from "next/server";
import { loadCards, matchesText, normalise } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? "";
    const element = searchParams.get("element") ?? "";
    const type = searchParams.get("type") ?? "";
    const rarity = searchParams.get("rarity") ?? "";
    const set = searchParams.get("set") ?? "";
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    const cards = await loadCards();

    const results = cards
      .filter((card) => {
        if (q && !matchesText(card, q)) return false;
        if (element && normalise(card.elements) !== normalise(element)) return false;
        if (type && !normalise(card.guardian.type).includes(normalise(type))) return false;
        if (rarity && normalise(card.guardian.rarity) !== normalise(rarity)) return false;
        if (set && !card.sets.some((s) => normalise(s.name).includes(normalise(set)))) return false;
        return true;
      })
      .slice(0, limit);

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

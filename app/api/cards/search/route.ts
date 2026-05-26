import { NextRequest, NextResponse } from "next/server";
import { loadCards, matchesText, normalise } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q       = searchParams.get("q") ?? "";
    const element = searchParams.get("element") ?? "";
    const type    = searchParams.get("type") ?? "";
    const rarity  = searchParams.get("rarity") ?? "";
    const set     = searchParams.get("set") ?? "";
    const sort    = searchParams.get("sort") ?? "name-asc";
    const limit   = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const offset  = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

    const cards = await loadCards();

    // Filter
    const filtered = cards.filter((card) => {
      if (q && !matchesText(card, q)) return false;
      if (element && !card.elements.toLowerCase().includes(element.toLowerCase())) return false;
      if (type && !normalise(card.guardian.type).includes(normalise(type))) return false;
      if (rarity && normalise(card.guardian.rarity) !== normalise(rarity)) return false;
      if (set && !card.sets.some((s) => normalise(s.name).includes(normalise(set)))) return false;
      return true;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "name-desc": return b.name.localeCompare(a.name);
        case "rarity-asc": return (a.guardian.rarity ?? "").localeCompare(b.guardian.rarity ?? "");
        case "rarity-desc": return (b.guardian.rarity ?? "").localeCompare(a.guardian.rarity ?? "");
        case "cost-asc": return (a.guardian.cost ?? 0) - (b.guardian.cost ?? 0);
        case "cost-desc": return (b.guardian.cost ?? 0) - (a.guardian.cost ?? 0);
        case "name-asc":
        default: return a.name.localeCompare(b.name);
      }
    });

    const total   = sorted.length;
    const results = sorted.slice(offset, offset + limit);

    return NextResponse.json({ results, total, offset, limit });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

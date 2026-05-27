/**
 * GET /api/collection/export
 *
 * Downloads the user's collection (or missing cards) as a CSV file
 * in curiosa.io-compatible format:
 *   card name,set,finish,product,quantity,notes
 *
 * Query params:
 *   ?missing=true  — export cards NOT in the user's collection (qty 0)
 *   (default)      — export cards the user owns
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCollection } from "@/lib/collection";
import { loadCards, type Card } from "@/lib/cards";

export const dynamic = "force-dynamic";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function csvEscape(value: string | number): string {
  const s = String(value);
  // Wrap in quotes if the value contains a comma, double-quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvEscape).join(",");
}

// ─── Variant lookup ───────────────────────────────────────────────────────────

/**
 * Find the best (setName, product) pair for a given finish on a card.
 * Falls back to the first available set if no exact match for that finish.
 */
function findVariant(
  card: Card,
  finish: "Standard" | "Foil",
): { setName: string; product: string } | null {
  for (const s of card.sets) {
    for (const v of s.variants) {
      if (v.finish === finish) {
        return { setName: s.name, product: v.product || "Booster" };
      }
    }
  }
  // Fallback: first set, any variant
  if (card.sets.length > 0) {
    return {
      setName: card.sets[0].name,
      product: card.sets[0].variants[0]?.product || "Booster",
    };
  }
  return null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const missing = request.nextUrl.searchParams.get("missing") === "true";

  // Load collection + full card database in parallel
  const [collection, allCards] = await Promise.all([
    getCollection(userId),
    loadCards(),
  ]);

  // Build lookup: normalised name → Card (for set/variant metadata)
  const cardByName = new Map<string, Card>();
  for (const card of allCards) {
    cardByName.set(card.name.toLowerCase().trim(), card);
  }

  const rows: string[] = [
    csvRow(["card name", "set", "finish", "product", "quantity", "notes"]),
  ];

  if (!missing) {
    // ── Export owned cards ────────────────────────────────────────────────────
    const owned = Object.values(collection)
      .filter((e) => e.qty > 0 || e.foilQty > 0)
      .sort((a, b) => a.cardName.localeCompare(b.cardName));

    for (const entry of owned) {
      const card = cardByName.get(entry.cardName);
      // Prefer proper-cased name from card data; fall back to stored key
      const displayName = card?.name ?? entry.cardName;

      if (entry.qty > 0) {
        const v = card ? findVariant(card, "Standard") : null;
        rows.push(
          csvRow([
            displayName,
            v?.setName ?? "",
            "Standard",
            v?.product ?? "Booster",
            entry.qty,
            "",
          ]),
        );
      }

      if (entry.foilQty > 0) {
        const v = card ? findVariant(card, "Foil") : null;
        // Foil might share the same set as Standard — use Standard fallback
        const sv = card ? findVariant(card, "Standard") : null;
        rows.push(
          csvRow([
            displayName,
            v?.setName ?? sv?.setName ?? "",
            "Foil",
            v?.product ?? sv?.product ?? "Booster",
            entry.foilQty,
            "",
          ]),
        );
      }
    }
  } else {
    // ── Export missing cards ──────────────────────────────────────────────────
    const sorted = [...allCards].sort((a, b) => a.name.localeCompare(b.name));

    for (const card of sorted) {
      const key = card.name.toLowerCase().trim();
      const entry = collection[key];
      const totalOwned = (entry?.qty ?? 0) + (entry?.foilQty ?? 0);
      if (totalOwned > 0) continue; // skip cards already owned

      const v = findVariant(card, "Standard");
      rows.push(
        csvRow([
          card.name,
          v?.setName ?? "",
          "Standard",
          v?.product ?? "Booster",
          1,
          "",
        ]),
      );
    }
  }

  const csv = rows.join("\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = missing
    ? `missing-cards-${dateStr}.csv`
    : `my-collection-${dateStr}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

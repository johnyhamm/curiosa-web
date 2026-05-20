import { NextRequest, NextResponse } from "next/server";
import { fetchDeckFromApi, extractDeckId } from "@/lib/decks";
import { toSimCards, runSimulation } from "@/lib/simulator";
import type { ApiDeckCard } from "@/lib/simulator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      deckA: string;
      deckB: string;
      iterations?: number;
    };

    const { deckA, deckB } = body;
    const iterations = Math.min(2000, Math.max(50, body.iterations ?? 500));

    if (!deckA || !deckB) {
      return NextResponse.json(
        { error: "Both deckA and deckB are required." },
        { status: 400 }
      );
    }

    const idA = extractDeckId(deckA);
    const idB = extractDeckId(deckB);

    // Fetch both decks in parallel
    const [dataA, dataB] = await Promise.all([
      fetchDeckFromApi(idA),
      fetchDeckFromApi(idB),
    ]);

    const avatarCardA = dataA.avatar as ApiDeckCard | null;
    const avatarCardB = dataB.avatar as ApiDeckCard | null;

    const avatarSimA = avatarCardA
      ? toSimCards([{ ...avatarCardA, quantity: 1 }])[0]
      : {
          name: "Unknown Avatar",
          type: "Avatar" as const,
          attack: 0,
          defense: 0,
          waterT: 0,
          earthT: 0,
          fireT: 0,
          airT: 0,
          elements: [],
        };

    const avatarSimB = avatarCardB
      ? toSimCards([{ ...avatarCardB, quantity: 1 }])[0]
      : {
          name: "Unknown Avatar",
          type: "Avatar" as const,
          attack: 0,
          defense: 0,
          waterT: 0,
          earthT: 0,
          fireT: 0,
          airT: 0,
          elements: [],
        };

    const specA = {
      name: dataA.meta?.name ?? idA,
      avatar: avatarSimA,
      cards: toSimCards(dataA.decklist),
    };
    const specB = {
      name: dataB.meta?.name ?? idB,
      avatar: avatarSimB,
      cards: toSimCards(dataB.decklist),
    };

    if (specA.cards.length === 0 || specB.cards.length === 0) {
      return NextResponse.json(
        { error: "One or both decks have no cards — are they public?" },
        { status: 400 }
      );
    }

    const report = runSimulation(specA, specB, iterations);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

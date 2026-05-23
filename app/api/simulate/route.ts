import { NextRequest, NextResponse } from "next/server";
import { fetchDeckFromApi, extractDeckId } from "@/lib/decks";
import { loadCards } from "@/lib/cards";
import { toSimCards, runSimulation } from "@/lib/simulator";
import type { ApiDeckCard } from "@/lib/simulator";

export const dynamic = "force-dynamic";

interface DeckOverrideBody {
  decklist: ApiDeckCard[];
  avatar: ApiDeckCard | null;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      deckA: string;
      deckB: string;
      iterations?: number;
      /** If provided, skip fetching Deck A from curiosa.io and use this data instead. */
      deckAOverride?: DeckOverrideBody;
      /** If provided, skip fetching Deck B from curiosa.io and use this data instead. */
      deckBOverride?: DeckOverrideBody;
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

    // Fetch both decks and card database in parallel.
    // Skip API fetch for any deck that has a client-side override.
    const [dataA, dataB, allCards] = await Promise.all([
      body.deckAOverride
        ? Promise.resolve({ decklist: body.deckAOverride.decklist, avatar: body.deckAOverride.avatar, meta: { name: body.deckAOverride.name } })
        : fetchDeckFromApi(idA),
      body.deckBOverride
        ? Promise.resolve({ decklist: body.deckBOverride.decklist, avatar: body.deckBOverride.avatar, meta: { name: body.deckBOverride.name } })
        : fetchDeckFromApi(idB),
      loadCards(),
    ]);

    const rulesLookup = new Map(allCards.map(c => [c.name, c.guardian.rulesText ?? ""]));
    const lifeLookup  = new Map(allCards.map(c => [c.name, c.guardian.life ?? 0]));

    const avatarCardA = dataA.avatar as ApiDeckCard | null;
    const avatarCardB = dataB.avatar as ApiDeckCard | null;

    const unknownAvatar = {
      name: "Unknown Avatar", type: "Avatar" as const,
      attack: 0, defense: 0, life: 20, waterT: 0, earthT: 0, fireT: 0, airT: 0,
      elements: [], keywords: [], subtypes: [], rulesText: "",
    };

    const avatarSimA = avatarCardA
      ? toSimCards([{ ...avatarCardA, quantity: 1 }], rulesLookup, lifeLookup)[0]
      : unknownAvatar;

    const avatarSimB = avatarCardB
      ? toSimCards([{ ...avatarCardB, quantity: 1 }], rulesLookup, lifeLookup)[0]
      : unknownAvatar;

    const specA = {
      name: dataA.meta?.name ?? idA,
      avatar: avatarSimA,
      cards: toSimCards(dataA.decklist, rulesLookup),
    };
    const specB = {
      name: dataB.meta?.name ?? idB,
      avatar: avatarSimB,
      cards: toSimCards(dataB.decklist, rulesLookup),
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

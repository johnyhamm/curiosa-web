/**
 * Client-side utility: convert a SavedBuilderDeck into a DeckOverride that
 * can be passed to /api/simulate as deckAOverride / deckBOverride.
 *
 * Fetches full card data from /api/cards/batch (fast, cached locally by the
 * browser) and shapes it into the ApiDeckCard format the simulator expects.
 */

import type { SavedBuilderDeck } from "@/lib/builder-deck";
import type { ApiDeckCard } from "@/lib/simulator";
import type { Card } from "@/lib/cards";
import type { DeckOverride } from "@/app/simulate/DeckEditor";

/** Convert a Card (sorcerytcg.com API) to the ApiDeckCard["card"] shape. */
function cardToApiCard(card: Card): ApiDeckCard["card"] {
  const els = card.elements
    ? card.elements.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    name: card.name,
    type: card.guardian.type ?? "Minion",
    attack: card.guardian.attack ?? null,
    defense: card.guardian.defence ?? null, // Card uses British "defence"
    waterThreshold: card.guardian.thresholds?.water ?? 0,
    earthThreshold: card.guardian.thresholds?.earth ?? 0,
    fireThreshold: card.guardian.thresholds?.fire ?? 0,
    airThreshold: card.guardian.thresholds?.air ?? 0,
    elements: els.map((e) => ({ id: e.toLowerCase(), name: e })),
  };
}

/**
 * Fetches card data for all cards in the deck, then returns a DeckOverride
 * ready to send to the /api/simulate endpoint.
 */
export async function builderDeckToOverride(
  deck: SavedBuilderDeck
): Promise<DeckOverride> {
  // Collect unique names (deck entries + avatar)
  const names = [...new Set([...deck.e.map(([name]) => name), ...(deck.av ? [deck.av] : [])])];

  const res = await fetch(`/api/cards/batch?names=${encodeURIComponent(names.join(","))}`);
  if (!res.ok) throw new Error(`Failed to fetch card data (HTTP ${res.status})`);
  const cards = (await res.json()) as Card[];

  const cardMap = new Map(cards.map((c) => [c.name.toLowerCase(), c]));

  const decklist: ApiDeckCard[] = [];
  for (const [name, qty] of deck.e) {
    const card = cardMap.get(name.toLowerCase());
    if (!card) continue;
    decklist.push({ card: cardToApiCard(card), quantity: qty });
  }

  let avatar: ApiDeckCard | null = null;
  if (deck.av) {
    const avCard = cardMap.get(deck.av.toLowerCase());
    if (avCard) avatar = { card: cardToApiCard(avCard), quantity: 1 };
  }

  return { decklist, avatar, name: deck.name };
}

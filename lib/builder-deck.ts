// Shared types for saved builder decks.
// Stored compactly in Clerk privateMetadata under the key `builderDecks`.

/** [name, qty, rarity, type] — enough to reconstruct a DeckEntry on load. */
export type SlimEntry = [string, number, string, string];

export interface SavedBuilderDeck {
  /** UUID */
  id: string;
  /** Deck display name */
  name: string;
  /** Avatar card name, or null */
  av: string | null;
  /** ISO 8601 savedAt timestamp */
  at: string;
  /** Card entries in compact form */
  e: SlimEntry[];
  /** Whether the deck is publicly visible (default: false = private) */
  pub?: boolean;
}

/** A public deck snapshot stored in Redis, visible to all users. */
export interface PublicBuilderDeck {
  id: string;
  name: string;
  av: string | null;
  e: SlimEntry[];
  ownerId: string;
  ownerName: string;
  at: string;
  likes: number;
  userLiked: boolean;
}

/** Subset of Clerk privateMetadata that this app cares about. */
export interface UserMeta {
  favoriteDeckIds?: string[];
  favoriteDeckMeta?: Record<string, unknown>;
  simResults?: unknown[];
  builderDecks?: SavedBuilderDeck[];
}

export const MAX_BUILDER_DECKS = 5;

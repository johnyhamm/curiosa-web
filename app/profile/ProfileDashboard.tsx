"use client";

import { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import type { SavedBuilderDeck } from "@/lib/builder-deck";

interface FavoriteDeckMeta {
  name: string;
  avatar?: string;
  elements?: string[];
}

interface FavoritesData {
  ids: string[];
  meta: Record<string, FavoriteDeckMeta>;
}

interface SimSummary {
  id: string;
  deckAId: string;
  deckBId: string;
  deckAName: string;
  deckBName: string;
  avatarA: string;
  avatarB: string;
  winRateA: string;
  winRateB: string;
  iterations: number;
  savedAt: string;
}

function elementBadge(el: string) {
  const colors: Record<string, string> = {
    Air: "bg-sky-900/50 text-sky-300",
    Earth: "bg-green-900/50 text-green-300",
    Fire: "bg-red-900/50 text-red-300",
    Water: "bg-blue-900/50 text-blue-300",
  };
  return colors[el] ?? "bg-gray-800 text-gray-400";
}

export function ProfileDashboard() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();

  const [favorites, setFavorites] = useState<FavoritesData | null>(null);
  const [simResults, setSimResults] = useState<SimSummary[] | null>(null);
  const [builderDecks, setBuilderDecks] = useState<SavedBuilderDeck[] | null>(null);
  const [tab, setTab] = useState<"favorites" | "simulations" | "builder">("favorites");

  // Load user data
  useEffect(() => {
    fetch("/api/user/favorites")
      .then((r) => r.json())
      .then(setFavorites)
      .catch(console.error);

    fetch("/api/user/simulations")
      .then((r) => r.json())
      .then(setSimResults)
      .catch(console.error);

    fetch("/api/user/builder-decks")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBuilderDecks(d as SavedBuilderDeck[]))
      .catch(console.error);
  }, []);

  const deleteBuilderDeck = async (id: string) => {
    await fetch("/api/user/builder-decks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBuilderDecks((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
  };

  const removeFavorite = async (deckId: string) => {
    await fetch("/api/user/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId }),
    });
    setFavorites((prev) =>
      prev
        ? {
            ids: prev.ids.filter((id) => id !== deckId),
            meta: Object.fromEntries(
              Object.entries(prev.meta).filter(([id]) => id !== deckId)
            ),
          }
        : prev
    );
  };

  const removeSimResult = async (id: string) => {
    await fetch("/api/user/simulations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSimResults((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
  };

  if (!isLoaded) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "User";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* User header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-gray-950 font-black text-xl shrink-0 overflow-hidden">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          <p className="text-sm text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => openUserProfile()}
            className="text-xs text-amber-500 hover:text-amber-400 border border-amber-500/30 hover:border-amber-400/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            Manage account
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 mb-6 w-fit flex-wrap">
        <button
          onClick={() => setTab("favorites")}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            tab === "favorites"
              ? "bg-amber-500 text-gray-950"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Saved Decks{favorites ? ` (${favorites.ids.length})` : ""}
        </button>
        <button
          onClick={() => setTab("builder")}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            tab === "builder"
              ? "bg-amber-500 text-gray-950"
              : "text-gray-400 hover:text-white"
          }`}
        >
          My Builds{builderDecks ? ` (${builderDecks.length})` : ""}
        </button>
        <button
          onClick={() => setTab("simulations")}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            tab === "simulations"
              ? "bg-amber-500 text-gray-950"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Simulations{simResults ? ` (${simResults.length})` : ""}
        </button>
      </div>

      {/* Saved Decks tab */}
      {tab === "favorites" && (
        <div>
          {!favorites && (
            <p className="text-gray-500 text-sm">Loading saved decks…</p>
          )}
          {favorites && favorites.ids.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">⭐</p>
              <p>No saved decks yet.</p>
              <p className="text-sm mt-1">
                Browse the{" "}
                <Link href="/decks" className="text-amber-500 hover:text-amber-400">
                  Deck Explorer
                </Link>{" "}
                and click the star to save decks here.
              </p>
            </div>
          )}
          {favorites && favorites.ids.length > 0 && (
            <div className="flex flex-col gap-3">
              {favorites.ids.map((deckId) => {
                const m = favorites.meta[deckId];
                return (
                  <div
                    key={deckId}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{m?.name ?? deckId}</div>
                      {m?.avatar && (
                        <div className="text-sm text-gray-500 mt-0.5">Avatar: {m.avatar}</div>
                      )}
                      {m?.elements && m.elements.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {m.elements.map((el) => (
                            <span key={el} className={`text-xs rounded px-1.5 py-0.5 ${elementBadge(el)}`}>
                              {el}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`https://curiosa.io/decks/${deckId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-500 hover:text-amber-400"
                      >
                        View ↗
                      </a>
                      <button
                        onClick={() => removeFavorite(deckId)}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors ml-2"
                        title="Remove from saved"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Builder Decks tab */}
      {tab === "builder" && (
        <div>
          {!builderDecks && (
            <p className="text-gray-500 text-sm">Loading your builds…</p>
          )}
          {builderDecks && builderDecks.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">🃏</p>
              <p>No saved builds yet.</p>
              <p className="text-sm mt-1">
                Open the{" "}
                <Link href="/deckbuilder" className="text-amber-500 hover:text-amber-400">
                  Deck Builder
                </Link>{" "}
                and click <span className="text-amber-500">Save</span> to store a deck here.
              </p>
            </div>
          )}
          {builderDecks && builderDecks.length > 0 && (
            <div className="flex flex-col gap-3">
              {builderDecks.map((deck) => {
                const spellbookCount = deck.e
                  .filter(([, , , type]) => type !== "Site")
                  .reduce((s, [, qty]) => s + qty, 0);
                const atlasCount = deck.e
                  .filter(([, , , type]) => type === "Site")
                  .reduce((s, [, qty]) => s + qty, 0);
                return (
                  <div
                    key={deck.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{deck.name}</div>
                      {deck.av && (
                        <div className="text-sm text-gray-500 mt-0.5">
                          Avatar: {deck.av}
                        </div>
                      )}
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-600">
                        <span>
                          <span className="text-blue-400 font-medium">{spellbookCount}</span>
                          {" "}Spellbook
                        </span>
                        <span>
                          <span className="text-green-400 font-medium">{atlasCount}</span>
                          {" "}Atlas
                        </span>
                        <span>{new Date(deck.at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href="/deckbuilder"
                        className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
                        title="Open Deck Builder to load this deck"
                      >
                        Open Builder ↗
                      </Link>
                      <button
                        onClick={() => deleteBuilderDeck(deck.id)}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                        title="Delete this build"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-gray-700 text-center mt-2">
                Up to 5 builds saved. Load a build in the Deck Builder to edit it.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Simulations tab */}
      {tab === "simulations" && (
        <div>
          {!simResults && (
            <p className="text-gray-500 text-sm">Loading simulation history…</p>
          )}
          {simResults && simResults.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">⚔️</p>
              <p>No saved simulations yet.</p>
              <p className="text-sm mt-1">
                Run a simulation and click{" "}
                <span className="text-amber-500">Save Result</span> to log it here.
              </p>
            </div>
          )}
          {simResults && simResults.length > 0 && (
            <div className="flex flex-col gap-3">
              {simResults.map((r) => (
                <div
                  key={r.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 text-sm mb-2">
                        <span className="font-semibold text-white truncate max-w-[35%]">{r.deckAName}</span>
                        <span className="text-amber-400 font-black tabular-nums">{r.winRateA}</span>
                        <span className="text-gray-600">vs</span>
                        <span className="text-sky-400 font-black tabular-nums">{r.winRateB}</span>
                        <span className="font-semibold text-white truncate max-w-[35%]">{r.deckBName}</span>
                      </div>
                      <div className="flex gap-1 mb-1">
                        {/* Win bar */}
                        <div className="flex h-1.5 w-48 rounded-full overflow-hidden gap-px bg-gray-950">
                          <div className="bg-amber-500 h-full" style={{ width: r.winRateA }} />
                          <div className="bg-sky-500 h-full" style={{ width: r.winRateB }} />
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        {r.iterations.toLocaleString()} games ·{" "}
                        {new Date(r.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeSimResult(r.id)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuthSafe } from "@/lib/useAuthSafe";
import type { SavedBuilderDeck } from "@/lib/builder-deck";
import { builderDeckToOverride } from "@/lib/builder-deck-sim";
import { DeckPicker } from "@/app/simulate/DeckPicker";
import type { DeckOverride } from "@/app/simulate/DeckEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Deck {
  id: string;
  name: string;
  /** Set when this slot was filled from a saved builder deck. */
  override?: DeckOverride | null;
}

interface BracketMatch {
  id: string;
  deckA: Deck;
  deckB: Deck;
  status: "pending" | "running" | "done" | "error";
  winRateA: number;
  winRateB: number;
  winner: Deck | null;
  /** Series wins for each deck (>1 when best-of-3/5) */
  gamesA: number;
  gamesB: number;
  seriesLength: number; // 1, 3, or 5
}

interface BracketRound {
  label: string;
  matches: BracketMatch[];
}

type Phase = "setup" | "running" | "done";

// ─── Featured tournaments ─────────────────────────────────────────────────────

interface FeaturedEntry {
  place: number;
  player: string;
  deckName: string;
  deckId: string;
}

interface FeaturedTournament {
  title: string;
  subtitle: string;
  articleUrl: string;
  entries: FeaturedEntry[];
}

const FEATURED_TOURNAMENTS: FeaturedTournament[] = [
  {
    title: "SCG CON Washington DC — Top 8",
    subtitle: "Where Tables Connected Recap",
    articleUrl: "https://sorcerytcg.com/news/where-tables-connected-scg-con-washington-dc-recap",
    entries: [
      { place: 1, player: "Gideon M",    deckName: "TerriblePracticePrecon (Necromancer)", deckId: "cmobu9jsm00f804l1i7xlnpl0" },
      { place: 2, player: "Brian S",     deckName: "Heavier than a Duck (Persecutor)",     deckId: "cmm45q5mu00dh04l7mzhl477o" },
      { place: 3, player: "Cameron P",   deckName: "Not Another Druid List (Druid)",        deckId: "cmppimy4s005804l1m8zu23qi"  },
      { place: 4, player: "John T",      deckName: "W/A Necro Grand Contest DC (Necro)",    deckId: "cmptwc0wj000404jra5gajp9g"  },
      { place: 5, player: "Mike H",      deckName: "FE Archimago (Archimago)",              deckId: "cmpulk97l000604lg2oeaaaap"  },
      { place: 6, player: "Christian V", deckName: "Scgcon DC Imposter (Imposter)",         deckId: "cmpejfcey00ll04le33z2508i"  },
      { place: 7, player: "Tyler M",     deckName: "Water Pathfinder (Pathfinder)",         deckId: "cmpuea7lu00j204l5bvepfisb"  },
      { place: 8, player: "Tom H",       deckName: "Algor Necrobliss (Necromancer)",        deckId: "cmoz800uw00dc04l2j24vc0ro"  },
    ],
  },
];

// ─── Round labels ─────────────────────────────────────────────────────────────

const LABELS: Record<4 | 8, string[]> = {
  4: ["Semi-finals", "Final"],
  8: ["Quarter-finals", "Semi-finals", "Final"],
};

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match }: { match: BracketMatch }) {
  const { deckA, deckB, status, winRateA, winRateB, winner, gamesA, gamesB, seriesLength } = match;
  const aWon = winner?.id === deckA.id;
  const bWon = winner?.id === deckB.id;
  const isSeries = seriesLength > 1;

  function scoreLabel(deck: "A" | "B") {
    if (status !== "done" && status !== "running") return "";
    if (status === "running") return "…";
    return isSeries
      ? String(deck === "A" ? gamesA : gamesB)
      : `${(deck === "A" ? winRateA : winRateB).toFixed(1)}%`;
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        status === "running"
          ? "border-amber-700/60 bg-gray-900"
          : status === "done"
          ? "border-gray-700 bg-gray-900"
          : status === "error"
          ? "border-red-800/50 bg-gray-900"
          : "border-gray-800 bg-gray-900/40"
      }`}
    >
      {/* Series badge */}
      {isSeries && (
        <div className="px-4 pt-2.5 pb-0 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Best of {seriesLength}
          </span>
          {status === "done" && (
            <span className="text-[10px] text-gray-700">
              — {gamesA}–{gamesB}
            </span>
          )}
        </div>
      )}

      {/* Deck A */}
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 ${
          status === "done" && aWon ? "bg-amber-950/30" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {status === "done" && aWon && (
            <span className="text-amber-400 shrink-0 text-xs">🏆</span>
          )}
          <span
            className={`text-sm font-medium truncate ${
              status === "pending"
                ? "text-gray-600"
                : status === "done" && !aWon
                ? "text-gray-500"
                : "text-white"
            }`}
          >
            {status === "pending" ? "TBD" : deckA.name}
          </span>
        </div>
        <span
          className={`text-sm font-mono font-bold shrink-0 ${
            status === "done"
              ? aWon ? "text-amber-400" : "text-gray-600"
              : "text-gray-700"
          }`}
        >
          {scoreLabel("A")}
        </span>
      </div>

      <div className="border-t border-gray-800 mx-3" />

      {/* Deck B */}
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 ${
          status === "done" && bWon ? "bg-amber-950/30" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {status === "done" && bWon && (
            <span className="text-amber-400 shrink-0 text-xs">🏆</span>
          )}
          <span
            className={`text-sm font-medium truncate ${
              status === "pending"
                ? "text-gray-600"
                : status === "done" && !bWon
                ? "text-gray-500"
                : "text-white"
            }`}
          >
            {status === "pending" ? "TBD" : deckB.name}
          </span>
        </div>
        <span
          className={`text-sm font-mono font-bold shrink-0 ${
            status === "done"
              ? bWon ? "text-amber-400" : "text-gray-600"
              : "text-gray-700"
          }`}
        >
          {scoreLabel("B")}
        </span>
      </div>

      {/* Bar — shows win rate for BO1, series split for BO3/5 */}
      {status === "done" && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-950 gap-px">
            <div
              className="bg-amber-500 h-full transition-all duration-700 rounded-l-full"
              style={{ width: `${isSeries ? (gamesA / (gamesA + gamesB)) * 100 : winRateA}%` }}
            />
            <div
              className="bg-sky-500 h-full transition-all duration-700 rounded-r-full"
              style={{ width: `${isSeries ? (gamesB / (gamesA + gamesB)) * 100 : winRateB}%` }}
            />
          </div>
        </div>
      )}

      {status === "running" && (
        <div className="px-4 pb-3 pt-1">
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full w-1/2 bg-amber-600/40 rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="px-4 pb-3 text-xs text-red-500">Simulation failed</div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const { isSignedIn } = useAuthSafe();

  const [size, setSize] = useState<4 | 8>(4);
  const [slotIds, setSlotIds]           = useState<string[]>(Array(4).fill(""));
  const [slotNames, setSlotNames]       = useState<string[]>(Array(4).fill(""));
  const [slotOverrides, setSlotOverrides] = useState<(DeckOverride | null)[]>(Array(4).fill(null));
  const [iterations, setIterations] = useState(200);
  const [qfGames, setQfGames] = useState<1 | 3 | 5>(3);
  const [phase, setPhase]     = useState<Phase>("setup");
  const [rounds, setRounds]   = useState<BracketRound[]>([]);
  const [champion, setChampion] = useState<Deck | null>(null);
  const [builderDecks, setBuilderDecks] = useState<SavedBuilderDeck[]>([]);

  // ── Load saved builder decks when signed in ────────────────────────────────

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/builder-decks")
      .then(r => r.ok ? r.json() : [])
      .then(d => setBuilderDecks(d as SavedBuilderDeck[]))
      .catch(console.error);
  }, [isSignedIn]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function changeSize(n: 4 | 8) {
    setSize(n);
    setSlotIds(Array(n).fill(""));
    setSlotNames(Array(n).fill(""));
    setSlotOverrides(Array(n).fill(null));
    reset();
  }

  function reset() {
    setRounds([]);
    setChampion(null);
    setPhase("setup");
  }

  function setSlot(i: number, id: string, name?: string, override: DeckOverride | null = null) {
    setSlotIds(prev      => { const x = [...prev]; x[i] = id;           return x; });
    setSlotNames(prev    => { const x = [...prev]; x[i] = name ?? id;   return x; });
    setSlotOverrides(prev => { const x = [...prev]; x[i] = override;    return x; });
    reset();
  }

  function loadFeatured(ft: FeaturedTournament) {
    const n = ft.entries.length as 4 | 8;
    setSize(n);
    setSlotIds(ft.entries.map(e => e.deckId));
    setSlotNames(ft.entries.map(e => `${e.player} – ${e.deckName}`));
    setSlotOverrides(Array(n).fill(null));
    reset();
  }

  const decks: Deck[] = slotIds.map((id, i) => ({
    id,
    name: slotNames[i] || id,
    override: slotOverrides[i],
  }));
  const filled    = decks.filter(d => d.id.trim()).length;
  const canRun    = filled === size && phase === "setup";

  // ── Tournament runner ──────────────────────────────────────────────────────

  async function run() {
    setPhase("running");
    setRounds([]);
    setChampion(null);

    const labels = LABELS[size];
    let pool = decks.filter(d => d.id.trim()).slice(0, size);

    for (let ri = 0; ri < labels.length; ri++) {
      // Quarter-finals (first round of an 8-deck bracket) use the configured series length
      const seriesLength = (size === 8 && ri === 0) ? qfGames : 1;

      // Build match stubs for this round
      const matches: BracketMatch[] = [];
      for (let i = 0; i < pool.length; i += 2) {
        matches.push({
          id: `r${ri}-m${i / 2}`,
          deckA: pool[i],
          deckB: pool[i + 1],
          status: "pending",
          winRateA: 0,
          winRateB: 0,
          winner: null,
          gamesA: 0,
          gamesB: 0,
          seriesLength,
        });
      }

      // Show the round with pending cards
      setRounds(prev => [...prev, { label: labels[ri], matches }]);
      await new Promise(r => setTimeout(r, 80));

      // Flip all to "running"
      setRounds(prev =>
        prev.map((round, idx) =>
          idx !== ri
            ? round
            : { ...round, matches: round.matches.map(m => ({ ...m, status: "running" as const })) }
        )
      );
      await new Promise(r => setTimeout(r, 60));

      // Run all matches in this round concurrently
      const winners: Deck[] = new Array(matches.length);

      await Promise.all(
        matches.map(async (match, mi) => {
          try {
            const needed = Math.ceil(match.seriesLength / 2);
            let gamesA = 0, gamesB = 0;
            let lastWinA = 50, lastWinB = 50;
            let resolvedA: Deck = { id: match.deckA.id, name: match.deckA.name, override: match.deckA.override };
            let resolvedB: Deck = { id: match.deckB.id, name: match.deckB.name, override: match.deckB.override };

            // Play games until one deck clinches the series
            while (gamesA < needed && gamesB < needed) {
              const res = await fetch("/api/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  deckA: match.deckA.id,
                  deckB: match.deckB.id,
                  iterations,
                  ...(match.deckA.override ? { deckAOverride: match.deckA.override } : {}),
                  ...(match.deckB.override ? { deckBOverride: match.deckB.override } : {}),
                }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = (await res.json()) as {
                winRateA: string; winRateB: string;
                deckAName: string; deckBName: string;
              };

              lastWinA = parseFloat(data.winRateA);
              lastWinB = parseFloat(data.winRateB);
              resolvedA = { id: match.deckA.id, name: data.deckAName || match.deckA.name, override: match.deckA.override };
              resolvedB = { id: match.deckB.id, name: data.deckBName || match.deckB.name, override: match.deckB.override };

              if (lastWinA >= lastWinB) gamesA++; else gamesB++;

              // Update score mid-series so the card shows live progress
              if (match.seriesLength > 1) {
                setRounds(prev =>
                  prev.map((round, rIdx) =>
                    rIdx !== ri ? round : {
                      ...round,
                      matches: round.matches.map((m, mIdx) =>
                        mIdx !== mi ? m : { ...m, gamesA, gamesB }
                      ),
                    }
                  )
                );
              }
            }

            const winner = gamesA >= needed ? resolvedA : resolvedB;
            winners[mi] = winner;

            setRounds(prev =>
              prev.map((round, rIdx) =>
                rIdx !== ri
                  ? round
                  : {
                      ...round,
                      matches: round.matches.map((m, mIdx) =>
                        mIdx !== mi
                          ? m
                          : {
                              ...m,
                              status: "done" as const,
                              deckA: resolvedA,
                              deckB: resolvedB,
                              winRateA: lastWinA,
                              winRateB: lastWinB,
                              gamesA,
                              gamesB,
                              winner,
                            }
                      ),
                    }
              )
            );
          } catch {
            winners[mi] = match.deckA; // advance deckA on error
            setRounds(prev =>
              prev.map((round, rIdx) =>
                rIdx !== ri ? round : {
                  ...round,
                  matches: round.matches.map((m, mIdx) =>
                    mIdx !== mi ? m : { ...m, status: "error" as const, gamesA: 0, gamesB: 0 }
                  ),
                }
              )
            );
          }
        })
      );

      pool = winners.filter(Boolean);
    }

    setChampion(pool[0] ?? null);
    setPhase("done");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>Tournament Bracket</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Single-elimination tournament. Every matchup runs a full Monte Carlo simulation — the
        deck with the higher win rate advances.
      </p>

      {/* ── Featured tournaments ── */}
      {FEATURED_TOURNAMENTS.map((ft) => (
        <div key={ft.title} className="bg-gray-900 border border-amber-700/30 rounded-xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Featured</span>
                <span className="text-xs text-gray-600">·</span>
                <a
                  href={ft.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
                >
                  {ft.subtitle} ↗
                </a>
              </div>
              <h2 className="text-base font-bold text-white mb-3" style={{ fontFamily: "var(--font-cinzel)" }}>
                {ft.title}
              </h2>
              {/* Deck list */}
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {ft.entries.map((e) => (
                  <div key={e.deckId} className="flex items-baseline gap-2 text-sm">
                    <span className="text-gray-600 font-mono w-4 shrink-0 text-right">{e.place}.</span>
                    <span className="text-gray-400 shrink-0">{e.player}</span>
                    <span className="text-gray-600 truncate text-xs">{e.deckName}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* CTA */}
            <button
              type="button"
              onClick={() => loadFeatured(ft)}
              className="shrink-0 self-start sm:self-center bg-amber-500 hover:bg-amber-400
                text-gray-950 font-bold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              Load Top 8 →
            </button>
          </div>
        </div>
      ))}

      {/* ── Setup panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8 flex flex-col gap-5">

        {/* Size toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-300">Format</span>
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            {([4, 8] as const).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => changeSize(n)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  size === n
                    ? "bg-amber-500 text-gray-950"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {n} Decks
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-600">
            {size === 4 ? "2 rounds" : "3 rounds"}
          </span>
        </div>

        {/* Deck slots */}
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: size }).map((_, i) => (
            <DeckPicker
              key={`${size}-${i}`}
              label={`Deck ${i + 1}`}
              value={slotIds[i] ?? ""}
              onChange={(id, name) => {
                if (!id.startsWith("builder:")) setSlot(i, id, name, null);
              }}
              accentColor={i % 2 === 0 ? "amber" : "sky"}
              savedDecks={builderDecks}
              onBuilderDeck={async (deck) => {
                try {
                  const override = await builderDeckToOverride(deck);
                  setSlot(i, "builder:" + deck.id, deck.name, override);
                } catch (e) { console.error("Failed to load builder deck:", e); }
              }}
            />
          ))}
        </div>

        {/* QF format — only shown for 8-deck brackets */}
        {size === 8 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-300">Quarter-finals</span>
            <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
              {([1, 3, 5] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQfGames(n)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    qfGames === n
                      ? "bg-amber-500 text-gray-950"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {n === 1 ? "BO1" : `BO${n}`}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-600">
              {qfGames === 1 ? "single game" : `best of ${qfGames}`}
            </span>
          </div>
        )}

        {/* Iterations slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-gray-300">Simulations per match</label>
            <span className="text-amber-400 font-mono font-bold">{iterations}</span>
          </div>
          <input
            type="range"
            min={100}
            max={500}
            step={50}
            value={iterations}
            onChange={e => setIterations(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>100 — fast</span>
            <span>500 — more accurate</span>
          </div>
        </div>

        {/* Run / status button */}
        <button
          type="button"
          onClick={run}
          disabled={phase !== "setup" || filled < size}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed
            text-gray-950 font-bold px-6 py-3 rounded-lg transition-colors text-base"
        >
          {phase === "running"
            ? "Running tournament…"
            : filled < size
            ? `Choose ${size - filled} more deck${size - filled !== 1 ? "s" : ""} to continue`
            : "▶ Run Tournament"}
        </button>
      </div>

      {/* ── Bracket results ── */}
      {rounds.length > 0 && (
        <div className="flex flex-col gap-10">
          {rounds.map((round, ri) => (
            <section key={ri}>
              {/* Round header */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
                  {round.label}
                </h2>
                <div className="flex-1 border-t border-gray-800" />
                <span className="text-xs text-gray-700 shrink-0">
                  {round.matches.filter(m => m.status === "done").length}/
                  {round.matches.length} done
                </span>
              </div>

              {/* Match cards */}
              <div
                className={`grid gap-3 ${
                  round.matches.length === 1
                    ? "sm:w-1/2"
                    : "grid-cols-1 sm:grid-cols-2"
                }`}
              >
                {round.matches.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          ))}

          {/* Champion banner */}
          {champion && (
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-8 text-center">
              <div className="text-5xl mb-3">🏆</div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">
                Tournament Champion
              </p>
              <p className="text-2xl font-black text-amber-300">{champion.name}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-6 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300
                  border border-gray-700 rounded-lg transition-colors"
              >
                Run again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {rounds.length === 0 && phase === "setup" && (
        <div className="text-center py-16 text-gray-600">
          Select {size} decks above and press Run Tournament.
        </div>
      )}
    </div>
  );
}

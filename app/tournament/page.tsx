"use client";

import { useState } from "react";
import { DeckPicker } from "@/app/simulate/DeckPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Deck {
  id: string;
  name: string;
}

interface BracketMatch {
  id: string;
  deckA: Deck;
  deckB: Deck;
  status: "pending" | "running" | "done" | "error";
  winRateA: number;
  winRateB: number;
  winner: Deck | null;
}

interface BracketRound {
  label: string;
  matches: BracketMatch[];
}

type Phase = "setup" | "running" | "done";

// ─── Round labels ─────────────────────────────────────────────────────────────

const LABELS: Record<4 | 8, string[]> = {
  4: ["Semi-finals", "Final"],
  8: ["Quarter-finals", "Semi-finals", "Final"],
};

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match }: { match: BracketMatch }) {
  const { deckA, deckB, status, winRateA, winRateB, winner } = match;
  const aWon = winner?.id === deckA.id;
  const bWon = winner?.id === deckB.id;

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
              ? aWon
                ? "text-amber-400"
                : "text-gray-600"
              : "text-gray-700"
          }`}
        >
          {status === "done"
            ? `${winRateA.toFixed(1)}%`
            : status === "running"
            ? "…"
            : ""}
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
              ? bWon
                ? "text-amber-400"
                : "text-gray-600"
              : "text-gray-700"
          }`}
        >
          {status === "done"
            ? `${winRateB.toFixed(1)}%`
            : status === "running"
            ? "…"
            : ""}
        </span>
      </div>

      {/* Win-rate bar */}
      {status === "done" && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-950 gap-px">
            {winRateA > 0 && (
              <div
                className="bg-amber-500 h-full transition-all duration-700 rounded-l-full"
                style={{ width: `${winRateA}%` }}
              />
            )}
            {winRateB > 0 && (
              <div
                className="bg-sky-500 h-full transition-all duration-700 rounded-r-full"
                style={{ width: `${winRateB}%` }}
              />
            )}
          </div>
        </div>
      )}

      {/* Running shimmer */}
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
  const [size, setSize] = useState<4 | 8>(4);
  const [slotIds, setSlotIds]     = useState<string[]>(Array(4).fill(""));
  const [slotNames, setSlotNames] = useState<string[]>(Array(4).fill(""));
  const [iterations, setIterations] = useState(200);
  const [phase, setPhase]     = useState<Phase>("setup");
  const [rounds, setRounds]   = useState<BracketRound[]>([]);
  const [champion, setChampion] = useState<Deck | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function changeSize(n: 4 | 8) {
    setSize(n);
    setSlotIds(Array(n).fill(""));
    setSlotNames(Array(n).fill(""));
    reset();
  }

  function reset() {
    setRounds([]);
    setChampion(null);
    setPhase("setup");
  }

  function setSlot(i: number, id: string, name?: string) {
    setSlotIds(prev   => { const x = [...prev];   x[i] = id;           return x; });
    setSlotNames(prev => { const x = [...prev];   x[i] = name ?? id;   return x; });
    reset();
  }

  const decks: Deck[] = slotIds.map((id, i) => ({ id, name: slotNames[i] || id }));
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
            const res = await fetch("/api/simulate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deckA: match.deckA.id, deckB: match.deckB.id, iterations }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as {
              winRateA: string; winRateB: string;
              deckAName: string; deckBName: string;
            };

            const winA = parseFloat(data.winRateA);
            const winB = parseFloat(data.winRateB);
            // Prefer the canonical name returned by the API
            const resolvedA: Deck = { id: match.deckA.id, name: data.deckAName || match.deckA.name };
            const resolvedB: Deck = { id: match.deckB.id, name: data.deckBName || match.deckB.name };
            const winner = winA >= winB ? resolvedA : resolvedB;
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
                              winRateA: winA,
                              winRateB: winB,
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
                rIdx !== ri
                  ? round
                  : {
                      ...round,
                      matches: round.matches.map((m, mIdx) =>
                        mIdx !== mi ? m : { ...m, status: "error" as const }
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
              onChange={(id, name) => setSlot(i, id, name)}
              accentColor={i % 2 === 0 ? "amber" : "sky"}
            />
          ))}
        </div>

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

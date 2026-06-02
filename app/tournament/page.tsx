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
  gamesA: number;
  gamesB: number;
  seriesLength: number;
}

interface BracketRound {
  label: string;
  matches: BracketMatch[];
}

interface GroupEntry {
  deck: Deck;
  wins: number;
  losses: number;
  points: number;
}

interface GroupResult {
  label: string;
  entries: GroupEntry[];
  matches: BracketMatch[];
  phase: "pending" | "running" | "done";
}

type TournamentMode = "elim" | "worldcup";
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

const ELIM_LABELS: Record<4 | 8, string[]> = {
  4: ["Semi-finals", "Final"],
  8: ["Quarter-finals", "Semi-finals", "Final"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortedStandings(entries: GroupEntry[]): GroupEntry[] {
  return [...entries].sort((a, b) =>
    b.points !== a.points ? b.points - a.points : b.wins - a.wins
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match, compact = false }: { match: BracketMatch; compact?: boolean }) {
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
    <div className={`rounded-xl border overflow-hidden transition-colors ${
      status === "running" ? "border-amber-700/60 bg-gray-900"
        : status === "done" ? "border-gray-700 bg-gray-900"
        : status === "error" ? "border-red-800/50 bg-gray-900"
        : "border-gray-800 bg-gray-900/40"
    }`}>
      {isSeries && (
        <div className="px-4 pt-2.5 pb-0 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Best of {seriesLength}
          </span>
          {status === "done" && (
            <span className="text-[10px] text-gray-700">— {gamesA}–{gamesB}</span>
          )}
        </div>
      )}

      {/* Deck A */}
      <div className={`flex items-center justify-between gap-3 px-4 ${compact ? "py-2" : "py-3"} ${status === "done" && aWon ? "bg-amber-950/30" : ""}`}>
        <div className="flex items-center gap-2 min-w-0">
          {status === "done" && aWon && <span className="text-amber-400 shrink-0 text-xs">🏆</span>}
          <span className={`${compact ? "text-xs" : "text-sm"} font-medium truncate ${
            status === "pending" ? "text-gray-600"
              : status === "done" && !aWon ? "text-gray-500"
              : "text-white"
          }`}>
            {status === "pending" ? "TBD" : deckA.name}
          </span>
        </div>
        <span className={`${compact ? "text-xs" : "text-sm"} font-mono font-bold shrink-0 ${
          status === "done" ? (aWon ? "text-amber-400" : "text-gray-600") : "text-gray-700"
        }`}>{scoreLabel("A")}</span>
      </div>

      <div className="border-t border-gray-800 mx-3" />

      {/* Deck B */}
      <div className={`flex items-center justify-between gap-3 px-4 ${compact ? "py-2" : "py-3"} ${status === "done" && bWon ? "bg-amber-950/30" : ""}`}>
        <div className="flex items-center gap-2 min-w-0">
          {status === "done" && bWon && <span className="text-amber-400 shrink-0 text-xs">🏆</span>}
          <span className={`${compact ? "text-xs" : "text-sm"} font-medium truncate ${
            status === "pending" ? "text-gray-600"
              : status === "done" && !bWon ? "text-gray-500"
              : "text-white"
          }`}>
            {status === "pending" ? "TBD" : deckB.name}
          </span>
        </div>
        <span className={`${compact ? "text-xs" : "text-sm"} font-mono font-bold shrink-0 ${
          status === "done" ? (bWon ? "text-amber-400" : "text-gray-600") : "text-gray-700"
        }`}>{scoreLabel("B")}</span>
      </div>

      {status === "done" && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-950 gap-px">
            <div className="bg-amber-500 h-full transition-all duration-700 rounded-l-full"
              style={{ width: `${isSeries ? (gamesA / (gamesA + gamesB)) * 100 : winRateA}%` }} />
            <div className="bg-sky-500 h-full transition-all duration-700 rounded-r-full"
              style={{ width: `${isSeries ? (gamesB / (gamesA + gamesB)) * 100 : winRateB}%` }} />
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
      {status === "error" && <div className="px-4 pb-3 text-xs text-red-500">Simulation failed</div>}
    </div>
  );
}

// ─── Group standings table ─────────────────────────────────────────────────────

function GroupTable({ group }: { group: GroupResult }) {
  const sorted = sortedStandings(group.entries);
  const qualifyLine = 2; // top 2 advance

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-cinzel)" }}>
          {group.label}
        </h3>
        <span className={`text-xs font-medium ${
          group.phase === "running" ? "text-amber-400" :
          group.phase === "done" ? "text-green-500" : "text-gray-600"
        }`}>
          {group.phase === "running" ? "Playing…" : group.phase === "done" ? "Complete" : "Pending"}
        </span>
      </div>

      {/* Standings */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-600 border-b border-gray-800/50">
            <th className="text-left px-4 py-2 font-medium">#</th>
            <th className="text-left px-4 py-2 font-medium">Deck</th>
            <th className="text-center px-2 py-2 font-medium">W</th>
            <th className="text-center px-2 py-2 font-medium">L</th>
            <th className="text-center px-3 py-2 font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const qualifies = i < qualifyLine;
            const eliminated = group.phase === "done" && !qualifies;
            return (
              <tr key={entry.deck.id}
                className={`border-b border-gray-800/30 last:border-0 transition-colors ${
                  qualifies && group.phase === "done" ? "bg-amber-950/20" : ""
                }`}>
                <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {qualifies && group.phase === "done" && (
                      <span className="text-amber-400 text-xs shrink-0">✓</span>
                    )}
                    <span className={`truncate max-w-[180px] ${eliminated ? "text-gray-600" : "text-white"}`}>
                      {entry.deck.name}
                    </span>
                  </div>
                </td>
                <td className={`text-center px-2 py-2.5 font-mono ${eliminated ? "text-gray-600" : "text-gray-300"}`}>
                  {entry.wins}
                </td>
                <td className={`text-center px-2 py-2.5 font-mono ${eliminated ? "text-gray-600" : "text-gray-300"}`}>
                  {entry.losses}
                </td>
                <td className={`text-center px-3 py-2.5 font-mono font-bold ${
                  eliminated ? "text-gray-600" : qualifies ? "text-amber-400" : "text-gray-300"
                }`}>
                  {entry.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Matches */}
      <div className="border-t border-gray-800 p-3 grid grid-cols-2 gap-2">
        {group.matches.map(m => <MatchCard key={m.id} match={m} compact />)}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const { isSignedIn } = useAuthSafe();

  const [mode, setMode] = useState<TournamentMode>("elim");

  // Shared
  const [size, setSize] = useState<4 | 8>(4);
  const [slotIds, setSlotIds]           = useState<string[]>(Array(4).fill(""));
  const [slotNames, setSlotNames]       = useState<string[]>(Array(4).fill(""));
  const [slotOverrides, setSlotOverrides] = useState<(DeckOverride | null)[]>(Array(4).fill(null));
  const [iterations, setIterations] = useState(200);
  const [builderDecks, setBuilderDecks] = useState<SavedBuilderDeck[]>([]);

  // Single-elimination state
  const [qfGames, setQfGames] = useState<1 | 3 | 5>(3);
  const [phase, setPhase]     = useState<Phase>("setup");
  const [rounds, setRounds]   = useState<BracketRound[]>([]);
  const [champion, setChampion] = useState<Deck | null>(null);

  // World Cup state
  const [wcGroups, setWcGroups] = useState<GroupResult[]>([]);
  const [wcKnockoutRounds, setWcKnockoutRounds] = useState<BracketRound[]>([]);
  const [wcChampion, setWcChampion] = useState<Deck | null>(null);
  const [wcPhase, setWcPhase] = useState<"setup" | "groups" | "knockouts" | "done">("setup");

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/builder-decks")
      .then(r => r.ok ? r.json() : [])
      .then(d => setBuilderDecks(d as SavedBuilderDeck[]))
      .catch(console.error);
  }, [isSignedIn]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function changeMode(m: TournamentMode) {
    setMode(m);
    const n = m === "worldcup" ? 8 : 4;
    setSize(n);
    setSlotIds(Array(n).fill(""));
    setSlotNames(Array(n).fill(""));
    setSlotOverrides(Array(n).fill(null));
    resetAll();
  }

  function changeSize(n: 4 | 8) {
    setSize(n);
    setSlotIds(Array(n).fill(""));
    setSlotNames(Array(n).fill(""));
    setSlotOverrides(Array(n).fill(null));
    resetAll();
  }

  function resetAll() {
    setPhase("setup");
    setRounds([]);
    setChampion(null);
    setWcPhase("setup");
    setWcGroups([]);
    setWcKnockoutRounds([]);
    setWcChampion(null);
  }

  function setSlot(i: number, id: string, name?: string, override: DeckOverride | null = null) {
    setSlotIds(prev      => { const x = [...prev]; x[i] = id;         return x; });
    setSlotNames(prev    => { const x = [...prev]; x[i] = name ?? id; return x; });
    setSlotOverrides(prev => { const x = [...prev]; x[i] = override;  return x; });
    resetAll();
  }

  function loadFeatured(ft: FeaturedTournament) {
    const n = ft.entries.length as 4 | 8;
    setMode(n === 8 ? mode : "elim");
    setSize(n);
    setSlotIds(ft.entries.map(e => e.deckId));
    setSlotNames(ft.entries.map(e => `${e.player} – ${e.deckName}`));
    setSlotOverrides(Array(n).fill(null));
    resetAll();
  }

  const decks: Deck[] = slotIds.map((id, i) => ({
    id,
    name: slotNames[i] || id,
    override: slotOverrides[i],
  }));
  const filled = decks.filter(d => d.id.trim()).length;
  const canRun = filled === size;

  // ── Simulate one match (returns resolved decks + result) ──────────────────

  async function simulateMatch(
    deckA: Deck,
    deckB: Deck,
    seriesLength: number,
  ): Promise<{ resolvedA: Deck; resolvedB: Deck; winner: Deck; gamesA: number; gamesB: number; winRateA: number; winRateB: number }> {
    const needed = Math.ceil(seriesLength / 2);
    let gamesA = 0, gamesB = 0, lastWinA = 50, lastWinB = 50;
    let resolvedA = deckA, resolvedB = deckB;

    while (gamesA < needed && gamesB < needed) {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckA: deckA.id, deckB: deckB.id, iterations,
          ...(deckA.override ? { deckAOverride: deckA.override } : {}),
          ...(deckB.override ? { deckBOverride: deckB.override } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { winRateA: string; winRateB: string; deckAName: string; deckBName: string };
      lastWinA = parseFloat(data.winRateA);
      lastWinB = parseFloat(data.winRateB);
      resolvedA = { ...deckA, name: data.deckAName || deckA.name };
      resolvedB = { ...deckB, name: data.deckBName || deckB.name };
      if (lastWinA >= lastWinB) gamesA++; else gamesB++;
    }

    const winner = gamesA >= needed ? resolvedA : resolvedB;
    return { resolvedA, resolvedB, winner, gamesA, gamesB, winRateA: lastWinA, winRateB: lastWinB };
  }

  // ── Single-elimination ────────────────────────────────────────────────────

  async function runElim() {
    setPhase("running");
    setRounds([]);
    setChampion(null);

    const labels = ELIM_LABELS[size];
    let pool = decks.filter(d => d.id.trim()).slice(0, size);

    for (let ri = 0; ri < labels.length; ri++) {
      const seriesLength = (size === 8 && ri === 0) ? qfGames : 1;

      const matches: BracketMatch[] = pool.reduce<BracketMatch[]>((acc, _, i) => {
        if (i % 2 === 0) acc.push({
          id: `r${ri}-m${i / 2}`,
          deckA: pool[i], deckB: pool[i + 1],
          status: "pending", winRateA: 0, winRateB: 0, winner: null,
          gamesA: 0, gamesB: 0, seriesLength,
        });
        return acc;
      }, []);

      setRounds(prev => [...prev, { label: labels[ri], matches }]);
      await new Promise(r => setTimeout(r, 80));
      setRounds(prev => prev.map((round, idx) =>
        idx !== ri ? round : { ...round, matches: round.matches.map(m => ({ ...m, status: "running" as const })) }
      ));
      await new Promise(r => setTimeout(r, 60));

      const winners: Deck[] = new Array(matches.length);

      await Promise.all(matches.map(async (match, mi) => {
        try {
          const result = await simulateMatch(match.deckA, match.deckB, seriesLength);
          winners[mi] = result.winner;
          setRounds(prev => prev.map((round, rIdx) => rIdx !== ri ? round : {
            ...round,
            matches: round.matches.map((m, mIdx) => mIdx !== mi ? m : {
              ...m, status: "done" as const,
              deckA: result.resolvedA, deckB: result.resolvedB,
              winRateA: result.winRateA, winRateB: result.winRateB,
              gamesA: result.gamesA, gamesB: result.gamesB,
              winner: result.winner,
            }),
          }));
        } catch {
          winners[mi] = match.deckA;
          setRounds(prev => prev.map((round, rIdx) => rIdx !== ri ? round : {
            ...round,
            matches: round.matches.map((m, mIdx) => mIdx !== mi ? m : { ...m, status: "error" as const, gamesA: 0, gamesB: 0 }),
          }));
        }
      }));

      pool = winners.filter(Boolean);
    }

    setChampion(pool[0] ?? null);
    setPhase("done");
  }

  // ── World Cup ─────────────────────────────────────────────────────────────

  async function runWorldCup() {
    setWcPhase("groups");
    setWcKnockoutRounds([]);
    setWcChampion(null);

    const allDecks = decks.filter(d => d.id.trim()).slice(0, 8);
    const groupDecks = [allDecks.slice(0, 4), allDecks.slice(4, 8)];

    // Build round-robin matches for each group
    const initialGroups: GroupResult[] = groupDecks.map((gd, gi) => {
      const matches: BracketMatch[] = [];
      for (let a = 0; a < gd.length; a++) {
        for (let b = a + 1; b < gd.length; b++) {
          matches.push({
            id: `g${gi}-${a}-${b}`,
            deckA: gd[a], deckB: gd[b],
            status: "pending", winRateA: 0, winRateB: 0, winner: null,
            gamesA: 0, gamesB: 0, seriesLength: 1,
          });
        }
      }
      return {
        label: gi === 0 ? "Group A" : "Group B",
        entries: gd.map(d => ({ deck: d, wins: 0, losses: 0, points: 0 })),
        matches,
        phase: "pending" as const,
      };
    });

    setWcGroups(initialGroups);
    await new Promise(r => setTimeout(r, 100));

    // Run both groups concurrently
    await Promise.all(initialGroups.map(async (group, gi) => {
      setWcGroups(prev => prev.map((g, i) => i !== gi ? g : { ...g, phase: "running" }));

      // Mark all matches as running
      setWcGroups(prev => prev.map((g, i) => i !== gi ? g : {
        ...g,
        matches: g.matches.map(m => ({ ...m, status: "running" as const })),
      }));

      // Simulate all round-robin matches concurrently within the group
      await Promise.all(group.matches.map(async (match, mi) => {
        try {
          const result = await simulateMatch(match.deckA, match.deckB, 1);

          setWcGroups(prev => prev.map((g, i) => {
            if (i !== gi) return g;
            const loser = result.winner.id === match.deckA.id ? result.resolvedB : result.resolvedA;
            return {
              ...g,
              matches: g.matches.map((m, mIdx) => mIdx !== mi ? m : {
                ...m, status: "done" as const,
                deckA: result.resolvedA, deckB: result.resolvedB,
                winRateA: result.winRateA, winRateB: result.winRateB,
                gamesA: result.gamesA, gamesB: result.gamesB,
                winner: result.winner,
              }),
              entries: g.entries.map(e => {
                if (e.deck.id === result.winner.id) return { ...e, wins: e.wins + 1, points: e.points + 3 };
                if (e.deck.id === loser.id)         return { ...e, losses: e.losses + 1 };
                return e;
              }),
            };
          }));
        } catch {
          setWcGroups(prev => prev.map((g, i) => i !== gi ? g : {
            ...g,
            matches: g.matches.map((m, mIdx) => mIdx !== mi ? m : { ...m, status: "error" as const }),
          }));
        }
      }));

      setWcGroups(prev => prev.map((g, i) => i !== gi ? g : { ...g, phase: "done" }));
    }));

    // ── Knockouts ────────────────────────────────────────────────────────────

    setWcPhase("knockouts");
    await new Promise(r => setTimeout(r, 300));

    // Grab final standings (read from state)
    // Re-derive sorted standings from current wcGroups state
    // We need to read current state, but since we're in an async function,
    // we track the final entries locally through the updates we made
    // Re-read from a ref-like approach: snapshot after awaits complete
    let finalGroups: GroupResult[] = [];
    setWcGroups(prev => { finalGroups = prev; return prev; });

    await new Promise(r => setTimeout(r, 50)); // let setState settle

    // Read snapshot (will be stale if rapid updates, so we re-derive)
    // Actually build standings from scratch by re-reading wcGroups via a promise
    const groupsSnapshot = await new Promise<GroupResult[]>(resolve => {
      setWcGroups(prev => { resolve(prev); return prev; });
    });

    const [groupA, groupB] = groupsSnapshot.map(g => sortedStandings(g.entries));

    // SF1: A1 vs B2,  SF2: B1 vs A2
    const sfPool = [groupA[0].deck, groupB[1].deck, groupB[0].deck, groupA[1].deck];
    const knockoutLabels = ["Semi-finals", "Final"];
    let pool = sfPool;

    for (let ri = 0; ri < knockoutLabels.length; ri++) {
      const matches: BracketMatch[] = pool.reduce<BracketMatch[]>((acc, _, i) => {
        if (i % 2 === 0) acc.push({
          id: `kn${ri}-m${i / 2}`,
          deckA: pool[i], deckB: pool[i + 1],
          status: "pending", winRateA: 0, winRateB: 0, winner: null,
          gamesA: 0, gamesB: 0, seriesLength: 1,
        });
        return acc;
      }, []);

      setWcKnockoutRounds(prev => [...prev, { label: knockoutLabels[ri], matches }]);
      await new Promise(r => setTimeout(r, 80));
      setWcKnockoutRounds(prev => prev.map((round, idx) =>
        idx !== ri ? round : { ...round, matches: round.matches.map(m => ({ ...m, status: "running" as const })) }
      ));
      await new Promise(r => setTimeout(r, 60));

      const winners: Deck[] = new Array(matches.length);

      await Promise.all(matches.map(async (match, mi) => {
        try {
          const result = await simulateMatch(match.deckA, match.deckB, 1);
          winners[mi] = result.winner;
          setWcKnockoutRounds(prev => prev.map((round, rIdx) => rIdx !== ri ? round : {
            ...round,
            matches: round.matches.map((m, mIdx) => mIdx !== mi ? m : {
              ...m, status: "done" as const,
              deckA: result.resolvedA, deckB: result.resolvedB,
              winRateA: result.winRateA, winRateB: result.winRateB,
              gamesA: result.gamesA, gamesB: result.gamesB,
              winner: result.winner,
            }),
          }));
        } catch {
          winners[mi] = match.deckA;
          setWcKnockoutRounds(prev => prev.map((round, rIdx) => rIdx !== ri ? round : {
            ...round,
            matches: round.matches.map((m, mIdx) => mIdx !== mi ? m : { ...m, status: "error" as const, gamesA: 0, gamesB: 0 }),
          }));
        }
      }));

      pool = winners.filter(Boolean);
    }

    setWcChampion(pool[0] ?? null);
    setWcPhase("done");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isElim = mode === "elim";
  const isWC   = mode === "worldcup";
  const wcRunning = isWC && wcPhase !== "setup";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>
        Tournament Bracket
      </h1>
      <p className="text-gray-400 mb-8 text-sm">
        {isElim
          ? "Single-elimination tournament. Every matchup runs a full Monte Carlo simulation — the deck with the higher win rate advances."
          : "World Cup format. 8 decks split into two groups of 4. Every deck plays every other in their group — win = 3 pts. Top 2 from each group advance to semi-finals."}
      </p>

      {/* ── Featured tournaments ── */}
      {FEATURED_TOURNAMENTS.map((ft) => (
        <div key={ft.title} className="bg-gray-900 border border-amber-700/30 rounded-xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Featured</span>
                <span className="text-xs text-gray-600">·</span>
                <a href={ft.articleUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-amber-400 transition-colors">
                  {ft.subtitle} ↗
                </a>
              </div>
              <h2 className="text-base font-bold text-white mb-3" style={{ fontFamily: "var(--font-cinzel)" }}>
                {ft.title}
              </h2>
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
            <button type="button" onClick={() => loadFeatured(ft)}
              className="shrink-0 self-start sm:self-center bg-amber-500 hover:bg-amber-400
                text-gray-950 font-bold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap">
              Load Top 8 →
            </button>
          </div>
        </div>
      ))}

      {/* ── Setup panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8 flex flex-col gap-5">

        {/* Mode toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-300">Format</span>
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            {([["elim", "Single Elimination"], ["worldcup", "⚽ World Cup"]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => changeMode(m)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  mode === m ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Size toggle — only for single-elim */}
        {isElim && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-300">Decks</span>
            <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
              {([4, 8] as const).map(n => (
                <button key={n} type="button" onClick={() => changeSize(n)}
                  className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                    size === n ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
                  }`}>
                  {n} Decks
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-600">{size === 4 ? "2 rounds" : "3 rounds"}</span>
          </div>
        )}

        {/* World Cup — group labels */}
        {isWC && (
          <p className="text-xs text-gray-500">
            Decks 1–4 → <span className="text-amber-400">Group A</span> &nbsp;·&nbsp;
            Decks 5–8 → <span className="text-sky-400">Group B</span>
          </p>
        )}

        {/* Deck slots */}
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: size }).map((_, i) => (
            <div key={`${size}-${i}`} className="relative">
              {isWC && (
                <span className={`absolute -top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded z-10
                  ${i < 4 ? "bg-amber-900/60 text-amber-400" : "bg-sky-900/60 text-sky-400"}`}>
                  {i < 4 ? "A" : "B"}
                </span>
              )}
              <DeckPicker
                label={`Deck ${i + 1}`}
                value={slotIds[i] ?? ""}
                onChange={(id, name) => { if (!id.startsWith("builder:")) setSlot(i, id, name, null); }}
                accentColor={i % 2 === 0 ? "amber" : "sky"}
                savedDecks={builderDecks}
                onBuilderDeck={async (deck) => {
                  try {
                    const override = await builderDeckToOverride(deck);
                    setSlot(i, "builder:" + deck.id, deck.name, override);
                  } catch (e) { console.error("Failed to load builder deck:", e); }
                }}
              />
            </div>
          ))}
        </div>

        {/* QF format — single-elim 8-deck only */}
        {isElim && size === 8 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-300">Quarter-finals</span>
            <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
              {([1, 3, 5] as const).map(n => (
                <button key={n} type="button" onClick={() => setQfGames(n)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    qfGames === n ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
                  }`}>
                  {n === 1 ? "BO1" : `BO${n}`}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-600">{qfGames === 1 ? "single game" : `best of ${qfGames}`}</span>
          </div>
        )}

        {/* Iterations slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-gray-300">Simulations per match</label>
            <span className="text-amber-400 font-mono font-bold">{iterations}</span>
          </div>
          <input type="range" min={100} max={500} step={50} value={iterations}
            onChange={e => setIterations(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500" />
          <div className="flex justify-between text-xs text-gray-600">
            <span>100 — fast</span>
            <span>500 — more accurate</span>
          </div>
        </div>

        {/* Run button */}
        <button type="button"
          onClick={isWC ? runWorldCup : runElim}
          disabled={!canRun || (isElim ? phase !== "setup" : wcPhase !== "setup")}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed
            text-gray-950 font-bold px-6 py-3 rounded-lg transition-colors text-base">
          {isElim
            ? (phase === "running" ? "Running tournament…"
              : !canRun ? `Choose ${size - filled} more deck${size - filled !== 1 ? "s" : ""}`
              : "▶ Run Tournament")
            : (wcPhase === "groups" ? "Running group stage…"
              : wcPhase === "knockouts" ? "Running knockouts…"
              : !canRun ? `Choose ${size - filled} more deck${size - filled !== 1 ? "s" : ""}`
              : "▶ Run World Cup")}
        </button>
      </div>

      {/* ── Single-elim results ── */}
      {isElim && rounds.length > 0 && (
        <div className="flex flex-col gap-10">
          {rounds.map((round, ri) => (
            <section key={ri}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">{round.label}</h2>
                <div className="flex-1 border-t border-gray-800" />
                <span className="text-xs text-gray-700 shrink-0">
                  {round.matches.filter(m => m.status === "done").length}/{round.matches.length} done
                </span>
              </div>
              <div className={`grid gap-3 ${round.matches.length === 1 ? "sm:w-1/2" : "grid-cols-1 sm:grid-cols-2"}`}>
                {round.matches.map(match => <MatchCard key={match.id} match={match} />)}
              </div>
            </section>
          ))}
          {champion && <ChampionBanner name={champion.name} onReset={resetAll} />}
        </div>
      )}

      {/* ── World Cup results ── */}
      {isWC && wcPhase !== "setup" && (
        <div className="flex flex-col gap-10">
          {/* Group stage */}
          {wcGroups.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">Group Stage</h2>
                <div className="flex-1 border-t border-gray-800" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {wcGroups.map(group => <GroupTable key={group.label} group={group} />)}
              </div>
            </section>
          )}

          {/* Knockouts */}
          {wcKnockoutRounds.length > 0 && (
            <div className="flex flex-col gap-10">
              {wcKnockoutRounds.map((round, ri) => (
                <section key={ri}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">{round.label}</h2>
                    <div className="flex-1 border-t border-gray-800" />
                    <span className="text-xs text-gray-700 shrink-0">
                      {round.matches.filter(m => m.status === "done").length}/{round.matches.length} done
                    </span>
                  </div>
                  <div className={`grid gap-3 ${round.matches.length === 1 ? "sm:w-1/2" : "grid-cols-1 sm:grid-cols-2"}`}>
                    {round.matches.map(match => <MatchCard key={match.id} match={match} />)}
                  </div>
                </section>
              ))}
              {wcChampion && <ChampionBanner name={wcChampion.name} onReset={resetAll} />}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {((isElim && rounds.length === 0 && phase === "setup") ||
        (isWC   && wcPhase === "setup")) && (
        <div className="text-center py-16 text-gray-600">
          {isWC
            ? "Select 8 decks above and press Run World Cup."
            : `Select ${size} decks above and press Run Tournament.`}
        </div>
      )}
    </div>
  );
}

// ─── Champion banner ──────────────────────────────────────────────────────────

function ChampionBanner({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-8 text-center">
      <div className="text-5xl mb-3">🏆</div>
      <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">Tournament Champion</p>
      <p className="text-2xl font-black text-amber-300">{name}</p>
      <button type="button" onClick={onReset}
        className="mt-6 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300
          border border-gray-700 rounded-lg transition-colors">
        Run again
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useAuthSafe } from "@/lib/useAuthSafe";
import type { SimulationReport } from "@/lib/simulator";
import { GridBoard } from "./GridBoard";
import { DeckPicker } from "./DeckPicker";
import { MatchExplanation } from "./MatchExplanation";

/** Single tug-of-war bar: amber = A wins, gray = draws, sky = B wins */
function MatchupBar({ winA, draws, winB }: { winA: number; draws: number; winB: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-5 rounded-full overflow-hidden gap-px bg-gray-950">
        {winA > 0 && (
          <div
            className="bg-amber-500 h-full transition-all duration-700 first:rounded-l-full"
            style={{ width: `${winA}%` }}
          />
        )}
        {draws > 0 && (
          <div className="bg-gray-600 h-full transition-all duration-700" style={{ width: `${draws}%` }} />
        )}
        {winB > 0 && (
          <div
            className="bg-sky-500 h-full transition-all duration-700 last:rounded-r-full"
            style={{ width: `${winB}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs font-mono">
        <span className="text-amber-400">{winA.toFixed(1)}%</span>
        {draws > 0 && <span className="text-gray-500">{draws.toFixed(1)}% draws</span>}
        <span className="text-sky-400">{winB.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function SimulatePage() {
  const { isSignedIn } = useAuthSafe();

  const [deckA, setDeckA] = useState("");
  const [deckB, setDeckB] = useState("");
  const [iterations, setIterations] = useState(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [snapIdx, setSnapIdx] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const saveResult = async () => {
    if (!report) return;
    if (!isSignedIn) { alert("Sign in to save simulation results."); return; }
    setSaveStatus("saving");
    try {
      await fetch("/api/user/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckAId: deckA.trim(),
          deckBId: deckB.trim(),
          deckAName: report.deckAName,
          deckBName: report.deckBName,
          avatarA: report.avatarA,
          avatarB: report.avatarB,
          winRateA: report.winRateA,
          winRateB: report.winRateB,
          iterations: report.iterations,
        }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  };

  const run = async () => {
    setSaveStatus("idle");
    if (!deckA.trim() || !deckB.trim()) {
      setError("Both deck A and deck B are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setSnapIdx(0);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckA: deckA.trim(), deckB: deckB.trim(), iterations }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SimulationReport;
      setReport(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const winANum   = report ? parseFloat(report.winRateA) : 0;
  const winBNum   = report ? parseFloat(report.winRateB) : 0;
  const drawsNum  = report ? (report.draws / report.iterations) * 100 : 0;
  const leader    = winANum > winBNum ? "A" : winBNum > winANum ? "B" : null;
  const margin    = report ? Math.abs(winANum - winBNum).toFixed(1) : "0";

  const snapshots = report?.sampleGame?.snapshots ?? [];
  const currentSnap = snapshots[snapIdx] ?? null;

  // Log lines that belong to the currently displayed turn
  const turnLog = report?.sampleGame?.log.filter(
    l => currentSnap && currentSnap.turn > 0
      ? l.startsWith(`T${currentSnap.turn} `) || l.startsWith("  →")
      : false
  ) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2">Match Simulator</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Run a Monte Carlo simulation between two public curiosa.io decks. Enter deck IDs or full URLs.
      </p>

      {/* Inputs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8 flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <DeckPicker
            label="Deck A"
            value={deckA}
            onChange={(id) => setDeckA(id)}
            accentColor="amber"
          />
          <DeckPicker
            label="Deck B"
            value={deckB}
            onChange={(id) => setDeckB(id)}
            accentColor="sky"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-gray-300">Iterations</label>
            <span className="text-amber-400 font-mono font-bold">{iterations}</span>
          </div>
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={iterations}
            onChange={(e) => setIterations(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>100</span>
            <span>1000</span>
            <span>2000</span>
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-bold px-6 py-3 rounded-lg transition-colors text-base"
        >
          {loading ? `Simulating ${iterations} games…` : "Run Simulation"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="flex flex-col gap-6">

          {/* Overview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-gray-800">
              <h2 className="text-base font-semibold text-gray-400">
                {report.iterations.toLocaleString()} games · {report.avgTurns} avg turns
              </h2>
              {leader ? (
                <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                  leader === "A"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                }`}>
                  Deck {leader} leads by {margin}%
                </div>
              ) : (
                <div className="text-sm text-gray-500">Too close to call</div>
              )}
            </div>

            {/* Side-by-side deck panels */}
            <div className="grid grid-cols-2 divide-x divide-gray-800">
              {/* Deck A */}
              <div className={`p-5 flex flex-col gap-3 ${
                leader === "A" ? "bg-amber-950/20" : ""
              }`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 text-lg leading-none ${
                    leader === "A" ? "opacity-100" : "opacity-20"
                  }`}>🏆</span>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm leading-tight truncate">
                      {report.deckAName}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {report.avatarA}
                    </div>
                  </div>
                </div>
                <div>
                  <div className={`text-4xl font-black tabular-nums ${
                    leader === "A" ? "text-amber-400" : "text-gray-400"
                  }`}>
                    {report.winRateA}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">win rate</div>
                </div>
                <div className="text-sm text-gray-400">
                  <span className="text-white font-semibold">{report.avgFinalLifeA}</span>
                  <span className="text-gray-600"> avg life remaining</span>
                </div>
              </div>

              {/* Deck B */}
              <div className={`p-5 flex flex-col gap-3 ${
                leader === "B" ? "bg-sky-950/20" : ""
              }`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 text-lg leading-none ${
                    leader === "B" ? "opacity-100" : "opacity-20"
                  }`}>🏆</span>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm leading-tight truncate">
                      {report.deckBName}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {report.avatarB}
                    </div>
                  </div>
                </div>
                <div>
                  <div className={`text-4xl font-black tabular-nums ${
                    leader === "B" ? "text-sky-400" : "text-gray-400"
                  }`}>
                    {report.winRateB}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">win rate</div>
                </div>
                <div className="text-sm text-gray-400">
                  <span className="text-white font-semibold">{report.avgFinalLifeB}</span>
                  <span className="text-gray-600"> avg life remaining</span>
                </div>
              </div>
            </div>

            {/* Tug-of-war bar */}
            <div className="px-5 py-4 border-t border-gray-800">
              <MatchupBar winA={winANum} draws={drawsNum} winB={winBNum} />
            </div>
          </div>

          {/* Save result */}
          <div className="flex justify-end">
            <button
              onClick={saveResult}
              disabled={saveStatus === "saving" || saveStatus === "saved"}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                saveStatus === "saved"
                  ? "bg-green-700/40 text-green-300 border border-green-700/40 cursor-default"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              }`}
            >
              {saveStatus === "saved"
                ? "✓ Saved to profile"
                : saveStatus === "saving"
                ? "Saving…"
                : "Save result"}
            </button>
          </div>

          {/* Match explanation */}
          <MatchExplanation report={report} leader={leader} />

          {/* Board viewer */}
          {snapshots.length > 0 && currentSnap && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">
                  Board — Sample Game
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  {currentSnap.turn === 0
                    ? "Initial state"
                    : `Turn ${currentSnap.turn} · Player ${currentSnap.activePlayer}`}
                </span>
              </div>

              <GridBoard
                snapshot={currentSnap}
                avatarNameA={report.avatarA}
                avatarNameB={report.avatarB}
              />

              {/* Turn navigation */}
              <div className="mt-4 flex flex-col gap-2">
                <input
                  type="range"
                  min={0}
                  max={snapshots.length - 1}
                  value={snapIdx}
                  onChange={e => setSnapIdx(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSnapIdx(i => Math.max(0, i - 1))}
                      disabled={snapIdx === 0}
                      className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-white transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setSnapIdx(i => Math.min(snapshots.length - 1, i + 1))}
                      disabled={snapIdx === snapshots.length - 1}
                      className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-white transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                  <span className="text-xs text-gray-600 font-mono">
                    {snapIdx + 1} / {snapshots.length}
                  </span>
                </div>
              </div>

              {/* Events this turn */}
              {turnLog.length > 0 && (
                <div className="mt-3 bg-gray-950 rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-1.5 font-medium uppercase tracking-wide">
                    Turn {currentSnap.turn} events
                  </div>
                  <div className="font-mono text-xs space-y-0.5 max-h-28 overflow-y-auto">
                    {turnLog.map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.includes("[A]") ? "text-amber-300/80" :
                          line.includes("[B]") ? "text-sky-300/80"   :
                          "text-gray-500"
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full log */}
          {report.sampleGame && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-base font-bold text-white mb-1">
                Full Log — Winner: Deck {report.sampleGame.winner} in {report.sampleGame.turns} turns
              </h3>
              <div className="text-xs text-gray-600 mb-3">
                Final life — A: {report.sampleGame.finalLifeA} / B: {report.sampleGame.finalLifeB}
              </div>
              <div className="font-mono text-xs text-gray-400 space-y-0.5 max-h-64 overflow-y-auto bg-gray-950 rounded-lg p-3">
                {report.sampleGame.log.length === 0 ? (
                  <p className="text-gray-600 italic">No log entries.</p>
                ) : (
                  report.sampleGame.log.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes("[A]") ? "text-amber-300/80" :
                        line.includes("[B]") ? "text-sky-300/80"   :
                        "text-gray-500"
                      }
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
        <div className="text-center py-16 text-gray-600">
          Enter two deck IDs or URLs and press Run Simulation.
        </div>
      )}
    </div>
  );
}

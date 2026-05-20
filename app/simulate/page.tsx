"use client";

import { useState } from "react";
import type { SimulationReport } from "@/lib/simulator";

function WinBar({ label, pct, color }: { label: string; pct: string; color: string }) {
  const n = parseFloat(pct);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300 font-medium">{label}</span>
        <span className={`font-bold ${color}`}>{pct}</span>
      </div>
      <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color.replace("text-", "bg-")}`}
          style={{ width: `${n}%` }}
        />
      </div>
    </div>
  );
}

export default function SimulatePage() {
  const [deckA, setDeckA] = useState("");
  const [deckB, setDeckB] = useState("");
  const [iterations, setIterations] = useState(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SimulationReport | null>(null);

  const run = async () => {
    if (!deckA.trim() || !deckB.trim()) {
      setError("Both deck A and deck B are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
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

  const drawRate = report
    ? ((report.draws / report.iterations) * 100).toFixed(1) + "%"
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2">Match Simulator</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Run a Monte Carlo simulation between two public curiosa.io decks. Enter deck IDs or full URLs.
      </p>

      {/* Inputs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8 flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Deck A</label>
            <input
              type="text"
              value={deckA}
              onChange={(e) => setDeckA(e.target.value)}
              placeholder="ID or https://curiosa.io/decks/..."
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Deck B</label>
            <input
              type="text"
              value={deckB}
              onChange={(e) => setDeckB(e.target.value)}
              placeholder="ID or https://curiosa.io/decks/..."
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
            />
          </div>
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
          {loading ? `Simulating ${iterations} games...` : "Run Simulation"}
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-bold text-white mb-1">
              Results — {report.iterations.toLocaleString()} games
            </h2>
            <div className="text-sm text-gray-500 mb-5">
              <span className="text-amber-300">{report.deckAName}</span>
              <span className="text-gray-600 mx-2">vs</span>
              <span className="text-sky-300">{report.deckBName}</span>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <WinBar
                label={`Deck A: ${report.deckAName} (${report.avatarA})`}
                pct={report.winRateA}
                color="text-amber-400"
              />
              <WinBar
                label={`Deck B: ${report.deckBName} (${report.avatarB})`}
                pct={report.winRateB}
                color="text-sky-400"
              />
              {drawRate && parseFloat(drawRate) > 0 && (
                <WinBar label="Draws" pct={drawRate} color="text-gray-400" />
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{report.avgTurns}</div>
                <div className="text-xs text-gray-500 mt-1">Avg Turns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{report.avgFinalLifeA}</div>
                <div className="text-xs text-gray-500 mt-1">Avg Life A</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-sky-400">{report.avgFinalLifeB}</div>
                <div className="text-xs text-gray-500 mt-1">Avg Life B</div>
              </div>
            </div>
          </div>

          {/* Sample game log */}
          {report.sampleGame && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-base font-bold text-white mb-3">
                Sample Game — Winner: Deck {report.sampleGame.winner} in {report.sampleGame.turns} turns
              </h3>
              <div className="font-mono text-xs text-gray-400 space-y-0.5 max-h-64 overflow-y-auto bg-gray-950 rounded-lg p-3">
                {report.sampleGame.log.length === 0 ? (
                  <p className="text-gray-600 italic">No log entries.</p>
                ) : (
                  report.sampleGame.log.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes("[A]")
                          ? "text-amber-300/80"
                          : line.includes("[B]")
                          ? "text-sky-300/80"
                          : "text-gray-500"
                      }
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Final life — Deck A: {report.sampleGame.finalLifeA} / Deck B: {report.sampleGame.finalLifeB}
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

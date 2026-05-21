"use client";

import type { SimulationReport } from "@/lib/simulator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Factor {
  icon: string;
  label: string;
  text: string;
  /** Which side has the advantage: "A" | "B" | "even" */
  side: "A" | "B" | "even";
}

// ─── Analysis logic ───────────────────────────────────────────────────────────

function buildFactors(r: SimulationReport, leader: "A" | "B" | null): Factor[] {
  const factors: Factor[] = [];

  const winA   = parseFloat(r.winRateA);
  const winB   = parseFloat(r.winRateB);
  const lifeA  = parseFloat(r.avgFinalLifeA);
  const lifeB  = parseFloat(r.avgFinalLifeB);
  const sitesA = parseFloat(r.avgSitesA);
  const sitesB = parseFloat(r.avgSitesB);
  const minA   = parseFloat(r.avgMinionsA);
  const minB   = parseFloat(r.avgMinionsB);
  const atkA   = parseFloat(r.avgSiteAttacksA);
  const atkB   = parseFloat(r.avgSiteAttacksB);
  const turns  = parseFloat(r.avgTurns);

  const winnerName = leader === "A" ? r.deckAName : r.deckBName;
  const loserName  = leader === "A" ? r.deckBName : r.deckAName;

  // ── Win-rate context ────────────────────────────────────────────────────────
  const margin = Math.abs(winA - winB);
  if (margin < 5) {
    factors.push({
      icon: "⚖️",
      label: "Closely matched",
      text: `These decks are nearly even — the ${margin.toFixed(1)}% gap is within the variance you'd expect from this many games. A few card changes could tip the balance.`,
      side: "even",
    });
  } else if (margin < 15) {
    factors.push({
      icon: "📊",
      label: "Slight edge",
      text: `${winnerName} has a consistent but modest ${margin.toFixed(1)}% advantage across ${r.iterations.toLocaleString()} games. The matchup is competitive — ${loserName} can still win.`,
      side: leader ?? "even",
    });
  } else {
    factors.push({
      icon: "🏆",
      label: "Clear winner",
      text: `${winnerName} dominated — winning ${leader === "A" ? r.winRateA : r.winRateB} of games against ${loserName}'s ${leader === "A" ? r.winRateB : r.winRateA}. A ${margin.toFixed(1)}% margin over ${r.iterations.toLocaleString()} games is decisive.`,
      side: leader ?? "even",
    });
  }

  // ── Territory (sites) ───────────────────────────────────────────────────────
  const siteDiff = Math.abs(sitesA - sitesB);
  if (siteDiff >= 0.8) {
    const moreA  = sitesA > sitesB;
    const more   = moreA ? r.deckAName : r.deckBName;
    const fewer  = moreA ? r.deckBName : r.deckAName;
    const moreSites = moreA ? sitesA : sitesB;
    const fewerSites = moreA ? sitesB : sitesA;
    factors.push({
      icon: "🏰",
      label: "Territory control",
      text: `${more} placed an average of ${moreSites.toFixed(1)} sites per game vs ${fewerSites.toFixed(1)} for ${fewer}. More sites means more mana each turn, letting you cast larger spells and fill the board with minions faster.`,
      side: moreA ? "A" : "B",
    });
  }

  // ── Board presence (minions) ─────────────────────────────────────────────────
  const minionDiff = Math.abs(minA - minB);
  if (minionDiff >= 1.0) {
    const moreA  = minA > minB;
    const more   = moreA ? r.deckAName : r.deckBName;
    const fewer  = moreA ? r.deckBName : r.deckAName;
    const moreM  = moreA ? minA : minB;
    const fewerM = moreA ? minB : minA;
    factors.push({
      icon: "⚔️",
      label: "Board presence",
      text: `${more} deployed ${moreM.toFixed(1)} minions on average vs ${fewerM.toFixed(1)} for ${fewer}. A larger board is harder to defend against and lets you contest more enemy sites simultaneously.`,
      side: moreA ? "A" : "B",
    });
  }

  // ── Offensive pressure (site attacks) ───────────────────────────────────────
  const atkDiff = Math.abs(atkA - atkB);
  if (atkDiff >= 0.5 || atkA + atkB >= 1.0) {
    const moreA  = atkA >= atkB;
    const more   = moreA ? r.deckAName : r.deckBName;
    const fewer  = moreA ? r.deckBName : r.deckAName;
    const moreAtk  = moreA ? atkA : atkB;
    const fewerAtk = moreA ? atkB : atkA;
    if (atkDiff >= 0.5) {
      factors.push({
        icon: "💥",
        label: "Breakthrough damage",
        text: `${more}'s units broke through to hit undefended sites ${moreAtk.toFixed(1)} times per game — ${atkDiff.toFixed(1)} more than ${fewer}'s ${fewerAtk.toFixed(1)}. Getting minions onto enemy territory without a defender waiting is how avatar damage accumulates.`,
        side: moreA ? "A" : "B",
      });
    } else {
      factors.push({
        icon: "💥",
        label: "Direct damage",
        text: `Both decks landed a similar number of site attacks (${atkA.toFixed(1)} vs ${atkB.toFixed(1)}), meaning neither side had a meaningful breakthrough advantage.`,
        side: "even",
      });
    }
  }

  // ── Avatar durability (life remaining) ──────────────────────────────────────
  const lifeDiff = Math.abs(lifeA - lifeB);
  if (lifeDiff >= 2.0) {
    const moreA = lifeA > lifeB;
    const more  = moreA ? r.deckAName : r.deckBName;
    const fewer = moreA ? r.deckBName : r.deckAName;
    const moreLife  = moreA ? lifeA : lifeB;
    const fewerLife = moreA ? lifeB : lifeA;
    factors.push({
      icon: "❤️",
      label: "Avatar durability",
      text: `${more}'s avatar finished games with ${moreLife.toFixed(1)} life on average vs ${fewerLife.toFixed(1)} for ${fewer}. A ${lifeDiff.toFixed(1)}-point gap means ${more} was consistently better at defending its own sites or had more threatening minions forcing the opponent to hold back.`,
      side: moreA ? "A" : "B",
    });
  } else if (leader) {
    // Close life totals — mention it's a tight race
    factors.push({
      icon: "❤️",
      label: "Life totals",
      text: `Both avatars ended games with similar life remaining (${lifeA.toFixed(1)} vs ${lifeB.toFixed(1)}), confirming this is a close matchup where small decisions have outsized effects.`,
      side: "even",
    });
  }

  // ── Game pace ────────────────────────────────────────────────────────────────
  if (turns <= 16) {
    factors.push({
      icon: "⚡",
      label: "Fast game pace",
      text: `Games ended in ${turns} turns on average — an aggressive pace. Fast games favour decks that can claim sites and deploy minions quickly, since there's little time to recover from an early board disadvantage.`,
      side: leader ?? "even",
    });
  } else if (turns >= 28) {
    factors.push({
      icon: "🕰️",
      label: "Slow, grinding game",
      text: `Games lasted ${turns} turns on average, suggesting neither deck broke through easily. In long games, card efficiency and the ability to out-trade minions matters more than raw speed.`,
      side: "even",
    });
  }

  return factors;
}

// ─── Stat comparison row ──────────────────────────────────────────────────────

function StatRow({
  label, valA, valB, higherIsBetter = true,
}: {
  label: string;
  valA: string;
  valB: string;
  higherIsBetter?: boolean;
}) {
  const nA = parseFloat(valA);
  const nB = parseFloat(valB);
  const aWins = higherIsBetter ? nA > nB : nA < nB;
  const bWins = higherIsBetter ? nB > nA : nB < nA;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`w-14 text-right font-mono font-semibold tabular-nums ${
        aWins ? "text-amber-400" : "text-gray-500"
      }`}>{valA}</span>
      <span className="flex-1 text-center text-xs text-gray-600">{label}</span>
      <span className={`w-14 text-left font-mono font-semibold tabular-nums ${
        bWins ? "text-sky-400" : "text-gray-500"
      }`}>{valB}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  report: SimulationReport;
  leader: "A" | "B" | null;
}

export function MatchExplanation({ report, leader }: Props) {
  const factors = buildFactors(report, leader);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800">
        <h3 className="text-base font-bold text-white">Why did {
          leader
            ? (leader === "A" ? report.deckAName : report.deckBName) + " win?"
            : "neither deck dominate?"
        }</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Analysis based on averages across all {report.iterations.toLocaleString()} simulated games
        </p>
      </div>

      {/* Factors */}
      <div className="divide-y divide-gray-800/60">
        {factors.map((f, i) => (
          <div key={i} className="px-5 py-4 flex gap-3">
            <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
            <div>
              <div className={`text-sm font-semibold mb-1 ${
                f.side === "A" ? "text-amber-400" :
                f.side === "B" ? "text-sky-400"   :
                                 "text-gray-400"
              }`}>{f.label}</div>
              <p className="text-sm text-gray-300 leading-relaxed">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Stat comparison table */}
      <div className="px-5 py-4 border-t border-gray-800 bg-gray-950/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-amber-400 truncate max-w-[40%]">{report.deckAName}</span>
          <span className="text-xs text-gray-600 mx-2">per-game averages</span>
          <span className="text-xs font-semibold text-sky-400 truncate max-w-[40%] text-right">{report.deckBName}</span>
        </div>
        <div className="flex flex-col gap-2">
          <StatRow label="sites placed"      valA={report.avgSitesA}       valB={report.avgSitesB} />
          <StatRow label="minions deployed"  valA={report.avgMinionsA}     valB={report.avgMinionsB} />
          <StatRow label="site attacks"      valA={report.avgSiteAttacksA} valB={report.avgSiteAttacksB} />
          <StatRow label="life remaining"    valA={report.avgFinalLifeA}   valB={report.avgFinalLifeB} />
          <StatRow label="turns (both)"      valA={report.avgTurns}        valB={report.avgTurns} higherIsBetter={false} />
        </div>
      </div>
    </div>
  );
}

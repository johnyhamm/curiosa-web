// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimCard {
  name: string;
  type: "Avatar" | "Site" | "Minion" | "Magic" | "Artifact" | "Aura";
  attack: number;
  defense: number;
  waterT: number;
  earthT: number;
  fireT: number;
  airT: number;
  /** Elements this card contributes when played as a site */
  elements: string[];
}

export interface DeckSpec {
  name: string;
  avatar: SimCard;
  cards: SimCard[]; // pre-expanded by quantity (3x Rat = [Rat, Rat, Rat])
}

interface Threshold {
  water: number;
  earth: number;
  fire: number;
  air: number;
}

interface PlayerState {
  id: "A" | "B";
  avatarName: string;
  avatarLife: number;
  deck: SimCard[];
  hand: SimCard[];
  sitesInPlay: SimCard[];
  minionsInPlay: SimCard[];
  threshold: Threshold;
  spellsCast: number;
  minionsPlayed: number;
  sitesPlayed: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlay(card: SimCard, t: Threshold): boolean {
  return t.water >= card.waterT &&
         t.earth >= card.earthT &&
         t.fire  >= card.fireT  &&
         t.air   >= card.airT;
}

function computeThreshold(sites: SimCard[]): Threshold {
  const t: Threshold = { water: 0, earth: 0, fire: 0, air: 0 };
  for (const s of sites) {
    for (const el of s.elements) {
      if (el === "water") t.water++;
      else if (el === "earth") t.earth++;
      else if (el === "fire") t.fire++;
      else if (el === "air") t.air++;
      // "none" — contributes no specific element
    }
  }
  return t;
}

/** Rough combat value for AI prioritisation */
function minionValue(c: SimCard): number {
  return (c.attack ?? 0) + (c.defense ?? 0);
}

function initPlayer(spec: DeckSpec, id: "A" | "B"): PlayerState {
  return {
    id,
    avatarName: spec.avatar.name,
    avatarLife: 20,
    deck: shuffle(spec.cards),
    hand: [],
    sitesInPlay: [],
    minionsInPlay: [],
    threshold: { water: 0, earth: 0, fire: 0, air: 0 },
    spellsCast: 0,
    minionsPlayed: 0,
    sitesPlayed: 0,
  };
}

function draw(state: PlayerState, n = 1): void {
  for (let i = 0; i < n && state.deck.length > 0; i++) {
    state.hand.push(state.deck.pop()!);
  }
}

function remove<T>(arr: T[], item: T): T[] {
  const idx = arr.indexOf(item);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

// ─── One-game simulation ──────────────────────────────────────────────────────

export interface GameResult {
  winner: "A" | "B" | "draw";
  turns: number;
  log: string[];
  finalLifeA: number;
  finalLifeB: number;
}

const MAX_TURNS = 40;

export function simulateGame(specA: DeckSpec, specB: DeckSpec, keepLog = false): GameResult {
  const stateA = initPlayer(specA, "A");
  const stateB = initPlayer(specB, "B");

  draw(stateA, 5);
  draw(stateB, 5);

  const log: string[] = [];
  const emit = (msg: string) => { if (keepLog) log.push(msg); };

  let turn = 0;

  while (turn < MAX_TURNS && stateA.avatarLife > 0 && stateB.avatarLife > 0) {
    turn++;
    const [active, passive] = turn % 2 === 1 ? [stateA, stateB] : [stateB, stateA];

    // ── Draw ──────────────────────────────────────────────────────────────────
    draw(active);

    // ── Play site ─────────────────────────────────────────────────────────────
    const sitesInHand = active.hand.filter(c => c.type === "Site");
    if (sitesInHand.length > 0) {
      // Pick the site that contributes the most new element types we still need
      const needed: Record<string, number> = { water: 0, earth: 0, fire: 0, air: 0 };
      for (const c of active.hand) {
        if (c.type === "Site") continue;
        needed.water  = Math.max(needed.water,  Math.max(0, c.waterT - active.threshold.water));
        needed.earth  = Math.max(needed.earth,  Math.max(0, c.earthT - active.threshold.earth));
        needed.fire   = Math.max(needed.fire,   Math.max(0, c.fireT  - active.threshold.fire));
        needed.air    = Math.max(needed.air,    Math.max(0, c.airT   - active.threshold.air));
      }
      const score = (s: SimCard) =>
        s.elements.reduce((n, el) => n + (needed[el] ?? 0), 0) + s.elements.length * 0.1;
      const best = sitesInHand.sort((a, b) => score(b) - score(a))[0];
      active.hand = remove(active.hand, best);
      active.sitesInPlay.push(best);
      active.threshold = computeThreshold(active.sitesInPlay);
      active.sitesPlayed++;
      emit(`T${turn} [${active.id}] plays site: ${best.name} → W${active.threshold.water}E${active.threshold.earth}F${active.threshold.fire}A${active.threshold.air}`);
    }

    // ── Play a card (highest-value playable non-site) ─────────────────────────
    const playable = active.hand.filter(
      c => c.type !== "Site" && c.type !== "Avatar" && canPlay(c, active.threshold)
    );

    if (playable.length > 0) {
      // Prefer minions with highest combat value; spells are fallback
      const card = playable.sort((a, b) => {
        if (a.type === "Minion" && b.type !== "Minion") return -1;
        if (a.type !== "Minion" && b.type === "Minion") return 1;
        return minionValue(b) - minionValue(a);
      })[0];

      active.hand = remove(active.hand, card);

      if (card.type === "Minion") {
        active.minionsInPlay.push(card);
        active.minionsPlayed++;
        emit(`T${turn} [${active.id}] deploys: ${card.name} (${card.attack}/${card.defense})`);
      } else {
        // Spell / Artifact / Aura — simplified: remove weakest enemy minion or ping avatar
        active.spellsCast++;
        if (passive.minionsInPlay.length > 0) {
          const victim = passive.minionsInPlay
            .slice()
            .sort((a, b) => minionValue(a) - minionValue(b))[0];
          passive.minionsInPlay = remove(passive.minionsInPlay, victim);
          emit(`T${turn} [${active.id}] casts ${card.name}: removes ${victim.name}`);
        } else {
          const ping = Math.max(1, card.waterT + card.earthT + card.fireT + card.airT);
          passive.avatarLife -= ping;
          emit(`T${turn} [${active.id}] casts ${card.name}: pings ${passive.avatarName} for ${ping}`);
        }
      }
    }

    // ── Combat ────────────────────────────────────────────────────────────────
    if (active.minionsInPlay.length > 0) {
      // Send best attacker
      const attacker = active.minionsInPlay
        .slice()
        .sort((a, b) => b.attack - a.attack)[0];

      if (passive.minionsInPlay.length > 0) {
        // Opponent blocks with the toughest minion
        const blocker = passive.minionsInPlay
          .slice()
          .sort((a, b) => b.defense - a.defense)[0];

        const attackerDies = (blocker.attack ?? 0) >= attacker.defense;
        const blockerDies  = attacker.attack >= blocker.defense;

        if (blockerDies) {
          passive.minionsInPlay = remove(passive.minionsInPlay, blocker);
          emit(`T${turn} [${active.id}] ${attacker.name} defeats ${blocker.name}`);
        } else {
          emit(`T${turn} [${active.id}] ${attacker.name} trades with ${blocker.name} (blocker survives)`);
        }
        if (attackerDies) {
          active.minionsInPlay = remove(active.minionsInPlay, attacker);
          emit(`T${turn} [${active.id}] ${attacker.name} dies in combat`);
        }
      } else {
        // No blockers — hit avatar directly
        passive.avatarLife -= attacker.attack;
        emit(`T${turn} [${active.id}] ${attacker.name} attacks ${passive.avatarName} for ${attacker.attack} (${Math.max(0, passive.avatarLife)} life remaining)`);
      }
    }
  }

  let winner: "A" | "B" | "draw";
  if (stateA.avatarLife <= 0 && stateB.avatarLife <= 0) winner = "draw";
  else if (stateA.avatarLife <= 0) winner = "B";
  else if (stateB.avatarLife <= 0) winner = "A";
  else winner = stateA.avatarLife > stateB.avatarLife ? "A" : stateB.avatarLife > stateA.avatarLife ? "B" : "draw";

  return {
    winner,
    turns: turn,
    log,
    finalLifeA: Math.max(0, stateA.avatarLife),
    finalLifeB: Math.max(0, stateB.avatarLife),
  };
}

// ─── Monte Carlo simulation ───────────────────────────────────────────────────

export interface SimulationReport {
  deckAName: string;
  deckBName: string;
  avatarA: string;
  avatarB: string;
  iterations: number;
  winsA: number;
  winsB: number;
  draws: number;
  winRateA: string;
  winRateB: string;
  avgTurns: string;
  avgFinalLifeA: string;
  avgFinalLifeB: string;
  sampleGame: GameResult;
}

export function runSimulation(
  specA: DeckSpec,
  specB: DeckSpec,
  iterations: number
): SimulationReport {
  let winsA = 0, winsB = 0, draws = 0;
  let totalTurns = 0;
  let totalLifeA = 0, totalLifeB = 0;
  let sampleGame: GameResult | null = null;

  for (let i = 0; i < iterations; i++) {
    const result = simulateGame(specA, specB, i === 0);
    if (result.winner === "A") winsA++;
    else if (result.winner === "B") winsB++;
    else draws++;
    totalTurns += result.turns;
    totalLifeA += result.finalLifeA;
    totalLifeB += result.finalLifeB;
    if (i === 0) sampleGame = result;
  }

  const pct = (n: number) => ((n / iterations) * 100).toFixed(1) + "%";

  return {
    deckAName: specA.name,
    deckBName: specB.name,
    avatarA: specA.avatar.name,
    avatarB: specB.avatar.name,
    iterations,
    winsA,
    winsB,
    draws,
    winRateA: pct(winsA),
    winRateB: pct(winsB),
    avgTurns: (totalTurns / iterations).toFixed(1),
    avgFinalLifeA: (totalLifeA / iterations).toFixed(1),
    avgFinalLifeB: (totalLifeB / iterations).toFixed(1),
    sampleGame: sampleGame!,
  };
}

// ─── Deck-building helpers ────────────────────────────────────────────────────

/** Convert raw API card entry (with quantity) into expanded SimCard array */
export function toSimCards(apiCards: ApiDeckCard[]): SimCard[] {
  const out: SimCard[] = [];
  for (const entry of apiCards) {
    const c = entry.card;
    const simCard: SimCard = {
      name: c.name,
      type: c.type as SimCard["type"],
      attack:   c.attack   ?? 0,
      defense:  c.defense  ?? 0,
      waterT:   c.waterThreshold ?? 0,
      earthT:   c.earthThreshold ?? 0,
      fireT:    c.fireThreshold  ?? 0,
      airT:     c.airThreshold   ?? 0,
      elements: (c.elements ?? []).map((e: { id: string }) => e.id),
    };
    for (let i = 0; i < (entry.quantity ?? 1); i++) {
      out.push(simCard);
    }
  }
  return out;
}

// Minimal API shape we need
export interface ApiDeckCard {
  quantity: number;
  card: {
    name: string;
    type: string;
    attack: number | null;
    defense: number | null;
    waterThreshold: number;
    earthThreshold: number;
    fireThreshold: number;
    airThreshold: number;
    elements: { id: string; name: string }[];
  };
}

export function formatReport(r: SimulationReport): string {
  const bar = (pct: string) => {
    const n = Math.round(parseFloat(pct) / 5);
    return "█".repeat(n) + "░".repeat(20 - n) + " " + pct;
  };

  const lines = [
    `## Simulation Results — ${r.iterations} games`,
    ``,
    `**Deck A:** ${r.deckAName} (Avatar: ${r.avatarA})`,
    `**Deck B:** ${r.deckBName} (Avatar: ${r.avatarB})`,
    ``,
    `### Win Rates`,
    `Deck A  ${bar(r.winRateA)}`,
    `Deck B  ${bar(r.winRateB)}`,
    `Draws   ${((r.draws / r.iterations) * 100).toFixed(1)}%`,
    ``,
    `### Game Stats`,
    `Average game length : ${r.avgTurns} turns`,
    `Avg final life — A  : ${r.avgFinalLifeA}`,
    `Avg final life — B  : ${r.avgFinalLifeB}`,
    ``,
    `### Sample Game (Game 1 of ${r.iterations})`,
    `Winner: Deck ${r.sampleGame.winner} in ${r.sampleGame.turns} turns`,
    ``,
    ...r.sampleGame.log.slice(0, 40),
    r.sampleGame.log.length > 40 ? `… (${r.sampleGame.log.length - 40} more lines)` : "",
  ].filter(l => l !== undefined);

  return lines.join("\n");
}

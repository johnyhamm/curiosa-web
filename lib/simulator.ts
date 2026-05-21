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
  /**
   * Phase-1 keywords parsed from rules text:
   * "airborne" | "charge" | "ranged" | "lethal" | "stealth" | "burrowing" | "ward"
   */
  keywords: string[];
  rulesText: string;
}

export interface DeckSpec {
  name: string;
  avatar: SimCard;
  cards: SimCard[]; // pre-expanded by quantity
}

interface Threshold {
  water: number;
  earth: number;
  fire: number;
  air: number;
}

// ─── Grid (5 columns × 4 rows) ───────────────────────────────────────────────
//
//   Player A territory  →  rows 0 (back / sites + avatar) and 1 (front)
//   Player B territory  →  rows 2 (front) and 3 (back / sites + avatar)
//
//   The "front line" is between rows 1 and 2.
//   Adjacent minions across that boundary can attack each other directly.

interface Pos { col: number; row: number; }

const COLS = 5;
const ROWS = 4;
const AVATAR_COL = 2; // avatar starts in the centre column of the back row

// Chebyshev (king-move) distance — matches 8-directional adjacency
function dist(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}
function adj(a: Pos, b: Pos): boolean { return dist(a, b) === 1; }
function posEq(a: Pos, b: Pos): boolean { return a.col === b.col && a.row === b.row; }
function inBounds(p: Pos): boolean { return p.col >= 0 && p.col < COLS && p.row >= 0 && p.row < ROWS; }
function posKey(p: Pos): string { return `${p.col},${p.row}`; }

function stepToward(from: Pos, to: Pos): Pos {
  return {
    col: from.col + Math.sign(to.col - from.col),
    row: from.row + Math.sign(to.row - from.row),
  };
}

// ─── Board minion ─────────────────────────────────────────────────────────────

interface BoardMinion {
  card: SimCard;
  pos: Pos;
  sick: boolean;      // summoning sickness — can't attack this turn (unless Charge)
  attacked: boolean;  // has already attacked this turn
  stealthy: boolean;  // still hidden (Stealth — revealed on first attack)
}

// ─── Player state ─────────────────────────────────────────────────────────────

interface PlayerState {
  id: "A" | "B";
  avatarName: string;
  avatarLife: number;
  avatarPos: Pos;
  deck: SimCard[];
  hand: SimCard[];
  sitesInPlay: SimCard[];
  sitePositions: Pos[];
  minionsOnBoard: BoardMinion[];
  threshold: Threshold;
  spellsCast: number;
  minionsPlayed: number;
  sitesPlayed: number;
}

// ─── Keyword helpers ──────────────────────────────────────────────────────────

function hasKw(card: SimCard, kw: string): boolean {
  return card.keywords.includes(kw);
}

/**
 * Parse Phase-1 keywords from a card's rules text.
 * Exported so callers can pre-build keyword lists when constructing SimCards.
 */
export function parseKeywords(rulesText: string): string[] {
  const t = (rulesText ?? "").toLowerCase();
  const kws: string[] = [];
  // Airborne is the primary flying keyword (90 cards); "fly/flying" also exists (7 cards)
  if (/\bairborne\b/.test(t) || /\bfly(ing)?\b/.test(t)) kws.push("airborne");
  if (/\bcharge\b/.test(t))       kws.push("charge");
  if (/\branged\b/.test(t))       kws.push("ranged");
  if (/\blethal\b/.test(t))       kws.push("lethal");    // kills anything it damages
  if (/\bstealth\b/.test(t))      kws.push("stealth");
  if (/\bburrow(ing)?\b/.test(t)) kws.push("burrowing");
  if (/\bward\b/.test(t))         kws.push("ward");      // can't be targeted by spells
  return kws;
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlay(card: SimCard, t: Threshold): boolean {
  return t.water >= card.waterT && t.earth >= card.earthT &&
         t.fire  >= card.fireT  && t.air   >= card.airT;
}

function computeThreshold(sites: SimCard[]): Threshold {
  const t: Threshold = { water: 0, earth: 0, fire: 0, air: 0 };
  for (const s of sites) {
    for (const el of s.elements) {
      if      (el === "water") t.water++;
      else if (el === "earth") t.earth++;
      else if (el === "fire")  t.fire++;
      else if (el === "air")   t.air++;
    }
  }
  return t;
}

function minionValue(c: SimCard): number { return (c.attack ?? 0) + (c.defense ?? 0); }

// ─── Grid placement helpers ───────────────────────────────────────────────────

// Back-row site columns — leave the centre column (2) for the avatar
const BACK_SITE_COLS = [0, 1, 3, 4];

function nextSitePos(id: "A" | "B", sitesPlayed: number): Pos {
  const backRow  = id === "A" ? 0 : 3;
  const frontRow = id === "A" ? 1 : 2;
  if (sitesPlayed < BACK_SITE_COLS.length) {
    return { col: BACK_SITE_COLS[sitesPlayed], row: backRow };
  }
  // Overflow: additional sites go in the front row
  return { col: (sitesPlayed - BACK_SITE_COLS.length) % COLS, row: frontRow };
}

function buildOccupied(stA: PlayerState, stB: PlayerState): Set<string> {
  const s = new Set<string>();
  for (const m of [...stA.minionsOnBoard, ...stB.minionsOnBoard]) s.add(posKey(m.pos));
  for (const p of [...stA.sitePositions, ...stB.sitePositions])   s.add(posKey(p));
  s.add(posKey(stA.avatarPos));
  s.add(posKey(stB.avatarPos));
  return s;
}

function nextMinionPos(id: "A" | "B", occupied: Set<string>): Pos | null {
  const frontRow = id === "A" ? 1 : 2;
  const backRow  = id === "A" ? 0 : 3;
  for (let col = 0; col < COLS; col++) {
    const p: Pos = { col, row: frontRow };
    if (!occupied.has(posKey(p))) return p;
  }
  for (let col = 0; col < COLS; col++) {
    if (col === AVATAR_COL) continue;
    const p: Pos = { col, row: backRow };
    if (!occupied.has(posKey(p))) return p;
  }
  return null;
}

function initPlayer(spec: DeckSpec, id: "A" | "B"): PlayerState {
  return {
    id,
    avatarName: spec.avatar.name,
    avatarLife: 20,
    avatarPos: { col: AVATAR_COL, row: id === "A" ? 0 : 3 },
    deck: shuffle(spec.cards),
    hand: [],
    sitesInPlay: [],
    sitePositions: [],
    minionsOnBoard: [],
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

// ─── Combat range & targeting ─────────────────────────────────────────────────

/** Maximum attack range (Chebyshev squares) for a minion */
function attackRange(bm: BoardMinion): number {
  if (hasKw(bm.card, "airborne")) return 99; // can target anything on the board
  if (hasKw(bm.card, "ranged"))   return 2;  // 2-square range
  return 1;                                   // adjacent only
}

function inRange(attacker: BoardMinion, targetPos: Pos): boolean {
  return dist(attacker.pos, targetPos) <= attackRange(attacker);
}

/**
 * Can `attacker` legally target `target`?
 * Respects Stealth (hidden until revealed) and Burrowing (underground protection).
 */
function canTarget(attacker: BoardMinion, target: BoardMinion): boolean {
  if (!inRange(attacker, target.pos)) return false;
  if (target.stealthy) return false; // Stealth: can't be targeted until revealed
  if (hasKw(target.card, "burrowing")) {
    // Burrowing: only attackable by other Burrowing, Airborne, or Ranged attackers
    return hasKw(attacker.card, "burrowing") ||
           hasKw(attacker.card, "airborne")  ||
           hasKw(attacker.card, "ranged");
  }
  return true;
}

function canAttack(bm: BoardMinion): boolean {
  if (bm.attacked) return false;
  if (bm.sick && !hasKw(bm.card, "charge")) return false;
  return true;
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

    // ── Reset turn flags ──────────────────────────────────────────────────────
    for (const m of active.minionsOnBoard) {
      m.attacked = false;
      m.sick     = false; // sickness expires at start of owner's next turn
    }

    // ── Draw ──────────────────────────────────────────────────────────────────
    draw(active);

    // ── Play site ─────────────────────────────────────────────────────────────
    const sitesInHand = active.hand.filter(c => c.type === "Site");
    if (sitesInHand.length > 0) {
      // Pick the site that covers the most missing thresholds
      const needed: Record<string, number> = { water: 0, earth: 0, fire: 0, air: 0 };
      for (const c of active.hand) {
        if (c.type === "Site") continue;
        needed.water = Math.max(needed.water, Math.max(0, c.waterT - active.threshold.water));
        needed.earth = Math.max(needed.earth, Math.max(0, c.earthT - active.threshold.earth));
        needed.fire  = Math.max(needed.fire,  Math.max(0, c.fireT  - active.threshold.fire));
        needed.air   = Math.max(needed.air,   Math.max(0, c.airT   - active.threshold.air));
      }
      const score = (s: SimCard) =>
        s.elements.reduce((n, el) => n + (needed[el] ?? 0), 0) + s.elements.length * 0.1;
      const best = [...sitesInHand].sort((a, b) => score(b) - score(a))[0];

      const sitePos = nextSitePos(active.id, active.sitesPlayed);
      active.hand = remove(active.hand, best);
      active.sitesInPlay.push(best);
      active.sitePositions.push(sitePos);
      active.threshold = computeThreshold(active.sitesInPlay);
      active.sitesPlayed++;
      emit(`T${turn} [${active.id}] plays site ${best.name} at (${sitePos.col},${sitePos.row}) → W${active.threshold.water}E${active.threshold.earth}F${active.threshold.fire}A${active.threshold.air}`);
    }

    // ── Play a card ───────────────────────────────────────────────────────────
    const playable = active.hand.filter(
      c => c.type !== "Site" && c.type !== "Avatar" && canPlay(c, active.threshold)
    );

    if (playable.length > 0) {
      // Prefer minions (highest value first); spells are fallback
      const card = [...playable].sort((a, b) => {
        if (a.type === "Minion" && b.type !== "Minion") return -1;
        if (a.type !== "Minion" && b.type === "Minion") return 1;
        return minionValue(b) - minionValue(a);
      })[0];

      active.hand = remove(active.hand, card);

      if (card.type === "Minion") {
        const occupied = buildOccupied(stateA, stateB);
        const pos = nextMinionPos(active.id, occupied);
        if (pos) {
          const kwStr = card.keywords.length ? ` [${card.keywords.join(",")}]` : "";
          const bm: BoardMinion = {
            card,
            pos,
            sick: !hasKw(card, "charge"), // Charge: no summoning sickness
            attacked: false,
            stealthy: hasKw(card, "stealth"),
          };
          active.minionsOnBoard.push(bm);
          active.minionsPlayed++;
          emit(`T${turn} [${active.id}] deploys ${card.name} (${card.attack}/${card.defense})${kwStr} → (${pos.col},${pos.row})`);
        }
      } else {
        // Spell / Artifact / Aura
        active.spellsCast++;
        // Ward minions are immune to spells
        const spellTargets = passive.minionsOnBoard.filter(
          m => !m.stealthy && !hasKw(m.card, "ward")
        );
        if (spellTargets.length > 0) {
          const victim = [...spellTargets].sort(
            (a, b) => minionValue(a.card) - minionValue(b.card)
          )[0];
          passive.minionsOnBoard = remove(passive.minionsOnBoard, victim);
          emit(`T${turn} [${active.id}] casts ${card.name}: destroys ${victim.card.name}`);
        } else {
          const ping = Math.max(1, card.waterT + card.earthT + card.fireT + card.airT);
          passive.avatarLife -= ping;
          emit(`T${turn} [${active.id}] casts ${card.name}: pings ${passive.avatarName} for ${ping}`);
        }
      }
    }

    // ── Movement + Combat ─────────────────────────────────────────────────────
    //
    // Each ready minion (highest ATK first):
    //   1. Moves one Chebyshev step toward its best target.
    //   2. Attacks if now in range.
    //
    // Airborne minions fly past defenders toward the avatar.
    // Ground minions must fight through the front line first.

    const actors = [...active.minionsOnBoard]
      .filter(canAttack)
      .sort((a, b) => b.card.attack - a.card.attack);

    for (const bm of actors) {
      // Guard: minion may have been removed earlier this turn
      if (!active.minionsOnBoard.includes(bm)) continue;

      const isAirborne = hasKw(bm.card, "airborne");
      const isRanged   = hasKw(bm.card, "ranged");

      // --- Choose target position to move toward ---
      const reachableEnemies = passive.minionsOnBoard.filter(t => canTarget(bm, t));

      let targetPos: Pos;

      if (isAirborne) {
        // Airborne: prefers avatar unless a minion is already closer
        const closeMinion = reachableEnemies.length > 0
          ? [...reachableEnemies].sort((a, b) => dist(bm.pos, a.pos) - dist(bm.pos, b.pos))[0]
          : null;
        const avatarDist  = dist(bm.pos, passive.avatarPos);
        const closestDist = closeMinion ? dist(bm.pos, closeMinion.pos) : Infinity;
        targetPos = avatarDist <= closestDist ? passive.avatarPos : closeMinion!.pos;
      } else {
        // Ground / ranged: nearest reachable enemy, fall back to avatar
        const closest = reachableEnemies.length > 0
          ? [...reachableEnemies].sort((a, b) => dist(bm.pos, a.pos) - dist(bm.pos, b.pos))[0]
          : null;
        targetPos = closest ? closest.pos : passive.avatarPos;
      }

      // --- Move one step toward targetPos (if not already in range) ---
      if (dist(bm.pos, targetPos) > attackRange(bm)) {
        const occupied = buildOccupied(stateA, stateB);
        occupied.delete(posKey(bm.pos)); // don't treat self as obstacle

        const step = stepToward(bm.pos, targetPos);
        let newPos: Pos | null = null;

        if (isAirborne) {
          // Airborne ignores occupied squares
          if (inBounds(step)) newPos = step;
        } else {
          // Ground: try direct step first, then column-only or row-only
          const candidates: Pos[] = [
            step,
            { col: bm.pos.col, row: bm.pos.row + Math.sign(targetPos.row - bm.pos.row) },
            { col: bm.pos.col + Math.sign(targetPos.col - bm.pos.col), row: bm.pos.row },
          ].filter(p => inBounds(p) && !occupied.has(posKey(p)));

          if (candidates.length > 0) {
            newPos = candidates.sort((a, b) => dist(a, targetPos) - dist(b, targetPos))[0];
          }
        }

        if (newPos && !posEq(newPos, bm.pos)) {
          emit(`T${turn} [${active.id}] ${bm.card.name} moves (${bm.pos.col},${bm.pos.row})→(${newPos.col},${newPos.row})`);
          bm.pos = newPos;
        }
      }

      // --- Attack (re-evaluate reachable targets after moving) ---
      const enemiesNow   = passive.minionsOnBoard.filter(t => canTarget(bm, t));
      const canHitAvatar = inRange(bm, passive.avatarPos);

      // Airborne/ranged hit avatar directly when no enemies are in the way;
      // ground minions must clear the front line first.
      const hitAvatar =
        canHitAvatar &&
        (isAirborne || isRanged
          ? enemiesNow.length === 0          // fly/ranged: prefer avatar when board is clear
          : enemiesNow.length === 0);        // ground: same — only if front line is empty

      if (hitAvatar) {
        if (bm.stealthy) bm.stealthy = false;
        passive.avatarLife -= bm.card.attack;
        bm.attacked = true;
        emit(`T${turn} [${active.id}] ${bm.card.name} strikes ${passive.avatarName} for ${bm.card.attack} (${Math.max(0, passive.avatarLife)} life)`);

      } else if (enemiesNow.length > 0) {
        // Pick best minion target: killable first, then closest
        const killable = enemiesNow.filter(
          t => bm.card.attack >= t.card.defense || hasKw(bm.card, "lethal")
        );
        const target = [...(killable.length > 0 ? killable : enemiesNow)]
          .sort((a, b) => dist(bm.pos, a.pos) - dist(bm.pos, b.pos))[0];

        if (bm.stealthy) bm.stealthy = false;

        const attackerDies = target.card.attack >= bm.card.defense || hasKw(target.card, "lethal");
        const defenderDies = bm.card.attack >= target.card.defense || hasKw(bm.card, "lethal");

        emit(`T${turn} [${active.id}] ${bm.card.name} attacks ${target.card.name} at (${target.pos.col},${target.pos.row})`);

        if (defenderDies) {
          passive.minionsOnBoard = remove(passive.minionsOnBoard, target);
          emit(`T${turn}   → ${target.card.name} destroyed`);
        }
        if (attackerDies) {
          active.minionsOnBoard = remove(active.minionsOnBoard, bm);
          emit(`T${turn}   → ${bm.card.name} destroyed in combat`);
        }
        bm.attacked = true;
      }
      // If nothing reachable yet, minion already moved — will try again next turn
    }
  }

  // ── Determine winner ──────────────────────────────────────────────────────
  let winner: "A" | "B" | "draw";
  if      (stateA.avatarLife <= 0 && stateB.avatarLife <= 0) winner = "draw";
  else if (stateA.avatarLife <= 0)                           winner = "B";
  else if (stateB.avatarLife <= 0)                           winner = "A";
  else winner = stateA.avatarLife > stateB.avatarLife ? "A"
              : stateB.avatarLife > stateA.avatarLife ? "B"
              : "draw";

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
  let totalTurns = 0, totalLifeA = 0, totalLifeB = 0;
  let sampleGame: GameResult | null = null;

  for (let i = 0; i < iterations; i++) {
    const result = simulateGame(specA, specB, i === 0);
    if      (result.winner === "A") winsA++;
    else if (result.winner === "B") winsB++;
    else                            draws++;
    totalTurns += result.turns;
    totalLifeA += result.finalLifeA;
    totalLifeB += result.finalLifeB;
    if (i === 0) sampleGame = result;
  }

  const pct = (n: number) => ((n / iterations) * 100).toFixed(1) + "%";

  return {
    deckAName:     specA.name,
    deckBName:     specB.name,
    avatarA:       specA.avatar.name,
    avatarB:       specB.avatar.name,
    iterations,
    winsA, winsB, draws,
    winRateA:      pct(winsA),
    winRateB:      pct(winsB),
    avgTurns:      (totalTurns / iterations).toFixed(1),
    avgFinalLifeA: (totalLifeA / iterations).toFixed(1),
    avgFinalLifeB: (totalLifeB / iterations).toFixed(1),
    sampleGame:    sampleGame!,
  };
}

// ─── Deck-building helpers ────────────────────────────────────────────────────

/** Convert raw API card entry (with quantity) into an expanded SimCard array */
export function toSimCards(
  apiCards: ApiDeckCard[],
  /** Optional card-name → rulesText lookup for keyword detection */
  rulesLookup?: Map<string, string>
): SimCard[] {
  const out: SimCard[] = [];
  for (const entry of apiCards) {
    const c = entry.card;
    const rulesText = rulesLookup?.get(c.name) ?? "";
    const simCard: SimCard = {
      name:     c.name,
      type:     c.type as SimCard["type"],
      attack:   c.attack   ?? 0,
      defense:  c.defense  ?? 0,
      waterT:   c.waterThreshold ?? 0,
      earthT:   c.earthThreshold ?? 0,
      fireT:    c.fireThreshold  ?? 0,
      airT:     c.airThreshold   ?? 0,
      elements: (c.elements ?? []).map((e: { id: string }) => e.id),
      keywords: parseKeywords(rulesText),
      rulesText,
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
    `_Models: 5×4 grid · movement · adjacency combat · Airborne / Charge / Ranged / Lethal / Stealth / Burrowing / Ward_`,
    `_Does not model: unique card abilities · Submerge · Voidwalk · avatar movement · multi-action turns_`,
    ``,
    `### Sample Game (Game 1 of ${r.iterations})`,
    `Winner: Deck ${r.sampleGame.winner} in ${r.sampleGame.turns} turns`,
    ``,
    ...r.sampleGame.log.slice(0, 40),
    r.sampleGame.log.length > 40 ? `… (${r.sampleGame.log.length - 40} more lines)` : "",
  ].filter(l => l !== undefined);

  return lines.join("\n");
}

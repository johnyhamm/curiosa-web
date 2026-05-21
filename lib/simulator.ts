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
  /** Elements this card contributes as a site */
  elements: string[];
  /** Keywords parsed from rules text */
  keywords: string[];
  rulesText: string;
}

export interface DeckSpec {
  name: string;
  avatar: SimCard;
  /** Pre-expanded by quantity; mix of Sites and non-Sites */
  cards: SimCard[];
}

// ─── Keyword parser ───────────────────────────────────────────────────────────

/**
 * Parse keywords from a card's rules text.
 * Exported so callers can pre-build keyword lists when constructing SimCards.
 */
export function parseKeywords(rulesText: string): string[] {
  const t = (rulesText ?? "").toLowerCase();
  const kws: string[] = [];
  if (/\bairborne\b/.test(t) || /\bfly(ing)?\b/.test(t)) kws.push("airborne");
  if (/\bcharge\b/.test(t))        kws.push("charge");
  if (/\branged\b/.test(t))        kws.push("ranged");
  if (/\blethal\b/.test(t))        kws.push("lethal");
  if (/\bstealth\b/.test(t))       kws.push("stealth");
  if (/\bburrow(ing)?\b/.test(t))  kws.push("burrowing");
  if (/\bward\b/.test(t))          kws.push("ward");
  return kws;
}

function hasKw(card: SimCard, kw: string): boolean {
  return card.keywords.includes(kw);
}

// ─── Grid positions & helpers ─────────────────────────────────────────────────
//
//   5 columns (0–4) × 4 rows (0–3)
//   Player A's avatar starts at col 2, row 0  (bottom of their side)
//   Player B's avatar starts at col 2, row 3  (bottom of their side)
//
//   Adjacency (official "Adjacent") = 4 cardinal directions
//   Nearby (official "Nearby")      = 8 directions (diagonals included)

interface Pos { col: number; row: number; }

const COLS = 5;
const ROWS = 4;
const AVATAR_COL = 2;

function inBounds(p: Pos): boolean {
  return p.col >= 0 && p.col < COLS && p.row >= 0 && p.row < ROWS;
}

function posEq(a: Pos, b: Pos): boolean {
  return a.col === b.col && a.row === b.row;
}

function posKey(p: Pos): string { return `${p.col},${p.row}`; }

/** 4-cardinal neighbors — the official "Adjacent" definition */
function cardinalNeighbors(p: Pos): Pos[] {
  return [
    { col: p.col - 1, row: p.row },
    { col: p.col + 1, row: p.row },
    { col: p.col,     row: p.row - 1 },
    { col: p.col,     row: p.row + 1 },
  ].filter(inBounds);
}

/** 8-directional neighbors — the official "Nearby" definition */
function nearbyNeighbors(p: Pos): Pos[] {
  const result: Pos[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const np = { col: p.col + dc, row: p.row + dr };
      if (inBounds(np)) result.push(np);
    }
  }
  return result;
}

/** Cardinal (Manhattan) distance — minimum steps for a ground unit */
function cardinalDist(a: Pos, b: Pos): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/** Chebyshev distance — minimum steps for an airborne unit (8-directional) */
function chebyshevDist(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** One cardinal step toward target (prefer column adjustment first) */
function cardinalStep(from: Pos, to: Pos): Pos {
  if (from.col !== to.col) {
    return { col: from.col + Math.sign(to.col - from.col), row: from.row };
  }
  return { col: from.col, row: from.row + Math.sign(to.row - from.row) };
}

/** One diagonal/cardinal step toward target (for airborne units) */
function diagonalStep(from: Pos, to: Pos): Pos {
  return {
    col: from.col + Math.sign(to.col - from.col),
    row: from.row + Math.sign(to.row - from.row),
  };
}

function stepDist(a: Pos, b: Pos, airborne: boolean): number {
  return airborne ? chebyshevDist(a, b) : cardinalDist(a, b);
}

// ─── Grid state ───────────────────────────────────────────────────────────────
//
//   The grid starts entirely void.  Sites are placed onto void (or rubble)
//   squares; each site square is owned by A or B.  When a site is destroyed it
//   becomes rubble (still passable; new sites can be placed there).

type SquareOwner = "A" | "B" | null;

interface GridSquare {
  owner: SquareOwner; // null = void or rubble
  site?: SimCard;
  isRubble: boolean;
}

type Grid = GridSquare[][];

function makeGrid(): Grid {
  const grid: Grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(Array.from({ length: COLS }, () => ({
      owner: null, site: undefined, isRubble: false,
    })));
  }
  return grid;
}

function getSquare(grid: Grid, p: Pos): GridSquare { return grid[p.row][p.col]; }

function ownedSites(grid: Grid, owner: "A" | "B"): Pos[] {
  const result: Pos[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].owner === owner) result.push({ col: c, row: r });
    }
  }
  return result;
}

function countSites(grid: Grid, owner: "A" | "B"): number {
  return ownedSites(grid, owner).length;
}

function siteThreshold(grid: Grid, owner: "A" | "B"): Threshold {
  const t: Threshold = { water: 0, earth: 0, fire: 0, air: 0 };
  for (const p of ownedSites(grid, owner)) {
    const sq = getSquare(grid, p);
    for (const el of sq.site?.elements ?? []) {
      if      (el === "water") t.water++;
      else if (el === "earth") t.earth++;
      else if (el === "fire")  t.fire++;
      else if (el === "air")   t.air++;
    }
  }
  return t;
}

// ─── Board minions ────────────────────────────────────────────────────────────

interface BoardMinion {
  card: SimCard;
  pos: Pos;
  owner: "A" | "B";
  tapped: boolean;       // has acted (moved or attacked) this turn
  sick: boolean;         // summoning sickness — can't attack unless Charge
  tempDamage: number;    // damage received this turn; cleared at end of turn
  stealthy: boolean;     // hidden until first attack
}

// ─── Player state ─────────────────────────────────────────────────────────────

interface Threshold { water: number; earth: number; fire: number; air: number; }

interface PlayerState {
  id: "A" | "B";
  avatarCard: SimCard;
  avatarLife: number;
  avatarPos: Pos;
  deathsDoor: boolean;   // survived hitting 0 life once; next damage = death blow
  atlasDeck: SimCard[];  // shuffled Sites
  spellDeck: SimCard[];  // shuffled non-Sites
  atlasHand: SimCard[];
  spellHand: SimCard[];
  mana: number;          // refreshes each turn = count of own sites
  threshold: Threshold;
  avatarTapUsed: boolean; // site placement once per turn
}

// ─── Deck helpers ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function remove<T>(arr: T[], item: T): T[] {
  const idx = arr.indexOf(item);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

function initPlayer(spec: DeckSpec, id: "A" | "B"): PlayerState {
  const sites    = shuffle(spec.cards.filter(c => c.type === "Site"));
  const nonSites = shuffle(spec.cards.filter(c => c.type !== "Site" && c.type !== "Avatar"));

  const player: PlayerState = {
    id,
    avatarCard:     spec.avatar,
    avatarLife:     spec.avatar.defense > 0 ? spec.avatar.defense : 20,
    avatarPos:      { col: AVATAR_COL, row: id === "A" ? 0 : 3 },
    deathsDoor:     false,
    atlasDeck:      sites,
    spellDeck:      nonSites,
    atlasHand:      [],
    spellHand:      [],
    mana:           0,
    threshold:      { water: 0, earth: 0, fire: 0, air: 0 },
    avatarTapUsed:  false,
  };

  // Starting hand: 3 atlas cards + 3 spellbook cards
  for (let i = 0; i < 3 && player.atlasDeck.length > 0; i++) {
    player.atlasHand.push(player.atlasDeck.pop()!);
  }
  for (let i = 0; i < 3 && player.spellDeck.length > 0; i++) {
    player.spellHand.push(player.spellDeck.pop()!);
  }

  return player;
}

/** Draw 1 card per turn — from atlas OR spellbook (pick based on hand balance) */
function drawOne(p: PlayerState): void {
  // Prefer atlas if atlas hand is smaller; otherwise spellbook; fallback to whichever exists
  const wantAtlas =
    (p.atlasHand.length <= p.spellHand.length && p.atlasDeck.length > 0) ||
    p.spellDeck.length === 0;

  if (wantAtlas && p.atlasDeck.length > 0) {
    p.atlasHand.push(p.atlasDeck.pop()!);
  } else if (p.spellDeck.length > 0) {
    p.spellHand.push(p.spellDeck.pop()!);
  }
}

function canPlay(card: SimCard, threshold: Threshold, mana: number): boolean {
  // Sites cost 0 mana (placed via Avatar Tap ability, not from mana pool)
  if (card.type === "Site") return true;
  const cost = card.waterT + card.earthT + card.fireT + card.airT;
  if (mana < cost) return false;
  return threshold.water >= card.waterT &&
         threshold.earth >= card.earthT &&
         threshold.fire  >= card.fireT  &&
         threshold.air   >= card.airT;
}

// ─── Site placement ───────────────────────────────────────────────────────────
//
//   Rules:
//   • The first site must be placed on the avatar's own square.
//   • Subsequent sites must be on a void or rubble square that is
//     adjacent (4-cardinal) to at least one square the player already owns.
//   • Sites are free (Avatar Tap ability, once per turn).

function findSitePlacementSquares(
  grid: Grid,
  minions: BoardMinion[],
  player: PlayerState,
): Pos[] {
  const owned = ownedSites(grid, player.id);

  // No sites yet → first site on avatar's square
  if (owned.length === 0) {
    const sq = getSquare(grid, player.avatarPos);
    if (!sq.owner) return [player.avatarPos]; // only if not already owned
    return [];
  }

  // Adjacent void/rubble squares not occupied by a minion
  const minionKeys = new Set(minions.map(m => posKey(m.pos)));
  const candidates = new Set<string>();
  for (const site of owned) {
    for (const nb of cardinalNeighbors(site)) {
      const sq = getSquare(grid, nb);
      if (!sq.owner && !minionKeys.has(posKey(nb))) {
        candidates.add(posKey(nb));
      }
    }
  }

  // Convert back to Pos
  return [...candidates].map(k => {
    const [c, r] = k.split(",").map(Number);
    return { col: c, row: r };
  });
}

/** AI chooses the best site to place — prefers expansion toward enemy */
function chooseSitePosition(
  candidates: Pos[],
  enemyAvatarPos: Pos,
  ownId: "A" | "B",
): Pos {
  // Score: closer to the centre row between players, closer to enemy is better
  return [...candidates].sort((a, b) => {
    const distA = cardinalDist(a, enemyAvatarPos);
    const distB = cardinalDist(b, enemyAvatarPos);
    return distA - distB; // smaller distance = better
  })[0];
}

/** Pick the best site card from hand to play (covers most needed thresholds) */
function chooseSiteCard(
  sites: SimCard[],
  threshold: Threshold,
  spellHand: SimCard[],
): SimCard {
  const needed: Record<string, number> = { water: 0, earth: 0, fire: 0, air: 0 };
  for (const c of spellHand) {
    if (c.type === "Site") continue;
    needed.water = Math.max(needed.water, Math.max(0, c.waterT - threshold.water));
    needed.earth = Math.max(needed.earth, Math.max(0, c.earthT - threshold.earth));
    needed.fire  = Math.max(needed.fire,  Math.max(0, c.fireT  - threshold.fire));
    needed.air   = Math.max(needed.air,   Math.max(0, c.airT   - threshold.air));
  }
  const score = (s: SimCard) =>
    s.elements.reduce((n, el) => n + (needed[el] ?? 0), 0) + s.elements.length * 0.01;
  return [...sites].sort((a, b) => score(b) - score(a))[0];
}

// ─── Minion placement ─────────────────────────────────────────────────────────
//
//   Minions must be placed on a friendly site square that has no minion on it.

function freeSiteSquares(
  grid: Grid,
  minions: BoardMinion[],
  owner: "A" | "B",
): Pos[] {
  const minionKeys = new Set(minions.map(m => posKey(m.pos)));
  return ownedSites(grid, owner).filter(p => !minionKeys.has(posKey(p)));
}

/** AI picks the most forward friendly site (closest to enemy) */
function chooseMinionPosition(
  freeSites: Pos[],
  enemyAvatarPos: Pos,
): Pos {
  return [...freeSites].sort(
    (a, b) => cardinalDist(a, enemyAvatarPos) - cardinalDist(b, enemyAvatarPos)
  )[0];
}

// ─── Combat helpers ───────────────────────────────────────────────────────────

function minionValue(c: SimCard): number { return (c.attack ?? 0) + (c.defense ?? 0); }

function canAttack(bm: BoardMinion): boolean {
  return !bm.tapped && !(bm.sick && !hasKw(bm.card, "charge"));
}

/** Effective movement distance for a unit (1 step; airborne = diagonal ok too) */
function moveRange(_bm: BoardMinion): number { return 1; }

/** Is this unit airborne? Affects movement style and target selection. */
function isAirborne(bm: BoardMinion): boolean {
  return hasKw(bm.card, "airborne");
}

/**
 * Can `attacker` see `target` minion?
 * Stealth = undetectable until revealed; Burrowing = only attackable by specific types.
 */
function canTarget(attacker: BoardMinion, target: BoardMinion): boolean {
  if (target.stealthy) return false;
  if (hasKw(target.card, "burrowing")) {
    return hasKw(attacker.card, "burrowing") ||
           hasKw(attacker.card, "airborne")  ||
           hasKw(attacker.card, "ranged");
  }
  return true;
}

/** Simultaneous fight: both deal damage; die if damage ≥ defense. */
interface FightResult {
  attackerDies: boolean;
  defenderDies: boolean;
}

function resolveFight(attacker: BoardMinion, defender: BoardMinion): FightResult {
  const defToAtk = defender.card.attack;
  const atkToDef = attacker.card.attack;
  return {
    attackerDies: defToAtk >= attacker.card.defense || hasKw(defender.card, "lethal"),
    defenderDies: atkToDef >= defender.card.defense || hasKw(attacker.card, "lethal"),
  };
}

// ─── Game result types ────────────────────────────────────────────────────────

export interface GameResult {
  winner: "A" | "B" | "draw";
  turns: number;
  log: string[];
  finalLifeA: number;
  finalLifeB: number;
}

// ─── Main game simulation ─────────────────────────────────────────────────────

const MAX_TURNS = 50;

export function simulateGame(specA: DeckSpec, specB: DeckSpec, keepLog = false): GameResult {
  const grid    = makeGrid();
  const pA      = initPlayer(specA, "A");
  const pB      = initPlayer(specB, "B");
  const minions: BoardMinion[] = [];

  const log: string[] = [];
  const emit = (msg: string) => { if (keepLog) log.push(msg); };

  function allMinions(): BoardMinion[] { return minions; }
  function friendlyMinions(id: "A" | "B"): BoardMinion[]  { return minions.filter(m => m.owner === id); }
  function enemyMinions(id: "A" | "B"): BoardMinion[]     { return minions.filter(m => m.owner !== id); }
  function removeMinion(bm: BoardMinion): void {
    const idx = minions.indexOf(bm);
    if (idx !== -1) minions.splice(idx, 1);
  }

  function player(id: "A" | "B"): PlayerState { return id === "A" ? pA : pB; }
  function opponent(id: "A" | "B"): PlayerState { return id === "A" ? pB : pA; }

  // ── Avatar damage ──────────────────────────────────────────────────────────
  //
  //   Applies damage to an avatar.  Death's Door: if life reaches ≤ 0 for the
  //   first time, the avatar stays at 1; only a second instance of damage kills.

  function damageAvatar(target: PlayerState, amount: number, source: string): void {
    if (amount <= 0) return;
    target.avatarLife -= amount;
    emit(`  → ${source} deals ${amount} to ${target.avatarCard.name} (${Math.max(0, target.avatarLife)} life)`);

    if (target.avatarLife <= 0) {
      if (!target.deathsDoor) {
        target.deathsDoor = true;
        target.avatarLife = 1; // survives on death's door
        emit(`  → ${target.avatarCard.name} is at Death's Door!`);
      }
      // If already at death's door: life stays ≤ 0 → triggers win condition
    }
  }

  // ── Site placement step ────────────────────────────────────────────────────

  function playSite(active: PlayerState): void {
    if (active.avatarTapUsed) return;
    if (active.atlasHand.length === 0) return;

    const opp = opponent(active.id);
    const squares = findSitePlacementSquares(grid, allMinions(), active);
    if (squares.length === 0) return;

    const card = chooseSiteCard(active.atlasHand, active.threshold, active.spellHand);
    const pos  = chooseSitePosition(squares, opp.avatarPos, active.id);

    // Place the site
    active.atlasHand = remove(active.atlasHand, card);
    const sq = getSquare(grid, pos);
    sq.owner   = active.id;
    sq.site    = card;
    sq.isRubble = false;
    active.avatarTapUsed = true;

    // Refresh mana and threshold
    active.mana      = countSites(grid, active.id);
    active.threshold = siteThreshold(grid, active.id);

    emit(`T${turn} [${active.id}] places site ${card.name} at (${pos.col},${pos.row}) ` +
         `→ ${active.mana} mana · W${active.threshold.water}E${active.threshold.earth}` +
         `F${active.threshold.fire}A${active.threshold.air}`);
  }

  // ── Card play step ────────────────────────────────────────────────────────

  function playCards(active: PlayerState): void {
    const opp = opponent(active.id);
    let keepTrying = true;

    while (keepTrying) {
      keepTrying = false;
      const allPlayable = active.spellHand.filter(
        c => c.type !== "Site" && c.type !== "Avatar" && canPlay(c, active.threshold, active.mana)
      );

      if (allPlayable.length === 0) break;

      // Prefer highest-value minions, then spells
      const card = [...allPlayable].sort((a, b) => {
        if (a.type === "Minion" && b.type !== "Minion") return -1;
        if (a.type !== "Minion" && b.type === "Minion") return 1;
        return minionValue(b) - minionValue(a);
      })[0];

      const cost = card.waterT + card.earthT + card.fireT + card.airT;
      active.mana -= cost;
      active.spellHand = remove(active.spellHand, card);

      if (card.type === "Minion") {
        const free = freeSiteSquares(grid, allMinions(), active.id);
        if (free.length === 0) {
          // No free site — put card back, stop trying minions
          active.spellHand.push(card);
          active.mana += cost;
          break;
        }
        const pos = chooseMinionPosition(free, opp.avatarPos);
        const bm: BoardMinion = {
          card,
          pos,
          owner: active.id,
          tapped: false,
          sick: !hasKw(card, "charge"),
          tempDamage: 0,
          stealthy: hasKw(card, "stealth"),
        };
        minions.push(bm);
        const kwStr = card.keywords.length ? ` [${card.keywords.join(",")}]` : "";
        emit(`T${turn} [${active.id}] plays ${card.name} (${card.attack}/${card.defense})${kwStr} → (${pos.col},${pos.row})`);
        keepTrying = true;
      } else {
        // Spell/Artifact/Aura: damage or remove enemy
        const validTargets = enemyMinions(active.id).filter(
          m => !m.stealthy && !hasKw(m.card, "ward")
        );
        if (validTargets.length > 0) {
          // Kill weakest enemy minion
          const victim = [...validTargets].sort(
            (a, b) => minionValue(a.card) - minionValue(b.card)
          )[0];
          removeMinion(victim);
          emit(`T${turn} [${active.id}] casts ${card.name}: destroys ${victim.card.name}`);
        } else {
          // No minion targets → spell hits avatar via site attack flavour
          const ping = Math.max(1, cost);
          damageAvatar(opp, ping, card.name);
          emit(`T${turn} [${active.id}] casts ${card.name}: deals ${ping} to avatar`);
        }
        keepTrying = true;
      }
    }
  }

  // ── Combat step ──────────────────────────────────────────────────────────
  //
  //   Each ready (untapped, not sick unless Charge) minion:
  //   1. Moves 1 step toward its best target.
  //   2. Resolves combat at the destination:
  //        a. Enemy minion on same square → fight simultaneously.
  //        b. Enemy site on square with no minion → attack site → deal attack
  //           to enemy avatar; check for a Defend response first.
  //        c. Nothing useful → stay (will try again next turn).

  function combatStep(active: PlayerState): void {
    const opp = opponent(active.id);

    // Actors sorted by attack descending (stronger units act first)
    const actors = friendlyMinions(active.id)
      .filter(canAttack)
      .sort((a, b) => b.card.attack - a.card.attack);

    for (const bm of actors) {
      if (!minions.includes(bm)) continue; // may have been killed earlier this turn

      const airborne = isAirborne(bm);

      // --- Choose target ---
      // Priority: co-located enemy (intercept), then enemy minion, then enemy site,
      // then enemy avatar square (to attack adjacent site)
      const colocated = enemyMinions(active.id).filter(
        e => posEq(e.pos, bm.pos) && canTarget(bm, e)
      );

      let targetPos: Pos;

      if (colocated.length > 0) {
        // Already in combat — fight in place
        targetPos = bm.pos;
      } else {
        // Look for nearest reachable enemy
        const visibleEnemies = enemyMinions(active.id).filter(e => canTarget(bm, e));

        // Find nearest enemy minion or enemy site
        const enemySitePositions = ownedSites(grid, opp.id);

        const candidates: { pos: Pos; dist: number }[] = [
          ...visibleEnemies.map(e => ({
            pos: e.pos,
            dist: stepDist(bm.pos, e.pos, airborne),
          })),
          ...enemySitePositions.map(p => ({
            pos: p,
            dist: stepDist(bm.pos, p, airborne),
          })),
        ];

        if (candidates.length === 0) continue; // nowhere to go

        candidates.sort((a, b) => a.dist - b.dist);
        targetPos = candidates[0].pos;
      }

      // --- Move one step toward targetPos ---
      if (!posEq(bm.pos, targetPos)) {
        const newPos = airborne
          ? diagonalStep(bm.pos, targetPos)
          : cardinalStep(bm.pos, targetPos);

        if (inBounds(newPos) && !posEq(newPos, bm.pos)) {
          emit(`T${turn} [${active.id}] ${bm.card.name} moves (${bm.pos.col},${bm.pos.row})→(${newPos.col},${newPos.row})`);
          bm.pos = newPos;
        }
      }

      // --- Resolve at new position ---
      const atSameSquare = enemyMinions(active.id).filter(
        e => posEq(e.pos, bm.pos) && canTarget(bm, e)
      );

      if (atSameSquare.length > 0) {
        // Fight the strongest enemy here (it fights back)
        const defender = [...atSameSquare].sort(
          (a, b) => b.card.attack - a.card.attack
        )[0];

        if (bm.stealthy) bm.stealthy = false;
        if (defender.stealthy) defender.stealthy = false;

        const { attackerDies, defenderDies } = resolveFight(bm, defender);
        bm.tapped = true;

        emit(`T${turn} [${active.id}] ${bm.card.name} fights ${defender.card.name} at (${bm.pos.col},${bm.pos.row})`);
        if (defenderDies) {
          removeMinion(defender);
          emit(`  → ${defender.card.name} destroyed`);
        }
        if (attackerDies) {
          removeMinion(bm);
          emit(`  → ${bm.card.name} destroyed in combat`);
        }

      } else {
        // Check if current square is an enemy site
        const sq = getSquare(grid, bm.pos);

        if (sq.owner === opp.id) {
          // This is an enemy site. Check for a defender.
          const defenders = friendlyMinions(opp.id).filter(
            d => !d.tapped && cardinalDist(d.pos, bm.pos) <= 1 && canTarget(bm, d)
          );

          if (defenders.length > 0) {
            // Nearest defender moves in to intercept
            const def = [...defenders].sort(
              (a, b) => cardinalDist(a.pos, bm.pos) - cardinalDist(b.pos, bm.pos)
            )[0];

            const fromPos = def.pos;
            def.pos = { ...bm.pos }; // defender moves to contested square
            def.tapped = true;

            emit(`T${turn} [${opp.id}] ${def.card.name} defends from (${fromPos.col},${fromPos.row})`);

            if (bm.stealthy) bm.stealthy = false;
            const { attackerDies, defenderDies } = resolveFight(bm, def);
            bm.tapped = true;

            emit(`T${turn} [${active.id}] ${bm.card.name} vs defender ${def.card.name}`);
            if (defenderDies) {
              removeMinion(def);
              emit(`  → ${def.card.name} destroyed`);
            }
            if (attackerDies) {
              removeMinion(bm);
              emit(`  → ${bm.card.name} destroyed by defender`);
            }
          } else {
            // Undefended enemy site! Attack → deal power to enemy avatar
            if (bm.stealthy) bm.stealthy = false;
            bm.tapped = true;
            damageAvatar(opp, bm.card.attack, `${bm.card.name} (site attack)`);
            emit(`T${turn} [${active.id}] ${bm.card.name} attacks undefended site at (${bm.pos.col},${bm.pos.row})`);
          }
        }
        // If neither enemy minion nor enemy site, minion just moved — will continue next turn
      }
    }
  }

  // ─── Main turn loop ──────────────────────────────────────────────────────

  let turn = 0;

  while (turn < MAX_TURNS && pA.avatarLife > 0 && pB.avatarLife > 0) {
    turn++;
    const active  = turn % 2 === 1 ? pA : pB;
    const passive = turn % 2 === 1 ? pB : pA;

    // ── Start of turn: untap all friendly units, reset avatar tap ────────────
    for (const m of friendlyMinions(active.id)) {
      m.tapped = false;
      m.sick   = false; // summoning sickness expires at start of owner's next turn
    }
    active.avatarTapUsed = false;

    // ── Refresh mana ─────────────────────────────────────────────────────────
    active.mana      = countSites(grid, active.id);
    active.threshold = siteThreshold(grid, active.id);

    // ── Draw (player A skips draw on turn 1) ─────────────────────────────────
    if (!(turn === 1 && active.id === "A")) {
      drawOne(active);
    }

    // ── Play a site (Avatar Tap ability) ─────────────────────────────────────
    playSite(active);

    // ── Play cards from hand ──────────────────────────────────────────────────
    playCards(active);

    // ── Combat ────────────────────────────────────────────────────────────────
    combatStep(active);

    // ── End of turn: clear all temp damage ───────────────────────────────────
    for (const m of allMinions()) m.tempDamage = 0;

    void passive; // passive player referenced through pA/pB above
  }

  // ─── Determine winner ─────────────────────────────────────────────────────
  let winner: "A" | "B" | "draw";
  if      (pA.avatarLife <= 0 && pB.avatarLife <= 0) winner = "draw";
  else if (pA.avatarLife <= 0)                        winner = "B";
  else if (pB.avatarLife <= 0)                        winner = "A";
  else winner = pA.avatarLife > pB.avatarLife ? "A"
              : pB.avatarLife > pA.avatarLife ? "B"
              : "draw";

  return {
    winner,
    turns: turn,
    log,
    finalLifeA: Math.max(0, pA.avatarLife),
    finalLifeB: Math.max(0, pB.avatarLife),
  };
}

// ─── Monte Carlo runner ───────────────────────────────────────────────────────

export interface SimulationReport {
  deckAName:     string;
  deckBName:     string;
  avatarA:       string;
  avatarB:       string;
  iterations:    number;
  winsA:         number;
  winsB:         number;
  draws:         number;
  winRateA:      string;
  winRateB:      string;
  avgTurns:      string;
  avgFinalLifeA: string;
  avgFinalLifeB: string;
  sampleGame:    GameResult;
}

export function runSimulation(
  specA: DeckSpec,
  specB: DeckSpec,
  iterations: number,
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

// ─── Format report ────────────────────────────────────────────────────────────

export function formatReport(r: SimulationReport): string {
  const bar = (pct: string) => {
    const n = Math.round(parseFloat(pct) / 5);
    return "█".repeat(n) + "░".repeat(20 - n) + " " + pct;
  };

  return [
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
    `_Models: shared 5×4 grid · dynamic site expansion · mana = sites owned · minions on sites_`,
    `_Cardinal movement · same-square combat · site attacks → avatar damage · Defend · Death's Door_`,
    `_Keywords: Airborne · Charge · Ranged · Lethal · Stealth · Burrowing · Ward_`,
    `_Does not model: unique card text · Submerge · Voidwalk · multiple actions per turn_`,
    ``,
    `### Sample Game (Game 1 of ${r.iterations})`,
    `Winner: Deck ${r.sampleGame.winner} in ${r.sampleGame.turns} turns`,
    ``,
    ...r.sampleGame.log.slice(0, 50),
    r.sampleGame.log.length > 50 ? `… (${r.sampleGame.log.length - 50} more lines)` : "",
  ].filter(l => l !== undefined).join("\n");
}

// ─── Deck-building helpers (backward-compatible) ──────────────────────────────

// Minimal API shape we need from the curiosa.io response
export interface ApiDeckCard {
  quantity: number;
  card: {
    name: string;
    type: string;
    attack:          number | null;
    defense:         number | null;
    waterThreshold:  number;
    earthThreshold:  number;
    fireThreshold:   number;
    airThreshold:    number;
    elements:        { id: string; name: string }[];
  };
}

/** Convert raw API card entries (with quantity) into an expanded SimCard array */
export function toSimCards(
  apiCards: ApiDeckCard[],
  /** Optional card-name → rulesText lookup for keyword detection */
  rulesLookup?: Map<string, string>,
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

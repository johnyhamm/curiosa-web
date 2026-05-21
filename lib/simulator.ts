// ─── SimCard ──────────────────────────────────────────────────────────────────

export interface SimCard {
  name: string;
  type: "Avatar" | "Site" | "Minion" | "Magic" | "Artifact" | "Aura";
  attack: number;
  defense: number;
  /** Avatar starting life (guardian.life). 0 = unknown → falls back to 20. */
  life: number;
  waterT: number;
  earthT: number;
  fireT: number;
  airT: number;
  elements: string[];
  keywords: string[];
  rulesText: string;
  // Pre-parsed effects (set by toSimCards; undefined for non-spell/artifact/aura cards)
  spellEffect?:     SpellEffect;
  artifactEffect?:  ArtifactEffect;
  auraEffect?:      AuraEffect;
  avatarAbilities?: AvatarAbility[];
}

export interface DeckSpec {
  name: string;
  avatar: SimCard;
  cards: SimCard[];
}

// ─── Keyword parser ───────────────────────────────────────────────────────────

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
  if (/\bsubmerge[d]?\b/.test(t))  kws.push("submerge");
  if (/\bundying\b/.test(t))       kws.push("undying");
  return kws;
}

function hasKw(card: SimCard, kw: string): boolean {
  return card.keywords.includes(kw);
}

// ─── Spell effects ────────────────────────────────────────────────────────────

export type SpellEffect =
  | { kind: "destroy" }                         // unconditionally remove a minion
  | { kind: "damage";     amount: number }       // deal X to minion or avatar
  | { kind: "damage_all"; amount: number }       // deal X to EVERY enemy minion (AoE)
  | { kind: "draw";       amount: number }       // draw X cards
  | { kind: "buff";       attack: number; defense: number } // +X/+Y this turn
  | { kind: "bounce" }                           // return strongest enemy to hand
  | { kind: "destroy_site" }                    // destroy a target enemy site
  | { kind: "steal" }                            // take control of a target enemy minion
  | { kind: "exhaust" }                          // tap/exhaust a target enemy minion
  | { kind: "generic" };                         // fallback (cost-based ping)

export function parseSpellEffect(rulesText: string): SpellEffect {
  const t = (rulesText ?? "").toLowerCase();

  // AoE damage ("deal X damage to all / each") — check before single-target
  const aoeMatch = t.match(/deal[s]?\s+(\d+)\s+damage\s+to\s+(all|each)/);
  if (aoeMatch) return { kind: "damage_all", amount: parseInt(aoeMatch[1]) };

  // Single-target damage ("deal X damage")
  const dmgMatch = t.match(/deal[s]?\s+(\d+)\s+damage/);
  if (dmgMatch) return { kind: "damage", amount: parseInt(dmgMatch[1]) };

  // Steal / take control — check before destroy to avoid mis-matching "destroy a stolen minion"
  if (/(?:gain|take)\s+control|steal\s+target/.test(t)) return { kind: "steal" };

  // Destroy site — check before generic destroy
  if (/destroy\b.*\bsite\b/.test(t)) return { kind: "destroy_site" };

  // Destroy ("destroy target")
  if (/\bdestroy\b/.test(t)) return { kind: "destroy" };

  // Exhaust / tap a target
  if (/\bexhaust\b|\btap\s+target\b/.test(t)) return { kind: "exhaust" };

  // Bounce ("return … to … hand")
  if (/return\b.*\bto\b.*\bhand\b/.test(t)) return { kind: "bounce" };

  // Draw ("draw X")
  const drawMatch = t.match(/\bdraw\s+(\d+)\b/);
  if (drawMatch) return { kind: "draw", amount: parseInt(drawMatch[1]) };

  // Buff ("+X/+Y until end of turn" or just "+X/+Y")
  const buffMatch = t.match(/\+(\d+)\/\+(\d+)/);
  if (buffMatch) return { kind: "buff", attack: parseInt(buffMatch[1]), defense: parseInt(buffMatch[2]) };

  return { kind: "generic" };
}

// ─── Artifact effects ─────────────────────────────────────────────────────────

export interface ArtifactEffect {
  kind: "equipment" | "structure" | "generic";
  attackBonus:  number;
  defenseBonus: number;
  manaBonus:    number;
  keywords:     string[];  // keywords granted to bearer/nearby minions
}

export function parseArtifactEffect(rulesText: string): ArtifactEffect {
  const t = (rulesText ?? "").toLowerCase();
  const fx: ArtifactEffect = {
    kind: "generic", attackBonus: 0, defenseBonus: 0, manaBonus: 0, keywords: [],
  };

  // Equipment vs structure
  if (/\bequip|\bbearer\b|\bwielder\b/.test(t))          fx.kind = "equipment";
  else if (/\bstructure\b|\bbuilding\b|\bfortif/.test(t)) fx.kind = "structure";

  // +X/+Y bonus
  const statMatch = t.match(/\+(\d+)\/\+(\d+)/);
  if (statMatch) {
    fx.attackBonus  = parseInt(statMatch[1]);
    fx.defenseBonus = parseInt(statMatch[2]);
    if (fx.kind === "generic") fx.kind = "equipment";
  }

  // Mana bonus
  const manaMatch = t.match(/\+\s*(\d+)\s*mana/);
  if (manaMatch) {
    fx.manaBonus = parseInt(manaMatch[1]);
    if (fx.kind === "generic") fx.kind = "structure";
  }

  // Keyword grants
  for (const kw of ["airborne", "charge", "lethal", "ranged", "burrowing", "ward", "stealth"]) {
    if (new RegExp(`\\b(grants?|gains?)\\s+${kw}\\b`).test(t)) fx.keywords.push(kw);
  }

  return fx;
}

// ─── Aura effects ─────────────────────────────────────────────────────────────

export interface AuraEffect {
  attackBonus:  number;
  defenseBonus: number;
  keywords:     string[];  // keywords granted to enchanted unit
}

export function parseAuraEffect(rulesText: string): AuraEffect {
  const t = (rulesText ?? "").toLowerCase();
  const fx: AuraEffect = { attackBonus: 0, defenseBonus: 0, keywords: [] };

  const statMatch = t.match(/\+(\d+)\/\+(\d+)/);
  if (statMatch) {
    fx.attackBonus  = parseInt(statMatch[1]);
    fx.defenseBonus = parseInt(statMatch[2]);
  }

  for (const kw of ["airborne", "charge", "lethal", "ranged", "burrowing", "ward", "stealth"]) {
    if (new RegExp(`\\b(gains?|grants?|has)\\s+${kw}\\b`).test(t)) fx.keywords.push(kw);
  }

  return fx;
}

// ─── Avatar abilities ─────────────────────────────────────────────────────────

/**
 * Structured representation of an avatar's passive or triggered ability.
 * A single avatar may have multiple abilities (all are collected into an array).
 */
export type AvatarAbility =
  /** Always-on stat/keyword bonus to all (or element-filtered) friendly minions. */
  | { kind: "passive_buff"; attackBonus: number; defenseBonus: number; keywords: string[]; elementFilter: string | null }
  /** Fires at the start of the avatar's turn. */
  | { kind: "start_of_turn"; grant: "mana" | "draw" | "damage_enemy" | "heal"; amount: number }
  /** Fires when any friendly minion dies. */
  | { kind: "on_friendly_death"; grant: "damage_enemy" | "draw" | "mana"; amount: number }
  /** Fires when the avatar places a site. */
  | { kind: "on_site_placed"; grant: "draw" | "mana" | "damage_enemy"; amount: number }
  /** Fires when the avatar casts a Magic spell. */
  | { kind: "on_spell_cast"; grant: "draw" | "mana" | "damage_enemy"; amount: number }
  /** The avatar itself carries a keyword (Stealth, Charge, etc.). */
  | { kind: "avatar_keyword"; keyword: string };

export function parseAvatarAbilities(rulesText: string): AvatarAbility[] {
  const t = (rulesText ?? "").toLowerCase();
  const abs: AvatarAbility[] = [];
  const ELEMENTS = ["water", "earth", "fire", "air"];

  // ── Passive minion stat buff ─────────────────────────────────────────────
  // "Friendly minions get +1/+0" / "[element] minions you control have +0/+1"
  const buffM = t.match(/(?:(\w+)\s+)?minions?(?:\s+you\s+control)?\s+(?:get|have|gain)\s+\+(\d+)\/\+(\d+)/);
  if (buffM) {
    const el = buffM[1] && ELEMENTS.includes(buffM[1]) ? buffM[1] : null;
    abs.push({ kind: "passive_buff", attackBonus: parseInt(buffM[2]), defenseBonus: parseInt(buffM[3]), keywords: [], elementFilter: el });
  }
  // Passive keyword grants to minions ("friendly minions have/gain Airborne")
  for (const kw of ["airborne", "charge", "lethal", "ranged", "burrowing", "ward", "stealth", "undying"]) {
    if (new RegExp(`(?:friendly\\s+)?(?:\\w+\\s+)?minions?(?:\\s+you\\s+control)?\\s+(?:have|get|gain)\\s+${kw}`).test(t)) {
      abs.push({ kind: "passive_buff", attackBonus: 0, defenseBonus: 0, keywords: [kw], elementFilter: null });
    }
  }

  // ── Start-of-turn triggers ────────────────────────────────────────────────
  const sotMana = t.match(/at\s+the\s+start\s+of\s+your\s+turn[^.]*?(?:gain|add)\s+(\d+)\s+mana/);
  if (sotMana) abs.push({ kind: "start_of_turn", grant: "mana", amount: parseInt(sotMana[1]) });

  const sotDraw = t.match(/at\s+the\s+start\s+of\s+your\s+turn[^.]*?draw\s+(?:a\s+card|(\d+))/);
  if (sotDraw) abs.push({ kind: "start_of_turn", grant: "draw", amount: sotDraw[1] ? parseInt(sotDraw[1]) : 1 });

  const sotDmg = t.match(/at\s+the\s+start\s+of\s+your\s+turn[^.]*?deal\s+(\d+)\s+damage/);
  if (sotDmg) abs.push({ kind: "start_of_turn", grant: "damage_enemy", amount: parseInt(sotDmg[1]) });

  const sotHeal = t.match(/at\s+the\s+start\s+of\s+your\s+turn[^.]*?(?:heal|restore|gain)\s+(\d+)\s+(?:life|health)/);
  if (sotHeal) abs.push({ kind: "start_of_turn", grant: "heal", amount: parseInt(sotHeal[1]) });

  // ── On-friendly-death triggers ────────────────────────────────────────────
  const deathDmg  = t.match(/when(?:ever)?\s+(?:a\s+)?(?:friendly\s+)?minion[^.]*?dies[^.]*?deal\s+(\d+)\s+damage/);
  if (deathDmg)  abs.push({ kind: "on_friendly_death", grant: "damage_enemy", amount: parseInt(deathDmg[1]) });

  const deathDraw = t.match(/when(?:ever)?\s+(?:a\s+)?(?:friendly\s+)?minion[^.]*?dies[^.]*?draw\s+(?:a\s+card|(\d+))/);
  if (deathDraw) abs.push({ kind: "on_friendly_death", grant: "draw", amount: deathDraw[1] ? parseInt(deathDraw[1]) : 1 });

  const deathMana = t.match(/when(?:ever)?\s+(?:a\s+)?(?:friendly\s+)?minion[^.]*?dies[^.]*?(?:gain|add)\s+(\d+)\s+mana/);
  if (deathMana) abs.push({ kind: "on_friendly_death", grant: "mana", amount: parseInt(deathMana[1]) });

  // ── On-site-placed triggers ───────────────────────────────────────────────
  const siteDraw = t.match(/when(?:ever)?\s+you\s+(?:place|play)\s+(?:a\s+)?site[^.]*?draw\s+(?:a\s+card|(\d+))/);
  if (siteDraw) abs.push({ kind: "on_site_placed", grant: "draw", amount: siteDraw[1] ? parseInt(siteDraw[1]) : 1 });

  const siteMana = t.match(/when(?:ever)?\s+you\s+(?:place|play)\s+(?:a\s+)?site[^.]*?(?:gain|add)\s+(\d+)\s+mana/);
  if (siteMana) abs.push({ kind: "on_site_placed", grant: "mana", amount: parseInt(siteMana[1]) });

  const siteDmg = t.match(/when(?:ever)?\s+you\s+(?:place|play)\s+(?:a\s+)?site[^.]*?deal\s+(\d+)\s+damage/);
  if (siteDmg)  abs.push({ kind: "on_site_placed", grant: "damage_enemy", amount: parseInt(siteDmg[1]) });

  // ── On-spell-cast triggers ────────────────────────────────────────────────
  const spellDraw = t.match(/when(?:ever)?\s+you\s+cast\s+(?:a\s+)?(?:magic\s+)?(?:spell|card)[^.]*?draw\s+(?:a\s+card|(\d+))/);
  if (spellDraw) abs.push({ kind: "on_spell_cast", grant: "draw", amount: spellDraw[1] ? parseInt(spellDraw[1]) : 1 });

  const spellMana = t.match(/when(?:ever)?\s+you\s+cast\s+(?:a\s+)?(?:magic\s+)?(?:spell|card)[^.]*?(?:gain|add)\s+(\d+)\s+mana/);
  if (spellMana) abs.push({ kind: "on_spell_cast", grant: "mana", amount: parseInt(spellMana[1]) });

  const spellDmg = t.match(/when(?:ever)?\s+you\s+cast\s+(?:a\s+)?(?:magic\s+)?(?:spell|card)[^.]*?deal\s+(\d+)\s+damage/);
  if (spellDmg)  abs.push({ kind: "on_spell_cast", grant: "damage_enemy", amount: parseInt(spellDmg[1]) });

  // ── Avatar keywords ───────────────────────────────────────────────────────
  for (const kw of ["airborne", "stealth", "charge", "lethal", "ranged", "ward"]) {
    if (new RegExp(`\\bthis\\s+avatar\\s+(?:has|gains?)\\s+${kw}\\b`).test(t) ||
        new RegExp(`^${kw}[,.]`).test(t)) {
      abs.push({ kind: "avatar_keyword", keyword: kw });
    }
  }

  return abs;
}

// ─── Grid positions & helpers ─────────────────────────────────────────────────

interface Pos { col: number; row: number; }

const COLS = 5;
const ROWS = 4;
const AVATAR_COL = 2;

function inBounds(p: Pos): boolean {
  return p.col >= 0 && p.col < COLS && p.row >= 0 && p.row < ROWS;
}
function posEq(a: Pos, b: Pos): boolean { return a.col === b.col && a.row === b.row; }
function posKey(p: Pos): string { return `${p.col},${p.row}`; }

function cardinalNeighbors(p: Pos): Pos[] {
  return [
    { col: p.col - 1, row: p.row }, { col: p.col + 1, row: p.row },
    { col: p.col, row: p.row - 1 }, { col: p.col, row: p.row + 1 },
  ].filter(inBounds);
}

function cardinalDist(a: Pos, b: Pos): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}
function chebyshevDist(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}
function stepDist(a: Pos, b: Pos, airborne: boolean): number {
  return airborne ? chebyshevDist(a, b) : cardinalDist(a, b);
}

function cardinalStep(from: Pos, to: Pos): Pos {
  if (from.col !== to.col) return { col: from.col + Math.sign(to.col - from.col), row: from.row };
  return { col: from.col, row: from.row + Math.sign(to.row - from.row) };
}
function diagonalStep(from: Pos, to: Pos): Pos {
  return { col: from.col + Math.sign(to.col - from.col), row: from.row + Math.sign(to.row - from.row) };
}

// ─── Grid state ───────────────────────────────────────────────────────────────

type SquareOwner = "A" | "B" | null;
interface GridSquare { owner: SquareOwner; site?: SimCard; isRubble: boolean; }
type Grid = GridSquare[][];

function makeGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ owner: null, site: undefined, isRubble: false }))
  );
}
function getSquare(grid: Grid, p: Pos): GridSquare { return grid[p.row][p.col]; }

function ownedSites(grid: Grid, owner: "A" | "B"): Pos[] {
  const result: Pos[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c].owner === owner) result.push({ col: c, row: r });
  return result;
}
function countSites(grid: Grid, owner: "A" | "B"): number { return ownedSites(grid, owner).length; }

function siteThreshold(grid: Grid, owner: "A" | "B"): Threshold {
  const t: Threshold = { water: 0, earth: 0, fire: 0, air: 0 };
  for (const p of ownedSites(grid, owner)) {
    for (const el of getSquare(grid, p).site?.elements ?? []) {
      if      (el === "water") t.water++;
      else if (el === "earth") t.earth++;
      else if (el === "fire")  t.fire++;
      else if (el === "air")   t.air++;
    }
  }
  return t;
}

// ─── Board units ──────────────────────────────────────────────────────────────

interface BoardMinion {
  card: SimCard;
  pos: Pos;
  owner: "A" | "B";
  tapped: boolean;
  sick: boolean;
  tempDamage: number;
  stealthy: boolean;
}

/** Artifact in play — either equipment (attached to a minion) or a structure (on a site). */
interface BoardArtifact {
  card:       SimCard;
  owner:      "A" | "B";
  attachedTo: BoardMinion | null; // null = structure
  pos:        Pos | null;          // position if structure
  effect:     ArtifactEffect;
}

/** Aura in play — enchants a specific minion. */
interface BoardAura {
  card:       SimCard;
  owner:      "A" | "B";
  attachedTo: BoardMinion;
  effect:     AuraEffect;
  temporary:  boolean; // true = spell-buff; removed at end of active player's turn
}

// ─── Player state ─────────────────────────────────────────────────────────────

interface Threshold { water: number; earth: number; fire: number; air: number; }

interface PlayerState {
  id: "A" | "B";
  avatarCard: SimCard;
  avatarLife: number;
  avatarPos: Pos;
  deathsDoor: boolean;
  atlasDeck:  SimCard[];
  spellDeck:  SimCard[];
  atlasHand:  SimCard[];
  spellHand:  SimCard[];
  mana:       number;
  threshold:  Threshold;
  avatarTapUsed: boolean;
  sitesPlaced:     number;
  minionsDeployed: number;
  siteAttacks:     number;
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
function remove<T>(arr: T[], item: T): T[] {
  const idx = arr.indexOf(item);
  return idx === -1 ? arr : [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

function initPlayer(spec: DeckSpec, id: "A" | "B"): PlayerState {
  const sites    = shuffle(spec.cards.filter(c => c.type === "Site"));
  const nonSites = shuffle(spec.cards.filter(c => c.type !== "Site" && c.type !== "Avatar"));
  const p: PlayerState = {
    id,
    avatarCard:     spec.avatar,
    avatarLife:     spec.avatar.life > 0 ? spec.avatar.life : 20,
    avatarPos:      { col: AVATAR_COL, row: id === "A" ? 0 : 3 },
    deathsDoor:     false,
    atlasDeck:      sites,
    spellDeck:      nonSites,
    atlasHand:      [],
    spellHand:      [],
    mana:            0,
    threshold:       { water: 0, earth: 0, fire: 0, air: 0 },
    avatarTapUsed:   false,
    sitesPlaced:     0,
    minionsDeployed: 0,
    siteAttacks:     0,
  };
  for (let i = 0; i < 3 && p.atlasDeck.length > 0; i++) p.atlasHand.push(p.atlasDeck.pop()!);
  for (let i = 0; i < 3 && p.spellDeck.length > 0; i++) p.spellHand.push(p.spellDeck.pop()!);
  return p;
}

function drawOne(p: PlayerState): void {
  const wantAtlas = (p.atlasHand.length <= p.spellHand.length && p.atlasDeck.length > 0) || p.spellDeck.length === 0;
  if (wantAtlas && p.atlasDeck.length > 0) p.atlasHand.push(p.atlasDeck.pop()!);
  else if (p.spellDeck.length > 0)          p.spellHand.push(p.spellDeck.pop()!);
}

function canPlay(card: SimCard, threshold: Threshold, mana: number): boolean {
  if (card.type === "Site") return true;
  const cost = card.waterT + card.earthT + card.fireT + card.airT;
  return mana >= cost &&
    threshold.water >= card.waterT && threshold.earth >= card.earthT &&
    threshold.fire  >= card.fireT  && threshold.air   >= card.airT;
}
function minionValue(c: SimCard): number { return (c.attack ?? 0) + (c.defense ?? 0); }

// ─── Site placement ───────────────────────────────────────────────────────────

function findSitePlacementSquares(grid: Grid, minions: BoardMinion[], player: PlayerState): Pos[] {
  const owned = ownedSites(grid, player.id);
  if (owned.length === 0) {
    const sq = getSquare(grid, player.avatarPos);
    return !sq.owner ? [player.avatarPos] : [];
  }
  const minionKeys = new Set(minions.map(m => posKey(m.pos)));
  const candidates = new Set<string>();
  for (const site of owned)
    for (const nb of cardinalNeighbors(site)) {
      const sq = getSquare(grid, nb);
      if (!sq.owner && !minionKeys.has(posKey(nb))) candidates.add(posKey(nb));
    }
  return [...candidates].map(k => { const [c, r] = k.split(",").map(Number); return { col: c, row: r }; });
}

function chooseSitePosition(candidates: Pos[], enemyAvatarPos: Pos): Pos {
  return [...candidates].sort((a, b) => cardinalDist(a, enemyAvatarPos) - cardinalDist(b, enemyAvatarPos))[0];
}

function chooseSiteCard(sites: SimCard[], threshold: Threshold, spellHand: SimCard[]): SimCard {
  const needed: Record<string, number> = { water: 0, earth: 0, fire: 0, air: 0 };
  for (const c of spellHand) {
    if (c.type === "Site") continue;
    needed.water = Math.max(needed.water, Math.max(0, c.waterT - threshold.water));
    needed.earth = Math.max(needed.earth, Math.max(0, c.earthT - threshold.earth));
    needed.fire  = Math.max(needed.fire,  Math.max(0, c.fireT  - threshold.fire));
    needed.air   = Math.max(needed.air,   Math.max(0, c.airT   - threshold.air));
  }
  const score = (s: SimCard) => s.elements.reduce((n, el) => n + (needed[el] ?? 0), 0) + s.elements.length * 0.01;
  return [...sites].sort((a, b) => score(b) - score(a))[0];
}

function freeSiteSquares(grid: Grid, minions: BoardMinion[], owner: "A" | "B"): Pos[] {
  const minionKeys = new Set(minions.map(m => posKey(m.pos)));
  return ownedSites(grid, owner).filter(p => !minionKeys.has(posKey(p)));
}

function chooseMinionPosition(freeSites: Pos[], enemyAvatarPos: Pos): Pos {
  return [...freeSites].sort((a, b) => cardinalDist(a, enemyAvatarPos) - cardinalDist(b, enemyAvatarPos))[0];
}

// ─── Board snapshot types ─────────────────────────────────────────────────────

export interface MinionState {
  name: string; owner: "A" | "B";
  attack: number; defense: number;
  tapped: boolean; sick: boolean;
  keywords: string[];
}
export interface SquareState {
  siteOwner: "A" | "B" | null; siteName: string | null;
  isRubble: boolean; minion: MinionState | null;
  isAvatarA: boolean; isAvatarB: boolean;
}
export interface BoardSnapshot {
  turn: number; activePlayer: "A" | "B";
  lifeA: number; lifeB: number;
  manaA: number; manaB: number;
  sitesA: number; sitesB: number;
  squares: SquareState[][];
}

// ─── Game result types ────────────────────────────────────────────────────────

export interface GameResult {
  winner: "A" | "B" | "draw";
  turns: number;
  log: string[];
  snapshots: BoardSnapshot[];
  finalLifeA: number; finalLifeB: number;
  sitesA: number;  sitesB: number;
  minionsA: number; minionsB: number;
  siteAtksA: number; siteAtksB: number;
}

const MAX_TURNS = 50;

// ─── Main game simulation ─────────────────────────────────────────────────────

export function simulateGame(specA: DeckSpec, specB: DeckSpec, keepLog = false): GameResult {
  const grid     = makeGrid();
  const pA       = initPlayer(specA, "A");
  const pB       = initPlayer(specB, "B");
  const minions: BoardMinion[]  = [];
  const artifacts: BoardArtifact[] = [];
  const auras: BoardAura[]     = [];

  const log: string[]          = [];
  const snapshots: BoardSnapshot[] = [];
  const emit = (msg: string) => { if (keepLog) log.push(msg); };

  // ── Effective-stat helpers (close over auras/artifacts) ──────────────────

  function effAtk(bm: BoardMinion): number {
    let v = bm.card.attack;
    for (const a of auras)     if (a.attachedTo === bm) v += a.effect.attackBonus;
    for (const a of artifacts) if (a.attachedTo === bm) v += a.effect.attackBonus;
    // Avatar passive buff
    for (const ab of player(bm.owner).avatarCard.avatarAbilities ?? [])
      if (ab.kind === "passive_buff" && (!ab.elementFilter || bm.card.elements.includes(ab.elementFilter)))
        v += ab.attackBonus;
    return v;
  }
  function effDef(bm: BoardMinion): number {
    let v = bm.card.defense;
    for (const a of auras)     if (a.attachedTo === bm) v += a.effect.defenseBonus;
    for (const a of artifacts) if (a.attachedTo === bm) v += a.effect.defenseBonus;
    // Avatar passive buff
    for (const ab of player(bm.owner).avatarCard.avatarAbilities ?? [])
      if (ab.kind === "passive_buff" && (!ab.elementFilter || bm.card.elements.includes(ab.elementFilter)))
        v += ab.defenseBonus;
    return v;
  }
  function effKws(bm: BoardMinion): string[] {
    const kws = [...bm.card.keywords];
    for (const a of auras)     if (a.attachedTo === bm) for (const k of a.effect.keywords) if (!kws.includes(k)) kws.push(k);
    for (const a of artifacts) if (a.attachedTo === bm) for (const k of a.effect.keywords) if (!kws.includes(k)) kws.push(k);
    // Avatar passive keyword grants
    for (const ab of player(bm.owner).avatarCard.avatarAbilities ?? [])
      if (ab.kind === "passive_buff" && (!ab.elementFilter || bm.card.elements.includes(ab.elementFilter)))
        for (const k of ab.keywords) if (!kws.includes(k)) kws.push(k);
    return kws;
  }
  function bHasKw(bm: BoardMinion, kw: string): boolean { return effKws(bm).includes(kw); }
  function bIsAirborne(bm: BoardMinion): boolean { return bHasKw(bm, "airborne"); }
  function bCanAttack(bm: BoardMinion): boolean {
    return !bm.tapped && !(bm.sick && !bHasKw(bm, "charge"));
  }

  // ── Board queries ─────────────────────────────────────────────────────────

  function friendlyMinions(id: "A" | "B"): BoardMinion[] { return minions.filter(m => m.owner === id); }
  function enemyMinions(id: "A" | "B"): BoardMinion[]    { return minions.filter(m => m.owner !== id); }
  function player(id: "A" | "B"): PlayerState { return id === "A" ? pA : pB; }
  function opponent(id: "A" | "B"): PlayerState { return id === "A" ? pB : pA; }

  function removeMinion(bm: BoardMinion): void {
    const idx = minions.indexOf(bm);
    if (idx !== -1) minions.splice(idx, 1);
    // Read Undying before clearing auras/artifacts (they might grant it)
    const hasUndying = bHasKw(bm, "undying");
    // Clean up attached auras/artifacts
    for (let i = auras.length - 1; i >= 0; i--)
      if (auras[i].attachedTo === bm) auras.splice(i, 1);
    for (let i = artifacts.length - 1; i >= 0; i--)
      if (artifacts[i].attachedTo === bm) artifacts.splice(i, 1);
    // Undying: return card to owner's hand instead of dying permanently
    if (hasUndying) {
      player(bm.owner).spellHand.push(bm.card);
      emit(`  → ${bm.card.name} returns to hand (Undying)`);
    }
    // Avatar on_friendly_death triggers
    const owner = player(bm.owner);
    const opp   = opponent(bm.owner);
    for (const ab of owner.avatarCard.avatarAbilities ?? []) {
      if (ab.kind !== "on_friendly_death") continue;
      if (ab.grant === "damage_enemy") {
        damageAvatar(opp, ab.amount, owner.avatarCard.name);
      } else if (ab.grant === "draw") {
        for (let i = 0; i < ab.amount; i++) drawOne(owner);
        emit(`  → ${owner.avatarCard.name} draws ${ab.amount} (death trigger)`);
      } else if (ab.grant === "mana") {
        owner.mana += ab.amount;
        emit(`  → ${owner.avatarCard.name} gains ${ab.amount} mana (death trigger)`);
      }
    }
  }

  /** Can attacker see / legally target a defender? */
  function canTarget(atk: BoardMinion, def: BoardMinion): boolean {
    if (def.stealthy) return false;
    // Burrowing: can only be targeted by burrowing, airborne, or ranged units
    if (bHasKw(def, "burrowing")) {
      return bHasKw(atk, "burrowing") || bHasKw(atk, "airborne") || bHasKw(atk, "ranged");
    }
    // Submerge: can only be targeted by submerged, airborne, or ranged units
    if (bHasKw(def, "submerge")) {
      return bHasKw(atk, "submerge") || bHasKw(atk, "airborne") || bHasKw(atk, "ranged");
    }
    return true;
  }

  // ── Simultaneous fight ────────────────────────────────────────────────────

  interface FightResult { attackerDies: boolean; defenderDies: boolean; }

  function resolveFight(atk: BoardMinion, def: BoardMinion): FightResult {
    return {
      attackerDies: def.card.attack >= effDef(atk) || bHasKw(def, "lethal"),
      defenderDies: effAtk(atk)     >= effDef(def) || bHasKw(atk, "lethal"),
    };
  }

  // ── Ranged one-way attack ─────────────────────────────────────────────────

  function resolveRangedAttack(atk: BoardMinion, def: BoardMinion, casterName: string): void {
    if (atk.stealthy) atk.stealthy = false;
    atk.tapped = true;
    // One-way: attacker deals damage; defender only fights back if also ranged
    const defenderDies = effAtk(atk) >= effDef(def) || bHasKw(atk, "lethal");
    const attackerDies = bHasKw(def, "ranged") && (def.card.attack >= effDef(atk) || bHasKw(def, "lethal"));
    emit(`T${turn} [${casterName}] ${atk.card.name} fires at ${def.card.name} (ranged)`);
    if (defenderDies) { removeMinion(def); emit(`  → ${def.card.name} destroyed`); }
    if (attackerDies) { removeMinion(atk); emit(`  → ${atk.card.name} shot down in return`); }
  }

  // ── Avatar damage ─────────────────────────────────────────────────────────

  function damageAvatar(target: PlayerState, amount: number, source: string): void {
    if (amount <= 0) return;
    target.avatarLife -= amount;
    emit(`  → ${source} deals ${amount} to ${target.avatarCard.name} (${Math.max(0, target.avatarLife)} life)`);
    if (target.avatarLife <= 0 && !target.deathsDoor) {
      target.deathsDoor = true;
      target.avatarLife = 1;
      emit(`  → ${target.avatarCard.name} is at Death's Door!`);
    }
  }

  // ── Board snapshot ────────────────────────────────────────────────────────

  function captureSnapshot(currentTurn: number, active: "A" | "B"): BoardSnapshot {
    const squares: SquareState[][] = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const sq = getSquare(grid, { col: c, row: r });
        const bm = minions.find(m => m.pos.col === c && m.pos.row === r);
        return {
          siteOwner: sq.owner, siteName: sq.site?.name ?? null, isRubble: sq.isRubble,
          minion: bm ? {
            name: bm.card.name, owner: bm.owner,
            attack: effAtk(bm), defense: effDef(bm),
            tapped: bm.tapped, sick: bm.sick, keywords: effKws(bm),
          } : null,
          isAvatarA: pA.avatarPos.col === c && pA.avatarPos.row === r,
          isAvatarB: pB.avatarPos.col === c && pB.avatarPos.row === r,
        };
      })
    );
    return {
      turn: currentTurn, activePlayer: active,
      lifeA: Math.max(0, pA.avatarLife), lifeB: Math.max(0, pB.avatarLife),
      manaA: pA.mana, manaB: pB.mana,
      sitesA: countSites(grid, "A"), sitesB: countSites(grid, "B"),
      squares,
    };
  }

  // ── Site placement ────────────────────────────────────────────────────────

  function playSite(active: PlayerState): void {
    if (active.avatarTapUsed || active.atlasHand.length === 0) return;
    const squares = findSitePlacementSquares(grid, minions, active);
    if (squares.length === 0) return;

    const card = chooseSiteCard(active.atlasHand, active.threshold, active.spellHand);
    const pos  = chooseSitePosition(squares, opponent(active.id).avatarPos);

    active.atlasHand = remove(active.atlasHand, card);
    const sq = getSquare(grid, pos);
    sq.owner = active.id; sq.site = card; sq.isRubble = false;
    active.avatarTapUsed = true;
    active.sitesPlaced++;
    active.mana      = countSites(grid, active.id);
    active.threshold = siteThreshold(grid, active.id);
    // Apply structure artifacts' mana bonus already on board
    for (const art of artifacts)
      if (art.owner === active.id && art.effect.kind === "structure") active.mana += art.effect.manaBonus;

    emit(`T${turn} [${active.id}] places site ${card.name} at (${pos.col},${pos.row}) → ${active.mana} mana · W${active.threshold.water}E${active.threshold.earth}F${active.threshold.fire}A${active.threshold.air}`);

    // Avatar on_site_placed triggers
    for (const ab of active.avatarCard.avatarAbilities ?? []) {
      if (ab.kind !== "on_site_placed") continue;
      if (ab.grant === "draw") {
        for (let i = 0; i < ab.amount; i++) drawOne(active);
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} draws ${ab.amount} (site placed)`);
      } else if (ab.grant === "mana") {
        active.mana += ab.amount;
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} gains ${ab.amount} mana (site placed)`);
      } else if (ab.grant === "damage_enemy") {
        damageAvatar(opponent(active.id), ab.amount, active.avatarCard.name);
      }
    }
  }

  // ── Spell resolution ──────────────────────────────────────────────────────

  function resolveSpellEffect(active: PlayerState, opp: PlayerState, effect: SpellEffect, cost: number, cardName: string): void {
    switch (effect.kind) {

      case "destroy": {
        const targets = enemyMinions(active.id).filter(m => !m.stealthy && !bHasKw(m, "ward"));
        if (targets.length > 0) {
          // Destroy the highest-value target
          const victim = [...targets].sort((a, b) => minionValue(b.card) - minionValue(a.card))[0];
          removeMinion(victim);
          emit(`T${turn} [${active.id}] casts ${cardName}: destroys ${victim.card.name}`);
        } else {
          damageAvatar(opp, Math.max(1, cost), cardName);
        }
        break;
      }

      case "damage": {
        const targets = enemyMinions(active.id).filter(m => !m.stealthy && !bHasKw(m, "ward"));
        if (targets.length > 0) {
          // Prefer killable; otherwise pick weakest
          const killable = targets.filter(t => effect.amount >= effDef(t));
          const victim = (killable.length > 0 ? killable : targets)
            .sort((a, b) => minionValue(a.card) - minionValue(b.card))[0];
          emit(`T${turn} [${active.id}] casts ${cardName}: ${effect.amount} damage to ${victim.card.name}`);
          if (effect.amount >= effDef(victim)) {
            removeMinion(victim);
            emit(`  → ${victim.card.name} destroyed`);
          }
        } else {
          damageAvatar(opp, effect.amount, cardName);
        }
        break;
      }

      case "damage_all": {
        const targets = enemyMinions(active.id).filter(m => !m.stealthy && !bHasKw(m, "ward"));
        emit(`T${turn} [${active.id}] casts ${cardName}: ${effect.amount} damage to all enemies`);
        for (const t of [...targets]) {  // copy — list mutates as minions die
          if (effect.amount >= effDef(t)) { removeMinion(t); emit(`  → ${t.card.name} destroyed`); }
        }
        if (targets.length === 0) damageAvatar(opp, effect.amount, cardName);
        break;
      }

      case "draw": {
        for (let i = 0; i < effect.amount; i++) drawOne(active);
        emit(`T${turn} [${active.id}] casts ${cardName}: draws ${effect.amount}`);
        break;
      }

      case "buff": {
        const friends = friendlyMinions(active.id);
        if (friends.length > 0) {
          const target = [...friends].sort((a, b) => minionValue(b.card) - minionValue(a.card))[0];
          // Push as a temporary aura (removed at end of this turn)
          auras.push({
            card: { ...target.card, name: `${cardName} buff` },
            owner: active.id, attachedTo: target,
            effect: { attackBonus: effect.attack, defenseBonus: effect.defense, keywords: [] },
            temporary: true,
          });
          emit(`T${turn} [${active.id}] casts ${cardName}: buffs ${target.card.name} +${effect.attack}/+${effect.defense}`);
        }
        break;
      }

      case "bounce": {
        const targets = enemyMinions(active.id).filter(m => !m.stealthy && !bHasKw(m, "ward"));
        if (targets.length > 0) {
          const victim = [...targets].sort((a, b) => minionValue(b.card) - minionValue(a.card))[0];
          removeMinion(victim);
          opp.spellHand.push(victim.card);
          emit(`T${turn} [${active.id}] casts ${cardName}: bounces ${victim.card.name} to hand`);
        }
        break;
      }

      case "destroy_site": {
        const enemySites = ownedSites(grid, opp.id);
        if (enemySites.length > 0) {
          // Target the most advanced site — farthest from opponent's avatar (= closest to ours)
          const target = [...enemySites].sort(
            (a, b) => cardinalDist(b, opp.avatarPos) - cardinalDist(a, opp.avatarPos)
          )[0];
          const sq = getSquare(grid, target);
          const siteName = sq.site?.name ?? "enemy site";
          sq.owner = null; sq.site = undefined; sq.isRubble = true;
          opp.mana      = countSites(grid, opp.id);
          opp.threshold = siteThreshold(grid, opp.id);
          emit(`T${turn} [${active.id}] casts ${cardName}: destroys ${siteName} at (${target.col},${target.row})`);
        } else {
          damageAvatar(opp, Math.max(1, cost), cardName);
        }
        break;
      }

      case "steal": {
        const targets = enemyMinions(active.id).filter(m => !m.stealthy && !bHasKw(m, "ward"));
        if (targets.length > 0) {
          const victim = [...targets].sort((a, b) => minionValue(b.card) - minionValue(a.card))[0];
          victim.owner = active.id;
          victim.tapped = true; victim.sick = true; // stolen minion is sick this turn
          emit(`T${turn} [${active.id}] casts ${cardName}: steals ${victim.card.name}`);
        }
        break;
      }

      case "exhaust": {
        const targets = enemyMinions(active.id).filter(m => !m.stealthy && !bHasKw(m, "ward") && !m.tapped);
        if (targets.length > 0) {
          // Exhaust the most dangerous untapped enemy
          const victim = [...targets].sort((a, b) => effAtk(b) - effAtk(a))[0];
          victim.tapped = true;
          emit(`T${turn} [${active.id}] casts ${cardName}: exhausts ${victim.card.name}`);
        }
        break;
      }

      default: { // generic
        const ping = Math.max(1, cost);
        const targets = enemyMinions(active.id).filter(m => !m.stealthy && !bHasKw(m, "ward"));
        if (targets.length > 0) {
          const victim = [...targets].sort((a, b) => minionValue(a.card) - minionValue(b.card))[0];
          removeMinion(victim);
          emit(`T${turn} [${active.id}] casts ${cardName}: removes ${victim.card.name}`);
        } else {
          damageAvatar(opp, ping, cardName);
        }
      }
    }
  }

  // ── Card play ─────────────────────────────────────────────────────────────

  function playCards(active: PlayerState): void {
    const opp = opponent(active.id);
    let keepTrying = true;

    while (keepTrying) {
      keepTrying = false;
      const allPlayable = active.spellHand.filter(
        c => c.type !== "Site" && c.type !== "Avatar" && canPlay(c, active.threshold, active.mana)
      );
      if (allPlayable.length === 0) break;

      // Priority: Minions first (highest value), then other card types
      const card = [...allPlayable].sort((a, b) => {
        if (a.type === "Minion" && b.type !== "Minion") return -1;
        if (a.type !== "Minion" && b.type === "Minion") return 1;
        return minionValue(b) - minionValue(a);
      })[0];

      const cost = card.waterT + card.earthT + card.fireT + card.airT;
      active.mana -= cost;
      active.spellHand = remove(active.spellHand, card);

      if (card.type === "Minion") {
        const free = freeSiteSquares(grid, minions, active.id);
        if (free.length === 0) { active.spellHand.push(card); active.mana += cost; break; }
        const pos = chooseMinionPosition(free, opp.avatarPos);
        const bm: BoardMinion = {
          card, pos, owner: active.id,
          tapped: false, sick: !hasKw(card, "charge"), tempDamage: 0,
          stealthy: hasKw(card, "stealth"),
        };
        minions.push(bm);
        active.minionsDeployed++;
        const kwStr = card.keywords.length ? ` [${card.keywords.join(",")}]` : "";
        emit(`T${turn} [${active.id}] plays ${card.name} (${card.attack}/${card.defense})${kwStr} → (${pos.col},${pos.row})`);
        keepTrying = true;

      } else if (card.type === "Artifact") {
        const fx = card.artifactEffect ?? parseArtifactEffect(card.rulesText);
        if (fx.kind === "equipment") {
          const friends = friendlyMinions(active.id);
          if (friends.length > 0) {
            const target = [...friends].sort((a, b) => minionValue(b.card) - minionValue(a.card))[0];
            artifacts.push({ card, owner: active.id, attachedTo: target, pos: null, effect: fx });
            emit(`T${turn} [${active.id}] equips ${card.name} to ${target.card.name} (+${fx.attackBonus}/+${fx.defenseBonus})`);
          }
        } else {
          // Structure — place on any friendly site
          const sites = ownedSites(grid, active.id);
          const pos = sites.length > 0 ? sites[0] : null;
          artifacts.push({ card, owner: active.id, attachedTo: null, pos, effect: fx });
          if (fx.manaBonus > 0) {
            active.mana += fx.manaBonus;
            emit(`T${turn} [${active.id}] builds structure ${card.name} (+${fx.manaBonus} mana)`);
          } else {
            emit(`T${turn} [${active.id}] builds structure ${card.name}`);
          }
        }
        keepTrying = true;

      } else if (card.type === "Aura") {
        const fx = card.auraEffect ?? parseAuraEffect(card.rulesText);
        const friends = friendlyMinions(active.id);
        if (friends.length > 0) {
          // Enchant the minion that benefits most — prefer one gaining a new keyword
          const target = [...friends].sort((a, b) => {
            const aGains = fx.keywords.filter(k => !bHasKw(a, k)).length;
            const bGains = fx.keywords.filter(k => !bHasKw(b, k)).length;
            return bGains - aGains || minionValue(b.card) - minionValue(a.card);
          })[0];
          auras.push({ card, owner: active.id, attachedTo: target, effect: fx, temporary: false });
          const kwStr = fx.keywords.length ? ` [grants ${fx.keywords.join(",")}]` : "";
          emit(`T${turn} [${active.id}] enchants ${target.card.name} with ${card.name}${kwStr}`);
        }
        keepTrying = true;

      } else {
        // Magic spell
        const fx = card.spellEffect ?? parseSpellEffect(card.rulesText);
        resolveSpellEffect(active, opp, fx, cost, card.name);
        // Avatar on_spell_cast triggers
        for (const ab of active.avatarCard.avatarAbilities ?? []) {
          if (ab.kind !== "on_spell_cast") continue;
          if (ab.grant === "draw") {
            for (let i = 0; i < ab.amount; i++) drawOne(active);
            emit(`T${turn} [${active.id}] ${active.avatarCard.name} draws ${ab.amount} (spell cast)`);
          } else if (ab.grant === "mana") {
            active.mana += ab.amount;
          } else if (ab.grant === "damage_enemy") {
            damageAvatar(opp, ab.amount, active.avatarCard.name);
          }
        }
        keepTrying = true;
      }
    }
  }

  // ── Combat step ───────────────────────────────────────────────────────────

  function combatStep(active: PlayerState): void {
    const opp = opponent(active.id);

    const actors = friendlyMinions(active.id)
      .filter(bCanAttack)
      .sort((a, b) => effAtk(b) - effAtk(a));

    for (const bm of actors) {
      if (!minions.includes(bm)) continue;

      const airborne = bIsAirborne(bm);
      const isRanged = bHasKw(bm, "ranged");

      // ── Ranged attack path ──────────────────────────────────────────────
      // Ranged units do NOT move to the target's square.
      // They attack any enemy within 2 cardinal steps from their current position.
      // The defender cannot retaliate (unless they also have Ranged).
      if (isRanged) {
        const rangedTargets = enemyMinions(active.id).filter(
          e => canTarget(bm, e) && cardinalDist(bm.pos, e.pos) <= 2
        );
        if (rangedTargets.length > 0) {
          // Prefer killable, then nearest, then weakest
          const target = [...rangedTargets].sort((a, b) => {
            const aKill = effAtk(bm) >= effDef(a) ? 0 : 1;
            const bKill = effAtk(bm) >= effDef(b) ? 0 : 1;
            return aKill - bKill || cardinalDist(bm.pos, a.pos) - cardinalDist(bm.pos, b.pos);
          })[0];
          resolveRangedAttack(bm, target, active.id);
          continue;
        }
        // No target in range — fall through to move 1 step closer
        const closestEnemy = [...enemyMinions(active.id)].sort(
          (a, b) => cardinalDist(bm.pos, a.pos) - cardinalDist(bm.pos, b.pos)
        )[0];
        const targetPos = closestEnemy?.pos ?? opp.avatarPos;
        const step = cardinalStep(bm.pos, targetPos);
        if (inBounds(step) && !posEq(step, bm.pos)) {
          emit(`T${turn} [${active.id}] ${bm.card.name} advances (${bm.pos.col},${bm.pos.row})→(${step.col},${step.row})`);
          bm.pos = step;
        }
        continue;
      }

      // ── Ground / airborne attack path ───────────────────────────────────
      const colocated = enemyMinions(active.id).filter(e => posEq(e.pos, bm.pos) && canTarget(bm, e));

      let targetPos: Pos;
      if (colocated.length > 0) {
        targetPos = bm.pos;
      } else {
        const visibleEnemies = enemyMinions(active.id).filter(e => canTarget(bm, e));
        const enemySites     = ownedSites(grid, opp.id);
        const candidates: { pos: Pos; dist: number }[] = [
          ...visibleEnemies.map(e => ({ pos: e.pos, dist: stepDist(bm.pos, e.pos, airborne) })),
          ...enemySites.map(p => ({ pos: p, dist: stepDist(bm.pos, p, airborne) })),
        ];
        if (candidates.length === 0) continue;
        candidates.sort((a, b) => a.dist - b.dist);
        targetPos = candidates[0].pos;
      }

      // Move 1 step toward target
      if (!posEq(bm.pos, targetPos)) {
        const newPos = airborne ? diagonalStep(bm.pos, targetPos) : cardinalStep(bm.pos, targetPos);
        if (inBounds(newPos) && !posEq(newPos, bm.pos)) {
          emit(`T${turn} [${active.id}] ${bm.card.name} moves (${bm.pos.col},${bm.pos.row})→(${newPos.col},${newPos.row})`);
          bm.pos = newPos;
        }
      }

      // Resolve at new position
      const atSameSquare = enemyMinions(active.id).filter(e => posEq(e.pos, bm.pos) && canTarget(bm, e));

      if (atSameSquare.length > 0) {
        const defender = [...atSameSquare].sort((a, b) => effAtk(b) - effAtk(a))[0];
        if (bm.stealthy) bm.stealthy = false;
        if (defender.stealthy) defender.stealthy = false;
        const { attackerDies, defenderDies } = resolveFight(bm, defender);
        bm.tapped = true;
        emit(`T${turn} [${active.id}] ${bm.card.name} fights ${defender.card.name} at (${bm.pos.col},${bm.pos.row})`);
        if (defenderDies) { removeMinion(defender); emit(`  → ${defender.card.name} destroyed`); }
        if (attackerDies) { removeMinion(bm);       emit(`  → ${bm.card.name} destroyed in combat`); }

      } else {
        const sq = getSquare(grid, bm.pos);
        if (sq.owner === opp.id) {
          // Check for Defend
          const defenders = friendlyMinions(opp.id).filter(
            d => !d.tapped && cardinalDist(d.pos, bm.pos) <= 1 && canTarget(bm, d)
          );
          if (defenders.length > 0) {
            const def = [...defenders].sort(
              (a, b) => cardinalDist(a.pos, bm.pos) - cardinalDist(b.pos, bm.pos)
            )[0];
            const fromPos = def.pos;
            def.pos   = { ...bm.pos };
            def.tapped = true;
            emit(`T${turn} [${opp.id}] ${def.card.name} defends from (${fromPos.col},${fromPos.row})`);
            if (bm.stealthy) bm.stealthy = false;
            const { attackerDies, defenderDies } = resolveFight(bm, def);
            bm.tapped = true;
            emit(`T${turn} [${active.id}] ${bm.card.name} vs defender ${def.card.name}`);
            if (defenderDies) { removeMinion(def); emit(`  → ${def.card.name} destroyed`); }
            if (attackerDies) { removeMinion(bm);  emit(`  → ${bm.card.name} destroyed by defender`); }
          } else {
            // Undefended site — deal damage to avatar
            if (bm.stealthy) bm.stealthy = false;
            bm.tapped = true;
            active.siteAttacks++;
            damageAvatar(opp, effAtk(bm), `${bm.card.name} (site attack)`);
            emit(`T${turn} [${active.id}] ${bm.card.name} attacks undefended site at (${bm.pos.col},${bm.pos.row})`);
          }
        }
      }
    }
  }

  // ─── Main turn loop ───────────────────────────────────────────────────────

  let turn = 0;
  if (keepLog) snapshots.push(captureSnapshot(0, "A"));

  while (turn < MAX_TURNS && pA.avatarLife > 0 && pB.avatarLife > 0) {
    turn++;
    const active  = turn % 2 === 1 ? pA : pB;
    const passive = turn % 2 === 1 ? pB : pA;

    // Untap / clear flags
    for (const m of friendlyMinions(active.id)) { m.tapped = false; m.sick = false; }
    active.avatarTapUsed = false;

    // Refresh mana (sites + structure artifacts)
    active.mana      = countSites(grid, active.id);
    active.threshold = siteThreshold(grid, active.id);
    for (const art of artifacts)
      if (art.owner === active.id && art.effect.kind === "structure") active.mana += art.effect.manaBonus;

    // Start-of-turn avatar abilities
    for (const ab of active.avatarCard.avatarAbilities ?? []) {
      if (ab.kind !== "start_of_turn") continue;
      if (ab.grant === "mana") {
        active.mana += ab.amount;
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} gains ${ab.amount} mana (start of turn)`);
      } else if (ab.grant === "draw") {
        for (let i = 0; i < ab.amount; i++) drawOne(active);
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} draws ${ab.amount} (start of turn)`);
      } else if (ab.grant === "damage_enemy") {
        damageAvatar(opponent(active.id), ab.amount, active.avatarCard.name);
      } else if (ab.grant === "heal") {
        const maxLife = active.avatarCard.life > 0 ? active.avatarCard.life : 20;
        active.avatarLife = Math.min(maxLife, active.avatarLife + ab.amount);
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} heals ${ab.amount} (start of turn)`);
      }
    }

    // Draw
    if (!(turn === 1 && active.id === "A")) drawOne(active);

    // Site placement
    playSite(active);

    // Play cards
    playCards(active);

    // Combat
    combatStep(active);

    // End of turn: clear temp damage and temporary buff auras
    for (const m of minions) m.tempDamage = 0;
    for (let i = auras.length - 1; i >= 0; i--)
      if (auras[i].temporary && auras[i].owner === active.id) auras.splice(i, 1);

    if (keepLog) snapshots.push(captureSnapshot(turn, active.id));

    void passive;
  }

  // ── Winner ────────────────────────────────────────────────────────────────
  let winner: "A" | "B" | "draw";
  if      (pA.avatarLife <= 0 && pB.avatarLife <= 0) winner = "draw";
  else if (pA.avatarLife <= 0)                        winner = "B";
  else if (pB.avatarLife <= 0)                        winner = "A";
  else winner = pA.avatarLife > pB.avatarLife ? "A" : pB.avatarLife > pA.avatarLife ? "B" : "draw";

  return {
    winner, turns: turn, log, snapshots,
    finalLifeA: Math.max(0, pA.avatarLife),
    finalLifeB: Math.max(0, pB.avatarLife),
    sitesA: pA.sitesPlaced,   sitesB: pB.sitesPlaced,
    minionsA: pA.minionsDeployed, minionsB: pB.minionsDeployed,
    siteAtksA: pA.siteAttacks, siteAtksB: pB.siteAttacks,
  };
}

// ─── Monte Carlo runner ───────────────────────────────────────────────────────

export interface SimulationReport {
  deckAName:       string;
  deckBName:       string;
  avatarA:         string;
  avatarB:         string;
  iterations:      number;
  winsA:           number;
  winsB:           number;
  draws:           number;
  winRateA:        string;
  winRateB:        string;
  avgTurns:        string;
  avgFinalLifeA:   string;
  avgFinalLifeB:   string;
  avgSitesA:       string;
  avgSitesB:       string;
  avgMinionsA:     string;
  avgMinionsB:     string;
  avgSiteAttacksA: string;
  avgSiteAttacksB: string;
  sampleGame:      GameResult;
}

export function runSimulation(specA: DeckSpec, specB: DeckSpec, iterations: number): SimulationReport {
  let winsA = 0, winsB = 0, draws = 0;
  let totalTurns = 0, totalLifeA = 0, totalLifeB = 0;
  let totalSitesA = 0, totalSitesB = 0;
  let totalMinionsA = 0, totalMinionsB = 0;
  let totalSiteAtksA = 0, totalSiteAtksB = 0;
  let sampleGame: GameResult | null = null;

  for (let i = 0; i < iterations; i++) {
    const r = simulateGame(specA, specB, i === 0);
    if      (r.winner === "A") winsA++;
    else if (r.winner === "B") winsB++;
    else                       draws++;
    totalTurns     += r.turns;
    totalLifeA     += r.finalLifeA;  totalLifeB     += r.finalLifeB;
    totalSitesA    += r.sitesA;      totalSitesB    += r.sitesB;
    totalMinionsA  += r.minionsA;    totalMinionsB  += r.minionsB;
    totalSiteAtksA += r.siteAtksA;   totalSiteAtksB += r.siteAtksB;
    if (i === 0) sampleGame = r;
  }

  const pct = (n: number) => ((n / iterations) * 100).toFixed(1) + "%";
  const avg = (n: number) => (n / iterations).toFixed(1);

  return {
    deckAName: specA.name, deckBName: specB.name,
    avatarA: specA.avatar.name, avatarB: specB.avatar.name,
    iterations, winsA, winsB, draws,
    winRateA: pct(winsA), winRateB: pct(winsB),
    avgTurns:      avg(totalTurns),
    avgFinalLifeA: avg(totalLifeA),   avgFinalLifeB: avg(totalLifeB),
    avgSitesA:     avg(totalSitesA),  avgSitesB:     avg(totalSitesB),
    avgMinionsA:   avg(totalMinionsA),avgMinionsB:   avg(totalMinionsB),
    avgSiteAttacksA: avg(totalSiteAtksA), avgSiteAttacksB: avg(totalSiteAtksB),
    sampleGame: sampleGame!,
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
    `Avg final life — A  : ${r.avgFinalLifeA}  |  B : ${r.avgFinalLifeB}`,
    `Avg sites placed    : A ${r.avgSitesA}  |  B ${r.avgSitesB}`,
    `Avg minions deployed: A ${r.avgMinionsA}  |  B ${r.avgMinionsB}`,
    `Avg site attacks    : A ${r.avgSiteAttacksA}  |  B ${r.avgSiteAttacksB}`,
    ``,
    `_Phase 3 model: shared 5×4 grid · site expansion · cardinal movement · same-square combat_`,
    `_Ranged (fires at 2 squares, no retaliation) · Airborne (8-dir) · Charge · Lethal · Stealth · Burrowing · Ward_`,
    `_Spell effects: Destroy · Damage · AoE · Draw · Bounce · Buff · Artifact persistence · Aura enchantments_`,
    `_Phase 4: Avatar abilities (start-of-turn, on-death, on-site, on-spell triggers; passive buffs) · Submerge · Undying · Destroy site · Steal · Exhaust_`,
  `_Does not model: unique named card text · Voidwalk · Ambush · Spellcaster_`,
    ``,
    `### Sample Game (Game 1 of ${r.iterations})`,
    `Winner: Deck ${r.sampleGame.winner} in ${r.sampleGame.turns} turns`,
    ``,
    ...r.sampleGame.log.slice(0, 50),
    r.sampleGame.log.length > 50 ? `… (${r.sampleGame.log.length - 50} more lines)` : "",
  ].filter(l => l !== undefined).join("\n");
}

// ─── Deck-building helpers ────────────────────────────────────────────────────

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

export function toSimCards(
  apiCards: ApiDeckCard[],
  rulesLookup?: Map<string, string>,
  lifeLookup?:  Map<string, number>,
): SimCard[] {
  const out: SimCard[] = [];
  for (const entry of apiCards) {
    const c         = entry.card;
    const rulesText = rulesLookup?.get(c.name) ?? "";
    const type      = c.type as SimCard["type"];
    const simCard: SimCard = {
      name:     c.name,
      type,
      attack:   c.attack   ?? 0,
      defense:  c.defense  ?? 0,
      life:     lifeLookup?.get(c.name) ?? 0,
      waterT:   c.waterThreshold ?? 0,
      earthT:   c.earthThreshold ?? 0,
      fireT:    c.fireThreshold  ?? 0,
      airT:     c.airThreshold   ?? 0,
      elements: (c.elements ?? []).map((e: { id: string }) => e.id),
      keywords: parseKeywords(rulesText),
      rulesText,
      spellEffect:     type === "Magic"    ? parseSpellEffect(rulesText)     : undefined,
      artifactEffect:  type === "Artifact" ? parseArtifactEffect(rulesText)  : undefined,
      auraEffect:      type === "Aura"     ? parseAuraEffect(rulesText)      : undefined,
      avatarAbilities: type === "Avatar"   ? parseAvatarAbilities(rulesText) : undefined,
    };
    for (let i = 0; i < (entry.quantity ?? 1); i++) out.push(simCard);
  }
  return out;
}

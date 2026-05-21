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
  subtypes: string[];           // e.g. ["knight"], ["dragon"], ["undead"]
  // Pre-parsed effects (set by toSimCards; undefined for non-spell/artifact/aura cards)
  spellEffect?:     SpellEffect;
  artifactEffect?:  ArtifactEffect;
  auraEffect?:      AuraEffect;
  siteEffect?:      SiteEffect;
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

// ─── Site effects ─────────────────────────────────────────────────────────────

export type SiteEffect =
  /** Genesis: deal X damage to each minion atop a target nearby enemy site. */
  | { kind: "genesis_damage_nearby";  amount: number }
  /** Genesis: gain X mana this turn (ifUniqueOnBoard = only when it's your sole copy). */
  | { kind: "genesis_gain_mana";      amount: number; ifUniqueOnBoard: boolean }
  /** Genesis: look at top N spells; bottom each that isn't payable soon. */
  | { kind: "genesis_scry";           amount: number }
  /** Genesis: pay tokenCost → summon a token on this site. */
  | { kind: "genesis_token";          tokenAtk: number; tokenDef: number; tokenCost: number }
  /** Genesis: heal X life to each nearby friendly avatar. */
  | { kind: "genesis_heal";           amount: number }
  /** Passive: non-airborne minions that enter this site are killed immediately. */
  | { kind: "passive_kill_entering_non_airborne" }
  /** Passive: enemy units entering or leaving this site take X damage. */
  | { kind: "passive_entry_damage";   amount: number }
  /** Passive: minions matching rarityFilter (null = any) cost X less to cast to
   *  this site (nearby = true → also adjacent sites, e.g. Camelot). */
  | { kind: "passive_cost_reduction"; amount: number; rarityFilter: string | null; nearby: boolean }
  /** Passive: provides no mana or threshold while any minion occupies it. */
  | { kind: "passive_no_mana_if_occupied" }
  /** Passive: whenever a site is played adjacent to this one, its controller loses X life. */
  | { kind: "passive_site_play_damage"; amount: number }
  // ── Tier 1 additions ────────────────────────────────────────────────────
  /** Genesis: add a burst of threshold this turn (Bloom sites). */
  | { kind: "genesis_threshold_burst"; water: boolean; earth: boolean; fire: boolean; air: boolean }
  /** Genesis: tap all enemy minions on adjacent sites + set skipNextUntap (Quagmire / Bog / Babbling Brook / Silent Hills). */
  | { kind: "genesis_immobilize_nearby" }
  /** Genesis: deal 1 damage to enemy avatar per nearby site they own (Poisoned Well). */
  | { kind: "genesis_damage_per_enemy_site" }
  /** Genesis: banish all dead minions from your cemetery and heal 1 life each (Pillar of Zeiros). */
  | { kind: "genesis_cemetery_heal" }
  /** Genesis: all enemy minions on the board lose Stealth (Hunter's Lodge). */
  | { kind: "genesis_strip_stealth" }
  /** Genesis: give Stealth to the best nearby friendly minion (Treetop Hideout). */
  | { kind: "genesis_grant_stealth" }
  /** Genesis: gain 1 mana per adjacent site that has an enemy minion atop it (Beacon). */
  | { kind: "genesis_mana_per_contested_neighbor" }
  /** Passive: only provides mana and threshold while in the owner's back row. */
  | { kind: "passive_back_row_only" };

export function parseSiteEffect(name: string, rulesText: string): SiteEffect | undefined {
  const t = (rulesText ?? "").toLowerCase();

  // ── Genesis effects ──────────────────────────────────────────────────────

  // "Genesis → Deal N damage to each minion atop target nearby site." (Deserts)
  const genDmg = t.match(/genesis\b.*deal\s+(\d+)\s+damage\s+to\s+each\s+minion/);
  if (genDmg) return { kind: "genesis_damage_nearby", amount: parseInt(genDmg[1]) };

  // "Genesis → If this is the only [Name] you control, gain ① this turn." (Towers)
  if (/genesis\b.*if this is the only.*gain\s+[①1]/.test(t))
    return { kind: "genesis_gain_mana", amount: 1, ifUniqueOnBoard: true };

  // Simple "Genesis → gain ①" with no condition
  if (/genesis\b.*\bgain\s+[①1]\b/.test(t) && !/for each/.test(t))
    return { kind: "genesis_gain_mana", amount: 1, ifUniqueOnBoard: false };

  // "Genesis → Look at your next spell … put it on the bottom" (Rivers, Kelp Cavern — no count word)
  if (/genesis\b.*look at your next spell/.test(t))
    return { kind: "genesis_scry", amount: 1 };
  // "Genesis → Look at your next three spells. Put them back in any order." (Observatory)
  const scryWord = t.match(/genesis\b.*look at your next\s+(\w+)\s+spells?/);
  if (scryWord) {
    const wordNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
    const n = wordNum[scryWord[1]] ?? parseInt(scryWord[1]) ?? 1;
    return { kind: "genesis_scry", amount: n };
  }

  // "Genesis → You may pay ① to summon a … token here." (Villages, Forge)
  if (/genesis\b.*pay.*①.*summon.*token|genesis\b.*pay.*\(1\).*summon.*token|genesis\b.*conjure.*token/.test(t))
    return { kind: "genesis_token", tokenAtk: 1, tokenDef: 1, tokenCost: 1 };

  // "Genesis → Banish all dead minions, and you heal 1 life for each." (Pillar of Zeiros)
  // Must come BEFORE the generic heal check.
  if (/genesis\b.*banish all dead minions.*heal/.test(t))
    return { kind: "genesis_cemetery_heal" };

  // "Genesis → Each nearby Avatar heals N life." (Holy Ground)
  const heal = t.match(/genesis\b.*heals?\s+(\d+)\s+life/);
  if (heal) return { kind: "genesis_heal", amount: parseInt(heal[1]) };

  // ── Passive effects ──────────────────────────────────────────────────────

  // "Whenever a non-Airborne minion enters this site, kill it." (Bottomless Pit)
  if (/non.airborne.*enters.*kill|kill.*non.airborne.*enters/.test(t))
    return { kind: "passive_kill_entering_non_airborne" };

  // "Whenever an enemy unit enters or leaves this site, it takes N damage." (Briar Patch)
  const briar = t.match(/enemy.*enters or leaves.*takes\s+(\d+)\s+damage/);
  if (briar) return { kind: "passive_entry_damage", amount: parseInt(briar[1]) };

  // "Ordinary/Elite/Unique minions cost (1) less to cast to this/nearby site." (Hamlet, Major City, Camelot)
  // Note: "(1)" contains parens so we use [^a-z]* between digit and "less"
  const costR = t.match(/(ordinary|elite|unique|rare)\s+minions?\s+cost[^a-z]*(\d+|①)[^a-z]*less/);
  if (costR) {
    const rarity = costR[1].charAt(0).toUpperCase() + costR[1].slice(1);
    return { kind: "passive_cost_reduction", amount: 1, rarityFilter: rarity, nearby: /nearby/.test(t) };
  }
  // "Anyone may cast minions here … for ① less." (Donnybrook Inn)
  if (/cast minions here.*①\s+less|for\s+①\s+less.*cast/.test(t))
    return { kind: "passive_cost_reduction", amount: 1, rarityFilter: null, nearby: false };

  // "Provides no mana or threshold unless completely empty." (Pristine Paradise)
  if (/provides no mana.*unless.*empty/.test(t))
    return { kind: "passive_no_mana_if_occupied" };

  // "Whenever another site is played nearby, its controller loses N life." (Cursed Land)
  const cursed = t.match(/site is played nearby.*loses\s+(\d+)\s+life/);
  if (cursed) return { kind: "passive_site_play_damage", amount: parseInt(cursed[1]) };

  // ── Tier 1 additions ────────────────────────────────────────────────────

  // "Genesis → Provides (A)(E)(F) this turn." (Bloom variants)
  // Letters inside parens: A=air E=earth F=fire W=water
  if (/genesis\b.*provides\s+[(\[]/.test(t)) {
    return {
      kind: "genesis_threshold_burst",
      air:   /\(a\)/.test(t),
      earth: /\(e\)/.test(t),
      fire:  /\(f\)/.test(t),
      water: /\(w\)/.test(t),
    };
  }

  // "Genesis → Until your next turn, units are Immobile / disabled / silenced while … nearby sites."
  // (Quagmire, Babbling Brook, Bog, Silent Hills, Leadworks)
  if (/genesis\b.*(immobile|disabled|silenced).*nearby/.test(t))
    return { kind: "genesis_immobilize_nearby" };

  // "Genesis → Enemy Avatars lose 1 life for each nearby site they control." (Poisoned Well)
  if (/genesis\b.*enemy.*lose.*life.*each.*nearby site/.test(t))
    return { kind: "genesis_damage_per_enemy_site" };

  // "Genesis → Enemies lose Stealth." (Hunter's Lodge)
  if (/genesis\b.*enemies\s+lose\s+stealth/.test(t))
    return { kind: "genesis_strip_stealth" };

  // "Genesis → You may give Stealth to a nearby allied minion." (Treetop Hideout)
  if (/genesis\b.*give stealth.*nearby/.test(t))
    return { kind: "genesis_grant_stealth" };

  // "Genesis → Gain (1) for each nearby site with an enemy atop it." (Beacon)
  if (/genesis\b.*gain.*for each nearby site.*enemy/.test(t))
    return { kind: "genesis_mana_per_contested_neighbor" };

  // "Only provides mana and threshold while in your back row." (Caerleon, Glastonbury Tor, Joyous Garde)
  if (/only provides mana.*back row/.test(t))
    return { kind: "passive_back_row_only" };

  return undefined;
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
  | { kind: "avatar_keyword"; keyword: string }
  /** Once per turn, banish a dead minion from the cemetery to re-summon it (e.g. Deathspeaker). */
  | { kind: "cemetery_summon"; freeCostOnDeathsDoor: boolean }
  /** When N dead magic spells are in the cemetery, banish them and cast a copy of one (e.g. Archimago). */
  | { kind: "cemetery_cast_spell"; banishCount: number }
  /** Once per turn, banish all dead fire minions and deal their total (F) threshold as damage (e.g. Flamecaller). */
  | { kind: "cemetery_fire_damage" }
  /** Permanent bonus to the player's mana threshold in all elements (e.g. Elementalist). */
  | { kind: "threshold_bonus"; water: number; earth: number; fire: number; air: number }
  /** Reduce all incoming damage to this avatar's life total by a fixed amount (e.g. Ironclad). */
  | { kind: "damage_reduction"; amount: number }
  /** Start the game with extra spell cards in hand (e.g. Spellslinger). */
  | { kind: "setup_extra_spells"; amount: number }
  /** Draw cards whenever a friendly minion successfully attacks an undefended site (e.g. Interrogator, Battlemage). */
  | { kind: "on_site_attack_draw"; amount: number }
  /** Once per turn, spend manaCost to summon a token minion on a free friendly site. */
  | { kind: "summon_token"; attack: number; defense: number; manaCost: number }
  /** Enemy minions entering a friendly site take this much direct damage (e.g. Druid). */
  | { kind: "on_enemy_enter_site_damage"; amount: number }
  /** Avatar moves and attacks each turn using its tap action (if not used for site placement). */
  | { kind: "avatar_combat" }
  /** After the avatar's first attack this turn it may take one extra step and attack again (Bladedancer). */
  | { kind: "avatar_extra_step_after_attack" }
  /** When the avatar successfully attacks an enemy site it destroys that site, then becomes
   *  immobile (digesting) for one full turn before it can act again (Realm-Eater). */
  | { kind: "avatar_destroy_site_on_attack" }
  /** When the avatar places a site its position immediately jumps to that site's square (Pathfinder). */
  | { kind: "avatar_move_on_site_place" }
  /** Avatar gains +1 ATK for every Earth site it occupies or is adjacent to (Avatar of Earth). */
  | { kind: "dynamic_atk_per_adjacent_earth_site" }
  // ── System 3: Setup variants ─────────────────────────────────────────────
  /** Override starting hand size (e.g. Duplicator: 2 spells + 2 sites). */
  | { kind: "setup_hand"; spells: number; sites: number }
  /** Merge atlas into spell deck; start with a larger hand of mixed cards (Magician). */
  | { kind: "setup_unified_deck"; handSize: number }
  /** On init, pick N random squares; minions may deploy there for -1 mana (Harbinger). */
  | { kind: "fixed_deployment_squares"; count: number }
  // ── System 4: Subtype discount ───────────────────────────────────────────
  /** First minion with the given subtype each turn costs 1 less mana (Templar). */
  | { kind: "first_subtype_discount"; subtypes: string[] }
  // ── System 5: Terrain / flooding ─────────────────────────────────────────
  /** Once per turn, flood the nearest enemy site; non-submerge minions there
   *  are tapped and skip their next untap (Waveshaper, Avatar of Water). */
  | { kind: "flood_adjacent_enemy_site" }
  // ── Standalone abilities ─────────────────────────────────────────────────
  /** At the start of your turn, scry 1: bottom the top card of a deck if it
   *  won't be playable next turn (Seer). */
  | { kind: "start_of_turn_scry" }
  /** After placing an earth site, mark an adjacent void square as Rubble (Geomancer). */
  | { kind: "geomancer_rubble" }
  /** After playing a minion this turn, spend 1 mana to give it Ward (Savior). */
  | { kind: "on_minion_played_ward" }
  /** When casting a Magic spell with no enemy targets, cast it as a Spirit
   *  minion with ATK = DEF = mana cost instead (Animist). */
  | { kind: "cast_magic_as_spirit" }
  /** When casting any spell, animate the cheapest Aura in hand as a minion
   *  with ATK = DEF = cost until end of turn (Enchantress). */
  | { kind: "animate_aura_on_spell_cast" }
  /** After playing cards this turn, deal damage equal to the total Air threshold
   *  of spells cast to the weakest enemy (Sparkmage). */
  | { kind: "turn_end_air_damage" };

/**
 * Returns the simulator-relevant abilities for a known avatar by name.
 *
 * Sorcery avatars have wildly varied, unique abilities — regex parsing is
 * not viable. This lookup table covers the ~8 avatars whose abilities map
 * cleanly to the simulation model. All others return [] and are treated as
 * vanilla 1/1 (or their stated base stats) with no special rules.
 *
 * Unmodelled avatars (complex/unique mechanics):
 *   Avatar of Air/Fire/Water · Waveshaper · Geomancer · Flamecaller · Sparkmage
 *   Deathspeaker · Archimago · Enchantress · Animist · Bladedancer · Pathfinder
 *   Realm-Eater · Persecutor · Dragonlord · Imposter · Corruptor · Duplicator
 *   Magician · Templar · Harbinger · Witch · Seer · Savior · Avatar of Earth
 */
export function lookupAvatarAbilities(name: string): AvatarAbility[] {
  switch (name) {

    // "You have an additional (E)(F)(W)(A)."
    // Permanent +1 in every threshold — unlocks higher-cost multi-element spells sooner.
    case "Elementalist":
      return [{ kind: "threshold_bonus", water: 1, earth: 1, fire: 1, air: 1 }];

    // "Takes 2 less damage."
    // Every hit on this avatar is reduced by 2 — very durable in long games.
    case "Ironclad":
      return [{ kind: "damage_reduction", amount: 2 }];

    // "Start the game with 4 spells in hand."
    // One extra card at game start → slightly more combo potential in the opening.
    case "Spellslinger":
      return [{ kind: "setup_extra_spells", amount: 1 }];

    // "Tap → Draw a spell."
    // Modelled as a free draw at the start of each turn (the avatar always uses
    // the tap on the most impactful thing, which in the sim is card advantage).
    case "Sorcerer":
      return [{ kind: "start_of_turn", grant: "draw", amount: 1 }];

    // "Nearby allied sites have 'Whenever an enemy enters here, it takes 1 damage.'"
    // Any enemy minion stepping onto a Druid-owned site takes 1 damage; if its
    // effective defence is ≤ 1 it is removed.
    case "Druid":
      return [{ kind: "on_enemy_enter_site_damage", amount: 1 }];

    // "Once on your turn, you may pay (1) to summon a Skeleton token here."
    // If the player has ≥ 1 mana and a free friendly site, spend 1 mana for a 1/1.
    case "Necromancer":
      return [{ kind: "summon_token", attack: 1, defense: 1, manaCost: 1 }];

    // "Whenever an ally strikes an enemy Avatar, draw a spell unless they pay 3 life."
    // Approximated as: draw 1 card each time a friendly minion lands a site attack.
    case "Interrogator":
      return [{ kind: "on_site_attack_draw", amount: 1 }];

    // "Whenever Battlemage attacks and kills an enemy, you may draw a spell."
    // 3/3 stats — models as a genuine combat avatar that draws on site attacks.
    case "Battlemage":
      return [{ kind: "avatar_combat" }, { kind: "on_site_attack_draw", amount: 1 }];

    // "After her first attack each turn, Bladedancer may take a step. When she does,
    //  she may attack a unit there."
    case "Bladedancer":
      return [{ kind: "avatar_combat" }, { kind: "avatar_extra_step_after_attack" }];

    // "Destroys sites it successfully attacks, then becomes immobile until it digests."
    case "Realm-Eater":
      return [{ kind: "avatar_combat" }, { kind: "avatar_destroy_site_on_attack" }];

    // "Once on your turn, Persecutor may step toward the closest Evil…"
    // Modelled as a standard combat avatar (2/2 stats, aggressive forward movement).
    case "Persecutor":
      return [{ kind: "avatar_combat" }];

    // "Tap → If able, play the topmost site of your atlas to an adjacent location
    //  and move there." Avatar teleports to each placed site.
    case "Pathfinder":
      return [{ kind: "avatar_move_on_site_place" }];

    // "You have +1 power for each nearby earth site."
    // Avatar's ATK scales with how many adjacent earth sites it occupies.
    case "Avatar of Earth":
      return [{ kind: "dynamic_atk_per_adjacent_earth_site" }];

    // ── System 3: Setup variants ─────────────────────────────────────────────

    // "Start with only two spells and two sites in hand."
    case "Duplicator":
      return [{ kind: "setup_hand", spells: 2, sites: 2 }];

    // "No atlas; spellbook may contain sites; start with seven cards."
    case "Magician":
      return [{ kind: "setup_unified_deck", handSize: 7 }];

    // "On setup, determine three random squares. Minions cast to one of them cost (1) less."
    case "Harbinger":
      return [{ kind: "fixed_deployment_squares", count: 3 }];

    // ── System 4: Subtype discount ────────────────────────────────────────

    // "The first Knight, Sir, or Dame you cast each turn costs (1) less."
    case "Templar":
      return [{ kind: "first_subtype_discount", subtypes: ["knight", "sir", "dame"] }];

    // ── System 5: Terrain / flooding ──────────────────────────────────────

    // "Tap → Flood a site near your body of water until you do so again.
    //  Tap minions without submerge there. They don't untap the next time they would."
    case "Waveshaper":
      return [{ kind: "flood_adjacent_enemy_site" }];

    // "Tap → Flood a site adjacent to your body of water until you do so again.
    //  You may teleport there."
    case "Avatar of Water":
      return [{ kind: "flood_adjacent_enemy_site" }];

    // ── Standalone abilities ───────────────────────────────────────────────

    // "At the start of your turn, look at your topmost site or spell.
    //  You may put it on the bottom of its deck."
    case "Seer":
      return [{ kind: "start_of_turn_scry" }];

    // "Tap → Play or draw a site. If you played an earth site, fill a void
    //  adjacent to you with Rubble."
    case "Geomancer":
      return [{ kind: "geomancer_rubble" }];

    // "(1) → Ward a minion that was summoned this turn."
    case "Savior":
      return [{ kind: "on_minion_played_ward" }];

    // "You may cast magics in your hand as Spirits with power equal to their cost."
    case "Animist":
      return [{ kind: "cast_magic_as_spirit" }];

    // "Whenever you cast a spell, you may animate target aura until your next turn.
    //  It's an aura minion with power equal to its cost."
    case "Enchantress":
      return [{ kind: "animate_aura_on_spell_cast" }];

    // "Tap → Deal damage to a random unit equal to the sum of (A) on spells cast this turn."
    case "Sparkmage":
      return [{ kind: "turn_end_air_damage" }];

    // "Tap → Curse target Avatar … they lose 2 life …" (modelled as automatic
    //  start-of-turn damage; approximates recurring curse pressure)
    case "Witch":
      return [{ kind: "start_of_turn", grant: "damage_enemy", amount: 2 }];

    // "You may banish a dead minion each turn to cast a copy of it, and for (0)
    //  if you're on Death's Door."
    case "Deathspeaker":
      return [{ kind: "cemetery_summon", freeCostOnDeathsDoor: true }];

    // "Banish three magic spells in your cemetery → Cast a copy of one of them."
    case "Archimago":
      return [{ kind: "cemetery_cast_spell", banishCount: 3 }];

    // "Tap, Banish all your dead fire minions → Shoot a projectile. It deals
    //  damage equal to the sum of their (F)."
    case "Flamecaller":
      return [{ kind: "cemetery_fire_damage" }];

    default:
      return [];
  }
}

/** @deprecated Use lookupAvatarAbilities(name) instead. */
export function parseAvatarAbilities(_rulesText: string): AvatarAbility[] {
  return [];
}

// ─── Subtype parser ───────────────────────────────────────────────────────────

export function parseSubtypes(name: string, rulesText: string): string[] {
  const n = name.toLowerCase();
  const t = (rulesText ?? "").toLowerCase();
  const subs: string[] = [];
  // Knight-lineage cards (Templar discount)
  if (n.startsWith("sir ") || n.startsWith("dame "))         subs.push("knight");
  if (/\bknight\b/.test(t) || /\bknight\b/.test(n))         subs.push("knight");
  // Creature families
  if (/\bdragon\b/.test(n) || /\bdragon\b/.test(t))         subs.push("dragon");
  if (/\bspirit\b/.test(n))                                  subs.push("spirit");
  if (/\bskeleton\b/.test(n) || /\bzombie\b/.test(n) ||
      /\blich\b/.test(n) || /\bghoul\b/.test(n))            subs.push("undead");
  if (/\belf\b/.test(n)   || /\belves\b/.test(n))           subs.push("elf");
  if (/\bdwarf\b/.test(n) || /\bdwarves\b/.test(n))         subs.push("dwarf");
  if (/\bbeast\b/.test(n) || /\bbear\b/.test(n) ||
      /\bwolf\b/.test(n)  || /\bwolves\b/.test(n))          subs.push("beast");
  if (/\bangel\b/.test(n) || /\bseraph\b/.test(n))          subs.push("angel");
  if (/\bdemon\b/.test(n) || /\bdevil\b/.test(n))           subs.push("demon");
  if (/\bhuman\b/.test(t) || /\bmortal\b/.test(t))          subs.push("mortal");
  if (/\bgoblin\b/.test(n))                                  subs.push("goblin");
  if (/\btroll\b/.test(n))                                   subs.push("troll");
  if (/\bgiant\b/.test(n))                                   subs.push("giant");
  if (/\belementals?\b/.test(n))                             subs.push("elemental");
  return [...new Set(subs)]; // deduplicate
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
interface GridSquare { owner: SquareOwner; site?: SimCard; isRubble: boolean; flooded: boolean; }
type Grid = GridSquare[][];

function makeGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ owner: null, site: undefined, isRubble: false, flooded: false }))
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

/** Mana = sites owned, minus those whose passive conditions aren't met. */
function computeMana(grid: Grid, minions: BoardMinion[], owner: "A" | "B"): number {
  // Back row: row 0 for A (avatar starts row 0), row 3 for B (avatar starts row 3)
  const backRow = owner === "A" ? 0 : ROWS - 1;
  let mana = 0;
  for (const p of ownedSites(grid, owner)) {
    const sq = getSquare(grid, p);
    const eff = sq.site?.siteEffect;
    if (eff?.kind === "passive_no_mana_if_occupied") {
      if (minions.some(m => posEq(m.pos, p))) continue;
    }
    if (eff?.kind === "passive_back_row_only") {
      if (p.row !== backRow) continue; // only contributes from the back row
    }
    mana++;
  }
  return mana;
}

/** siteThreshold skips sites whose passive_back_row_only condition isn't met. */
function computeThreshold(grid: Grid, minions: BoardMinion[], owner: "A" | "B"): Threshold {
  const backRow = owner === "A" ? 0 : ROWS - 1;
  const th: Threshold = { water: 0, earth: 0, fire: 0, air: 0 };
  for (const p of ownedSites(grid, owner)) {
    const sq = getSquare(grid, p);
    const eff = sq.site?.siteEffect;
    if (eff?.kind === "passive_back_row_only" && p.row !== backRow) continue;
    if (eff?.kind === "passive_no_mana_if_occupied" && minions.some(m => posEq(m.pos, p))) continue;
    for (const el of sq.site?.elements ?? []) {
      if      (el === "water") th.water++;
      else if (el === "earth") th.earth++;
      else if (el === "fire")  th.fire++;
      else if (el === "air")   th.air++;
    }
  }
  return th;
}

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
  skipNextUntap: boolean; // flooded squares: stays tapped through opponent's untap step
  temporary: boolean;     // animated auras etc: removed at end of the turn they entered
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
  avatarTapUsed:   boolean;
  avatarDigesting: boolean; // Realm-Eater: immobile for one turn after destroying a site
  unifiedDeck:     boolean; // Magician: sites dealt from spellDeck, no atlasDeck
  sitesPlaced:     number;
  minionsDeployed: number;
  siteAttacks:     number;
  // Cemetery — cards that have left the game this match
  deadMinions: SimCard[];
  deadSpells:  SimCard[];
  // Per-turn tracking
  deploymentSquares:    Pos[];   // Harbinger: fixed deployment squares
  turnAirCostSpent:     number;  // Sparkmage: air threshold of spells cast this turn
  firstSubtypeUsed:     boolean; // Templar: first knight-type discount consumed
  lastMinionPlayed:     BoardMinion | null; // Savior: most recently played minion this turn
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
  const abs = spec.avatar.avatarAbilities ?? [];

  // Magician: unified deck — all non-avatar cards go into spellDeck
  const isUnified = abs.some(a => a.kind === "setup_unified_deck");
  const atlasDeckInit  = isUnified ? [] : shuffle(spec.cards.filter(c => c.type === "Site"));
  const spellDeckInit  = isUnified
    ? shuffle(spec.cards.filter(c => c.type !== "Avatar"))
    : shuffle(spec.cards.filter(c => c.type !== "Site" && c.type !== "Avatar"));

  const p: PlayerState = {
    id,
    avatarCard:     spec.avatar,
    avatarLife:     spec.avatar.life > 0 ? spec.avatar.life : 20,
    avatarPos:      { col: AVATAR_COL, row: id === "A" ? 0 : 3 },
    deathsDoor:     false,
    atlasDeck:      atlasDeckInit,
    spellDeck:      spellDeckInit,
    atlasHand:      [],
    spellHand:      [],
    mana:            0,
    threshold:       { water: 0, earth: 0, fire: 0, air: 0 },
    avatarTapUsed:   false,
    avatarDigesting: false,
    unifiedDeck:     isUnified,
    sitesPlaced:     0,
    minionsDeployed: 0,
    siteAttacks:     0,
    deadMinions:     [],
    deadSpells:      [],
    deploymentSquares:    [],
    turnAirCostSpent:     0,
    firstSubtypeUsed:     false,
    lastMinionPlayed:     null,
  };

  // Setup_hand: Duplicator uses 2/2 instead of 3/3
  const setupHand = abs.find(a => a.kind === "setup_hand");
  const startSites  = setupHand?.kind === "setup_hand" ? setupHand.sites  : 3;
  const startSpells = setupHand?.kind === "setup_hand" ? setupHand.spells : 3;

  // setup_extra_spells: Spellslinger gets +1
  let extraSpells = 0;
  for (const ab of abs) if (ab.kind === "setup_extra_spells") extraSpells += ab.amount;

  // Magician: all from spellDeck (no atlas hand); otherwise normal split
  if (isUnified) {
    const unifiedAb = abs.find(a => a.kind === "setup_unified_deck");
    const handSize  = unifiedAb?.kind === "setup_unified_deck" ? unifiedAb.handSize : 7;
    for (let i = 0; i < handSize && p.spellDeck.length > 0; i++) p.spellHand.push(p.spellDeck.pop()!);
  } else {
    for (let i = 0; i < startSites  && p.atlasDeck.length > 0;  i++) p.atlasHand.push(p.atlasDeck.pop()!);
    for (let i = 0; i < startSpells + extraSpells && p.spellDeck.length > 0; i++) p.spellHand.push(p.spellDeck.pop()!);
  }

  // Harbinger: pick N random deployment squares across the full 5×4 grid
  const harbAb = abs.find(a => a.kind === "fixed_deployment_squares");
  if (harbAb?.kind === "fixed_deployment_squares") {
    const allSquares: Pos[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) allSquares.push({ col: c, row: r });
    const shuffled = shuffle(allSquares);
    p.deploymentSquares = shuffled.slice(0, harbAb.count);
  }

  // Permanent threshold bonus (Elementalist) — active from turn 1
  for (const ab of abs)
    if (ab.kind === "threshold_bonus") {
      p.threshold.water += ab.water; p.threshold.earth += ab.earth;
      p.threshold.fire  += ab.fire;  p.threshold.air   += ab.air;
    }
  return p;
}

function drawOne(p: PlayerState): void {
  if (p.unifiedDeck) {
    // Magician: single deck, everything goes to spellHand
    if (p.spellDeck.length > 0) p.spellHand.push(p.spellDeck.pop()!);
    return;
  }
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
    } else {
      // Normal death — card goes to cemetery
      player(bm.owner).deadMinions.push(bm.card);
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
    // damage_reduction ability (e.g. Ironclad — "Takes 2 less damage")
    for (const ab of target.avatarCard.avatarAbilities ?? [])
      if (ab.kind === "damage_reduction") amount = Math.max(0, amount - ab.amount);
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
    if (active.avatarTapUsed) return;
    const opp = opponent(active.id);

    // Magician draws sites from spellHand; others from atlasHand
    const siteSource = active.unifiedDeck
      ? active.spellHand.filter(c => c.type === "Site")
      : active.atlasHand;
    if (siteSource.length === 0) return;

    const squares = findSitePlacementSquares(grid, minions, active);
    if (squares.length === 0) return;

    const card = chooseSiteCard(siteSource, active.threshold, active.spellHand);
    const pos  = chooseSitePosition(squares, opponent(active.id).avatarPos);

    if (active.unifiedDeck) active.spellHand = remove(active.spellHand, card);
    else                    active.atlasHand = remove(active.atlasHand, card);
    const sq = getSquare(grid, pos);
    sq.owner = active.id; sq.site = card; sq.isRubble = false;
    active.avatarTapUsed = true;
    active.sitesPlaced++;
    active.mana      = computeMana(grid, minions, active.id);
    active.threshold = computeThreshold(grid, minions, active.id);
    // Re-apply permanent threshold bonus after recalculating from sites
    for (const ab of active.avatarCard.avatarAbilities ?? [])
      if (ab.kind === "threshold_bonus") {
        active.threshold.water += ab.water; active.threshold.earth += ab.earth;
        active.threshold.fire  += ab.fire;  active.threshold.air   += ab.air;
      }
    // Apply structure artifacts' mana bonus already on board
    for (const art of artifacts)
      if (art.owner === active.id && art.effect.kind === "structure") active.mana += art.effect.manaBonus;

    // Pathfinder: avatar moves to the placed site
    for (const ab of active.avatarCard.avatarAbilities ?? [])
      if (ab.kind === "avatar_move_on_site_place") active.avatarPos = pos;

    emit(`T${turn} [${active.id}] places site ${card.name} at (${pos.col},${pos.row}) → ${active.mana} mana · W${active.threshold.water}E${active.threshold.earth}F${active.threshold.fire}A${active.threshold.air}`);

    // Geomancer: when an earth site is placed, fill an adjacent void with Rubble
    if (card.elements.includes("earth")) {
      for (const ab of active.avatarCard.avatarAbilities ?? []) {
        if (ab.kind !== "geomancer_rubble") continue;
        const voids = cardinalNeighbors(active.avatarPos).filter(p => {
          const s = getSquare(grid, p);
          return s.owner === null && !s.isRubble;
        });
        if (voids.length > 0) {
          // Pick the void closest to enemy avatar for maximum disruption
          const rubblePos = [...voids].sort(
            (a, b) => cardinalDist(b, opponent(active.id).avatarPos) - cardinalDist(a, opponent(active.id).avatarPos)
          )[0];
          getSquare(grid, rubblePos).isRubble = true;
          emit(`T${turn} [${active.id}] Geomancer fills (${rubblePos.col},${rubblePos.row}) with Rubble`);
        }
      }
    }

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

    // ── Resolve Genesis ability on the placed site ──────────────────────────
    const siteEff = card.siteEffect;
    if (siteEff) {
      switch (siteEff.kind) {

        case "genesis_damage_nearby": {
          // Target the enemy-owned neighbor with the most minions; else any enemy neighbor
          const neighbors = cardinalNeighbors(pos);
          const enemyNeighbors = neighbors.filter(p => getSquare(grid, p).owner === opp.id);
          const target = [...enemyNeighbors].sort(
            (a, b) => minions.filter(m => posEq(m.pos, b)).length
                    - minions.filter(m => posEq(m.pos, a)).length
          )[0] ?? null;
          if (target) {
            const victims = minions.filter(m => posEq(m.pos, target) && m.owner === opp.id);
            if (victims.length > 0) {
              emit(`T${turn} [${active.id}] ${card.name} Genesis: ${siteEff.amount} dmg to each at (${target.col},${target.row})`);
              for (const v of [...victims]) {
                if (siteEff.amount >= effDef(v)) { removeMinion(v); emit(`  → ${v.card.name} destroyed`); }
              }
            }
          }
          break;
        }

        case "genesis_gain_mana": {
          let canGain = true;
          if (siteEff.ifUniqueOnBoard) {
            // Count owner's sites with the same name (we just placed it, so ≤1 means unique)
            let sameCount = 0;
            for (let r = 0; r < ROWS; r++)
              for (let c2 = 0; c2 < COLS; c2++)
                if (grid[r][c2].owner === active.id && grid[r][c2].site?.name === card.name)
                  sameCount++;
            canGain = sameCount <= 1;
          }
          if (canGain) {
            active.mana += siteEff.amount;
            emit(`T${turn} [${active.id}] ${card.name} Genesis: +${siteEff.amount} mana`);
          }
          break;
        }

        case "genesis_scry": {
          for (let i = 0; i < siteEff.amount && active.spellDeck.length > 0; i++) {
            const top = active.spellDeck[active.spellDeck.length - 1];
            const cost2 = top.waterT + top.earthT + top.fireT + top.airT;
            if (!canPlay(top, active.threshold, active.mana + 1)) {
              active.spellDeck.pop();
              active.spellDeck.unshift(top);
              emit(`T${turn} [${active.id}] ${card.name} Genesis: bottoms ${top.name}`);
            } else {
              emit(`T${turn} [${active.id}] ${card.name} Genesis: keeps ${top.name} on top`);
            }
            void cost2;
          }
          break;
        }

        case "genesis_token": {
          if (active.mana >= siteEff.tokenCost) {
            active.mana -= siteEff.tokenCost;
            const tokenCard2: SimCard = {
              name: "Token", type: "Minion",
              attack: siteEff.tokenAtk, defense: siteEff.tokenDef, life: 0,
              waterT: 0, earthT: 0, fireT: 0, airT: 0,
              elements: [], keywords: [], subtypes: [], rulesText: "",
            };
            const bmT: BoardMinion = {
              card: tokenCard2, pos, owner: active.id,
              tapped: false, sick: true, tempDamage: 0, stealthy: false,
              skipNextUntap: false, temporary: false,
            };
            minions.push(bmT);
            active.minionsDeployed++;
            emit(`T${turn} [${active.id}] ${card.name} Genesis: summons ${siteEff.tokenAtk}/${siteEff.tokenDef} token`);
          }
          break;
        }

        case "genesis_heal": {
          const maxLife = active.avatarCard.life > 0 ? active.avatarCard.life : 20;
          active.avatarLife = Math.min(maxLife, active.avatarLife + siteEff.amount);
          emit(`T${turn} [${active.id}] ${card.name} Genesis: heals ${siteEff.amount}`);
          break;
        }

        case "genesis_threshold_burst": {
          // Bloom sites: add burst threshold for this turn only.
          // We model it as a permanent bonus here (it's re-calculated from sites next turn, so it
          // naturally expires; we just need the threshold for the remaining playCards this turn).
          if (siteEff.air)   active.threshold.air++;
          if (siteEff.earth) active.threshold.earth++;
          if (siteEff.fire)  active.threshold.fire++;
          if (siteEff.water) active.threshold.water++;
          const gained = [siteEff.air&&"A",siteEff.earth&&"E",siteEff.fire&&"F",siteEff.water&&"W"]
            .filter(Boolean).join("");
          emit(`T${turn} [${active.id}] ${card.name} Genesis: +threshold (${gained}) this turn`);
          break;
        }

        case "genesis_immobilize_nearby": {
          // Tap all enemy minions on adjacent sites and set skipNextUntap (simulates Immobile)
          const neighbors2 = cardinalNeighbors(pos);
          let tapped2 = 0;
          for (const bm of minions) {
            if (bm.owner === active.id) continue;
            if (!neighbors2.some(nb => posEq(nb, bm.pos))) continue;
            bm.tapped = true;
            bm.skipNextUntap = true;
            tapped2++;
          }
          if (tapped2 > 0)
            emit(`T${turn} [${active.id}] ${card.name} Genesis: immobilised ${tapped2} nearby enemy minion(s)`);
          break;
        }

        case "genesis_damage_per_enemy_site": {
          // Poisoned Well: 1 damage per nearby enemy site
          const nearbySites2 = cardinalNeighbors(pos).filter(p => getSquare(grid, p).owner === opp.id);
          if (nearbySites2.length > 0) {
            emit(`T${turn} [${active.id}] ${card.name} Genesis: ${nearbySites2.length} damage (${nearbySites2.length} nearby enemy sites)`);
            damageAvatar(opp, nearbySites2.length, card.name);
          }
          break;
        }

        case "genesis_cemetery_heal": {
          // Pillar of Zeiros: banish all dead minions, heal 1 per
          const banished = active.deadMinions.length;
          if (banished > 0) {
            active.deadMinions = [];
            const maxLife2 = active.avatarCard.life > 0 ? active.avatarCard.life : 20;
            active.avatarLife = Math.min(maxLife2, active.avatarLife + banished);
            emit(`T${turn} [${active.id}] ${card.name} Genesis: banished ${banished} dead minions, healed ${banished} life`);
          }
          break;
        }

        case "genesis_strip_stealth": {
          // Hunter's Lodge: all enemy minions lose Stealth
          let stripped = 0;
          for (const bm of minions) {
            if (bm.owner !== active.id && bm.stealthy) { bm.stealthy = false; stripped++; }
          }
          if (stripped > 0)
            emit(`T${turn} [${active.id}] ${card.name} Genesis: stripped Stealth from ${stripped} enemy minion(s)`);
          break;
        }

        case "genesis_grant_stealth": {
          // Treetop Hideout: give Stealth to the highest-value nearby friendly minion
          const nearbyFriends = friendlyMinions(active.id).filter(
            bm => cardinalNeighbors(pos).some(nb => posEq(nb, bm.pos)) || posEq(bm.pos, pos)
          );
          if (nearbyFriends.length > 0) {
            const target = [...nearbyFriends].sort((a, b) => minionValue(b.card) - minionValue(a.card))[0];
            target.stealthy = true;
            emit(`T${turn} [${active.id}] ${card.name} Genesis: ${target.card.name} gains Stealth`);
          }
          break;
        }

        case "genesis_mana_per_contested_neighbor": {
          // Beacon: +1 mana per adjacent site that has an enemy minion on it
          const contested = cardinalNeighbors(pos).filter(nb => {
            const sq2 = getSquare(grid, nb);
            return sq2.owner !== null && minions.some(bm => bm.owner === opp.id && posEq(bm.pos, nb));
          });
          if (contested.length > 0) {
            active.mana += contested.length;
            emit(`T${turn} [${active.id}] ${card.name} Genesis: +${contested.length} mana (${contested.length} contested neighbor(s))`);
          }
          break;
        }

        default: break; // passive effects handled elsewhere
      }
    }

    // ── Cursed Land: if any enemy-owned adjacent site has passive_site_play_damage ──
    for (const nb of cardinalNeighbors(pos)) {
      const nbSq = getSquare(grid, nb);
      if (nbSq.owner === opp.id && nbSq.site?.siteEffect?.kind === "passive_site_play_damage") {
        const dmg = nbSq.site.siteEffect.amount;
        emit(`T${turn} [${active.id}] ${nbSq.site.name}: placing a nearby site costs ${dmg} life`);
        damageAvatar(active, dmg, nbSq.site.name);
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
          opp.mana      = computeMana(grid, minions, opp.id);
          opp.threshold = computeThreshold(grid, minions, opp.id);
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

      let cost = card.waterT + card.earthT + card.fireT + card.airT;

      // Site passive cost reductions (Hamlet, Major City, Camelot, Donnybrook Inn)
      if (card.type === "Minion") {
        for (let r = 0; r < ROWS; r++) {
          for (let c2 = 0; c2 < COLS; c2++) {
            const sq2 = grid[r][c2];
            if (sq2.owner !== active.id || !sq2.site?.siteEffect) continue;
            const se = sq2.site.siteEffect;
            if (se.kind !== "passive_cost_reduction") continue;
            // rarityFilter: null = any; otherwise match card rarity by name convention
            // (we don't store rarity on SimCard, so we use a keyword heuristic — skip filter for now)
            if (se.rarityFilter === null) { cost = Math.max(0, cost - se.amount); break; }
            // Apply if no rarity filter (simplification: treat all as eligible)
            cost = Math.max(0, cost - se.amount); break;
          }
        }
      }

      // Templar: first knight/sir/dame per turn costs 1 less
      if (!active.firstSubtypeUsed && card.type === "Minion") {
        const discountAb = (active.avatarCard.avatarAbilities ?? []).find(a => a.kind === "first_subtype_discount");
        if (discountAb?.kind === "first_subtype_discount") {
          const matches = discountAb.subtypes.some(s => card.subtypes.includes(s));
          if (matches) { cost = Math.max(0, cost - 1); active.firstSubtypeUsed = true; }
        }
      }

      active.mana -= cost;
      active.spellHand = remove(active.spellHand, card);

      if (card.type === "Minion") {
        // Harbinger: deployment squares are also valid placements (at the discounted cost already applied)
        const freeSites  = freeSiteSquares(grid, minions, active.id);
        const freeHarbinger = active.deploymentSquares.filter(
          p => !minions.some(m => posEq(m.pos, p))
        );
        const allFree = [...freeSites];
        for (const p of freeHarbinger) if (!allFree.some(q => posEq(q, p))) allFree.push(p);

        if (allFree.length === 0) { active.spellHand.push(card); active.mana += cost; break; }
        const pos = chooseMinionPosition(allFree, opp.avatarPos);
        const bm: BoardMinion = {
          card, pos, owner: active.id,
          tapped: false, sick: !hasKw(card, "charge"), tempDamage: 0,
          stealthy: hasKw(card, "stealth"), skipNextUntap: false, temporary: false,
        };
        minions.push(bm);
        active.minionsDeployed++;
        active.lastMinionPlayed = bm;
        const kwStr = card.keywords.length ? ` [${card.keywords.join(",")}]` : "";
        emit(`T${turn} [${active.id}] plays ${card.name} (${card.attack}/${card.defense})${kwStr} → (${pos.col},${pos.row})`);

        // Savior: spend 1 mana to ward a minion summoned this turn
        for (const ab of active.avatarCard.avatarAbilities ?? []) {
          if (ab.kind === "on_minion_played_ward" && active.mana >= 1) {
            active.mana -= 1;
            if (!bm.card.keywords.includes("ward")) bm.card = { ...bm.card, keywords: [...bm.card.keywords, "ward"] };
            emit(`T${turn} [${active.id}] Savior wards ${bm.card.name}`);
          }
        }
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
        active.turnAirCostSpent += card.airT; // Sparkmage tracking

        // Animist: if no enemy minions to target, cast as a Spirit minion instead
        const isAnimist = (active.avatarCard.avatarAbilities ?? []).some(a => a.kind === "cast_magic_as_spirit");
        const hasEnemyTargets = enemyMinions(active.id).length > 0;
        if (isAnimist && !hasEnemyTargets && cost >= 2) {
          const freeSites = freeSiteSquares(grid, minions, active.id);
          if (freeSites.length > 0) {
            const pos = chooseMinionPosition(freeSites, opp.avatarPos);
            const spiritCard: SimCard = {
              name: `${card.name} Spirit`, type: "Minion",
              attack: cost, defense: cost, life: 0,
              waterT: 0, earthT: 0, fireT: 0, airT: 0,
              elements: card.elements, keywords: [], subtypes: ["spirit"], rulesText: "",
            };
            const bm2: BoardMinion = {
              card: spiritCard, pos, owner: active.id,
              tapped: false, sick: true, tempDamage: 0,
              stealthy: false, skipNextUntap: false, temporary: false,
            };
            minions.push(bm2);
            active.minionsDeployed++;
            emit(`T${turn} [${active.id}] Animist casts ${card.name} as ${cost}/${cost} Spirit → (${pos.col},${pos.row})`);
            active.deadSpells.push(card);
            keepTrying = true;
            continue;
          }
        }

        // Normal spell resolution — goes to cemetery
        const fx = card.spellEffect ?? parseSpellEffect(card.rulesText);
        resolveSpellEffect(active, opp, fx, cost, card.name);
        active.deadSpells.push(card);

        // Enchantress: after casting a spell, animate the cheapest aura in hand as a temporary minion
        for (const ab of active.avatarCard.avatarAbilities ?? []) {
          if (ab.kind !== "animate_aura_on_spell_cast") continue;
          const auras2 = active.spellHand.filter(c => c.type === "Aura");
          if (auras2.length === 0) continue;
          const aura = [...auras2].sort((a, b) =>
            (a.waterT + a.earthT + a.fireT + a.airT) - (b.waterT + b.earthT + b.fireT + b.airT)
          )[0];
          const auraCost = aura.waterT + aura.earthT + aura.fireT + aura.airT;
          const freeSites = freeSiteSquares(grid, minions, active.id);
          if (freeSites.length > 0) {
            const pos = chooseMinionPosition(freeSites, opp.avatarPos);
            const animCard: SimCard = {
              name: `${aura.name} (animated)`, type: "Minion",
              attack: Math.max(1, auraCost), defense: Math.max(1, auraCost), life: 0,
              waterT: 0, earthT: 0, fireT: 0, airT: 0,
              elements: aura.elements, keywords: [], subtypes: [], rulesText: "",
            };
            const bm3: BoardMinion = {
              card: animCard, pos, owner: active.id,
              tapped: false, sick: false, tempDamage: 0,
              stealthy: false, skipNextUntap: false, temporary: true,
            };
            minions.push(bm3);
            active.minionsDeployed++;
            active.spellHand = remove(active.spellHand, aura);
            emit(`T${turn} [${active.id}] Enchantress animates ${aura.name} as ${animCard.attack}/${animCard.defense} minion`);
          }
        }

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
          // on_enemy_enter_site_damage: fire when minion steps onto opponent's site (e.g. Druid)
          const enteredSq = getSquare(grid, bm.pos);
          if (enteredSq.owner === opp.id) {
            for (const ab of opp.avatarCard.avatarAbilities ?? []) {
              if (ab.kind !== "on_enemy_enter_site_damage") continue;
              emit(`T${turn} [${opp.id}] ${opp.avatarCard.name}'s site deals ${ab.amount} to ${bm.card.name}`);
              if (effDef(bm) <= ab.amount) {
                removeMinion(bm);
                emit(`  → ${bm.card.name} destroyed by site damage`);
              }
            }
            if (!minions.includes(bm)) continue; // skip if killed by site damage
          }
          // Site passive entry effects (Bottomless Pit, Briar Patch, etc.)
          if (handleSiteEntry(bm)) continue;
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
            // on_site_attack_draw (e.g. Interrogator, Battlemage)
            for (const ab of active.avatarCard.avatarAbilities ?? []) {
              if (ab.kind === "on_site_attack_draw") {
                for (let i = 0; i < ab.amount; i++) drawOne(active);
                emit(`  → ${active.avatarCard.name} draws ${ab.amount} (site attack)`);
              }
            }
          }
        }
      }
    }
  }

  // ── Avatar action step ────────────────────────────────────────────────────

  function avatarActionStep(active: PlayerState): void {
    const hasAbility = (k: AvatarAbility["kind"]) =>
      (active.avatarCard.avatarAbilities ?? []).some(a => a.kind === k);

    if (!hasAbility("avatar_combat")) return;
    if (active.avatarTapUsed) return; // tap already spent placing a site

    const opp = opponent(active.id);

    // Realm-Eater digesting: spend this turn's tap to finish digesting, can't attack
    if (active.avatarDigesting) {
      active.avatarDigesting = false;
      active.avatarTapUsed   = true;
      emit(`T${turn} [${active.id}] ${active.avatarCard.name} finishes digesting`);
      return;
    }

    // Effective avatar ATK (Avatar of Earth scales with adjacent earth sites)
    let avatarAtk = active.avatarCard.attack;
    if (hasAbility("dynamic_atk_per_adjacent_earth_site")) {
      avatarAtk += cardinalNeighbors(active.avatarPos).filter(p => {
        const s = getSquare(grid, p);
        return s.owner === active.id && (s.site?.elements ?? []).includes("earth");
      }).length;
    }

    // Inner: perform one combat at current avatar position; return true if an attack happened
    const doAttack = (): boolean => {
      const pos = active.avatarPos;
      const sq  = getSquare(grid, pos);

      // Enemies sharing the square
      const colocated = enemyMinions(active.id).filter(e => posEq(e.pos, pos));
      if (colocated.length > 0) {
        const def = [...colocated].sort((a, b) => effAtk(b) - effAtk(a))[0];
        const defDies    = avatarAtk >= effDef(def);
        const avatarHurt = effAtk(def) > 0;
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} (${avatarAtk}/${active.avatarCard.defense}) fights ${def.card.name}`);
        if (defDies) { removeMinion(def); emit(`  → ${def.card.name} destroyed`); }
        if (avatarHurt) damageAvatar(active, effAtk(def), def.card.name);
        return true;
      }

      if (sq.owner !== opp.id) return false;

      // Check for Defend on this site
      const defenders = friendlyMinions(opp.id).filter(
        d => !d.tapped && cardinalDist(d.pos, pos) <= 1
      );
      if (defenders.length > 0) {
        const def = [...defenders].sort(
          (a, b) => cardinalDist(a.pos, pos) - cardinalDist(b.pos, pos)
        )[0];
        const fromPos = { ...def.pos };
        def.pos   = { ...pos };
        def.tapped = true;
        emit(`T${turn} [${opp.id}] ${def.card.name} defends from (${fromPos.col},${fromPos.row})`);
        const defDies    = avatarAtk >= effDef(def);
        const avatarHurt = effAtk(def) > 0;
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} vs defender ${def.card.name}`);
        if (defDies) { removeMinion(def); emit(`  → ${def.card.name} destroyed`); }
        if (avatarHurt) damageAvatar(active, effAtk(def), def.card.name);
        return true;
      }

      // Undefended site attack
      active.siteAttacks++;
      damageAvatar(opp, avatarAtk, `${active.avatarCard.name} (avatar site attack)`);
      emit(`T${turn} [${active.id}] ${active.avatarCard.name} attacks undefended site at (${pos.col},${pos.row})`);

      if (hasAbility("avatar_destroy_site_on_attack")) {
        const siteName = sq.site?.name ?? "site";
        sq.owner = null; sq.site = undefined; sq.isRubble = true;
        opp.mana      = computeMana(grid, minions, opp.id);
        opp.threshold = computeThreshold(grid, minions, opp.id);
        emit(`  → ${active.avatarCard.name} destroys ${siteName}; now digesting`);
        active.avatarDigesting = true;
      }

      // on_site_attack_draw fires for avatar attacks too (Battlemage, Interrogator)
      for (const ab of active.avatarCard.avatarAbilities ?? [])
        if (ab.kind === "on_site_attack_draw") {
          for (let i = 0; i < ab.amount; i++) drawOne(active);
          emit(`  → ${active.avatarCard.name} draws ${ab.amount} (site attack)`);
        }
      return true;
    };

    // Choose nearest enemy site or enemy avatar as destination
    const destinations = [
      ...ownedSites(grid, opp.id),
      opp.avatarPos,
    ].sort((a, b) => cardinalDist(active.avatarPos, a) - cardinalDist(active.avatarPos, b));

    if (destinations.length === 0) return;

    // Advance one step
    if (!posEq(active.avatarPos, destinations[0])) {
      const step = cardinalStep(active.avatarPos, destinations[0]);
      if (inBounds(step)) {
        emit(`T${turn} [${active.id}] ${active.avatarCard.name} advances (${active.avatarPos.col},${active.avatarPos.row})→(${step.col},${step.row})`);
        active.avatarPos = step;
      }
    }

    const attacked = doAttack();
    active.avatarTapUsed = true;

    // Bladedancer: bonus step + attack after the first
    if (attacked && hasAbility("avatar_extra_step_after_attack") && !active.avatarDigesting) {
      const dest2 = [
        ...ownedSites(grid, opp.id),
        opp.avatarPos,
      ].sort((a, b) => cardinalDist(active.avatarPos, a) - cardinalDist(active.avatarPos, b));
      if (dest2.length > 0 && !posEq(active.avatarPos, dest2[0])) {
        const step2 = cardinalStep(active.avatarPos, dest2[0]);
        if (inBounds(step2)) {
          emit(`T${turn} [${active.id}] ${active.avatarCard.name} takes bonus step to (${step2.col},${step2.row})`);
          active.avatarPos = step2;
          doAttack();
        }
      }
    }
  }

  // ── Site-entry passive effects ────────────────────────────────────────────
  // Returns true if the minion was destroyed by a site passive.
  function handleSiteEntry(bm: BoardMinion): boolean {
    const sq  = getSquare(grid, bm.pos);
    if (!sq.site?.siteEffect) return false;
    const eff = sq.site.siteEffect;
    const siteOwner = player(sq.owner!);

    if (eff.kind === "passive_kill_entering_non_airborne") {
      if (!bHasKw(bm, "airborne")) {
        emit(`T${turn} [${sq.owner}] ${sq.site.name}: kills non-airborne ${bm.card.name} entering`);
        removeMinion(bm);
        return true;
      }
    }

    if (eff.kind === "passive_entry_damage" && bm.owner !== sq.owner) {
      emit(`T${turn} [${sq.owner}] ${sq.site.name}: ${eff.amount} damage to ${bm.card.name} entering`);
      if (eff.amount >= effDef(bm)) {
        removeMinion(bm);
        emit(`  → ${bm.card.name} destroyed by site`);
        return true;
      }
    }

    void siteOwner;
    return false;
  }

  // Also fires on exit (Briar Patch) — only entry_damage triggers on leave
  function handleSiteExit(bm: BoardMinion, exitedPos: Pos): void {
    const sq = getSquare(grid, exitedPos);
    if (!sq.site?.siteEffect) return;
    const eff = sq.site.siteEffect;
    if (eff.kind === "passive_entry_damage" && bm.owner !== sq.owner) {
      emit(`T${turn} [${sq.owner}] ${sq.site.name}: ${eff.amount} damage to ${bm.card.name} leaving`);
      // Damage on exit — minion is no longer on the square, so we just note it;
      // in a full model this could kill it but for simplicity we skip that edge case
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
    for (const m of friendlyMinions(active.id)) {
      // flooded minions with skipNextUntap stay tapped this turn and consume the flag
      if (m.skipNextUntap) { m.skipNextUntap = false; }
      else                  { m.tapped = false; }
      m.sick = false;
    }
    active.avatarTapUsed     = false;
    active.turnAirCostSpent  = 0;
    active.firstSubtypeUsed  = false;
    active.lastMinionPlayed  = null;

    // Refresh mana (sites + structure artifacts)
    active.mana      = computeMana(grid, minions, active.id);
    active.threshold = computeThreshold(grid, minions, active.id);
    for (const art of artifacts)
      if (art.owner === active.id && art.effect.kind === "structure") active.mana += art.effect.manaBonus;
    // Re-apply permanent threshold bonus (recalculated from scratch each turn)
    for (const ab of active.avatarCard.avatarAbilities ?? [])
      if (ab.kind === "threshold_bonus") {
        active.threshold.water += ab.water; active.threshold.earth += ab.earth;
        active.threshold.fire  += ab.fire;  active.threshold.air   += ab.air;
      }

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

    // Seer: start_of_turn_scry — look at top spell; bottom it if it won't be payable next turn
    for (const ab of active.avatarCard.avatarAbilities ?? []) {
      if (ab.kind !== "start_of_turn_scry") continue;
      if (active.spellDeck.length > 0) {
        const top  = active.spellDeck[active.spellDeck.length - 1];
        const cost = top.waterT + top.earthT + top.fireT + top.airT;
        // "Won't be playable" heuristic: costs more than mana+1 OR missing threshold
        const nextMana = active.mana + 1; // rough projection
        if (cost > nextMana || !canPlay(top, active.threshold, nextMana)) {
          active.spellDeck.pop();
          active.spellDeck.unshift(top);
          emit(`T${turn} [${active.id}] Seer bottoms ${top.name} (cost ${cost})`);
        } else {
          emit(`T${turn} [${active.id}] Seer keeps ${top.name} on top`);
        }
      }
    }

    // Draw
    if (!(turn === 1 && active.id === "A")) drawOne(active);

    // Site placement
    playSite(active);

    // Play cards
    playCards(active);

    // Flooding (Waveshaper / Avatar of Water): flood nearest enemy site; tap non-submerge minions there
    for (const ab of active.avatarCard.avatarAbilities ?? []) {
      if (ab.kind !== "flood_adjacent_enemy_site") continue;
      const enemySitePositions = ownedSites(grid, opponent(active.id).id);
      if (enemySitePositions.length === 0) break;
      // Un-flood previous square (there's at most one flooded square per player)
      for (let r = 0; r < ROWS; r++)
        for (let c2 = 0; c2 < COLS; c2++)
          grid[r][c2].flooded = false;
      // Choose the site farthest from the enemy avatar (= most advanced / vulnerable)
      const floodTarget = [...enemySitePositions].sort(
        (a, b) => cardinalDist(b, opponent(active.id).avatarPos) - cardinalDist(a, opponent(active.id).avatarPos)
      )[0];
      getSquare(grid, floodTarget).flooded = true;
      emit(`T${turn} [${active.id}] ${active.avatarCard.name} floods (${floodTarget.col},${floodTarget.row})`);
      // Tap non-submerge minions there and mark them to skip their next untap
      for (const bm of minions) {
        if (!posEq(bm.pos, floodTarget)) continue;
        if (bHasKw(bm, "submerge")) continue;
        bm.tapped = true;
        bm.skipNextUntap = true;
        emit(`  → ${bm.card.name} flooded (skips next untap)`);
      }
      break; // only one flood_adjacent_enemy_site ability
    }

    // Sparkmage: deal air-cost damage to weakest enemy after playing cards this turn
    for (const ab of active.avatarCard.avatarAbilities ?? []) {
      if (ab.kind !== "turn_end_air_damage") continue;
      if (active.turnAirCostSpent <= 0) continue;
      const targets = enemyMinions(active.id).filter(m => !m.stealthy);
      if (targets.length > 0) {
        const victim = [...targets].sort((a, b) => effDef(a) - effDef(b))[0];
        emit(`T${turn} [${active.id}] Sparkmage deals ${active.turnAirCostSpent} to ${victim.card.name}`);
        if (active.turnAirCostSpent >= effDef(victim)) {
          removeMinion(victim);
          emit(`  → ${victim.card.name} destroyed by Sparkmage`);
        }
      } else {
        damageAvatar(opponent(active.id), active.turnAirCostSpent, "Sparkmage");
      }
    }

    // Once-per-turn token summons (e.g. Necromancer skeleton)
    for (const ab of active.avatarCard.avatarAbilities ?? []) {
      if (ab.kind !== "summon_token") continue;
      if (active.mana < ab.manaCost) continue;
      const free = freeSiteSquares(grid, minions, active.id);
      if (free.length === 0) continue;
      active.mana -= ab.manaCost;
      const pos = chooseMinionPosition(free, opponent(active.id).avatarPos);
      const tokenCard: SimCard = {
        name: "Token", type: "Minion",
        attack: ab.attack, defense: ab.defense, life: 0,
        waterT: 0, earthT: 0, fireT: 0, airT: 0,
        elements: [], keywords: [], subtypes: [], rulesText: "",
      };
      const bm: BoardMinion = {
        card: tokenCard, pos, owner: active.id,
        tapped: false, sick: true, tempDamage: 0, stealthy: false,
        skipNextUntap: false, temporary: false,
      };
      minions.push(bm);
      active.minionsDeployed++;
      emit(`T${turn} [${active.id}] ${active.avatarCard.name} summons a ${ab.attack}/${ab.defense} token at (${pos.col},${pos.row})`);
    }

    // Cemetery abilities
    for (const ab of active.avatarCard.avatarAbilities ?? []) {

      // Deathspeaker: banish a dead minion to re-summon it
      if (ab.kind === "cemetery_summon" && active.deadMinions.length > 0) {
        const isFree = ab.freeCostOnDeathsDoor && active.deathsDoor;
        const candidate = [...active.deadMinions]
          .sort((a, b) => minionValue(b) - minionValue(a))[0];
        const cost2 = candidate.waterT + candidate.earthT + candidate.fireT + candidate.airT;
        const canAfford = isFree || (active.mana >= cost2 && canPlay(candidate, active.threshold, active.mana));
        if (canAfford) {
          const free2 = freeSiteSquares(grid, minions, active.id);
          if (free2.length > 0) {
            active.deadMinions = active.deadMinions.filter(c => c !== candidate);
            if (!isFree) active.mana -= cost2;
            const pos2 = chooseMinionPosition(free2, opponent(active.id).avatarPos);
            const bm2: BoardMinion = {
              card: candidate, pos: pos2, owner: active.id,
              tapped: false, sick: true, tempDamage: 0, stealthy: hasKw(candidate, "stealth"),
              skipNextUntap: false, temporary: false,
            };
            minions.push(bm2);
            active.minionsDeployed++;
            emit(`T${turn} [${active.id}] Deathspeaker re-summons ${candidate.name} from cemetery${isFree ? " (free)" : ""}`);
          }
        }
      }

      // Archimago: banish 3 dead spells → cast a copy of one
      if (ab.kind === "cemetery_cast_spell" && active.deadSpells.length >= ab.banishCount) {
        // Pick the highest-value spell and cast it again for free
        const spellCopy = [...active.deadSpells]
          .sort((a, b) => minionValue(b) - minionValue(a))[0];
        // Banish banishCount spells from cemetery
        const toRemove = ab.banishCount;
        for (let i = 0; i < toRemove && active.deadSpells.length > 0; i++)
          active.deadSpells.shift();
        const fx2 = spellCopy.spellEffect ?? parseSpellEffect(spellCopy.rulesText);
        const spellCost = spellCopy.waterT + spellCopy.earthT + spellCopy.fireT + spellCopy.airT;
        resolveSpellEffect(active, opponent(active.id), fx2, spellCost, `${spellCopy.name} (Archimago copy)`);
        emit(`T${turn} [${active.id}] Archimago casts copy of ${spellCopy.name} from cemetery`);
      }

      // Flamecaller: banish all dead fire minions → deal their total (F) as damage
      if (ab.kind === "cemetery_fire_damage") {
        const fireMinions = active.deadMinions.filter(c => c.fireT > 0 || c.elements.includes("fire"));
        if (fireMinions.length > 0) {
          const totalF = fireMinions.reduce((sum, c) => sum + c.fireT, 0);
          if (totalF > 0) {
            active.deadMinions = active.deadMinions.filter(c => !fireMinions.includes(c));
            damageAvatar(opponent(active.id), totalF, "Flamecaller");
            emit(`T${turn} [${active.id}] Flamecaller banishes ${fireMinions.length} fire minion(s) for ${totalF} damage`);
          }
        }
      }
    }

    // Combat
    combatStep(active);

    // Avatar action (combat avatars that didn't tap for a site attack independently)
    avatarActionStep(active);

    // End of turn: clear temp damage and temporary buff auras
    for (const m of minions) m.tempDamage = 0;
    for (let i = auras.length - 1; i >= 0; i--)
      if (auras[i].temporary && auras[i].owner === active.id) auras.splice(i, 1);
    // Remove temporary minions (Enchantress animated auras expire end of owner's turn)
    for (let i = minions.length - 1; i >= 0; i--) {
      if (minions[i].temporary && minions[i].owner === active.id) {
        emit(`T${turn} [${active.id}] ${minions[i].card.name} expires`);
        minions.splice(i, 1);
      }
    }

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
      subtypes:        type === "Minion"   ? parseSubtypes(c.name, rulesText) : [],
      spellEffect:     type === "Magic"    ? parseSpellEffect(rulesText)     : undefined,
      artifactEffect:  type === "Artifact" ? parseArtifactEffect(rulesText)  : undefined,
      auraEffect:      type === "Aura"     ? parseAuraEffect(rulesText)      : undefined,
      siteEffect:      type === "Site"     ? parseSiteEffect(c.name, rulesText) : undefined,
      avatarAbilities: type === "Avatar"   ? lookupAvatarAbilities(c.name)   : undefined,
    };
    for (let i = 0; i < (entry.quantity ?? 1); i++) out.push(simCard);
  }
  return out;
}

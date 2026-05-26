"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Card } from "@/lib/cards";
import type { ApiDeckCard, SimulationReport } from "@/lib/simulator";
import type { SavedBuilderDeck, SlimEntry } from "@/lib/builder-deck";
import type { CollectionMap } from "@/lib/collection";
import type { DeckOverride } from "@/app/simulate/DeckEditor";
import { builderDeckToOverride } from "@/lib/builder-deck-sim";
import { DeckPicker } from "@/app/simulate/DeckPicker";
import { useAuthSafe } from "@/lib/useAuthSafe";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiCard = ApiDeckCard["card"];

interface DeckEntry {
  apiCard: ApiCard;
  qty: number;
  rarity: string; // kept so we can enforce per-rarity copy limits
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Types that belong in the Spellbook (not Sites, not Avatar). */
const SPELLBOOK_TYPES = ["Minion", "Magic", "Artifact", "Aura"];
const STORAGE_KEY = "sorcerysim:deckbuilder:v1";

/** Filter chip data (matches collection page) */
const F_ELEMENTS = ["Water", "Earth", "Fire", "Air"];
const F_TYPES    = ["Avatar", "Site", "Minion", "Magic", "Artifact", "Aura"];
const F_RARITIES = ["Ordinary", "Exceptional", "Elite", "Unique"];
const F_SETS     = ["Alpha", "Beta", "Arthurian Legends", "Dragonlord", "Gothic", "Promotional"];

const F_EL_COLOUR: Record<string, string> = {
  Water: "bg-sky-900/50 text-sky-400 border-sky-700/40",
  Earth: "bg-yellow-900/40 text-yellow-500 border-yellow-700/40",
  Fire:  "bg-orange-900/40 text-orange-400 border-orange-700/40",
  Air:   "bg-violet-900/40 text-violet-400 border-violet-700/40",
};

/** Constructed format minimums per the official rulebook. */
const MIN_SPELLBOOK = 60; // Minions, Magic, Artifacts, Auras
const MIN_ATLAS     = 30; // Sites only

// ─── Utilities ────────────────────────────────────────────────────────────────

function toApiCard(card: Card): ApiCard {
  const els = card.elements
    ? card.elements.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    name: card.name,
    type: card.guardian.type ?? "Minion",
    attack: card.guardian.attack ?? null,
    defense: card.guardian.defence ?? null, // Card uses British "defence"
    waterThreshold: card.guardian.thresholds?.water ?? 0,
    earthThreshold: card.guardian.thresholds?.earth ?? 0,
    fireThreshold: card.guardian.thresholds?.fire ?? 0,
    airThreshold: card.guardian.thresholds?.air ?? 0,
    elements: els.map((e) => ({ id: e.toLowerCase(), name: e })),
  };
}

/**
 * Official Sorcery: Contested Realm copy limits by rarity (Constructed format):
 *   Ordinary    → 4 copies
 *   Exceptional → 3 copies
 *   Elite       → 2 copies
 *   Unique      → 1 copy
 */
function maxCopies(rarity: string | null | undefined): number {
  switch ((rarity ?? "").toLowerCase()) {
    case "ordinary":    return 4;
    case "exceptional": return 3;
    case "elite":       return 2;
    case "unique":      return 1;
    default:            return 4; // fallback for unknown/None
  }
}

// ─── Small display helpers ────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  ordinary:    "text-gray-400",
  exceptional: "text-purple-400",
  elite:       "text-blue-400",
  unique:      "text-amber-400",
};
function rarityClass(r: string | null | undefined) {
  if (!r) return "text-gray-600";
  return RARITY_COLOR[r.toLowerCase()] ?? "text-gray-500";
}

const TH = [
  { key: "fire",  label: "F", cls: "text-red-400"   },
  { key: "water", label: "W", cls: "text-blue-400"  },
  { key: "earth", label: "E", cls: "text-green-400" },
  { key: "air",   label: "A", cls: "text-sky-400"   },
] as const;

function ThresholdPips({ th }: { th: Card["guardian"]["thresholds"] | undefined }) {
  if (!th) return null;
  const active = TH.filter((c) => (th as unknown as Record<string, number>)[c.key] > 0);
  if (!active.length) return null;
  return (
    <span className="flex items-center gap-1">
      {active.map((c) => (
        <span key={c.key} className={`font-mono ${c.cls}`}>
          {c.label}{(th as unknown as Record<string, number>)[c.key]}
        </span>
      ))}
    </span>
  );
}

// ─── Chip toggle ─────────────────────────────────────────────────────────────

function Chip({ label, active, colour, onClick }: {
  label: string; active: boolean; colour?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? colour ?? "bg-amber-500/20 text-amber-400 border-amber-500/50"
          : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

// ─── CardResultRow ────────────────────────────────────────────────────────────

function CardResultRow({
  card,
  qty,
  owned,
  onAdd,
  onSetAvatar,
  isCurrentAvatar,
}: {
  card: Card;
  qty: number;
  owned?: number;
  onAdd: () => void;
  onSetAvatar: () => void;
  isCurrentAvatar: boolean;
}) {
  const isAvatar = card.guardian.type === "Avatar";
  const max = maxCopies(card.guardian.rarity);
  const atMax = qty >= max;
  const th = card.guardian.thresholds;
  const hasThresh = th && (th.fire > 0 || th.water > 0 || th.earth > 0 || th.air > 0);

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-800/40 last:border-0 hover:bg-gray-800/30 transition-colors">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{card.name}</span>
          {card.guardian.rarity && (
            <span className={`text-xs ${rarityClass(card.guardian.rarity)}`}>
              {card.guardian.rarity}
            </span>
          )}
          {owned != null && owned > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold">
              own ×{owned}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{card.guardian.type}</span>
          {card.subTypes && <span className="text-gray-600">· {card.subTypes}</span>}
          {card.elements && <span className="text-gray-600">· {card.elements}</span>}
          {/* Destination badge */}
          {!isAvatar && (
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded font-medium ${
              card.guardian.type === "Site"
                ? "bg-green-900/30 text-green-500"
                : "bg-blue-900/30 text-blue-400"
            }`}>
              {card.guardian.type === "Site" ? "Atlas" : "Spellbook"}
            </span>
          )}
        </div>
        {(card.guardian.attack != null ||
          (card.guardian.life != null && card.guardian.life > 0) ||
          card.guardian.cost != null ||
          hasThresh) && (
          <div className="flex items-center gap-3 mt-0.5 text-xs font-mono">
            {card.guardian.attack != null && (
              <span className="text-amber-400">
                {card.guardian.attack}/{card.guardian.defence}
              </span>
            )}
            {card.guardian.life != null && card.guardian.life > 0 && (
              <span className="text-pink-400">❤ {card.guardian.life}</span>
            )}
            {card.guardian.cost != null && (
              <span className="text-gray-400">Cost {card.guardian.cost}</span>
            )}
            <ThresholdPips th={th} />
          </div>
        )}
        {card.guardian.rulesText && (
          <div className="text-xs text-gray-600 italic mt-1 line-clamp-2">
            {card.guardian.rulesText}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
        {isAvatar ? (
          <button
            type="button"
            onClick={onSetAvatar}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
              isCurrentAvatar
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
            }`}
          >
            {isCurrentAvatar ? "✓ Avatar" : "Set Avatar"}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              {qty > 0 && (
                <span className={`font-mono font-bold text-sm ${atMax ? "text-gray-500" : "text-amber-500"}`}>
                  {qty}/{max}
                </span>
              )}
              <button
                type="button"
                onClick={onAdd}
                disabled={atMax}
                title={atMax ? `Max ${max} ${max === 1 ? "copy" : "copies"} (${card.guardian.rarity})` : `Add to ${card.guardian.type === "Site" ? "Atlas" : "Spellbook"}`}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-base font-bold transition-colors ${
                  atMax
                    ? "text-gray-700 bg-gray-800/60 cursor-not-allowed"
                    : "text-white bg-gray-700 hover:bg-amber-600"
                }`}
              >
                +
              </button>
            </div>
            <span className="text-xs text-gray-700">max {max}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DeckEntryRow ─────────────────────────────────────────────────────────────

function DeckEntryRow({
  entry,
  onInc,
  onDec,
  onRemove,
}: {
  entry: DeckEntry;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
}) {
  const max = maxCopies(entry.rarity);
  return (
    <div className="flex items-center gap-2 py-0.5 group">
      <button
        type="button"
        onClick={onDec}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700
          text-gray-500 hover:text-white text-xs transition-colors shrink-0"
      >
        −
      </button>
      <span className="text-amber-500 font-mono w-5 text-center text-sm shrink-0">
        {entry.qty}
      </span>
      <button
        type="button"
        onClick={onInc}
        disabled={entry.qty >= max}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700
          text-gray-500 hover:text-white disabled:opacity-30 text-xs transition-colors shrink-0"
      >
        +
      </button>
      <span className="flex-1 text-sm text-gray-300 truncate">{entry.apiCard.name}</span>
      {entry.apiCard.attack != null && (
        <span className="text-xs text-gray-600 font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {entry.apiCard.attack}/{entry.apiCard.defense}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-700 hover:text-red-400 text-xs transition-colors shrink-0"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Deck grouping helper (module-level so DeckSection can call it) ──────────

function groupByType(list: DeckEntry[]) {
  const map = new Map<string, DeckEntry[]>();
  for (const e of list) {
    const t = e.apiCard.type ?? "Other";
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(e);
  }
  return map;
}

// ─── DeckSection ──────────────────────────────────────────────────────────────

interface DeckSectionProps {
  label: string;
  description: string;
  entries: DeckEntry[];
  total: number;
  minimum: number;
  typeOrder: string[];
  onInc: (entry: DeckEntry) => void;
  onDec: (name: string) => void;
  onRemove: (name: string) => void;
  accentColor: "blue" | "green";
  emptyMessage: string;
}

function DeckSection({
  label,
  description,
  entries,
  total,
  minimum,
  typeOrder,
  onInc,
  onDec,
  onRemove,
  accentColor,
  emptyMessage,
}: DeckSectionProps) {
  const met = total >= minimum;
  const grouped = groupByType(entries);

  // Respect typeOrder, then any remaining types alphabetically
  const orderedTypes = [
    ...typeOrder.filter((t) => grouped.has(t)),
    ...[...grouped.keys()].filter((t) => !typeOrder.includes(t)).sort(),
  ];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-1.5">
        <p
          className={`text-xs uppercase tracking-wide font-semibold ${
            accentColor === "blue" ? "text-blue-400" : "text-green-400"
          }`}
        >
          {label}
        </p>
        <span className="text-xs text-gray-600">{description}</span>
        <span
          className={`ml-auto text-xs font-mono font-bold ${
            met ? (accentColor === "blue" ? "text-blue-400" : "text-green-400") : "text-amber-400"
          }`}
        >
          {total}/{minimum}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-gray-800 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            met
              ? accentColor === "blue"
                ? "bg-blue-500"
                : "bg-green-500"
              : "bg-amber-500"
          }`}
          style={{ width: `${Math.min(100, (total / minimum) * 100)}%` }}
        />
      </div>

      {/* Card list */}
      {entries.length === 0 ? (
        <div className="text-xs text-gray-700 text-center py-4 border border-dashed border-gray-800 rounded-lg">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orderedTypes.map((type) => {
            const group = grouped.get(type)!;
            const groupTotal = group.reduce((s, e) => s + e.qty, 0);
            return (
              <div key={type}>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">
                  {type}{" "}
                  <span className="font-mono text-gray-700">({groupTotal})</span>
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.map((entry) => (
                    <DeckEntryRow
                      key={entry.apiCard.name}
                      entry={entry}
                      onInc={() => onInc(entry)}
                      onDec={() => onDec(entry.apiCard.name)}
                      onRemove={() => onRemove(entry.apiCard.name)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MiniSimResult ────────────────────────────────────────────────────────────

function MiniSimResult({
  report,
  deckName,
}: {
  report: SimulationReport;
  deckName: string;
}) {
  const winA = parseFloat(report.winRateA);
  const winB = parseFloat(report.winRateB);
  const draws = report.draws > 0 ? (report.draws / report.iterations) * 100 : 0;
  const leader = winA > winB ? "A" : winB > winA ? "B" : null;

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between bg-gray-950/40">
        <span className="text-xs text-gray-500 font-medium">
          {report.iterations.toLocaleString()} games · {report.avgTurns} avg turns
        </span>
        {leader && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              leader === "A"
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-sky-500/20 text-sky-400 border-sky-500/30"
            }`}
          >
            {leader === "A" ? deckName : report.deckBName} leads
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-800">
        {(
          [
            { name: deckName,        rate: winA, winRate: report.winRateA, life: report.avgFinalLifeA, side: "A" },
            { name: report.deckBName, rate: winB, winRate: report.winRateB, life: report.avgFinalLifeB, side: "B" },
          ] as const
        ).map((s) => (
          <div
            key={s.side}
            className={`px-4 py-3 ${
              leader === s.side ? (s.side === "A" ? "bg-amber-950/20" : "bg-sky-950/20") : ""
            }`}
          >
            <div className="text-xs text-gray-500 truncate mb-1">{s.name}</div>
            <div
              className={`text-2xl font-black tabular-nums ${
                leader === s.side
                  ? s.side === "A"
                    ? "text-amber-400"
                    : "text-sky-400"
                  : "text-gray-400"
              }`}
            >
              {s.winRate}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">{s.life} avg life left</div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-950 gap-px">
          {winA > 0 && (
            <div
              className="bg-amber-500 h-full rounded-l-full transition-all duration-700"
              style={{ width: `${winA}%` }}
            />
          )}
          {draws > 0 && (
            <div className="bg-gray-600 h-full transition-all duration-700" style={{ width: `${draws}%` }} />
          )}
          {winB > 0 && (
            <div
              className="bg-sky-500 h-full rounded-r-full transition-all duration-700"
              style={{ width: `${winB}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs font-mono mt-1.5">
          <span className="text-amber-400">{report.winRateA}</span>
          {report.draws > 0 && (
            <span className="text-gray-600">{draws.toFixed(1)}% draws</span>
          )}
          <span className="text-sky-400">{report.winRateB}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DeckBuilderPageContent() {
  // Auth
  const { isSignedIn, isLoaded: authLoaded } = useAuthSafe();
  const searchParams = useSearchParams();

  // Deck state
  const [deckName, setDeckName] = useState("My Deck");
  const [avatar, setAvatar] = useState<ApiCard | null>(null);
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  /** ID of the saved deck currently loaded in the editor (null = unsaved / new). */
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);

  // Search state
  const [query,          setQuery]          = useState("");
  const [typeFilters,    setTypeFilters]    = useState<string[]>([]);
  const [elementFilters, setElementFilters] = useState<string[]>([]);
  const [rarityFilters,  setRarityFilters]  = useState<string[]>([]);
  const [setFilter,      setSetFilter]      = useState("");
  const [results,        setResults]        = useState<Card[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [hasSearched,    setHasSearched]    = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collection state
  const [collection, setCollection] = useState<CollectionMap>({});
  const [collectionOnly, setCollectionOnly] = useState(false);

  // Sim state
  const [opponentId, setOpponentId]         = useState("");
  const [opponentOverride, setOpponentOverride] = useState<DeckOverride | null>(null);
  const [simIterations, setSimIterations]   = useState(300);
  const [simLoading, setSimLoading]         = useState(false);
  const [simReport, setSimReport]           = useState<SimulationReport | null>(null);
  const [simError, setSimError]             = useState<string | null>(null);

  // Save/load state
  const [savedDecks, setSavedDecks] = useState<SavedBuilderDeck[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingDeckId, setLoadingDeckId] = useState<string | null>(null);
  /** ID of the deck the user has asked to delete (shows inline confirmation). */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Persistence ───────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const d = JSON.parse(saved) as {
        name?: string;
        entries?: DeckEntry[];
        avatar?: ApiCard | null;
        currentDeckId?: string | null;
      };
      if (d.name)          setDeckName(d.name);
      if (d.entries)       setEntries(d.entries);
      if (d.avatar)        setAvatar(d.avatar);
      if (d.currentDeckId) setCurrentDeckId(d.currentDeckId);
    } catch { /* ignore corrupt storage */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ name: deckName, entries, avatar, currentDeckId })
        );
      } catch { /* quota exceeded */ }
    }, 500);
    return () => clearTimeout(t);
  }, [deckName, entries, avatar, currentDeckId]);

  // ── Fetch saved decks when signed in ────────────────────────────────────

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/builder-decks")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSavedDecks(d as SavedBuilderDeck[]))
      .catch(console.error);
  }, [isSignedIn]);

  // ── Auto-load deck from ?load=<id> URL parameter ─────────────────────────
  // Used by "Open in Builder" links on the Deck Explorer page.

  const autoLoadRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn || autoLoadRef.current || savedDecks.length === 0) return;
    const loadId = searchParams.get("load");
    if (!loadId) return;
    const deck = savedDecks.find((d) => d.id === loadId);
    if (deck) {
      autoLoadRef.current = true;
      loadSavedDeck(deck);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, savedDecks]);

  // ── Fetch collection when signed in ─────────────────────────────────────

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/collection")
      .then((r) => (r.ok ? r.json() : { collection: {} }))
      .then((d) => setCollection((d as { collection: CollectionMap }).collection))
      .catch(console.error);
  }, [isSignedIn]);

  // ── Save / update current deck ───────────────────────────────────────────
  // If currentDeckId is set, PUTs to update the existing saved deck.
  // Otherwise, POSTs to create a new one and captures the returned ID.

  async function saveDeck() {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const slimEntries: SlimEntry[] = entries.map((e) => [
        e.apiCard.name,
        e.qty,
        e.rarity,
        e.apiCard.type ?? "Minion",
      ]);

      if (currentDeckId) {
        // ── Update existing ──
        const res = await fetch("/api/user/builder-decks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentDeckId,
            name: deckName,
            avatarName: avatar?.name ?? null,
            entries: slimEntries,
          }),
        });
        if (res.status === 404) {
          // Deck was deleted on the server — fall back to creating a new one
          setCurrentDeckId(null);
          throw new Error("Deck no longer exists. Please save again to create a new copy.");
        }
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          throw new Error(d.error ?? `HTTP ${res.status}`);
        }
      } else {
        // ── Create new ──
        const res = await fetch("/api/user/builder-decks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: deckName,
            avatarName: avatar?.name ?? null,
            entries: slimEntries,
          }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          throw new Error(d.error ?? `HTTP ${res.status}`);
        }
        const saved = (await res.json()) as { id: string };
        setCurrentDeckId(saved.id); // track the new deck going forward
      }

      // Refresh the saved decks list
      const updated = await fetch("/api/user/builder-decks").then((r) =>
        r.ok ? r.json() : []
      );
      setSavedDecks(updated as SavedBuilderDeck[]);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      setSaveError(String(e));
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 5000);
    }
  }

  // ── Load a saved deck into the editor ───────────────────────────────────

  async function loadSavedDeck(deck: SavedBuilderDeck) {
    setLoadingDeckId(deck.id);
    try {
      const allNames = [
        ...deck.e.map(([name]) => name),
        ...(deck.av ? [deck.av] : []),
      ];
      const res = await fetch(
        `/api/cards/batch?names=${encodeURIComponent(allNames.join(","))}`
      );
      if (!res.ok) throw new Error("Failed to fetch card data");
      const cards = (await res.json()) as Card[];
      const byName = new Map(cards.map((c) => [c.name.toLowerCase(), c]));

      const newEntries: DeckEntry[] = deck.e.flatMap(([name, qty, rarity]) => {
        const card = byName.get(name.toLowerCase());
        if (!card) return [];
        return [{ apiCard: toApiCard(card), qty, rarity }];
      });

      const avatarCard = deck.av ? byName.get(deck.av.toLowerCase()) : null;

      setDeckName(deck.name);
      setEntries(newEntries);
      setAvatar(avatarCard ? toApiCard(avatarCard) : null);
      setCurrentDeckId(deck.id);
      setSimReport(null);
      setSimError(null);
    } catch (e) {
      console.error("Failed to load saved deck:", e);
    } finally {
      setLoadingDeckId(null);
    }
  }

  // ── Delete a saved deck ──────────────────────────────────────────────────

  async function deleteSavedDeck(id: string) {
    await fetch("/api/user/builder-decks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSavedDecks((prev) => prev.filter((d) => d.id !== id));
  }

  // ── Card search ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();

    if (!q && !typeFilters.length && !elementFilters.length && !rarityFilters.length && !setFilter) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setHasSearched(true);
      try {
        const p = new URLSearchParams({ limit: "60" });
        if (q)                          p.set("q", q);
        if (typeFilters.length === 1)    p.set("type", typeFilters[0]);
        if (elementFilters.length === 1) p.set("element", elementFilters[0]);
        if (rarityFilters.length === 1)  p.set("rarity", rarityFilters[0]);
        if (setFilter)                   p.set("set", setFilter);
        const res = await fetch(`/api/cards/search?${p}`);
        if (res.ok) {
          const data = (await res.json()) as { results: Card[] };
          let cards = data.results;

          // Client-side multi-select filtering
          if (elementFilters.length > 1)
            cards = cards.filter((c) =>
              elementFilters.every((el) => c.elements.toLowerCase().includes(el.toLowerCase()))
            );
          if (typeFilters.length > 1)
            cards = cards.filter((c) =>
              typeFilters.some((t) => c.guardian.type.toLowerCase().includes(t.toLowerCase()))
            );
          if (rarityFilters.length > 1)
            cards = cards.filter((c) =>
              rarityFilters.some((r) => (c.guardian.rarity ?? "").toLowerCase() === r.toLowerCase())
            );

          // Collection-only filter
          const filtered = collectionOnly
            ? cards.filter((c) => (collection[c.name.trim().toLowerCase()]?.qty ?? 0) > 0)
            : cards;
          setResults(filtered);
        }
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, typeFilters, elementFilters, rarityFilters, setFilter, collectionOnly, collection]);

  // ── Deck mutations ────────────────────────────────────────────────────────

  const getQty = useCallback(
    (name: string) => entries.find((e) => e.apiCard.name === name)?.qty ?? 0,
    [entries]
  );

  const addCard = useCallback((card: Card) => {
    const apiCard = toApiCard(card);
    const max = maxCopies(card.guardian.rarity);
    setEntries((prev) => {
      const existing = prev.find((e) => e.apiCard.name === card.name);
      if (existing) {
        if (existing.qty >= max) return prev;
        return prev.map((e) =>
          e.apiCard.name === card.name ? { ...e, qty: e.qty + 1 } : e
        );
      }
      return [...prev, { apiCard, qty: 1, rarity: card.guardian.rarity ?? "" }];
    });
  }, []);

  const incEntry = useCallback((entry: DeckEntry) => {
    const max = maxCopies(entry.rarity);
    setEntries((prev) =>
      prev.map((e) =>
        e.apiCard.name === entry.apiCard.name && e.qty < max
          ? { ...e, qty: e.qty + 1 }
          : e
      )
    );
  }, []);

  const decEntry = useCallback((name: string) => {
    setEntries((prev) =>
      prev
        .map((e) => (e.apiCard.name === name ? { ...e, qty: e.qty - 1 } : e))
        .filter((e) => e.qty > 0)
    );
  }, []);

  const removeEntry = useCallback((name: string) => {
    setEntries((prev) => prev.filter((e) => e.apiCard.name !== name));
  }, []);

  const clearDeck = useCallback(() => {
    setEntries([]);
    setAvatar(null);
    setDeckName("My Deck");
    setCurrentDeckId(null);
    setSimReport(null);
    setSimError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // ── Spellbook / Atlas split ───────────────────────────────────────────────

  const spellbookEntries = entries.filter((e) => e.apiCard.type !== "Site");
  const atlasEntries     = entries.filter((e) => e.apiCard.type === "Site");
  const spellbookTotal   = spellbookEntries.reduce((s, e) => s + e.qty, 0);
  const atlasTotal       = atlasEntries.reduce((s, e) => s + e.qty, 0);

  // ── Simulation ────────────────────────────────────────────────────────────

  const totalCards = entries.reduce((s, e) => s + e.qty, 0);
  const canSim = totalCards > 0 && opponentId.trim() !== ""
    && (!opponentId.startsWith("builder:") || opponentOverride !== null);

  async function runSim() {
    setSimReport(null);
    setSimError(null);
    setSimLoading(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckA: "builder",   // placeholder — skipped because override is provided
          deckB: opponentId.trim(),
          iterations: simIterations,
          deckAOverride: {
            decklist: entries.map((e) => ({ quantity: e.qty, card: e.apiCard })),
            avatar: avatar ? { quantity: 1, card: avatar } : null,
            name: deckName,
          },
          ...(opponentOverride ? { deckBOverride: opponentOverride } : {}),
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setSimReport((await res.json()) as SimulationReport);
    } catch (e) {
      setSimError(String(e));
    } finally {
      setSimLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>Deck Builder</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Build a deck from scratch and test it against any curiosa.io deck.
        Your work is saved automatically in this browser.
      </p>

      <div className="grid lg:grid-cols-[2fr_3fr] gap-6 items-start">

        {/* ── Left: Card search ── */}
        <div className="lg:sticky lg:top-20">
          <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">

            {/* Search controls */}
            <div className="p-4 flex flex-col gap-3 border-b border-gray-800">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cards by name or text…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white
                  placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              />

              {/* Element chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Element</div>
                <div className="flex flex-wrap gap-1.5">
                  {F_ELEMENTS.map((el) => (
                    <Chip
                      key={el} label={el}
                      active={elementFilters.includes(el)}
                      colour={F_EL_COLOUR[el]}
                      onClick={() => setElementFilters((p) => p.includes(el) ? p.filter((x) => x !== el) : [...p, el])}
                    />
                  ))}
                </div>
              </div>

              {/* Type chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Type</div>
                <div className="flex flex-wrap gap-1.5">
                  {F_TYPES.map((t) => (
                    <Chip
                      key={t} label={t}
                      active={typeFilters.includes(t)}
                      onClick={() => setTypeFilters((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])}
                    />
                  ))}
                </div>
              </div>

              {/* Rarity chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Rarity</div>
                <div className="flex flex-wrap gap-1.5">
                  {F_RARITIES.map((r) => (
                    <Chip
                      key={r} label={r}
                      active={rarityFilters.includes(r)}
                      colour={`bg-gray-800 border ${
                        r === "Unique"      ? "text-amber-400 border-amber-500/50 bg-amber-500/10" :
                        r === "Elite"       ? "text-sky-400 border-sky-500/50 bg-sky-500/10" :
                        r === "Exceptional" ? "text-green-400 border-green-500/50 bg-green-500/10" :
                        "text-gray-300 border-gray-500"
                      }`}
                      onClick={() => setRarityFilters((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r])}
                    />
                  ))}
                </div>
              </div>

              {/* Set chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Set</div>
                <div className="flex flex-wrap gap-1.5">
                  {F_SETS.map((s) => (
                    <Chip
                      key={s} label={s}
                      active={setFilter === s}
                      onClick={() => setSetFilter((prev) => prev === s ? "" : s)}
                    />
                  ))}
                </div>
              </div>

              {/* Collection toggle — only shown when signed in */}
              {isSignedIn && (
                <button
                  onClick={() => setCollectionOnly((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    collectionOnly
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                  }`}
                >
                  <span>📦 My Collection only</span>
                  <span className={`w-8 h-4 rounded-full transition-colors ${collectionOnly ? "bg-amber-500" : "bg-gray-600"} relative`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${collectionOnly ? "left-4" : "left-0.5"}`} />
                  </span>
                </button>
              )}

              {/* Active filter clear */}
              {(typeFilters.length > 0 || elementFilters.length > 0 || rarityFilters.length > 0 || setFilter) && (
                <button
                  type="button"
                  onClick={() => { setTypeFilters([]); setElementFilters([]); setRarityFilters([]); setSetFilter(""); }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium text-left"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Search results */}
            <div className="overflow-y-auto max-h-[55vh] lg:max-h-[65vh]">
              {searching && (
                <div className="text-center text-gray-500 text-sm py-10">Searching…</div>
              )}
              {!searching && hasSearched && results.length === 0 && (
                <div className="text-center text-gray-600 text-sm py-10">No cards found.</div>
              )}
              {!searching && !hasSearched && (
                <div className="text-center text-gray-700 text-sm py-14">
                  Search for cards to add to your deck.
                </div>
              )}
              {results.map((card) => (
                <CardResultRow
                  key={card.name}
                  card={card}
                  qty={getQty(card.name)}
                  owned={collection[card.name.trim().toLowerCase()]?.qty}
                  onAdd={() => addCard(card)}
                  onSetAvatar={() => setAvatar(toApiCard(card))}
                  isCurrentAvatar={avatar?.name === card.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Deck + Tester ── */}
        <div className="flex flex-col gap-6">

          {/* Deck panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">

            {/* Deck name + actions */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="flex-1 bg-transparent text-xl font-bold text-white focus:outline-none
                  border-b border-transparent focus:border-gray-600 pb-0.5 transition-colors min-w-0"
                placeholder="Deck Name"
              />
              <div className="flex items-center gap-2 shrink-0">
                {/* Save to account — only when signed in and deck has cards */}
                {authLoaded && isSignedIn && entries.length > 0 && (
                  <button
                    type="button"
                    onClick={saveDeck}
                    disabled={saveStatus === "saving"}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      saveStatus === "saved"
                        ? "bg-green-900/20 text-green-400 border-green-800/40"
                        : saveStatus === "error"
                        ? "bg-red-900/20 text-red-400 border-red-800/40"
                        : "bg-gray-800 text-gray-300 border-gray-700 hover:border-amber-500/40 hover:text-amber-400"
                    }`}
                  >
                    {saveStatus === "saving"
                      ? (currentDeckId ? "Updating…" : "Saving…")
                      : saveStatus === "saved"
                      ? "✓ Saved"
                      : saveStatus === "error"
                      ? "Save failed"
                      : currentDeckId
                      ? "Update"
                      : "Save"}
                  </button>
                )}
                {/* Nudge unauthenticated users */}
                {authLoaded && !isSignedIn && entries.length > 0 && (
                  <span className="text-xs text-gray-700">Sign in to save</span>
                )}
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={clearDeck}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                    title="Clear entire deck"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Save error */}
            {saveStatus === "error" && saveError && (
              <p className="text-xs text-red-400 -mt-2">{saveError}</p>
            )}

            {/* Saved decks list — only when signed in and there are saved decks */}
            {isSignedIn && savedDecks.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1.5">
                  Saved Decks
                </p>
                <div className="flex flex-col gap-1.5">
                  {savedDecks.map((deck) => {
                    const cardCount = deck.e.reduce((s, e) => s + e[1], 0);
                    const isLoading = loadingDeckId === deck.id;
                    return (
                      <div
                        key={deck.id}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800/40 border border-gray-700/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{deck.name}</p>
                          <p className="text-xs text-gray-600">
                            {cardCount} cards
                            {deck.av && ` · ${deck.av}`}
                            {" · "}
                            {new Date(deck.at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadSavedDeck(deck)}
                          disabled={isLoading}
                          className="text-xs text-amber-500 hover:text-amber-400 disabled:text-gray-600 transition-colors shrink-0"
                        >
                          {isLoading ? "Loading…" : "Load"}
                        </button>
                        {confirmDeleteId === deck.id ? (
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-red-400">Delete?</span>
                            <button
                              type="button"
                              onClick={() => { deleteSavedDeck(deck.id); setConfirmDeleteId(null); }}
                              className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(deck.id)}
                            className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
                            title="Delete saved deck"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Avatar slot */}
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1.5">
                Avatar <span className="text-gray-700 font-normal normal-case">(required · 1)</span>
              </p>
              {avatar ? (
                <div className="flex items-center justify-between px-3 py-2 bg-amber-900/20 border border-amber-800/30 rounded-lg">
                  <span className="text-sm font-medium text-amber-300">{avatar.name}</span>
                  <button
                    type="button"
                    onClick={() => setAvatar(null)}
                    className="text-gray-600 hover:text-red-400 text-xs transition-colors ml-3 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 border border-dashed border-gray-800 rounded-lg text-xs text-gray-600">
                  Search for an Avatar card, then click "Set Avatar"
                </div>
              )}
            </div>

            {/* ── SPELLBOOK ── */}
            <DeckSection
              label="Spellbook"
              description="Minions · Magic · Artifacts · Auras"
              entries={spellbookEntries}
              total={spellbookTotal}
              minimum={MIN_SPELLBOOK}
              typeOrder={SPELLBOOK_TYPES}
              onInc={incEntry}
              onDec={decEntry}
              onRemove={removeEntry}
              accentColor="blue"
              emptyMessage="Add Minions, Magic, Artifacts, and Auras from the search panel."
            />

            {/* ── ATLAS ── */}
            <DeckSection
              label="Atlas"
              description="Sites only"
              entries={atlasEntries}
              total={atlasTotal}
              minimum={MIN_ATLAS}
              typeOrder={["Site"]}
              onInc={incEntry}
              onDec={decEntry}
              onRemove={removeEntry}
              accentColor="green"
              emptyMessage="Add Site cards from the search panel."
            />

          </div>

          {/* Simulation tester */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-base font-bold text-white">Test Against a Deck</h2>

            <DeckPicker
              label="Opponent"
              value={opponentId}
              onChange={(id) => {
                if (!id.startsWith("builder:")) {
                  setOpponentId(id);
                  setOpponentOverride(null);
                  setSimReport(null);
                  setSimError(null);
                }
              }}
              accentColor="sky"
              savedDecks={savedDecks}
              onBuilderDeck={async (deck) => {
                try {
                  const override = await builderDeckToOverride(deck);
                  setOpponentId("builder:" + deck.id);
                  setOpponentOverride(override);
                  setSimReport(null);
                  setSimError(null);
                } catch (e) { console.error("Failed to load builder deck:", e); }
              }}
            />

            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <label className="font-medium text-gray-300">Simulations</label>
                <span className="text-amber-400 font-mono font-bold">{simIterations}</span>
              </div>
              <input
                type="range"
                min={100}
                max={1000}
                step={100}
                value={simIterations}
                onChange={(e) => setSimIterations(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-gray-600">
                <span>100 — fast</span>
                <span>1000 — accurate</span>
              </div>
            </div>

            <button
              type="button"
              onClick={runSim}
              disabled={!canSim || simLoading}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed
                text-gray-950 font-bold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              {simLoading
                ? `Simulating ${simIterations} games…`
                : totalCards === 0
                ? "Build a deck first"
                : !opponentId
                ? "Choose an opponent"
                : `▶ Simulate ${simIterations} games`}
            </button>

            {simError && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
                {simError}
              </div>
            )}

            {simReport && (
              <MiniSimResult report={simReport} deckName={deckName} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function DeckBuilderPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-10 text-gray-500">Loading…</div>}>
      <DeckBuilderPageContent />
    </Suspense>
  );
}

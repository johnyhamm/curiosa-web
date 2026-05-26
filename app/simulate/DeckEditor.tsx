"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ApiDeckCard } from "@/lib/simulator";
import type { Card } from "@/lib/cards";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FullDeckData {
  decklist: ApiDeckCard[];
  avatar: ApiDeckCard | null;
  meta: { name?: string; format?: string } | null;
}

export interface DeckOverride {
  decklist: ApiDeckCard[];
  avatar: ApiDeckCard | null;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a plain deck ID from a raw input (handles curiosa.io URLs). */
function extractId(value: string): string {
  const m = value.match(/curiosa\.io\/decks\/([^/?#\s]+)/);
  if (m) return m[1];
  return value.trim();
}

/** Convert a Card (sorcerytcg.com API) to the ApiDeckCard["card"] shape. */
function cardToApiCard(card: Card): ApiDeckCard["card"] {
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

const TYPE_ORDER = ["Site", "Minion", "Magic", "Artifact", "Aura"];

// ─── Card detail helpers ───────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common:    "text-gray-500",
  uncommon:  "text-green-500",
  rare:      "text-blue-400",
  exceptional: "text-purple-400",
  unique:    "text-amber-400",
};

function rarityClass(r: string | null | undefined) {
  if (!r) return "text-gray-600";
  return RARITY_COLOR[r.toLowerCase()] ?? "text-gray-500";
}

/** Coloured threshold pips: F2 W1 etc. — only shows non-zero values. */
function ThresholdPips({ th }: { th: Card["guardian"]["thresholds"] | undefined }) {
  if (!th) return null;
  const items = [
    { key: "fire",  val: th.fire,  label: "F", cls: "text-red-400"   },
    { key: "water", val: th.water, label: "W", cls: "text-blue-400"  },
    { key: "earth", val: th.earth, label: "E", cls: "text-green-400" },
    { key: "air",   val: th.air,   label: "A", cls: "text-sky-400"   },
  ].filter((i) => i.val && i.val > 0);
  if (!items.length) return null;
  return (
    <span className="flex items-center gap-1">
      {items.map((i) => (
        <span key={i.key} className={`font-mono ${i.cls}`}>
          {i.label}{i.val}
        </span>
      ))}
    </span>
  );
}

/** One result row in the "Add a card" dropdown. */
function CardSearchResult({ card, onAdd }: { card: Card; onAdd: () => void }) {
  const th = card.guardian.thresholds;
  const hasStats = card.guardian.attack != null;
  const hasLife  = card.guardian.life  != null && card.guardian.life > 0;
  const hasCost  = card.guardian.cost  != null;
  const hasThresholds = th && (th.fire > 0 || th.water > 0 || th.earth > 0 || th.air > 0);
  const rulesSnippet = card.guardian.rulesText
    ? card.guardian.rulesText.replace(/\s+/g, " ").trim().slice(0, 80)
    : null;

  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full text-left px-3 py-2.5 hover:bg-gray-800 transition-colors
        border-b border-gray-800/50 last:border-0"
    >
      {/* Row 1: name + rarity */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-white font-semibold truncate">{card.name}</span>
        {card.guardian.rarity && (
          <span className={`text-xs shrink-0 ${rarityClass(card.guardian.rarity)}`}>
            {card.guardian.rarity}
          </span>
        )}
      </div>

      {/* Row 2: type · subtype · elements */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-xs text-gray-500">
        <span>{card.guardian.type}</span>
        {card.subTypes && (
          <><span className="text-gray-700">·</span><span className="text-gray-600">{card.subTypes}</span></>
        )}
        {card.elements && (
          <><span className="text-gray-700">·</span><span className="text-gray-500">{card.elements}</span></>
        )}
      </div>

      {/* Row 3: stats line */}
      {(hasStats || hasLife || hasCost || hasThresholds) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs font-mono">
          {hasCost && (
            <span className="text-gray-400">Cost&nbsp;{card.guardian.cost}</span>
          )}
          {hasStats && (
            <span className="text-amber-400">
              {card.guardian.attack}/{card.guardian.defence}
            </span>
          )}
          {hasLife && (
            <span className="text-pink-400">❤&nbsp;{card.guardian.life}</span>
          )}
          {hasThresholds && <ThresholdPips th={th} />}
        </div>
      )}

      {/* Row 4: rules text snippet */}
      {rulesSnippet && (
        <div className="mt-1 text-xs text-gray-600 italic line-clamp-3">
          {rulesSnippet}{card.guardian.rulesText && card.guardian.rulesText.length > 80 ? "…" : ""}
        </div>
      )}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DeckEditorProps {
  /** Raw deck value from DeckPicker (may be an ID or a curiosa.io URL). */
  deckValue: string;
  accentColor: "amber" | "sky";
  /** Called with edited data when the user modifies anything; null when reset. */
  onOverride: (override: DeckOverride | null) => void;
}

export function DeckEditor({ deckValue, accentColor, onOverride }: DeckEditorProps) {
  const accent =
    accentColor === "amber"
      ? {
          borderOpen: "border-amber-800/40",
          bgOpen: "bg-amber-950/10",
          text: "text-amber-400",
          badge: "bg-amber-900/30 text-amber-300 border-amber-800/40",
        }
      : {
          borderOpen: "border-sky-800/40",
          bgOpen: "bg-sky-950/10",
          text: "text-sky-400",
          badge: "bg-sky-900/30 text-sky-300 border-sky-800/40",
        };

  const deckId = extractId(deckValue);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [originalData, setOriginalData] = useState<FullDeckData | null>(null);

  // Editable state
  const [editedList, setEditedList] = useState<ApiDeckCard[]>([]);
  const [editedAvatar, setEditedAvatar] = useState<ApiDeckCard | null>(null);
  const [isModified, setIsModified] = useState(false);

  // "Add card" search
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<Card[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const addTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset everything when the deck changes
  useEffect(() => {
    setOpen(false);
    setOriginalData(null);
    setEditedList([]);
    setEditedAvatar(null);
    setIsModified(false);
    setAddQuery("");
    setAddResults([]);
    onOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Fetch deck data the first time the panel is opened
  useEffect(() => {
    if (!open || originalData || loading || !deckId) return;
    setLoading(true);
    fetch(`/api/decks/${deckId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FullDeckData>;
      })
      .then((data) => {
        setOriginalData(data);
        setEditedList(data.decklist ?? []);
        setEditedAvatar(data.avatar ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, deckId, originalData, loading]);

  // Debounced card search
  useEffect(() => {
    if (addTimerRef.current) clearTimeout(addTimerRef.current);
    if (!addQuery.trim()) { setAddResults([]); return; }
    addTimerRef.current = setTimeout(async () => {
      setAddLoading(true);
      try {
        const res = await fetch(
          `/api/cards/search?q=${encodeURIComponent(addQuery.trim())}&limit=6`
        );
        if (res.ok) setAddResults(((await res.json()) as { results: Card[] }).results);
      } catch { /* ignore */ }
      finally { setAddLoading(false); }
    }, 300);
    return () => { if (addTimerRef.current) clearTimeout(addTimerRef.current); };
  }, [addQuery]);

  // Propagate override whenever the edited list changes
  const propagate = useCallback(
    (list: ApiDeckCard[], avatar: ApiDeckCard | null, data: FullDeckData) => {
      onOverride({ decklist: list, avatar, name: data.meta?.name ?? "Custom Deck" });
    },
    [onOverride]
  );

  function updateQty(cardName: string, delta: number) {
    if (!originalData) return;
    const next = editedList
      .map((e) => (e.card.name === cardName ? { ...e, quantity: e.quantity + delta } : e))
      .filter((e) => e.quantity > 0);
    setEditedList(next);
    setIsModified(true);
    propagate(next, editedAvatar, originalData);
  }

  function removeCard(cardName: string) {
    if (!originalData) return;
    const next = editedList.filter((e) => e.card.name !== cardName);
    setEditedList(next);
    setIsModified(true);
    propagate(next, editedAvatar, originalData);
  }

  function addCard(card: Card) {
    if (!originalData) return;
    const existing = editedList.find((e) => e.card.name === card.name);
    const next = existing
      ? editedList.map((e) =>
          e.card.name === card.name ? { ...e, quantity: e.quantity + 1 } : e
        )
      : [...editedList, { quantity: 1, card: cardToApiCard(card) }];
    setEditedList(next);
    setIsModified(true);
    propagate(next, editedAvatar, originalData);
    setAddQuery("");
    setAddResults([]);
  }

  function reset() {
    if (!originalData) return;
    setEditedList(originalData.decklist);
    setEditedAvatar(originalData.avatar);
    setIsModified(false);
    onOverride(null);
  }

  // ── Grouped display ────────────────────────────────────────────────────────

  const byType = new Map<string, ApiDeckCard[]>();
  for (const entry of editedList) {
    const t = entry.card.type ?? "Other";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(entry);
  }
  const total = editedList.reduce((s, e) => s + e.quantity, 0);
  const otherTypes = [...byType.keys()].filter((t) => !TYPE_ORDER.includes(t));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`border rounded-lg transition-colors ${
        open
          ? `${accent.borderOpen} ${accent.bgOpen}`
          : "border-gray-800/60"
      }`}
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-800/30 transition-colors rounded-lg"
      >
        <span className={`font-medium ${open ? accent.text : "text-gray-600"}`}>
          {open ? "▲" : "▼"}&nbsp;
          {isModified ? "✏ Deck modified" : "Show / edit deck list"}
        </span>
        {isModified && (
          <span className={`text-xs px-2 py-0.5 rounded border ${accent.badge}`}>
            {total} cards
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-gray-800/50 p-4 flex flex-col gap-4">
          {loading && (
            <p className="text-gray-500 text-sm text-center py-4">Loading deck…</p>
          )}

          {!loading && !originalData && (
            <p className="text-gray-600 text-sm text-center py-4">No deck data found.</p>
          )}

          {!loading && originalData && (
            <>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold text-white">
                    {originalData.meta?.name ?? "Deck"}
                  </span>
                  <span className="text-gray-500 ml-2">— {total} cards</span>
                  {isModified && (
                    <span className={`ml-2 text-xs font-medium ${accent.text}`}>
                      (modified)
                    </span>
                  )}
                </div>
                {isModified && (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-gray-500 hover:text-white underline transition-colors"
                  >
                    Reset to original
                  </button>
                )}
              </div>

              {/* Avatar */}
              {editedAvatar && (
                <div className="px-3 py-2 bg-amber-900/20 border border-amber-800/30 rounded text-sm text-amber-300">
                  Avatar: {editedAvatar.card.name}
                </div>
              )}

              {/* Card list — scrollable so "Add card" stays visible */}
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {[...TYPE_ORDER, ...otherTypes].map((t) => {
                  const group = byType.get(t);
                  if (!group?.length) return null;
                  const uniqueCount = group.length;
                  const totalQty = group.reduce((s, e) => s + e.quantity, 0);
                  const sorted = [...group].sort((a, b) =>
                    a.card.name.localeCompare(b.card.name)
                  );
                  return (
                    <div key={t}>
                      <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                        {t}s&nbsp;
                        <span className="text-gray-700 font-normal normal-case">
                          ({uniqueCount} unique · {totalQty} total)
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {sorted.map((entry) => (
                          <div
                            key={entry.card.name}
                            className="flex items-center gap-2 py-0.5"
                          >
                            {/* − button */}
                            <button
                              type="button"
                              onClick={() => updateQty(entry.card.name, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs transition-colors shrink-0"
                              title="Decrease quantity"
                            >
                              −
                            </button>
                            {/* Qty */}
                            <span className="text-amber-500 font-mono w-4 text-center text-sm shrink-0">
                              {entry.quantity}
                            </span>
                            {/* + button */}
                            <button
                              type="button"
                              onClick={() => updateQty(entry.card.name, +1)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs transition-colors shrink-0"
                              title="Increase quantity"
                            >
                              +
                            </button>
                            {/* Name */}
                            <span className="flex-1 text-sm text-gray-300 truncate">
                              {entry.card.name}
                            </span>
                            {/* Stats */}
                            {entry.card.attack != null && (
                              <span className="text-xs text-gray-600 font-mono shrink-0">
                                {entry.card.attack}/{entry.card.defense}
                              </span>
                            )}
                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => removeCard(entry.card.name)}
                              className="text-gray-700 hover:text-red-400 text-xs transition-colors shrink-0 ml-0.5"
                              title="Remove card"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add card search */}
              <div className="border-t border-gray-800/50 pt-3">
                <p className="text-xs text-gray-500 font-medium mb-1.5">Add a card</p>
                <div className="relative">
                <input
                  type="text"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Search by card name…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                    placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-colors"
                />
                {(addLoading || addResults.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/60 overflow-y-auto max-h-80 z-50">
                    {addLoading && (
                      <div className="text-xs text-gray-500 px-4 py-3">Searching…</div>
                    )}
                    {addResults.map((card) => (
                      <CardSearchResult
                        key={card.name}
                        card={card}
                        onAdd={() => addCard(card)}
                      />
                    ))}
                  </div>
                )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

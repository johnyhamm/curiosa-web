"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Card } from "@/lib/cards";
import type { CollectionMap } from "@/lib/collection";
import { cardImageUrl } from "@/lib/card-images";
import { useAuthSafe } from "@/lib/useAuthSafe";

// ─── CSV import parser ────────────────────────────────────────────────────────

/** Minimal RFC 4180-compliant CSV parser — handles quoted fields with commas/newlines. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      fields.push(field);
      if (line[i] === ",") i++; // skip separator
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

interface ImportCard { cardName: string; qty: number; foilQty: number; }

function parseCsv(text: string): ImportCard[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const map = new Map<string, ImportCard>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (i === 0) continue; // skip header

    const rawName = (fields[0] ?? "").trim();
    const finish  = (fields[2] ?? "").trim();  // "Standard" or "Foil"
    const qty     = parseInt(fields[4] ?? "0", 10);

    if (!rawName || isNaN(qty) || qty <= 0) continue;

    const key = rawName.toLowerCase();
    const existing = map.get(key) ?? { cardName: rawName, qty: 0, foilQty: 0 };

    if (finish.toLowerCase() === "foil") {
      existing.foilQty += qty;
    } else {
      existing.qty += qty;
    }
    map.set(key, existing);
  }

  return Array.from(map.values());
}

// ─── Card display constants ───────────────────────────────────────────────────

const CARD_W   = 150;
const CARD_H   = Math.round(CARD_W * (88 / 63));   // ≈ 210 — portrait
const SITE_H   = Math.round(CARD_W * (63 / 88));   // ≈ 107 — landscape container
const SITE_IW  = SITE_H;                            // inner portrait element width
const SITE_IH  = CARD_W;                            // inner portrait element height

// 2× hover preview
const HOVER_W      = CARD_W * 2;                     // 300
const HOVER_H      = Math.round(CARD_H * 2);          // ≈ 420
const HOVER_SITE_H = Math.round(SITE_H * 2);          // ≈ 214
const HOVER_SITE_IW = HOVER_SITE_H;                   // inner portrait width for hover site
const HOVER_SITE_IH = HOVER_W;                        // inner portrait height for hover site

const PAGE_SIZE = 20;

// ─── Filter options (matching curiosa.io style) ───────────────────────────────

const ELEMENTS = ["Water", "Earth", "Fire", "Air"];
const TYPES    = ["Avatar", "Site", "Minion", "Magic", "Artifact", "Aura"];
const RARITIES = ["Ordinary", "Exceptional", "Elite", "Unique"];
const SETS     = ["Alpha", "Beta", "Arthurian Legends", "Dragonlord", "Gothic", "Promotional"];
const SORTS    = [
  { value: "name-asc",    label: "Name A → Z" },
  { value: "name-desc",   label: "Name Z → A" },
  { value: "cost-asc",    label: "Cost ↑" },
  { value: "cost-desc",   label: "Cost ↓" },
  { value: "rarity-asc",  label: "Rarity ↑" },
  { value: "rarity-desc", label: "Rarity ↓" },
];

// ─── Element colour chips ─────────────────────────────────────────────────────

const EL_COLOUR: Record<string, string> = {
  Water: "bg-sky-900/50 text-sky-400 border-sky-700/40",
  Earth: "bg-yellow-900/40 text-yellow-500 border-yellow-700/40",
  Fire:  "bg-orange-900/40 text-orange-400 border-orange-700/40",
  Air:   "bg-violet-900/40 text-violet-400 border-violet-700/40",
};

const RARITY_COLOUR: Record<string, string> = {
  ordinary:    "text-gray-400",
  exceptional: "text-green-400",
  elite:       "text-sky-400",
  unique:      "text-amber-400",
};

// ─── Pill chip toggle ─────────────────────────────────────────────────────────

function Chip({
  label, active, colour, onClick,
}: { label: string; active: boolean; colour?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? colour ?? "bg-amber-500/20 text-amber-400 border-amber-500/50"
          : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Card image (parameterised width) ────────────────────────────────────────

function CardImage({ card, w = CARD_W }: { card: Card; w?: number }) {
  // Request at least w400 (full original quality); display size may be smaller
  const imgUrl = cardImageUrl(card.name, Math.max(400, w * 2));
  const isSite = card.guardian.type === "Site";
  const [failed, setFailed] = useState(false);

  // Derived dimensions
  const h   = Math.round(w * (88 / 63));   // portrait height
  const sh  = Math.round(w * (63 / 88));   // landscape container height
  const siw = sh;                           // inner portrait element width
  const sih = w;                            // inner portrait element height

  if (!imgUrl || failed) {
    return (
      <div
        className="bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs text-center px-2"
        style={{ width: w, height: isSite ? sh : h }}
      >
        No image
      </div>
    );
  }

  if (isSite) {
    return (
      <div
        className="relative overflow-hidden rounded-lg shadow-md shadow-black/40"
        style={{ width: w, height: sh }}
      >
        <img
          src={imgUrl}
          alt={card.name}
          onError={() => setFailed(true)}
          loading="lazy"
          style={{
            position: "absolute",
            left: "50%", top: "50%",
            width: siw, height: sih,
            maxWidth: "none",
            objectFit: "cover",
            transform: `translate(${-siw / 2}px, ${-sih / 2}px) rotate(90deg)`,
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt={card.name}
      onError={() => setFailed(true)}
      loading="lazy"
      className="rounded-lg shadow-md shadow-black/40 block"
      style={{ width: w, height: h, objectFit: "cover" }}
    />
  );
}

// ─── Hover preview (docked to right margin, 2× thumbnail size) ───────────────

function HoverPreview({ card }: { card: Card }) {
  const imgUrl = cardImageUrl(card.name);
  const isSite = card.guardian.type === "Site";
  const [failed, setFailed] = useState(false);

  if (!imgUrl || failed) return null;

  return (
    <div
      className="hidden sm:block fixed pointer-events-none z-[100]"
      style={{
        right: 24,
        top: "50%",
        transform: "translateY(-50%)",
        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.9))",
      }}
    >
      {isSite ? (
        <div
          className="relative overflow-hidden rounded-xl ring-2 ring-amber-500/30"
          style={{ width: HOVER_W, height: HOVER_SITE_H }}
        >
          <img
            src={imgUrl}
            alt={card.name}
            onError={() => setFailed(true)}
            style={{
              position: "absolute",
              left: "50%", top: "50%",
              width: HOVER_SITE_IW, height: HOVER_SITE_IH,
              maxWidth: "none",
              objectFit: "cover",
              transform: `translate(${-HOVER_SITE_IW / 2}px, ${-HOVER_SITE_IH / 2}px) rotate(90deg)`,
            }}
          />
        </div>
      ) : (
        <img
          src={imgUrl}
          alt={card.name}
          onError={() => setFailed(true)}
          className="rounded-xl block ring-2 ring-amber-500/30"
          style={{ width: HOVER_W, height: HOVER_H, objectFit: "cover" }}
        />
      )}
    </div>
  );
}

// ─── Browse preview (inline panel, same 2× size, no fixed positioning) ───────

function BrowsePreview({ card }: { card: Card }) {
  const imgUrl = cardImageUrl(card.name);
  const isSite = card.guardian.type === "Site";
  const [failed, setFailed] = useState(false);

  if (!imgUrl || failed) return null;

  return (
    <div style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.85))" }}>
      {isSite ? (
        <div
          className="relative overflow-hidden rounded-xl ring-2 ring-amber-500/20"
          style={{ width: HOVER_W, height: HOVER_SITE_H }}
        >
          <img
            src={imgUrl}
            alt={card.name}
            onError={() => setFailed(true)}
            style={{
              position: "absolute",
              left: "50%", top: "50%",
              width: HOVER_SITE_IW, height: HOVER_SITE_IH,
              maxWidth: "none",
              objectFit: "cover",
              transform: `translate(${-HOVER_SITE_IW / 2}px, ${-HOVER_SITE_IH / 2}px) rotate(90deg)`,
            }}
          />
        </div>
      ) : (
        <img
          src={imgUrl}
          alt={card.name}
          onError={() => setFailed(true)}
          className="rounded-xl block ring-2 ring-amber-500/20"
          style={{ width: HOVER_W, height: HOVER_H, objectFit: "cover" }}
        />
      )}
    </div>
  );
}

// ─── Card tile ────────────────────────────────────────────────────────────────

const MOBILE_W = 120; // card image width in mobile horizontal layout

function CardTile({
  card, qty, onQtyChange,
  onHoverStart, onHoverEnd,
}: {
  card: Card;
  qty: number;
  onQtyChange: (name: string, n: number) => void;
  onHoverStart?: (card: Card) => void;
  onHoverEnd?:   () => void;
}) {
  const rarity = card.guardian.rarity?.toLowerCase() ?? "";
  return (
    // Mobile: horizontal row (image left, info right), full width
    // Desktop: vertical column (image top, info below), fixed width
    <div
      className="flex flex-row items-start gap-3 w-full
                 sm:flex-col sm:items-center sm:gap-2 sm:w-auto"
      onMouseEnter={() => onHoverStart?.(card)}
      onMouseLeave={() => onHoverEnd?.()}
    >
      {/* Image + qty badge */}
      <div className="relative shrink-0">
        {/* Mobile size */}
        <div className="sm:hidden">
          <CardImage card={card} w={MOBILE_W} />
        </div>
        {/* Desktop size */}
        <div className="hidden sm:block">
          <CardImage card={card} w={CARD_W} />
        </div>
        {qty > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-amber-500 text-gray-950 text-xs font-black px-1.5 py-0.5 rounded-full shadow-lg leading-none">
            ×{qty}
          </div>
        )}
      </div>

      {/* Name, type hint (mobile only), rarity, qty controls */}
      <div className="flex-1 flex flex-col gap-2 sm:items-center sm:w-[150px]">
        <div>
          {/* Larger text on mobile */}
          <div className="text-sm sm:text-xs text-gray-200 font-semibold leading-snug sm:text-center sm:line-clamp-2" title={card.name}>
            {card.name}
          </div>
          {/* Type + element shown on mobile for context */}
          <div className="text-xs text-gray-500 mt-0.5 sm:hidden">
            {card.guardian.type}{card.elements ? ` · ${card.elements}` : ""}
          </div>
          {rarity && (
            <div className={`text-xs mt-0.5 sm:text-center ${RARITY_COLOUR[rarity] ?? "text-gray-500"}`}>
              {card.guardian.rarity}
            </div>
          )}
        </div>

        {/* Qty controls — bigger touch targets on mobile */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQtyChange(card.name, Math.max(0, qty - 1))}
            disabled={qty === 0}
            className="w-9 h-9 sm:w-7 sm:h-7 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-white font-bold transition-colors flex items-center justify-center text-base sm:text-sm"
          >−</button>
          <span className="w-6 text-center text-base sm:text-sm font-mono font-semibold text-white tabular-nums">{qty}</span>
          <button
            onClick={() => onQtyChange(card.name, qty + 1)}
            className="w-9 h-9 sm:w-7 sm:h-7 rounded-md bg-gray-800 hover:bg-gray-700 text-white font-bold transition-colors flex items-center justify-center text-base sm:text-sm"
          >+</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "mine" | "browse";

interface SearchResult { results: Card[]; total: number; }

export default function CollectionPage() {
  const { isSignedIn, isLoaded } = useAuthSafe();

  const [tab, setTab]               = useState<Tab>("mine");
  const [collection, setCollection] = useState<CollectionMap>({});
  const [colLoading, setColLoading] = useState(true);

  // Full card DB — loaded once from /cards-data.json, used for both "My Collection"
  // display and the collection browse. Replaces per-request batch fetches so that
  // collections with hundreds of unique cards display correctly.
  const [allCardData, setAllCardData]       = useState<Card[]>([]);
  const [allCardsLoading, setAllCardsLoading] = useState(true);

  // Browse tab — filter state
  const [query, setQuery]               = useState("");
  const [elements, setElements]         = useState<string[]>([]);
  const [types, setTypes]               = useState<string[]>([]);
  const [rarities, setRarities]         = useState<string[]>([]);
  const [set, setSet]                   = useState("");
  const [sort, setSort]                 = useState("name-asc");
  const [ownedOnly, setOwnedOnly]       = useState(false);

  // Browse tab — pagination + results
  const [browseCards, setBrowseCards]   = useState<Card[]>([]);
  const [browseTotal, setBrowseTotal]   = useState(0);
  const [page, setPage]                 = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Hover preview
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

  // Import / export
  const [exportMissing, setExportMissing] = useState(false);
  const [importing, setImporting]         = useState(false);
  const [importMsg, setImportMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Delete entire collection
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]                   = useState(false);

  const searchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer      = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Tracks qty values that have been changed locally but not yet persisted to Redis.
  // Flushed immediately via sendBeacon on page unload so mobile navigations don't lose data.
  const pendingWrites  = useRef<Map<string, { cardName: string; qty: number }>>(new Map());

  // ── Load collection ──────────────────────────────────────────────────────

  const loadCollection = useCallback(async () => {
    setColLoading(true);
    try {
      const res = await fetch("/api/collection");
      if (res.ok) {
        const data = (await res.json()) as { collection: CollectionMap };
        console.log("[Collection] Loaded", Object.keys(data.collection).length, "cards from server");
        setCollection(data.collection);
      } else {
        console.error("[Collection] Load failed", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[Collection] Load error", err);
    } finally { setColLoading(false); }
  }, []);

  useEffect(() => {
    if (isSignedIn) loadCollection();
    else setColLoading(false);
  }, [isSignedIn, loadCollection]);

  // ── Export collection (or missing cards) ─────────────────────────────────

  const handleExport = useCallback(async (missing: boolean) => {
    const url = `/api/collection/export${missing ? "?missing=true" : ""}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const cd   = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? (missing ? "missing-cards.csv" : "my-collection.csv");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  // ── Import collection from CSV ────────────────────────────────────────────

  const handleImportFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportMsg(null);
    try {
      const text  = await file.text();
      const cards = parseCsv(text);

      if (cards.length === 0) {
        setImportMsg({ type: "err", text: "No valid cards found in the CSV." });
        return;
      }

      // Chunk into batches of 500 (bulk API limit per request)
      const CHUNK = 500;
      let imported = 0;
      for (let i = 0; i < cards.length; i += CHUNK) {
        const batch = cards.slice(i, i + CHUNK);
        const res = await fetch("/api/collection/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cards: batch }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          setImportMsg({ type: "err", text: `Import failed: ${body || res.status}` });
          return;
        }
        imported += batch.length;
      }

      // Reload collection so UI reflects the new data
      await loadCollection();
      setImportMsg({ type: "ok", text: `Imported ${imported} card${imported !== 1 ? "s" : ""} successfully.` });
    } catch (err) {
      setImportMsg({ type: "err", text: `Import error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setImporting(false);
      // Clear the file input so the same file can be re-selected
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [loadCollection]);

  // ── Load full card DB once ───────────────────────────────────────────────
  // cards-data.json is bundled in /public and served as a static file (brotli
  // compressed to ~250 KB). Loading it once eliminates the 200-card batch limit
  // and means qty changes never require a network round-trip.

  useEffect(() => {
    fetch("/cards-data.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((cards: Card[]) => setAllCardData(cards))
      .catch(() => setAllCardData([]))
      .finally(() => setAllCardsLoading(false));
  }, []);

  // ── Derive owned cards from collection + card DB ─────────────────────────
  // Pure computation — no loading state, no network call. Updates instantly
  // when qty changes.

  const ownedCards = useMemo(() => {
    if (allCardData.length === 0) return [];
    const ownedKeys = new Set(
      Object.values(collection)
        .filter((e) => e.qty > 0)
        .map((e) => e.cardName),
    );
    return allCardData
      .filter((c) => ownedKeys.has(c.name.toLowerCase().trim()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCardData, collection]);

  const missingCards = useMemo(() => {
    if (allCardData.length === 0) return [];
    const ownedKeys = new Set(
      Object.values(collection)
        .filter((e) => e.qty > 0)
        .map((e) => e.cardName),
    );
    return allCardData
      .filter((c) => !ownedKeys.has(c.name.toLowerCase().trim()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCardData, collection]);

  // ── Delete entire collection ──────────────────────────────────────────────

  const handleDeleteAll = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/collection/all", { method: "DELETE" });
      if (res.ok) {
        setCollection({});          // ownedCards auto-empties via useMemo
        setShowDeleteConfirm(false);
      }
    } finally {
      setDeleting(false);
    }
  }, []);

  // ── Browse: fetch page ───────────────────────────────────────────────────

  const fetchBrowsePage = useCallback(async (pageNum: number) => {
    setBrowseLoading(true);
    try {
      const p = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE),
        sort,
      });
      if (query)           p.set("q", query);
      if (elements.length === 1) p.set("element", elements[0]);
      if (types.length === 1)    p.set("type", types[0]);
      if (rarities.length === 1) p.set("rarity", rarities[0]);
      if (set)             p.set("set", set);

      const res = await fetch(`/api/cards/search?${p}`);
      if (!res.ok) return;
      const data = (await res.json()) as SearchResult;

      // Client-side filter for multi-select and owned-only
      let cards = data.results;
      if (elements.length > 1) {
        cards = cards.filter((c) =>
          elements.every((el) => c.elements.toLowerCase().includes(el.toLowerCase()))
        );
      }
      if (types.length > 1) {
        cards = cards.filter((c) =>
          types.some((t) => c.guardian.type.toLowerCase().includes(t.toLowerCase()))
        );
      }
      if (rarities.length > 1) {
        cards = cards.filter((c) =>
          rarities.some((r) => (c.guardian.rarity ?? "").toLowerCase() === r.toLowerCase())
        );
      }
      if (ownedOnly) {
        cards = cards.filter((c) => (collection[c.name.trim().toLowerCase()]?.qty ?? 0) > 0);
      }

      setBrowseCards(cards);
      setBrowseTotal(data.total);
    } catch { /* ignore */ }
    finally { setBrowseLoading(false); }
  }, [query, elements, types, rarities, set, sort, ownedOnly, collection]);

  // Reset to page 0 and refetch when filters change
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(0);
      fetchBrowsePage(0);
    }, query ? 300 : 0);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, elements, types, rarities, set, sort, ownedOnly]);

  // Fetch when page changes
  useEffect(() => {
    if (tab === "browse") fetchBrowsePage(page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Trigger initial browse load when switching to browse tab
  useEffect(() => {
    if (tab === "browse") fetchBrowsePage(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Flush pending writes on page unload (mobile navigation safety) ──────
  // sendBeacon is fire-and-forget but guaranteed to complete even if the page
  // is closed or the user navigates away, unlike setTimeout + fetch.

  useEffect(() => {
    function flushOnUnload() {
      if (pendingWrites.current.size === 0) return;
      // Cancel pending debounce timers — sendBeacon handles them now.
      for (const timer of saveTimer.current.values()) clearTimeout(timer);
      saveTimer.current.clear();
      const cards = Array.from(pendingWrites.current.values());
      pendingWrites.current.clear();
      const blob = new Blob([JSON.stringify({ cards })], { type: "application/json" });
      navigator.sendBeacon("/api/collection/bulk", blob);
    }
    window.addEventListener("beforeunload", flushOnUnload);
    // Also flush when the React component unmounts (e.g. client-side navigation).
    return () => {
      window.removeEventListener("beforeunload", flushOnUnload);
      flushOnUnload();
    };
  }, []);

  // ── Quantity change ──────────────────────────────────────────────────────

  const handleQtyChange = useCallback((cardName: string, newQty: number) => {
    const key = cardName.trim().toLowerCase();
    // Track as pending immediately so flushOnUnload can pick it up.
    pendingWrites.current.set(key, { cardName, qty: newQty });
    setCollection((prev) => {
      const next = { ...prev };
      if (newQty <= 0) { delete next[key]; }
      else { next[key] = { cardName: key, qty: newQty, foilQty: prev[key]?.foilQty ?? 0, updatedAt: new Date().toISOString() }; }
      return next;
    });
    const existing = saveTimer.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      saveTimer.current.delete(key);
      pendingWrites.current.delete(key); // Remove once persisted.
      try {
        const res = await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardName, qty: newQty }),
          keepalive: true, // Continue request even if page is closed mid-flight.
        });
        if (res.ok) {
          console.log("[Collection] Saved", cardName, "qty:", newQty);
        } else {
          const body = await res.text().catch(() => "");
          console.error("[Collection] Save failed", res.status, body, "—", cardName, "qty:", newQty);
        }
      } catch (err) {
        console.error("[Collection] Save error", err, "—", cardName, "qty:", newQty);
      }
    }, 600);
    saveTimer.current.set(key, t);
  }, []);

  // ── Toggle helpers ───────────────────────────────────────────────────────

  function toggleEl(el: string) {
    setElements((prev) => prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]);
  }
  function toggleType(t: string) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }
  function toggleRarity(r: string) {
    setRarities((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  const ownedEntries = Object.values(collection).filter((e) => e.qty > 0);
  const totalCopies  = ownedEntries.reduce((s, e) => s + e.qty, 0);
  const totalPages   = Math.ceil(browseTotal / PAGE_SIZE);

  // ── Not signed in ────────────────────────────────────────────────────────

  if (isLoaded && !isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-amber-400 mb-4" style={{ fontFamily: "var(--font-cinzel)" }}>
          My Collection
        </h1>
        <p className="text-gray-400">Sign in to track your Sorcery card collection.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-amber-400 mb-2" style={{ fontFamily: "var(--font-cinzel)" }}>
        My Collection
      </h1>
      <p className="text-gray-400 text-sm mb-6">
        Track the cards you own. Use the Deck Builder toggle to filter by your collection.
      </p>

      {/* Stats + Import/Export toolbar */}
      {!colLoading && !allCardsLoading && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
          {/* Stats */}
          <div className="flex gap-6">
            <div>
              <span className="text-2xl font-bold text-amber-400">{ownedEntries.length}</span>
              <span className="text-gray-500 text-sm ml-1.5">unique cards</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-amber-400">{totalCopies}</span>
              <span className="text-gray-500 text-sm ml-1.5">total copies</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-gray-500">{missingCards.length}</span>
              <span className="text-gray-600 text-sm ml-1.5">not collected</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 hidden sm:block" />

          {/* Import / Export controls — only shown when signed in */}
          {isSignedIn && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Hidden file input for CSV import */}
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                }}
              />

              {/* Import button */}
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white text-xs font-medium transition-colors"
                title="Import a curiosa.io-format CSV file"
              >
                {importing ? (
                  <>
                    <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import CSV
                  </>
                )}
              </button>

              {/* Export button */}
              <button
                onClick={() => handleExport(exportMissing)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors"
                title={exportMissing ? "Download cards not yet in your collection" : "Download your collection as CSV"}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exportMissing ? "Export Not Collected" : "Export CSV"}
              </button>

              {/* Not collected toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none" title="When checked, shows and exports cards not yet in your collection">
                <div
                  onClick={() => setExportMissing((v) => !v)}
                  className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${exportMissing ? "bg-amber-500" : "bg-gray-600"}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${exportMissing ? "left-4" : "left-0.5"}`} />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">Not collected</span>
              </label>

              {/* Divider */}
              <div className="w-px h-5 bg-gray-700 mx-1 hidden sm:block" />

              {/* Delete collection button */}
              <button
                onClick={() => { setShowDeleteConfirm(true); setImportMsg(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/60 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                title="Delete your entire collection"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import status message */}
      {importMsg && (
        <div className={`flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg border text-sm ${
          importMsg.type === "ok"
            ? "bg-green-900/30 border-green-700/50 text-green-400"
            : "bg-red-900/30 border-red-700/50 text-red-400"
        }`}>
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* Delete confirmation banner */}
      {showDeleteConfirm && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg border border-red-700/60 bg-red-900/25 text-sm">
          <div>
            <p className="text-red-300 font-semibold">Are you sure you want to delete your entire collection?</p>
            <p className="text-red-400/70 text-xs mt-0.5">
              This will permanently remove all {ownedEntries.length} unique card{ownedEntries.length !== 1 ? "s" : ""} ({totalCopies} cop{totalCopies !== 1 ? "ies" : "y"}) and cannot be undone.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {(["mine", "browse"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
            }`}>
            {t === "mine" ? "My Collection" : "Browse & Add"}
          </button>
        ))}
      </div>

      {/* ══ MY COLLECTION ══ */}
      {tab === "mine" && (
        colLoading || allCardsLoading
          ? <div className="py-16 text-center text-gray-600 text-sm">Loading…</div>
          : exportMissing
            ? missingCards.length === 0
              ? (
                <div className="py-16 text-center text-gray-600 text-sm">
                  🎉 You have every card in the set!
                </div>
              )
              : (
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-5">
                  {missingCards.map((card) => (
                    <CardTile
                      key={card.name}
                      card={card}
                      qty={0}
                      onQtyChange={handleQtyChange}
                      onHoverStart={(c) => setHoveredCard(c)}
                      onHoverEnd={() => setHoveredCard(null)}
                    />
                  ))}
                </div>
              )
            : ownedCards.length === 0
              ? (
                <div className="py-16 text-center text-gray-600 text-sm">
                  No cards yet —{" "}
                  <button onClick={() => setTab("browse")} className="text-amber-400 hover:underline">
                    Browse & Add
                  </button>
                </div>
              )
              : (
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-5">
                  {ownedCards.map((card) => (
                    <CardTile
                      key={card.name}
                      card={card}
                      qty={collection[card.name.trim().toLowerCase()]?.qty ?? 0}
                      onQtyChange={handleQtyChange}
                      onHoverStart={(c) => setHoveredCard(c)}
                      onHoverEnd={() => setHoveredCard(null)}
                    />
                  ))}
                </div>
              )
      )}

      {/* ── Fixed hover preview — My Collection tab only ── */}
      {tab === "mine" && hoveredCard && (
        <HoverPreview card={hoveredCard} />
      )}

      {/* ══ BROWSE & ADD ══ */}
      {tab === "browse" && (
        <div className="flex flex-col gap-6">

          {/* ── Top row: narrow filters sidebar + preview panel ── */}
          <div className="flex gap-5 items-start">

            {/* Filters sidebar — full width on mobile, fixed 288px on desktop */}
            <div className="flex-1 sm:flex-none sm:w-72 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-4">

              {/* Search */}
              <input
                type="text"
                placeholder="Search card name or text…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500"
              >
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              {/* Element chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Element</div>
                <div className="flex flex-wrap gap-2">
                  {ELEMENTS.map((el) => (
                    <Chip key={el} label={el} active={elements.includes(el)} colour={EL_COLOUR[el]} onClick={() => toggleEl(el)} />
                  ))}
                </div>
              </div>

              {/* Type chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Type</div>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <Chip key={t} label={t} active={types.includes(t)} onClick={() => toggleType(t)} />
                  ))}
                </div>
              </div>

              {/* Rarity chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Rarity</div>
                <div className="flex flex-wrap gap-2">
                  {RARITIES.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      active={rarities.includes(r)}
                      colour={`bg-gray-800 border ${
                        r === "Unique"      ? "text-amber-400 border-amber-500/50 bg-amber-500/10" :
                        r === "Elite"       ? "text-sky-400 border-sky-500/50 bg-sky-500/10" :
                        r === "Exceptional" ? "text-green-400 border-green-500/50 bg-green-500/10" :
                        "text-gray-300 border-gray-500"
                      }`}
                      onClick={() => toggleRarity(r)}
                    />
                  ))}
                </div>
              </div>

              {/* Set chips */}
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Set</div>
                <div className="flex flex-wrap gap-2">
                  {SETS.map((s) => (
                    <Chip key={s} label={s} active={set === s} onClick={() => setSet((prev) => prev === s ? "" : s)} />
                  ))}
                </div>
              </div>

              {/* Owned only toggle */}
              {isSignedIn && (
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Show</div>
                  <button
                    onClick={() => setOwnedOnly((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      ownedOnly
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className={`w-8 h-4 rounded-full transition-colors relative ${ownedOnly ? "bg-amber-500" : "bg-gray-600"}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${ownedOnly ? "left-4" : "left-0.5"}`} />
                    </span>
                    Owned only
                  </button>
                </div>
              )}

              {/* Active filter summary + clear */}
              {(elements.length > 0 || types.length > 0 || rarities.length > 0 || set || query) && (
                <div className="flex items-center justify-between border-t border-gray-800 pt-3">
                  <span className="text-xs text-gray-500">
                    {browseTotal} card{browseTotal !== 1 ? "s" : ""} match
                  </span>
                  <button
                    onClick={() => { setQuery(""); setElements([]); setTypes([]); setRarities([]); setSet(""); }}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Card preview panel — hidden on mobile, shown on desktop */}
            <div
              className="hidden sm:flex flex-1 items-center justify-center bg-gray-900/40 border border-gray-800 rounded-xl"
              style={{ minHeight: HOVER_H + 48 }}
            >
              {hoveredCard
                ? <BrowsePreview card={hoveredCard} />
                : <span className="text-gray-700 text-sm">Hover a card below to preview</span>
              }
            </div>

          </div>

          {/* ── Results grid ── */}
          {browseLoading ? (
            <div className="py-12 text-center text-gray-600 text-sm">Loading…</div>
          ) : browseCards.length === 0 ? (
            <div className="py-12 text-center text-gray-600 text-sm">No cards found.</div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-5">
              {browseCards.map((card) => (
                <CardTile
                  key={card.name}
                  card={card}
                  qty={collection[card.name.trim().toLowerCase()]?.qty ?? 0}
                  onQtyChange={handleQtyChange}
                  onHoverStart={(c) => setHoveredCard(c)}
                  onHoverEnd={() => setHoveredCard(null)}
                />
              ))}
            </div>
          )}

          {/* ── Pagination ── */}
          {totalPages > 1 && !browseLoading && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white rounded-lg transition-colors"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page + 1} of {totalPages}
                <span className="text-gray-600 ml-2">({browseTotal} cards total)</span>
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white rounded-lg transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

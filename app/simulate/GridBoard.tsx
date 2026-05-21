"use client";

import type { BoardSnapshot, SquareState } from "@/lib/simulator";

// ─── Single cell ──────────────────────────────────────────────────────────────

function Cell({ sq }: { sq: SquareState }) {
  // Background: site owner or void
  const bgClass =
    sq.siteOwner === "A" ? "bg-amber-950 border-amber-800/60" :
    sq.siteOwner === "B" ? "bg-sky-950 border-sky-800/60"    :
    sq.isRubble           ? "bg-stone-900 border-stone-700/40" :
                            "bg-gray-900 border-gray-800/40";

  // Avatar ring
  const ringClass =
    sq.isAvatarA ? "ring-2 ring-amber-400/80" :
    sq.isAvatarB ? "ring-2 ring-sky-400/80"   :
                   "";

  const { minion } = sq;
  const minionColor  = minion?.owner === "A" ? "text-amber-300" : "text-sky-300";
  const tappedClass  = minion?.tapped ? "opacity-40" : "";
  const sickMark     = minion?.sick ? " 💤" : "";
  const shortName    = (name: string) => name.length > 9 ? name.slice(0, 8) + "…" : name;

  return (
    <div
      className={`relative flex flex-col items-center justify-center border rounded
        ${bgClass} ${ringClass} text-center select-none overflow-hidden`}
      style={{ minHeight: "68px" }}
    >
      {/* Site label */}
      {sq.siteName && (
        <span className={`absolute top-0.5 left-0 right-0 text-center text-[9px] leading-tight px-0.5
          ${sq.siteOwner === "A" ? "text-amber-600" : "text-sky-600"}`}>
          {sq.siteName.length > 12 ? sq.siteName.slice(0, 11) + "…" : sq.siteName}
        </span>
      )}

      {/* Avatar marker */}
      {(sq.isAvatarA || sq.isAvatarB) && (
        <span className={`text-[10px] font-bold leading-none mb-0.5
          ${sq.isAvatarA ? "text-amber-400" : "text-sky-400"}`}>
          {sq.isAvatarA ? "▲ A" : "▲ B"}
        </span>
      )}

      {/* Minion */}
      {minion && (
        <div className={`${minionColor} ${tappedClass} leading-tight px-0.5`}>
          <div className="text-[10px] font-semibold">{shortName(minion.name)}{sickMark}</div>
          <div className="text-[11px] font-mono font-bold">
            {minion.attack}/{minion.defense}
          </div>
          {minion.keywords.length > 0 && (
            <div className="text-[8px] text-gray-500">
              {minion.keywords.slice(0, 2).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Empty void label */}
      {!sq.siteName && !sq.isAvatarA && !sq.isAvatarB && !minion && (
        <span className="text-[9px] text-gray-800">void</span>
      )}
    </div>
  );
}

// ─── Column headers ───────────────────────────────────────────────────────────

function ColHeaders() {
  return (
    <div className="grid grid-cols-5 gap-1 mb-1">
      {[0, 1, 2, 3, 4].map(c => (
        <div key={c} className="text-center text-[9px] text-gray-700">{c}</div>
      ))}
    </div>
  );
}

// ─── Row label ────────────────────────────────────────────────────────────────

function RowLabel({ row, id }: { row: number; id: "A" | "B" | null }) {
  return (
    <div className="flex items-center justify-center w-5 shrink-0">
      <span className={`text-[9px] font-mono ${
        id === "A" ? "text-amber-700" :
        id === "B" ? "text-sky-700"   :
                     "text-gray-800"
      }`}>
        {row}
      </span>
    </div>
  );
}

// ─── Avatar life bar ─────────────────────────────────────────────────────────

function LifeBar({
  name, life, maxLife, color, align,
}: {
  name: string; life: number; maxLife: number; color: "amber" | "sky"; align: "left" | "right";
}) {
  const pct = Math.min(100, Math.max(0, (life / maxLife) * 100));
  const barColor = color === "amber" ? "bg-amber-500" : "bg-sky-500";
  const textColor = color === "amber" ? "text-amber-400" : "text-sky-400";
  return (
    <div className={`flex flex-col gap-0.5 flex-1 ${align === "right" ? "items-end" : "items-start"}`}>
      <div className={`text-xs font-medium ${textColor} truncate max-w-full`}>{name}</div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`${barColor} h-full rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`text-sm font-bold ${textColor}`}>{life} life</div>
    </div>
  );
}

// ─── Full board ───────────────────────────────────────────────────────────────

interface GridBoardProps {
  snapshot: BoardSnapshot;
  avatarNameA: string;
  avatarNameB: string;
}

const ROW_OWNER: Record<number, "A" | "B" | null> = {
  0: "A", // A's back row
  1: null,
  2: null,
  3: "B", // B's back row
};

// Max life defaults (used for bar proportions)
const DEFAULT_MAX_LIFE = 20;

export function GridBoard({ snapshot, avatarNameA, avatarNameB }: GridBoardProps) {
  const maxLifeA = Math.max(DEFAULT_MAX_LIFE, snapshot.lifeA);
  const maxLifeB = Math.max(DEFAULT_MAX_LIFE, snapshot.lifeB);

  return (
    <div className="flex flex-col gap-2">
      {/* B's life bar — top */}
      <div className="flex items-center gap-3 px-6">
        <LifeBar
          name={`B · ${avatarNameB}`}
          life={snapshot.lifeB}
          maxLife={maxLifeB}
          color="sky"
          align="left"
        />
        <div className="text-xs text-gray-600 shrink-0">
          {snapshot.sitesB} sites · {snapshot.manaB} mana
        </div>
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-0.5">
        <ColHeaders />
        {/* Rows rendered top-to-bottom: row 3 at top (B's side), row 0 at bottom (A's side) */}
        {[3, 2, 1, 0].map(r => (
          <div key={r} className="flex items-stretch gap-1">
            <RowLabel row={r} id={ROW_OWNER[r]} />
            <div className="grid grid-cols-5 gap-1 flex-1">
              {snapshot.squares[r].map((sq, c) => (
                <Cell key={c} sq={sq} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* A's life bar — bottom */}
      <div className="flex items-center gap-3 px-6">
        <div className="text-xs text-gray-600 shrink-0">
          {snapshot.sitesA} sites · {snapshot.manaA} mana
        </div>
        <LifeBar
          name={`A · ${avatarNameA}`}
          life={snapshot.lifeA}
          maxLife={maxLifeA}
          color="amber"
          align="right"
        />
      </div>
    </div>
  );
}

import { loadCards } from "@/lib/cards";
import { cardImageUrl } from "@/lib/card-images";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  ordinary:    "text-gray-400",
  exceptional: "text-purple-400",
  elite:       "text-blue-400",
  unique:      "text-amber-400",
};

const ELEMENT_STYLE: Record<string, string> = {
  Fire:  "bg-red-900/40   text-red-400   border-red-700/40",
  Water: "bg-blue-900/40  text-blue-400  border-blue-700/40",
  Earth: "bg-green-900/40 text-green-400 border-green-700/40",
  Air:   "bg-sky-900/40   text-sky-400   border-sky-700/40",
};

const TH = [
  { key: "fire",  label: "F", cls: "text-red-400"   },
  { key: "water", label: "W", cls: "text-blue-400"  },
  { key: "earth", label: "E", cls: "text-green-400" },
  { key: "air",   label: "A", cls: "text-sky-400"   },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export async function CardOfTheDay() {
  const allCards = await loadCards();

  // Only cards that have artwork, sorted for a stable seed
  const withArt = allCards
    .filter((c) => cardImageUrl(c.name) !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (withArt.length === 0) return null;

  // Deterministic daily pick — changes at midnight UTC
  const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const card   = withArt[dayNum % withArt.length];
  const imgUrl = cardImageUrl(card.name, 500)!;
  const g      = card.guardian;

  const elements = card.elements
    ? card.elements.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const activeThresholds = TH.filter(
    (t) => (g.thresholds?.[t.key] ?? 0) > 0
  );

  const typeLine = [g.type, card.subTypes].filter(Boolean).join(" · ");

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });

  return (
    <section className="rounded-2xl border border-amber-700/30 bg-gray-900 overflow-hidden">
      {/* ── Header bar ── */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-800/80">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
          ✦ Card of the Day
        </span>
        <span className="text-xs text-gray-600">{dateLabel}</span>
      </div>

      {/* ── Body: image + details ── */}
      <div className="flex flex-col sm:flex-row">

        {/* Artwork */}
        <div className="sm:w-56 shrink-0 bg-gray-950 flex items-stretch">
          <img
            src={imgUrl}
            alt={card.name}
            width={224}
            height={313}
            className="w-full object-cover object-top"
            loading="eager"
          />
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-4 p-6">

          {/* Name + rarity */}
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">{card.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {g.rarity && (
                <span className={`text-xs font-medium ${RARITY_COLOR[g.rarity.toLowerCase()] ?? "text-gray-500"}`}>
                  {g.rarity}
                </span>
              )}
              <span className="text-xs text-gray-600">{typeLine}</span>
            </div>
          </div>

          {/* Element badges */}
          {elements.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {elements.map((el) => (
                <span
                  key={el}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    ELEMENT_STYLE[el] ?? "bg-gray-800 text-gray-400 border-gray-700"
                  }`}
                >
                  {el}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          {(g.attack != null || (g.life != null && g.life > 0) || g.cost != null || activeThresholds.length > 0) && (
            <div className="flex flex-wrap items-center gap-4 font-mono text-sm">
              {g.attack != null && (
                <span className="text-amber-400 font-bold">
                  {g.attack}/{g.defence}
                  <span className="text-gray-600 text-xs ml-1">ATK/DEF</span>
                </span>
              )}
              {g.life != null && g.life > 0 && (
                <span className="text-pink-400">
                  ❤ {g.life}
                  <span className="text-gray-600 text-xs ml-1">Life</span>
                </span>
              )}
              {g.cost != null && (
                <span className="text-gray-400">
                  {g.cost}
                  <span className="text-gray-600 text-xs ml-1">Cost</span>
                </span>
              )}
              {activeThresholds.length > 0 && (
                <span className="flex items-center gap-1">
                  {activeThresholds.map((t) => (
                    <span key={t.key} className={`font-bold ${t.cls}`}>
                      {t.label}{g.thresholds![t.key]}
                    </span>
                  ))}
                </span>
              )}
            </div>
          )}

          {/* Rules text */}
          {g.rulesText && (
            <div className="border-l-2 border-amber-700/40 pl-3">
              <p className="text-sm text-gray-300 leading-relaxed italic">
                {g.rulesText}
              </p>
            </div>
          )}

          {/* Sets */}
          {card.sets && card.sets.length > 0 && (
            <p className="text-xs text-gray-700">
              {card.sets.map((s) => s.name).join(" · ")}
            </p>
          )}

          {/* CTA */}
          <div className="mt-auto pt-1">
            <Link
              href={`/cards?q=${encodeURIComponent(card.name)}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-500
                hover:text-amber-400 transition-colors border border-amber-500/30 hover:border-amber-400/40
                rounded-lg px-4 py-2"
            >
              View full card details →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

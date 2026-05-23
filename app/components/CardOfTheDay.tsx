import { loadCards, type Card } from "@/lib/cards";
import { cardImageUrl } from "@/lib/card-images";

// ─── Style maps ───────────────────────────────────────────────────────────────

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

// ─── Single card panel ────────────────────────────────────────────────────────

function CardPanel({ card }: { card: Card }) {
  const imgUrl = cardImageUrl(card.name, 400)!;
  const g = card.guardian;

  const elements = card.elements
    ? card.elements.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const activeThresholds = TH.filter((t) => (g.thresholds?.[t.key] ?? 0) > 0);
  const typeLine = [g.type, card.subTypes].filter(Boolean).join(" · ");
  const hasStats =
    g.attack != null ||
    (g.life != null && g.life > 0) ||
    g.cost != null ||
    activeThresholds.length > 0;

  return (
    <div className="flex flex-col">
      {/* Artwork */}
      <div className="bg-gray-950 overflow-hidden">
        <img
          src={imgUrl}
          alt={card.name}
          width={400}
          height={560}
          className="w-full aspect-[5/7] object-cover object-top"
          loading="eager"
        />
      </div>

      {/* Details */}
      <div className="flex flex-col gap-3 p-5">
        {/* Name + rarity + type */}
        <div>
          <h3 className="text-lg font-bold text-white leading-tight">{card.name}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {g.rarity && (
              <span className={`text-xs font-medium ${RARITY_COLOR[g.rarity.toLowerCase()] ?? "text-gray-500"}`}>
                {g.rarity}
              </span>
            )}
            {typeLine && (
              <span className="text-xs text-gray-600">{typeLine}</span>
            )}
          </div>
        </div>

        {/* Elements */}
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

        {/* Stats */}
        {hasStats && (
          <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
            {g.attack != null && (
              <span className="text-amber-400 font-bold">
                {g.attack}/{g.defence}
                <span className="text-gray-600 text-xs ml-1 font-sans">ATK/DEF</span>
              </span>
            )}
            {g.life != null && g.life > 0 && (
              <span className="text-pink-400">
                ❤ {g.life}
                <span className="text-gray-600 text-xs ml-1 font-sans">Life</span>
              </span>
            )}
            {g.cost != null && (
              <span className="text-gray-400">
                {g.cost}
                <span className="text-gray-600 text-xs ml-1 font-sans">Cost</span>
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
            <p className="text-sm text-gray-300 leading-relaxed italic">{g.rulesText}</p>
          </div>
        )}

        {/* Sets */}
        {card.sets && card.sets.length > 0 && (
          <p className="text-xs text-gray-700 mt-auto">
            {card.sets.map((s) => s.name).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function CardOfTheDay() {
  const allCards = await loadCards();

  // Only cards that have artwork, sorted alphabetically for a stable seed
  const withArt = allCards
    .filter((c) => cardImageUrl(c.name) !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (withArt.length === 0) return null;

  // Two deterministic daily picks — offset by half the list for variety
  const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const half   = Math.floor(withArt.length / 2);
  const card1  = withArt[dayNum % withArt.length];
  const card2  = withArt[(dayNum + half) % withArt.length];

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });

  return (
    <section className="rounded-2xl border border-amber-700/30 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-800/80">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
          ✦ Cards of the Day
        </span>
        <span className="text-xs text-gray-600">{dateLabel}</span>
      </div>

      {/* Two cards side by side */}
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-800/80">
        <CardPanel card={card1} />
        <CardPanel card={card2} />
      </div>
    </section>
  );
}

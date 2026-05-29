import Link from "next/link";
import { Suspense } from "react";
import { CardOfTheDay } from "@/app/components/CardOfTheDay";
import { CodexTipOfTheDay } from "@/app/components/CodexTipOfTheDay";
import { NewsSection } from "@/app/components/NewsSection";
import { HomeSearch } from "@/app/components/HomeSearch";

// Regenerate at most every 60 s so the daily picks flip within a minute
// of UTC midnight rather than up to an hour late.
export const revalidate = 60;

// ── Sorcery card-frame feature widgets ───────────────────────────────────────

type CardElement = "Fire" | "Air" | "Earth" | "Water";

interface FeatureCard {
  href: string;
  title: string;
  element: CardElement;
  description: string;
  cta: string;
  stroke: string;
  artFrom: string;
  artTo: string;
}

const features: FeatureCard[] = [
  {
    href: "/deckbuilder",
    title: "Deck Builder",
    element: "Fire",
    description:
      "Build a deck from scratch and test it instantly against any public deck.",
    cta: "Build a Deck",
    stroke: "#f97316",
    artFrom: "from-orange-950",
    artTo:   "to-red-950",
  },
  {
    href: "/decks",
    title: "Deck Explorer",
    element: "Air",
    description:
      "Browse 16,000+ public decks. Filter by avatar, sort by most liked or most viewed, and inspect full decklists.",
    cta: "Browse Decks",
    stroke: "#a78bfa",
    artFrom: "from-violet-950",
    artTo:   "to-purple-950",
  },
  {
    href: "/simulate",
    title: "Match Simulator",
    element: "Earth",
    description:
      "Run Monte Carlo simulations between any two decks. Get win rates, average game length, and a full sample game log.",
    cta: "Run Simulation",
    stroke: "#d4a017",
    artFrom: "from-yellow-950",
    artTo:   "to-amber-950",
  },
  {
    href: "/cards",
    title: "Card Explorer",
    element: "Water",
    description:
      "Search and filter the full card catalogue. Browse by element, type, keywords, and set.",
    cta: "Search Cards",
    stroke: "#38bdf8",
    artFrom: "from-cyan-950",
    artTo:   "to-sky-950",
  },
];

// Elemental symbol SVGs matching the game rulebook icons
function ElementSymbol({ element, stroke }: { element: CardElement; stroke: string }) {
  const hasBar  = element === "Air" || element === "Earth";
  const pointsUp = element === "Fire" || element === "Air";

  const upPath   = "M50,4 L4,88 L96,88Z";
  const downPath = "M50,88 L4,4 L96,4Z";
  const barUp    = { x1: 22, y1: 38, x2: 78, y2: 38 };
  const barDown  = { x1: 22, y1: 54, x2: 78, y2: 54 };

  return (
    <svg
      width="120" height="112"
      viewBox="0 0 100 92"
      fill="none"
      className="absolute opacity-30"
      style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}
    >
      <path
        d={pointsUp ? upPath : downPath}
        stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {hasBar && (
        <line
          {...(pointsUp ? barUp : barDown)}
          stroke={stroke} strokeWidth="3.5" strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// Small threshold gem (top-right cost indicator)
function ThresholdGems({ color }: { color: string }) {
  return (
    <div className="flex gap-1 shrink-0">
      {[0, 1].map(i => (
        <div
          key={i}
          className="w-3.5 h-3.5 rounded-full border"
          style={{ borderColor: color, backgroundColor: color + "40" }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1
          className="text-5xl sm:text-6xl font-bold text-amber-400 mb-4"
          style={{ fontFamily: "var(--font-cinzel)", letterSpacing: "0.02em" }}
        >
          SorcerySim
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          An unofficial simulator for{" "}
          <a
            href="https://sorcerytcg.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400 transition-colors"
          >
            Sorcery: Contested Realm
          </a>
          . Search cards, explore or build decks, and simulate matches.
        </p>
      </div>

      {/* Feature cards — Sorcery card frames */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {features.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="group relative flex flex-col overflow-hidden rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
            style={{
              border: `2px solid ${f.stroke}50`,
              boxShadow: `0 0 0 1px ${f.stroke}18`,
            }}
          >
            {/* ── Title bar ── */}
            <div
              className="relative flex items-center justify-between gap-1.5 px-2.5 py-2 bg-gray-950"
              style={{ borderBottom: `1px solid ${f.stroke}30` }}
            >
              <span className="text-[9px] leading-none shrink-0" style={{ color: f.stroke + "90" }}>◆</span>
              <span
                className="flex-1 text-center text-xs font-bold tracking-wide text-white truncate"
                style={{ fontFamily: "var(--font-cinzel)" }}
              >
                {f.title}
              </span>
              <ThresholdGems color={f.stroke} />
              <span className="text-[9px] leading-none shrink-0" style={{ color: f.stroke + "90" }}>◆</span>
            </div>

            {/* ── Art box ── */}
            <div
              className={`relative h-32 bg-gradient-to-b ${f.artFrom} ${f.artTo} overflow-hidden`}
            >
              <ElementSymbol element={f.element} stroke={f.stroke} />
              <div
                className="absolute inset-0"
                style={{ background: `radial-gradient(ellipse at center, ${f.stroke}20 0%, transparent 70%)` }}
              />
            </div>

            {/* ── Text box ── */}
            <div
              className="flex-1 px-2.5 py-2.5 bg-gray-950"
              style={{ borderTop: `1px solid ${f.stroke}20` }}
            >
              <p className="text-xs text-gray-300 leading-relaxed">{f.description}</p>
            </div>

            {/* ── Footer / CTA ── */}
            <div
              className="px-2.5 py-2 bg-gray-950 flex items-center justify-between"
              style={{ borderTop: `1px solid ${f.stroke}25` }}
            >
              <span className="text-[9px] text-gray-700 uppercase tracking-widest">SorcerySim</span>
              <span
                className="text-xs font-semibold group-hover:underline transition-colors"
                style={{ color: f.stroke, fontFamily: "var(--font-cinzel)" }}
              >
                {f.cta} →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Search */}
      <HomeSearch />

      {/* Card of the Day + Codex Tip — side by side */}
      <Suspense
        fallback={
          <div className="grid lg:grid-cols-2 gap-4 mb-12">
            <div className="rounded-2xl border border-amber-700/20 bg-gray-900 h-64 animate-pulse" />
            <div className="rounded-2xl border border-violet-700/20 bg-gray-900 h-64 animate-pulse" />
          </div>
        }
      >
        <div className="grid lg:grid-cols-2 gap-4 mb-12">
          <CardOfTheDay />
          <CodexTipOfTheDay />
        </div>
      </Suspense>

      {/* News */}
      <Suspense fallback={null}>
        <NewsSection />
      </Suspense>

      {/* Community & Resources */}
      <div className="mt-12">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
            Community &amp; Resources
          </h2>
          <div className="flex-1 border-t border-gray-800" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Official Site",      href: "https://sorcerytcg.com",          icon: "🏰" },
            { label: "Find Organized Play", href: "https://play.sorcerytcg.com",     icon: "🎮" },
            { label: "Curiosa.io",         href: "https://curiosa.io",              icon: "📚" },
            { label: "Discord",            href: "https://discord.gg/beEMKYRz",     icon: "💬" },
            { label: "TCGplayer",          href: "https://www.tcgplayer.com/search/sorcery-contested-realm/product?productLineName=sorcery-contested-realm&view=grid", icon: "🛒" },
            { label: "Team Covenant",      href: "https://teamcovenant.com",        icon: "⚔️" },
            { label: "Facebook Community", href: "https://www.facebook.com/share/g/1BsFJ16Re3/", icon: "👥" },
            { label: "How to Play – Video Guide from Team Covenant", href: "https://www.youtube.com/watch?v=Ss-PtdOBHcQ", icon: "▶️" },
          ].map(({ label, href, icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                bg-gray-900 hover:bg-gray-800
                border border-gray-800 hover:border-gray-700
                text-sm text-gray-400 hover:text-white
                transition-colors"
            >
              <span>{icon}</span>
              {label}
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}

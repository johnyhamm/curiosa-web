import Link from "next/link";
import { Suspense } from "react";
import { CardOfTheDay } from "@/app/components/CardOfTheDay";
import { NewsSection } from "@/app/components/NewsSection";

// Regenerate the home page at most every hour so the card-of-the-day
// stays current without rebuilding on every request.
export const revalidate = 3600;

const features = [
  {
    href: "/deckbuilder",
    title: "Deck Builder",
    icon: "🔨",
    description:
      "Build a deck from scratch and test it instantly against any public deck.",
    cta: "Build a Deck",
    color: "from-amber-900/40 to-amber-800/20",
    border: "border-amber-700/40",
    accent: "text-amber-400",
  },
  {
    href: "/decks",
    title: "Deck Explorer",
    icon: "📚",
    description:
      "Browse 16,000+ public decks from curiosa.io. Filter by avatar, sort by most liked or most viewed, and inspect full decklists.",
    cta: "Browse Decks",
    color: "from-purple-900/40 to-purple-800/20",
    border: "border-purple-700/40",
    accent: "text-purple-400",
  },
  {
    href: "/simulate",
    title: "Match Simulator",
    icon: "⚔️",
    description:
      "Run Monte Carlo simulations between any two public decks. Get win rates, average game length, life totals, and a sample game log.",
    cta: "Run Simulation",
    color: "from-red-900/40 to-red-800/20",
    border: "border-red-700/40",
    accent: "text-red-400",
  },
];

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-5xl sm:text-6xl font-bold text-amber-400 mb-4 tracking-tight">
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
          . Search cards, explore decks, and simulate matches.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid sm:grid-cols-3 gap-6 mb-12">
        {features.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`group relative flex flex-col bg-gradient-to-b ${f.color} border ${f.border} rounded-xl p-6 hover:border-opacity-80 transition-all hover:scale-[1.02]`}
          >
            <div className="text-4xl mb-4">{f.icon}</div>
            <h2 className={`text-xl font-bold mb-2 ${f.accent}`}>{f.title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed flex-1">{f.description}</p>
            <div className="mt-6">
              <span
                className={`inline-block text-sm font-semibold ${f.accent} group-hover:underline`}
              >
                {f.cta} →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Card of the Day */}
      <Suspense
        fallback={
          <div className="rounded-2xl border border-amber-700/20 bg-gray-900 h-64 animate-pulse mb-12" />
        }
      >
        <div className="mb-12">
          <CardOfTheDay />
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
            { label: "TCGplayer",          href: "https://tcgplayer.com",           icon: "🛒" },
            { label: "Team Covenant",      href: "https://teamcovenant.com",        icon: "⚔️" },
            { label: "Facebook Community", href: "https://www.facebook.com/share/g/1BsFJ16Re3/", icon: "👥" },
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

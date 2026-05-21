import Link from "next/link";

const features = [
  {
    href: "/cards",
    title: "Card Search",
    icon: "🃏",
    description:
      "Search all Sorcery: Contested Realm cards by name, rules text, element, type, rarity, or set. Full card details including stats, thresholds, and flavor text.",
    cta: "Browse Cards",
    color: "from-blue-900/40 to-blue-800/20",
    border: "border-blue-700/40",
    accent: "text-blue-400",
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
            href="https://curiosa.io"
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
      <div className="grid sm:grid-cols-3 gap-6">
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

      {/* MCP note */}
      <div className="mt-12 p-4 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-500 text-center">
        Also available as an MCP server at{" "}
        <code className="text-amber-500 font-mono">/api/mcp</code> — connect
        Claude or any MCP client to query cards and decks directly.
      </div>
    </div>
  );
}

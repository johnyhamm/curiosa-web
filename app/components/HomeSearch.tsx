"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HomeSearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"cards" | "decks">("cards");
  const router = useRouter();

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/${mode}?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="mb-12 max-w-2xl mx-auto">
      {/* Mode toggle */}
      <div className="flex justify-center gap-1 mb-3">
        {(["cards", "decks"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              mode === m
                ? "bg-amber-500 text-gray-950"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={mode === "cards" ? "Search cards by name or text…" : "Search decks by name or avatar…"}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white
            placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1
            focus:ring-amber-500 transition-colors text-sm"
        />
        <button
          onClick={submit}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold
            rounded-lg transition-colors text-sm shrink-0"
        >
          Search
        </button>
      </div>
    </div>
  );
}

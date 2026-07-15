import { getCodexTipOfTheDay, stripWikiLinks } from "@/lib/codex";

const TRUNCATE_AT = 450;

export async function CodexTipOfTheDay() {
  const entry = await getCodexTipOfTheDay();
  if (!entry) return null;

  const cleanContent = stripWikiLinks(entry.content);
  const isTruncated = cleanContent.length > TRUNCATE_AT;
  const displayText = isTruncated
    ? cleanContent.slice(0, TRUNCATE_AT).replace(/\s+\S*$/, "") + "…"
    : cleanContent;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="rounded-2xl border border-violet-700/30 bg-gray-900 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-800/80">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
          ✦ Codex Tip of the Day
        </span>
        <span className="text-xs text-gray-600">{dateLabel}</span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-5 flex-1">
        <h2 className="text-xl font-bold text-white leading-tight">
          {entry.title}
        </h2>

        <div className="border-l-2 border-violet-700/40 pl-3 flex-1">
          <p className="text-sm text-gray-300 leading-relaxed">
            {displayText}
          </p>
        </div>

        <div className="mt-auto pt-1 flex items-center justify-between">
          <span className="text-xs text-gray-700">curiosa.io codex</span>
          <a
            href="https://curiosa.io/codex"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Browse full codex ↗
          </a>
        </div>
      </div>
    </section>
  );
}

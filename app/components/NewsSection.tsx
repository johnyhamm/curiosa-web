// Renders the latest news from sorcerytcg.com. The fetch + parse logic lives
// in lib/news.ts so the /api/news endpoint can reuse it.

import { fetchNewsArticles } from "@/lib/news";

// ─── Component ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day:   "numeric",
      year:  "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export async function NewsSection() {
  const articles = await fetchNewsArticles(4);
  if (articles.length === 0) return null;

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
          Latest News
        </h2>
        <div className="flex-1 border-t border-gray-800" />
        <a
          href="https://sorcerytcg.com/news"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:text-amber-500 transition-colors shrink-0"
        >
          sorcerytcg.com ↗
        </a>
      </div>

      {/* Article grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.map((a) => (
          <a
            key={a.slug}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col bg-gray-900 border border-gray-800 rounded-xl
              overflow-hidden hover:border-gray-700 transition-colors"
          >
            {/* Cover image */}
            {a.imageUrl ? (
              <div className="aspect-[2/1] overflow-hidden bg-gray-800">
                <img
                  src={a.imageUrl}
                  alt={a.title}
                  width={600}
                  height={300}
                  className="w-full h-full object-cover transition-transform duration-300
                    group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="aspect-[2/1] bg-gray-800" />
            )}

            {/* Text */}
            <div className="flex flex-col gap-1.5 p-4 flex-1">
              <p className="text-xs text-gray-600">{formatDate(a.date)}</p>
              <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2
                group-hover:text-amber-400 transition-colors">
                {a.title}
              </h3>
              {a.excerpt && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-0.5">
                  {a.excerpt}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// Fetches the latest news from sorcerytcg.com by reading the __NEXT_DATA__
// JSON that Next.js embeds in the page. Cached for 6 hours via ISR.

// ─── Types ────────────────────────────────────────────────────────────────────

interface SanityImageRef {
  _ref: string; // e.g. "image-{hash}-{w}x{h}-{ext}"
}

interface RawPost {
  title: string;
  slug: string;
  date: string;
  excerpt?: string;
  coverImage?: { asset?: SanityImageRef };
}

export interface NewsArticle {
  title: string;
  slug: string;
  url: string;
  date: string;      // ISO string
  excerpt: string;
  imageUrl: string | null;
}

// ─── Sanity image URL builder ────────────────────────────────────────────────
// Ref format: "image-{fileId}-{w}x{h}-{ext}"
// CDN base:   https://cdn.sanity.io/images/vg9ve3gy/production/

function sanityImageUrl(ref: string, w = 600, h = 300): string | null {
  // Strip leading "image-"
  const body = ref.startsWith("image-") ? ref.slice(6) : ref;
  // Last segment is the extension, e.g. "png" or "jpg"
  const lastDash = body.lastIndexOf("-");
  if (lastDash === -1) return null;
  const ext      = body.slice(lastDash + 1);
  const filepart = body.slice(0, lastDash); // "{hash}-{w}x{h}"
  return `https://cdn.sanity.io/images/vg9ve3gy/production/${filepart}.${ext}?w=${w}&h=${h}&fit=crop&auto=format`;
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchArticles(): Promise<NewsArticle[]> {
  try {
    const res = await fetch("https://sorcerytcg.com", {
      next: { revalidate: 21600 }, // 6 hours
      headers: { "User-Agent": "SorcerySim/1.0 (+https://sorcerysim.vercel.app)" },
    });
    if (!res.ok) return [];

    const html = await res.text();

    // Extract the __NEXT_DATA__ JSON blob
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
    if (!match) return [];

    const data  = JSON.parse(match[1]) as {
      props?: { pageProps?: { posts?: RawPost[] } };
    };
    const posts = data?.props?.pageProps?.posts ?? [];

    return posts.slice(0, 4).map((p) => ({
      title:    p.title,
      slug:     p.slug,
      url:      `https://sorcerytcg.com/news/${p.slug}`,
      date:     p.date,
      excerpt:  p.excerpt ?? "",
      imageUrl: p.coverImage?.asset?._ref
        ? sanityImageUrl(p.coverImage.asset._ref)
        : null,
    }));
  } catch {
    return [];
  }
}

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
  const articles = await fetchArticles();
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

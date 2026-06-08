// Shared news fetcher — reads the latest articles from sorcerytcg.com by
// parsing the __NEXT_DATA__ JSON that Next.js embeds in the page.
// Used by both the home-page NewsSection and the /api/news endpoint.

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
  date: string; // ISO string
  excerpt: string;
  imageUrl: string | null;
}

// ─── Sanity image URL builder ────────────────────────────────────────────────
// Ref format: "image-{fileId}-{w}x{h}-{ext}"

function sanityImageUrl(ref: string, w = 600, h = 300): string | null {
  const body = ref.startsWith("image-") ? ref.slice(6) : ref;
  const lastDash = body.lastIndexOf("-");
  if (lastDash === -1) return null;
  const ext = body.slice(lastDash + 1);
  const filepart = body.slice(0, lastDash); // "{hash}-{w}x{h}"
  return `https://cdn.sanity.io/images/vg9ve3gy/production/${filepart}.${ext}?w=${w}&h=${h}&fit=crop&auto=format`;
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

/** Fetch the latest news articles from sorcerytcg.com. */
export async function fetchNewsArticles(limit = 4): Promise<NewsArticle[]> {
  try {
    const res = await fetch("https://sorcerytcg.com", {
      next: { revalidate: 21600 }, // 6 hours
      headers: { "User-Agent": "SorcerySim/1.0 (+https://sorcerysim.vercel.app)" },
    });
    if (!res.ok) return [];

    const html = await res.text();

    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
    if (!match) return [];

    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { posts?: RawPost[] } };
    };
    const posts = data?.props?.pageProps?.posts ?? [];

    return posts.slice(0, limit).map((p) => ({
      title: p.title,
      slug: p.slug,
      url: `https://sorcerytcg.com/news/${p.slug}`,
      date: p.date,
      excerpt: p.excerpt ?? "",
      imageUrl: p.coverImage?.asset?._ref
        ? sanityImageUrl(p.coverImage.asset._ref)
        : null,
    }));
  } catch {
    return [];
  }
}

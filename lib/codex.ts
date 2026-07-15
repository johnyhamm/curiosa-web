import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";

export interface CodexEntry {
  title: string;
  content: string;
}

const CURIOSA_CODEX_URL = "https://curiosa.io/codex";
// Require at least this many entries from the web before trusting it over the
// committed CSV fallback — protects against curiosa.io returning a stub page.
const MIN_HEALTHY = 50;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract plain text from a Sanity portable-text block array. */
function blockText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .flatMap((b: { children?: { text?: string }[] }) =>
      (b?.children ?? []).map((c) => c?.text ?? "")
    )
    .join(" ")
    .trim();
}

function clean(s: string): string {
  return s.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
}

// ── Source: curiosa.io/codex (live, cached 1 day via ISR) ──────────────────

async function fetchCodexFromWeb(): Promise<CodexEntry[]> {
  try {
    const res = await fetch(CURIOSA_CODEX_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SorcerySim/1.0)" },
      next: { revalidate: 86400 }, // refresh at most once a day
    });
    if (!res.ok) return [];
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return [];

    const data = JSON.parse(m[1]);
    const queries = data?.props?.pageProps?.trpcState?.json?.queries ?? [];
    const raw = queries.flatMap(
      (q: { queryKey?: unknown; state?: { data?: unknown[] } }) =>
        JSON.stringify(q?.queryKey ?? "").includes("getAllCodexes")
          ? q?.state?.data ?? []
          : []
    ) as { title?: string; content?: unknown }[];

    return raw
      .map((e) => ({ title: (e?.title ?? "").trim(), content: clean(blockText(e?.content)) }))
      .filter((e) => e.title && e.content.length > 40);
  } catch {
    return [];
  }
}

// ── Fallback: committed lib/data/codex.csv ─────────────────────────────────

function loadCodexFromCsv(): CodexEntry[] {
  try {
    const raw = readFileSync(join(process.cwd(), "lib/data/codex.csv"), "utf8");
    const rows = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
    }) as Record<string, string>[];
    return rows
      .filter((r) => r.title?.trim() && r.content?.trim())
      .map((r) => ({ title: r.title.trim(), content: clean(r.content) }));
  } catch {
    return [];
  }
}

/** Web codex with CSV fallback. Never throws — returns [] if both fail. */
export async function getCodexEntries(): Promise<CodexEntry[]> {
  const web = await fetchCodexFromWeb();
  if (web.length >= MIN_HEALTHY) return web;
  const csv = loadCodexFromCsv();
  return csv.length ? csv : web;
}

/** The codex entry for today (UTC day number). null if no source is available. */
export async function getCodexTipOfTheDay(): Promise<CodexEntry | null> {
  try {
    const entries = await getCodexEntries();
    if (!entries.length) return null;
    const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return entries[dayNum % entries.length];
  } catch {
    return null;
  }
}

/** Strip [[Card Name]] wiki-link syntax, leaving just the name. */
export function stripWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, "$1");
}

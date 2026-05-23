import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";

export interface CodexEntry {
  title: string;
  content: string;
}

let _entries: CodexEntry[] | null = null;

export function loadCodexEntries(): CodexEntry[] {
  if (_entries) return _entries;

  const raw = readFileSync(
    join(process.cwd(), "lib/data/codex.csv"),
    "utf8"
  );

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  _entries = rows
    .filter((r) => r.title?.trim() && r.content?.trim())
    .map((r) => ({
      title: r.title.trim(),
      // Collapse internal newlines to spaces for cleaner display
      content: r.content.trim().replace(/\n+/g, " ").replace(/\s{2,}/g, " "),
    }));

  return _entries;
}

export function getCodexTipOfTheDay(): CodexEntry {
  const entries = loadCodexEntries();
  const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return entries[dayNum % entries.length];
}

/** Strip [[Card Name]] wiki-link syntax, leaving just the name. */
export function stripWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, "$1");
}

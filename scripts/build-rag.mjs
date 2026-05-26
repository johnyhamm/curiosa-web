#!/usr/bin/env node
/**
 * Build the RAG index for "Ask the Sorcerers".
 *
 * Reads three sources:
 *   1. lib/data/rulebook.txt  – extracted from the official PDF
 *   2. curiosa.io/faqs        – live page, parsed from __NEXT_DATA__
 *   3. lib/data/codex.csv     – existing codex entries
 *
 * Chunks and embeds each source with OpenAI text-embedding-3-small (256 dims),
 * then writes lib/data/rag-chunks.json.
 *
 * Run manually when content changes:
 *   OPENAI_API_KEY=sk-... node scripts/build-rag.mjs
 */

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY environment variable is not set.");
  console.error("  Usage: OPENAI_API_KEY=sk-... node scripts/build-rag.mjs");
  process.exit(1);
}

const oai = new OpenAI({ apiKey: OPENAI_API_KEY });
const EMBEDDING_MODEL = "text-embedding-3-small";
const DIMENSIONS = 256;
const BATCH_SIZE = 100;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanText(s) {
  return s.replace(/\s+/g, " ").replace(/- \d+ -/g, "").trim();
}

/** Extract plain text from a Sanity portable-text block array. */
function blockText(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .flatMap((b) => (b.children ?? []).map((c) => c.text ?? ""))
    .join(" ")
    .trim();
}

// ── Source 1: Rulebook ────────────────────────────────────────────────────────

function loadRulebookChunks() {
  const raw = readFileSync(join(ROOT, "lib/data/rulebook.txt"), "utf8");

  // Split on page markers, then on section headings
  const pageBlocks = raw.split(/\[Page \d+\]\n?/).filter((p) => p.trim());

  const chunks = [];
  let currentTitle = "Rulebook — Introduction";
  let currentText = "";

  const headingRe = /^([A-Z][A-Za-z &/'-]{3,50})\s*$/m;

  for (const block of pageBlocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect a new section heading (short, title-case line not ending with punctuation)
      if (
        headingRe.test(trimmed) &&
        trimmed.length < 50 &&
        !trimmed.endsWith(".") &&
        !trimmed.endsWith(",") &&
        !trimmed.match(/^\d/)
      ) {
        if (currentText.length > 150) {
          chunks.push({
            source: "rulebook",
            title: `Rulebook — ${currentTitle}`,
            text: cleanText(currentText),
          });
        }
        currentTitle = trimmed;
        currentText = "";
      } else {
        currentText += " " + trimmed;
      }
    }
  }

  if (currentText.length > 150) {
    chunks.push({
      source: "rulebook",
      title: `Rulebook — ${currentTitle}`,
      text: cleanText(currentText),
    });
  }

  // Merge very-short chunks into previous chunk
  const merged = [];
  for (const chunk of chunks) {
    if (merged.length && chunk.text.length < 200) {
      merged[merged.length - 1].text += " " + chunk.text;
    } else {
      merged.push({ ...chunk });
    }
  }

  return merged;
}

// ── Source 2: FAQ from curiosa.io ────────────────────────────────────────────

async function loadFaqChunks() {
  console.log("  Fetching FAQ from curiosa.io/faqs ...");
  const res = await fetch("https://curiosa.io/faqs", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SorcerySim/1.0)" },
  });
  if (!res.ok) throw new Error(`FAQ fetch failed: HTTP ${res.status}`);

  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find __NEXT_DATA__ in curiosa.io/faqs");

  const data = JSON.parse(m[1]);
  const faqs = data.props.pageProps.faqs ?? [];
  console.log(`  Got ${faqs.length} raw FAQ entries`);

  // Group by card name
  const byCard = new Map();
  for (const faq of faqs) {
    const question = blockText(faq.question);
    const answer = blockText(faq.answer);
    if (!question || !answer) continue;
    const qa = `Q: ${question}\nA: ${answer}`;

    for (const name of faq.cardNames ?? []) {
      if (!byCard.has(name)) byCard.set(name, []);
      byCard.get(name).push(qa);
    }
  }

  const chunks = [];
  for (const [cardName, qas] of byCard) {
    // If a card has many Q&As, split into sub-chunks of max 8 each
    for (let i = 0; i < qas.length; i += 8) {
      const slice = qas.slice(i, i + 8);
      chunks.push({
        source: "faq",
        title: `FAQ: ${cardName}`,
        text: slice.join("\n\n"),
      });
    }
  }

  return chunks;
}

// ── Source 3: Codex CSV ───────────────────────────────────────────────────────

function loadCodexChunks() {
  const raw = readFileSync(join(ROOT, "lib/data/codex.csv"), "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  return rows
    .filter((r) => r.title?.trim() && r.content?.trim().length > 80)
    .map((r) => ({
      source: "codex",
      title: `Codex: ${r.title.trim()}`,
      text: cleanText(r.content),
    }));
}

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embedBatch(texts) {
  const res = await oai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: DIMENSIONS,
  });
  // Round to 4 decimal places to reduce file size
  return res.data.map((d) => d.embedding.map((v) => Math.round(v * 10000) / 10000));
}

async function embedAll(chunks) {
  const result = [];
  const total = Math.ceil(chunks.length / BATCH_SIZE);
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${total}...\r`);
    const embeddings = await embedBatch(
      batch.map((c) => `${c.title}\n${c.text}`)
    );
    for (let j = 0; j < batch.length; j++) {
      result.push({ ...batch[j], embedding: embeddings[j] });
    }
  }
  console.log("  Embedding complete.           ");
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Building RAG index for Ask the Sorcerers...\n");

  console.log("Loading rulebook...");
  const rulebook = loadRulebookChunks();
  console.log(`  ${rulebook.length} chunks`);

  console.log("Loading FAQ...");
  const faq = await loadFaqChunks();
  console.log(`  ${faq.length} chunks`);

  console.log("Loading codex...");
  const codex = loadCodexChunks();
  console.log(`  ${codex.length} chunks`);

  const all = [...rulebook, ...faq, ...codex];
  console.log(`\nTotal: ${all.length} chunks\n`);

  console.log("Embedding all chunks...");
  const embedded = await embedAll(all);

  const outPath = join(ROOT, "lib/data/rag-chunks.json");
  writeFileSync(outPath, JSON.stringify(embedded));

  const { statSync } = await import("fs");
  const sizeKb = (statSync(outPath).size / 1024).toFixed(0);
  console.log(`\nSaved ${outPath}`);
  console.log(`File size: ${sizeKb} KB`);
  console.log("\nDone! Run `git add lib/data/rag-chunks.json` to commit the index.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

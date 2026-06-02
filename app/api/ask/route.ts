import { streamText, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import OpenAI from "openai";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { loadCards, normalise, formatCard } from "@/lib/cards";

export const runtime = "nodejs";
export const maxDuration = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RagChunk {
  source: "rulebook" | "faq" | "codex";
  title: string;
  text: string;
  embedding: number[];
}

// ── Chunk cache ───────────────────────────────────────────────────────────────

let _chunks: RagChunk[] | null = null;

function getChunks(): RagChunk[] {
  if (_chunks) return _chunks;
  const path = join(process.cwd(), "lib/data/rag-chunks.json");
  if (!existsSync(path)) return [];
  _chunks = JSON.parse(readFileSync(path, "utf8")) as RagChunk[];
  return _chunks;
}

// ── Cosine similarity ─────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── RAG retrieval ─────────────────────────────────────────────────────────────

async function findRelevantChunks(query: string, k = 6): Promise<RagChunk[]> {
  const chunks = getChunks();
  if (chunks.length === 0) return [];

  try {
    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const res = await oai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      dimensions: 256,
    });
    const queryEmb = res.data[0].embedding;

    const scored = chunks
      .map((c) => ({ chunk: c, score: cosineSimilarity(queryEmb, c.embedding) }))
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, k).map((s) => s.chunk);
  } catch {
    // Embeddings unavailable — answer without RAG context
    return [];
  }
}

// ── API route ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build RAG context from the latest user message
    const lastUserMsg =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content ?? "";

    const relevant = await findRelevantChunks(lastUserMsg);
    const context =
      relevant.length > 0
        ? relevant.map((c) => `[${c.title}]\n${c.text}`).join("\n\n---\n\n")
        : "No specific context found — answer from general knowledge of Sorcery: Contested Realm.";

    const systemPrompt = `You are "Ask the Sorcerers" — a wise and precise rules expert for the trading card game Sorcery: Contested Realm.
You have deep knowledge of the official rulebook, the FAQ, and the Codex of game terms.

Answer questions about rules, card interactions, mechanics, and gameplay clearly and concisely.
If you are unsure, say so rather than guessing. Cite your source (Rulebook / FAQ / Codex) when relevant.
You can look up specific cards using the lookupCard tool to get their exact stats and abilities.
Keep responses focused — players want quick, accurate answers.

Relevant context from official sources:
${context}`;

    const result = await streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages,
      maxOutputTokens: 600,
      tools: {
        lookupCard: tool({
          description:
            "Look up a specific Sorcery: Contested Realm card by name to get its full stats, cost, element, abilities, and rules text.",
          inputSchema: z.object({
            name: z.string().describe("The card name to look up (exact or approximate)"),
          }),
          execute: async ({ name }: { name: string }) => {
            try {
              const cards = await loadCards();
              const q = normalise(name);
              const card =
                cards.find((c) => normalise(c.name) === q) ??
                cards.find((c) => normalise(c.name).includes(q)) ??
                cards.find((c) => normalise(c.name).startsWith(q));
              if (!card) return `No card found matching "${name}".`;
              return formatCard(card, false);
            } catch {
              return `Could not look up card "${name}".`;
            }
          },
        }),
      },
      stopWhen: stepCountIs(3),
    });

    return result.toTextStreamResponse();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ask] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: `AI service error: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  loadCards,
  matchesText,
  formatCard,
  getUniqueSets,
  normalise,
} from "@/lib/cards";
import {
  extractDeckId,
  fetchDeckFromApi,
  getDeckIndex,
  searchAllDecks,
  resolveAvatarCardId,
} from "@/lib/decks";
import { toSimCards, runSimulation, formatReport } from "@/lib/simulator";
import type { ApiDeckCard } from "@/lib/simulator";

export const dynamic = "force-dynamic";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "curiosa-web",
    version: "1.0.0",
  });

  // Tool 1: search_cards
  server.tool(
    "search_cards",
    "Search Sorcery: Contested Realm cards. Filter by keyword (searches name, rules text, flavor text, subtypes), element, type, rarity, or set. Returns up to `limit` matching cards.",
    {
      query: z
        .string()
        .optional()
        .describe("Free-text search across card name, rules text, flavor text, and subtypes"),
      element: z
        .enum(["air", "earth", "fire", "water"])
        .optional()
        .describe("Filter by primary element"),
      type: z
        .string()
        .optional()
        .describe('Card type, e.g. "Minion", "Magic", "Artifact", "Aura"'),
      rarity: z
        .enum(["Common", "Uncommon", "Rare", "Exceptional", "Elite", "Unique"])
        .optional()
        .describe("Card rarity"),
      set: z
        .string()
        .optional()
        .describe('Set name, e.g. "Alpha", "Beta"'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Max results to return (default 20, max 100)"),
    },
    async ({ query, element, type, rarity, set, limit }) => {
      const cards = await loadCards();

      let results = cards.filter((card) => {
        if (query && !matchesText(card, query)) return false;
        if (element && normalise(card.elements) !== normalise(element)) return false;
        if (type && !normalise(card.guardian.type).includes(normalise(type))) return false;
        if (rarity && normalise(card.guardian.rarity) !== normalise(rarity)) return false;
        if (set && !card.sets.some((s) => normalise(s.name).includes(normalise(set))))
          return false;
        return true;
      });

      if (results.length === 0) {
        return { content: [{ type: "text", text: "No cards matched your search." }] };
      }

      const total = results.length;
      results = results.slice(0, limit);

      const text =
        `Found ${total} card(s)${total > limit ? ` (showing first ${limit})` : ""}:\n\n` +
        results.map((c) => formatCard(c, false)).join("\n\n---\n\n");

      return { content: [{ type: "text", text }] };
    }
  );

  // Tool 2: get_card
  server.tool(
    "get_card",
    "Get the full details of a specific Sorcery: Contested Realm card by name, including all sets, variants, artists, and flavor text.",
    {
      name: z.string().describe("The exact or partial card name to look up"),
    },
    async ({ name }) => {
      const cards = await loadCards();
      const q = normalise(name);

      const card =
        cards.find((c) => normalise(c.name) === q) ??
        cards.find((c) => normalise(c.name).startsWith(q)) ??
        cards.find((c) => normalise(c.name).includes(q));

      if (!card) {
        const suggestions = cards
          .filter((c) => normalise(c.name).includes(q.substring(0, 3)))
          .slice(0, 5)
          .map((c) => c.name);
        const hint =
          suggestions.length > 0
            ? `\n\nDid you mean: ${suggestions.join(", ")}?`
            : "";
        return {
          content: [{ type: "text", text: `No card found named "${name}".${hint}` }],
        };
      }

      return { content: [{ type: "text", text: formatCard(card, true) }] };
    }
  );

  // Tool 3: browse_sets
  server.tool(
    "browse_sets",
    "List all Sorcery: Contested Realm card sets with release dates and card counts.",
    {},
    async () => {
      const cards = await loadCards();
      const sets = getUniqueSets(cards);

      const rows = sets.map((s) => {
        const count = cards.filter((c) =>
          c.sets.some((cs) => cs.name === s.name)
        ).length;
        const date = new Date(s.releasedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `• **${s.name}** — Released ${date} — ${count} cards`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Sorcery: Contested Realm sets (${sets.length} total):\n\n${rows.join("\n")}`,
          },
        ],
      };
    }
  );

  // Tool 4: get_rules
  server.tool(
    "get_rules",
    "Fetch Sorcery: Contested Realm rules and codex entries from curiosa.io. Optionally look up a specific rules concept.",
    {
      topic: z
        .string()
        .optional()
        .describe(
          'Specific rules concept to look up, e.g. "threshold", "attack", "fight", "burst". Omit for the general codex overview.'
        ),
    },
    async ({ topic }) => {
      const baseUrl = "https://curiosa.io";
      const path = topic
        ? `/codex/${encodeURIComponent(topic.toLowerCase().replace(/\s+/g, "-"))}`
        : "/codex";

      const res = await fetch(`${baseUrl}${path}`, {
        headers: { "User-Agent": "curiosa-mcp/1.0 (personal MCP server)" },
      });

      if (!res.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Could not fetch rules for "${topic ?? "codex"}" (HTTP ${res.status}). Try visiting curiosa.io/codex directly.`,
            },
          ],
        };
      }

      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&#?\w+;/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (text.length < 100) {
        return {
          content: [
            {
              type: "text",
              text: `The rules page for "${topic ?? "codex"}" appears to be dynamically rendered. Visit curiosa.io${path} directly.`,
            },
          ],
        };
      }

      const snippet = text.substring(0, 6000);
      return {
        content: [
          {
            type: "text",
            text: `Rules content from curiosa.io${path}:\n\n${snippet}${text.length > 6000 ? "\n\n[...truncated]" : ""}`,
          },
        ],
      };
    }
  );

  // Tool 5: search_decks
  server.tool(
    "search_decks",
    "Search public Sorcery: Contested Realm decks on curiosa.io. Uses a local deck index (auto-built on first use, refreshed daily) to instantly search all 16,000+ public decks.",
    {
      query: z
        .string()
        .default("")
        .describe("Search query — matches deck name. Leave empty to browse all decks."),
      avatar: z
        .string()
        .optional()
        .describe("Filter by Avatar card name, e.g. 'Necromancer' or 'Enchantress'. Case-insensitive, partial match."),
      sort_by: z
        .enum(["likes", "views"])
        .default("views")
        .describe("Sort results by most likes or most views (default: views)."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("How many results to return (default 10, max 50)."),
    },
    async ({ query, avatar, sort_by, limit }) => {
      const index = getDeckIndex();

      if (index) {
        const q = query.toLowerCase();
        const av = avatar?.toLowerCase();

        let results = index.decks.filter((d) => {
          if (q && !d.name.toLowerCase().includes(q)) return false;
          if (av && !d.avatarName.toLowerCase().includes(av)) return false;
          return true;
        });

        results = results.sort((a, b) =>
          sort_by === "likes" ? b.likes - a.likes : b.views - a.views
        );

        if (results.length === 0) {
          const hint = avatar ? ` with avatar "${avatar}"` : "";
          return {
            content: [
              { type: "text", text: `No public decks found for "${query}"${hint}.` },
            ],
          };
        }

        const shown = results.slice(0, limit);
        const rows = shown.map((d, i) =>
          [
            `${i + 1}. **${d.name}** by @${d.username}`,
            `   Avatar: ${d.avatarName || "Unknown"} | Elements: ${d.elements.join(", ") || "None"} | Format: ${d.format || "?"}`,
            `   ♥ ${d.likes} likes · 👁 ${d.views} views`,
            `   ID: \`${d.id}\``,
            `   URL: https://curiosa.io/decks/${d.id}`,
          ].join("\n")
        );

        const filterNote = avatar ? ` with avatar "${avatar}"` : "";
        const sortLabel = sort_by === "likes" ? "most liked" : "most viewed";
        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length.toLocaleString()} deck(s)${query ? ` matching "${query}"` : ""}${filterNote} (${index.totalDecks.toLocaleString()} total indexed), showing top ${shown.length} by ${sortLabel}:\n\n${rows.join("\n\n")}`,
            },
          ],
        };
      }

      // Index not ready — fall back to live search
      if (sort_by === "likes") {
        return {
          content: [
            {
              type: "text",
              text: "The deck index isn't ready yet — it's being built in the background. Sorting by likes requires the full index. Please try again in a couple of minutes.",
            },
          ],
        };
      }

      let avatarCardId: string | undefined;
      if (avatar) {
        const resolved = await resolveAvatarCardId(avatar);
        if (!resolved) {
          return {
            content: [
              {
                type: "text",
                text: `Could not find an avatar card named "${avatar}". Check the spelling.`,
              },
            ],
          };
        }
        avatarCardId = resolved;
      }

      const all = await searchAllDecks(query, avatarCardId);

      if (all.length === 0) {
        const hint = avatar ? ` with avatar "${avatar}"` : "";
        return {
          content: [{ type: "text", text: `No public decks found for "${query}"${hint}.` }],
        };
      }

      const shown = all.slice(0, limit);
      const rows = shown.map((d, i) => {
        const elements = (d.elements ?? []).map((e) => e.name).filter((e) => e !== "None").join(", ");
        const avatarName = d.avatars?.[0]?.card?.name ?? "Unknown";
        const author = d.user?.username ?? "?";
        const likes = d._count?.likes ?? 0;
        const views = d._count?.views ?? 0;
        return [
          `${i + 1}. **${d.name}** by @${author}`,
          `   Avatar: ${avatarName} | Elements: ${elements || "None"} | Format: ${d.format ?? "?"}`,
          `   ♥ ${likes} likes · 👁 ${views} views`,
          `   ID: \`${d.id}\``,
          `   URL: https://curiosa.io/decks/${d.id}`,
        ].join("\n");
      });

      const filterNote = avatar ? ` using avatar "${avatar}"` : "";
      return {
        content: [
          {
            type: "text",
            text: `Found ${all.length} deck(s)${query ? ` matching "${query}"` : ""}${filterNote}, showing top ${shown.length} by views:\n\n${rows.join("\n\n")}`,
          },
        ],
      };
    }
  );

  // Tool 6: fetch_deck
  server.tool(
    "fetch_deck",
    "Fetch a public Sorcery: Contested Realm deck from curiosa.io by deck ID or full URL. Returns the full card list with quantities, avatar, and deck metadata.",
    {
      deck: z
        .string()
        .describe("Deck ID (e.g. cmixygfzf1j4c30ecqcaanrcj) or full curiosa.io deck URL"),
    },
    async ({ deck }) => {
      const deckId = extractDeckId(deck);
      const { decklist, avatar, meta } = await fetchDeckFromApi(deckId);

      const header = [
        `**${meta?.name ?? "Unnamed Deck"}**`,
        `Author: @${meta?.user?.username ?? "unknown"}`,
        `Format: ${meta?.format ?? "?"}  |  ♥ ${meta?._count?.likes ?? 0} likes  |  👁 ${meta?._count?.views ?? 0} views`,
        `URL: https://curiosa.io/decks/${deckId}`,
      ].join("\n");

      const avatarLine = avatar
        ? `\n**Avatar:** ${(avatar as ApiDeckCard).card.name}`
        : "";

      const byType = new Map<string, string[]>();
      for (const entry of decklist) {
        const type = (entry.card as { type?: string }).type ?? "Other";
        if (!byType.has(type)) byType.set(type, []);
        const t = entry.card as typeof entry.card & {
          attack?: number | null;
          defense?: number | null;
          waterThreshold?: number;
          earthThreshold?: number;
          fireThreshold?: number;
          airThreshold?: number;
        };
        const stats = t.attack != null ? ` (${t.attack}/${t.defense})` : "";
        const threshStr = [
          t.waterThreshold ? `W${t.waterThreshold}` : "",
          t.earthThreshold ? `E${t.earthThreshold}` : "",
          t.fireThreshold  ? `F${t.fireThreshold}`  : "",
          t.airThreshold   ? `A${t.airThreshold}`   : "",
        ].filter(Boolean).join("");
        const thresh = threshStr ? ` [${threshStr}]` : "";
        byType.get(type)!.push(`  ${entry.quantity}x ${entry.card.name}${stats}${thresh}`);
      }

      const cardLines: string[] = [];
      const typeOrder = ["Site", "Minion", "Magic", "Artifact", "Aura"];
      for (const t of typeOrder) {
        const group = byType.get(t);
        if (group?.length) {
          cardLines.push(`\n**${t}s** (${group.length} entries):`);
          cardLines.push(...group.sort());
        }
      }

      const total = decklist.reduce((s, e) => s + (e.quantity ?? 1), 0);
      cardLines.push(`\nTotal cards: ${total}`);

      return {
        content: [
          {
            type: "text",
            text: `${header}${avatarLine}\n${cardLines.join("\n")}`,
          },
        ],
      };
    }
  );

  // Tool 7: simulate_match
  server.tool(
    "simulate_match",
    [
      "Run a Monte Carlo simulation of two Sorcery: Contested Realm decks playing against each other.",
      "Each deck is fetched from curiosa.io by ID or URL.",
      "The simulator models: threshold requirements, site deployment, minion combat (ATK vs DEF),",
      "spells removing enemy minions or pinging the avatar, and draw mechanics.",
    ].join(" "),
    {
      deck_a: z.string().describe("First deck — ID or curiosa.io URL"),
      deck_b: z.string().describe("Second deck — ID or curiosa.io URL"),
      iterations: z
        .number()
        .int()
        .min(50)
        .max(2000)
        .default(500)
        .describe("Number of games to simulate (default 500, max 2000)"),
    },
    async ({ deck_a, deck_b, iterations }) => {
      const idA = extractDeckId(deck_a);
      const idB = extractDeckId(deck_b);

      const [dataA, dataB, allCards] = await Promise.all([
        fetchDeckFromApi(idA),
        fetchDeckFromApi(idB),
        loadCards(),
      ]);

      const rulesLookup = new Map(allCards.map(c => [c.name, c.guardian.rulesText ?? ""]));

      const avatarCardA = dataA.avatar as ApiDeckCard | null;
      const avatarCardB = dataB.avatar as ApiDeckCard | null;

      const unknownAvatar = {
        name: "Unknown Avatar", type: "Avatar" as const,
        attack: 0, defense: 0, waterT: 0, earthT: 0, fireT: 0, airT: 0,
        elements: [], keywords: [], rulesText: "",
      };

      const avatarSimA = avatarCardA
        ? toSimCards([{ ...avatarCardA, quantity: 1 }], rulesLookup)[0]
        : unknownAvatar;

      const avatarSimB = avatarCardB
        ? toSimCards([{ ...avatarCardB, quantity: 1 }], rulesLookup)[0]
        : unknownAvatar;

      const specA = {
        name: dataA.meta?.name ?? idA,
        avatar: avatarSimA,
        cards: toSimCards(dataA.decklist, rulesLookup),
      };
      const specB = {
        name: dataB.meta?.name ?? idB,
        avatar: avatarSimB,
        cards: toSimCards(dataB.decklist, rulesLookup),
      };

      if (specA.cards.length === 0 || specB.cards.length === 0) {
        return {
          content: [
            { type: "text", text: "One or both decks have no cards — are they public?" },
          ],
        };
      }

      const report = runSimulation(specA, specB, iterations);
      return { content: [{ type: "text", text: formatReport(report) }] };
    }
  );

  return server;
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,
  });

  const mcpServer = createMcpServer();
  await mcpServer.connect(transport);

  const response = await transport.handleRequest(request);
  return response;
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

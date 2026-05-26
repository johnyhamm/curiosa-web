import { auth, clerkClient } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import {
  type SavedBuilderDeck,
  type SlimEntry,
  type UserMeta,
  MAX_BUILDER_DECKS,
} from "@/lib/builder-deck";

// ── GET /api/user/builder-decks ──────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = (user.privateMetadata ?? {}) as UserMeta;

  return NextResponse.json(meta.builderDecks ?? []);
}

// ── POST /api/user/builder-decks ─────────────────────────────────────────────
// Body: { name, avatarName, entries: SlimEntry[] }

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    name: string;
    avatarName: string | null;
    entries: SlimEntry[];
  };

  if (!body.name || !Array.isArray(body.entries)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;

  const deck: SavedBuilderDeck = {
    id: crypto.randomUUID(),
    name: body.name,
    av: body.avatarName ?? null,
    at: new Date().toISOString(),
    e: body.entries,
  };

  // Prepend, keep the most recent MAX_BUILDER_DECKS
  const builderDecks = [deck, ...(existing.builderDecks ?? [])].slice(
    0,
    MAX_BUILDER_DECKS
  );

  try {
    await client.users.updateUser(userId, {
      privateMetadata: { ...existing, builderDecks },
    });
  } catch (err) {
    console.error("[builder-decks] Failed to update user metadata:", err);
    return NextResponse.json(
      { error: "Could not save deck. You may have reached the account storage limit." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: deck.id });
}

// ── PUT /api/user/builder-decks ──────────────────────────────────────────────
// Body: { id, name, avatarName, entries: SlimEntry[] }
// Updates an existing saved deck in-place (preserves its position in the list).

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    id: string;
    name: string;
    avatarName: string | null;
    entries: SlimEntry[];
  };

  if (!body.id || !body.name || !Array.isArray(body.entries)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;
  const existingDecks = existing.builderDecks ?? [];

  if (!existingDecks.some((d) => d.id === body.id)) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const builderDecks = existingDecks.map((d) =>
    d.id === body.id
      ? { ...d, name: body.name, av: body.avatarName ?? null, e: body.entries, at: new Date().toISOString() }
      : d
  );

  try {
    await client.users.updateUser(userId, {
      privateMetadata: { ...existing, builderDecks },
    });
  } catch (err) {
    console.error("[builder-decks] Failed to update user metadata:", err);
    return NextResponse.json(
      { error: "Could not update deck." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/user/builder-decks ───────────────────────────────────────────
// Body: { id }

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = (await req.json()) as { id: string };
  if (!id) return new NextResponse("Bad Request", { status: 400 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;

  const builderDecks = (existing.builderDecks ?? []).filter((d) => d.id !== id);

  await client.users.updateUser(userId, {
    privateMetadata: { ...existing, builderDecks },
  });

  return NextResponse.json({ ok: true });
}

import { auth, clerkClient } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import {
  type SavedBuilderDeck,
  type SlimEntry,
  type UserMeta,
  MAX_BUILDER_DECKS,
} from "@/lib/builder-deck";
import { publishBuilderDeck, unpublishBuilderDeck } from "@/lib/redis";

function ownerName(user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.username ?? (fullName || user.emailAddresses[0]?.emailAddress) ?? "Unknown";
}

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
// Body: { name, avatarName, entries: SlimEntry[], isPublic?: boolean }

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    name: string;
    avatarName: string | null;
    entries: SlimEntry[];
    isPublic?: boolean;
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
    pub: body.isPublic ?? false,
  };

  const builderDecks = [deck, ...(existing.builderDecks ?? [])].slice(0, MAX_BUILDER_DECKS);

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

  if (deck.pub) {
    await publishBuilderDeck(deck, userId, ownerName(user));
  }

  return NextResponse.json({ ok: true, id: deck.id });
}

// ── PUT /api/user/builder-decks ──────────────────────────────────────────────
// Body: { id, name, avatarName, entries: SlimEntry[], isPublic?: boolean }

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    id: string;
    name: string;
    avatarName: string | null;
    entries: SlimEntry[];
    isPublic?: boolean;
  };

  if (!body.id || !body.name || !Array.isArray(body.entries)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;
  const existingDecks = existing.builderDecks ?? [];

  const oldDeck = existingDecks.find((d) => d.id === body.id);
  if (!oldDeck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  const newPub = body.isPublic ?? oldDeck.pub ?? false;

  const updatedDeck: SavedBuilderDeck = {
    ...oldDeck,
    name: body.name,
    av: body.avatarName ?? null,
    e: body.entries,
    at: new Date().toISOString(),
    pub: newPub,
  };

  const builderDecks = existingDecks.map((d) => (d.id === body.id ? updatedDeck : d));

  try {
    await client.users.updateUser(userId, {
      privateMetadata: { ...existing, builderDecks },
    });
  } catch (err) {
    console.error("[builder-decks] Failed to update user metadata:", err);
    return NextResponse.json({ error: "Could not update deck." }, { status: 500 });
  }

  // Sync public index
  if (newPub) {
    await publishBuilderDeck(updatedDeck, userId, ownerName(user));
  } else {
    await unpublishBuilderDeck(body.id);
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

  // Remove from public index if it was published
  await unpublishBuilderDeck(id);

  return NextResponse.json({ ok: true });
}

import { auth, clerkClient } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

// Shape stored in Clerk privateMetadata
interface FavoriteDeckMeta {
  name: string;
  avatar?: string;
  elements?: string[];
}

interface UserMeta {
  favoriteDeckIds?: string[];
  favoriteDeckMeta?: Record<string, FavoriteDeckMeta>;
  simResults?: SimSummary[];
}

export interface SimSummary {
  id: string;
  deckAId: string;
  deckBId: string;
  deckAName: string;
  deckBName: string;
  avatarA: string;
  avatarB: string;
  winRateA: string;
  winRateB: string;
  iterations: number;
  savedAt: string;
}

// ── GET /api/user/favorites ──────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = (user.privateMetadata ?? {}) as UserMeta;

  return NextResponse.json({
    ids: meta.favoriteDeckIds ?? [],
    meta: meta.favoriteDeckMeta ?? {},
  });
}

// ── POST /api/user/favorites ─────────────────────────────────────────────────
// Body: { deckId, name, avatar?, elements? }

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json()) as { deckId: string; name: string; avatar?: string; elements?: string[] };
  const { deckId, name, avatar, elements } = body;
  if (!deckId) return new NextResponse("Bad Request", { status: 400 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;

  const ids = Array.from(new Set([...(existing.favoriteDeckIds ?? []), deckId]));
  const deckMeta: Record<string, FavoriteDeckMeta> = {
    ...(existing.favoriteDeckMeta ?? {}),
    [deckId]: { name, avatar, elements },
  };

  await client.users.updateUser(userId, {
    privateMetadata: { ...existing, favoriteDeckIds: ids, favoriteDeckMeta: deckMeta },
  });

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/user/favorites ───────────────────────────────────────────────
// Body: { deckId }

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json()) as { deckId: string };
  const { deckId } = body;
  if (!deckId) return new NextResponse("Bad Request", { status: 400 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;

  const ids = (existing.favoriteDeckIds ?? []).filter((id) => id !== deckId);
  const deckMeta = { ...(existing.favoriteDeckMeta ?? {}) };
  delete deckMeta[deckId];

  await client.users.updateUser(userId, {
    privateMetadata: { ...existing, favoriteDeckIds: ids, favoriteDeckMeta: deckMeta },
  });

  return NextResponse.json({ ok: true });
}

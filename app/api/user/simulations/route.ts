import { auth, clerkClient } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

const MAX_SAVED = 20;

interface SimSummary {
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

interface UserMeta {
  favoriteDeckIds?: string[];
  favoriteDeckMeta?: Record<string, unknown>;
  simResults?: SimSummary[];
}

// ── GET /api/user/simulations ────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = (user.privateMetadata ?? {}) as UserMeta;

  return NextResponse.json(meta.simResults ?? []);
}

// ── POST /api/user/simulations ───────────────────────────────────────────────
// Body: SimSummary fields (without id/savedAt — those are assigned here)

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json() as Omit<SimSummary, "id" | "savedAt">;

  const summary: SimSummary = {
    ...body,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;

  // Prepend and keep last MAX_SAVED entries
  const simResults = [summary, ...(existing.simResults ?? [])].slice(0, MAX_SAVED);

  await client.users.updateUser(userId, {
    privateMetadata: { ...existing, simResults },
  });

  return NextResponse.json({ ok: true, id: summary.id });
}

// ── DELETE /api/user/simulations ─────────────────────────────────────────────
// Body: { id }

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return new NextResponse("Bad Request", { status: 400 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.privateMetadata ?? {}) as UserMeta;

  const simResults = (existing.simResults ?? []).filter((r) => r.id !== id);

  await client.users.updateUser(userId, {
    privateMetadata: { ...existing, simResults },
  });

  return NextResponse.json({ ok: true });
}

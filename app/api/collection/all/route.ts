/**
 * DELETE /api/collection/all
 *
 * Permanently removes every card from the authenticated user's collection
 * by deleting the entire Redis hash key.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clearCollection } from "@/lib/collection";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await clearCollection(userId);
  return NextResponse.json({ ok: true });
}

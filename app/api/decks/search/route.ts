import { NextRequest, NextResponse } from "next/server";
import {
  getDeckIndex,
  searchAllDecks,
  resolveAvatarCardId,
} from "@/lib/decks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q") ?? "";
    const avatar = searchParams.get("avatar") ?? "";
    const sortBy = (searchParams.get("sort_by") ?? "views") as "likes" | "views";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    const index = getDeckIndex();

    if (index) {
      // Fast path: search entirely from the local index
      const q = query.toLowerCase();
      const av = avatar.toLowerCase();

      let results = index.decks.filter((d) => {
        if (q && !d.name.toLowerCase().includes(q)) return false;
        if (av && !d.avatarName.toLowerCase().includes(av)) return false;
        return true;
      });

      results = results.sort((a, b) =>
        sortBy === "likes" ? b.likes - a.likes : b.views - a.views
      );

      return NextResponse.json({
        total: results.length,
        totalIndexed: index.totalDecks,
        results: results.slice(0, limit),
        source: "index",
      });
    }

    // Index not ready — fall back to live search (views sort only)
    if (sortBy === "likes") {
      return NextResponse.json({
        total: 0,
        results: [],
        source: "live",
        message: "Deck index is being built. Sort by likes requires the full index. Please try again in a few minutes.",
      });
    }

    let avatarCardId: string | undefined;
    if (avatar) {
      const resolved = await resolveAvatarCardId(avatar);
      if (!resolved) {
        return NextResponse.json({
          total: 0,
          results: [],
          source: "live",
          message: `Could not find an avatar card named "${avatar}".`,
        });
      }
      avatarCardId = resolved;
    }

    const all = await searchAllDecks(query, avatarCardId);
    const mapped = all.slice(0, limit).map((d) => ({
      id: d.id,
      name: d.name,
      username: d.user?.username ?? "",
      format: d.format ?? "",
      avatarName: d.avatars?.[0]?.card?.name ?? "",
      elements: (d.elements ?? []).map((e) => e.name).filter((e) => e !== "None"),
      likes: d._count?.likes ?? 0,
      views: d._count?.views ?? 0,
    }));

    return NextResponse.json({
      total: all.length,
      totalIndexed: null,
      results: mapped,
      source: "live",
      message: "Deck index is being built in the background (~5 min). Results may be incomplete.",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

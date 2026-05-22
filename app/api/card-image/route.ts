import { type NextRequest, NextResponse } from "next/server";

const DRIVE_BASE = "https://lh3.googleusercontent.com/d";

// Validate that the id looks like a Drive file ID (alphanumeric + _ -)
const VALID_ID = /^[A-Za-z0-9_\-]{10,}$/;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id || !VALID_ID.test(id)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const size = req.nextUrl.searchParams.get("sz") ?? "w220";

  try {
    const upstream = await fetch(`${DRIVE_BASE}/${id}=${size}`, {
      // next.js server-side fetch — revalidate daily
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return new NextResponse("Not Found", { status: upstream.status });
    }

    const body = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "image/png";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 1-hour browser cache, 1-day shared cache — safe for card art
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Upstream Error", { status: 502 });
  }
}

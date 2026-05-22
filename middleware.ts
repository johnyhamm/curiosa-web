import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Clerk middleware only runs when API keys are present in the environment.
// Without keys the site works exactly as before auth was added — auth features
// are simply unavailable until the Clerk env vars are added to Vercel.
const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const withClerk = clerkConfigured ? clerkMiddleware() : null;

export default function middleware(req: NextRequest, ctx: Parameters<NonNullable<typeof withClerk>>[1]) {
  if (!withClerk) return NextResponse.next();
  return withClerk(req, ctx);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

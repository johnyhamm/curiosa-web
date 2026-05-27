import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Clerk v7 requires the middleware export to BE clerkMiddleware() directly —
// wrapping it in a custom function breaks its internal request-context detection
// and causes auth() to throw in API routes.
// When Clerk keys are absent we fall back to a plain pass-through.
const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default clerkConfigured
  ? clerkMiddleware()
  : (_req: NextRequest) => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

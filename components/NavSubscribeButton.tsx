"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Outer shell guards against rendering hooks outside <ClerkProvider />
export function NavSubscribeButton() {
  if (!clerkConfigured) return null;
  return <NavSubscribeButtonInner />;
}

function NavSubscribeButtonInner() {
  const { isSignedIn, has } = useAuth();

  if (!isSignedIn) return null;
  if (has?.({ plan: "user:monthly" })) return null;

  return (
    <Link
      href="/pricing"
      className="px-3 py-1.5 rounded-md text-sm font-semibold text-amber-400 border border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-400 transition-colors"
    >
      Subscribe
    </Link>
  );
}

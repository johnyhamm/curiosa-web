"use client";

import { useAuth } from "@clerk/nextjs";
// CheckoutButton is in the experimental package — Clerk Billing is in public beta
import { CheckoutButton } from "@clerk/nextjs/experimental";

const PLAN_ID = process.env.NEXT_PUBLIC_CLERK_PLAN_ID ?? "";

export function NavSubscribeButton() {
  const { isSignedIn, has } = useAuth();

  // Hide if not signed in, or already a subscriber
  if (!isSignedIn) return null;
  if (has?.({ plan: "user:monthly" })) return null;

  return (
    <CheckoutButton planId={PLAN_ID}>
      <button className="px-3 py-1.5 rounded-md text-sm font-semibold text-amber-400 border border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-400 transition-colors">
        Subscribe
      </button>
    </CheckoutButton>
  );
}

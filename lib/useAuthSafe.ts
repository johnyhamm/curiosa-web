"use client";

import { useAuth } from "@clerk/nextjs";

// NEXT_PUBLIC_ env vars are baked in at build time, so this is a true
// constant — the same branch is always taken for the lifetime of the build.
const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const noAuthFallback = () =>
  ({ isSignedIn: false as const, isLoaded: true as const } as const);

// Assign once at module load — components always call the same function,
// which satisfies React's rules of hooks.
export const useAuthSafe: () => { isSignedIn: boolean | null | undefined; isLoaded: boolean } =
  clerkConfigured ? useAuth : noAuthFallback;

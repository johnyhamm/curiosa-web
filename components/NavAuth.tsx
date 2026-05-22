"use client";

import Link from "next/link";
import { UserButton, SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";

// Baked in at build time — safe to check on the client
const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Outer shell: only mounts the inner component (which calls hooks) when
// ClerkProvider is guaranteed to be in the tree.
export function NavAuth() {
  if (!clerkConfigured) return null;
  return <NavAuthInner />;
}

function NavAuthInner() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    // Invisible placeholder prevents layout shift while Clerk loads
    return <div className="w-20 h-8" />;
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          Profile
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <SignInButton mode="modal">
        <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="px-3 py-2 rounded-md text-sm font-medium bg-amber-500 hover:bg-amber-400 text-gray-950 transition-colors">
          Sign up
        </button>
      </SignUpButton>
    </div>
  );
}

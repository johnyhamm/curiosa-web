"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { useFeedback } from "@/app/components/FeedbackProvider";

const PLAN_ID = "cplan_3E81Ot3T0AQw82rZjHJJynER1Jw";

const NAV_LINKS = [
  { href: "/",            label: "Home" },
  { href: "/cards",       label: "Cards" },
  { href: "/decks",       label: "Decks" },
  { href: "/simulate",    label: "Simulate" },
  { href: "/tournament",  label: "Tournament" },
  { href: "/deckbuilder", label: "Builder" },
];

function MobileAuthSection({ onClose }: { onClose: () => void }) {
  const { isSignedIn, isLoaded, has } = useAuth();
  const isSubscriber = has?.({ plan: "user:monthly" }) ?? false;

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <div className="flex flex-col gap-1">
        {!isSubscriber && (
          <CheckoutButton planId={PLAN_ID}>
            <button className="w-full text-left px-3 py-3 text-sm font-semibold text-amber-400 hover:bg-gray-800 rounded-md transition-colors">
              ✦ Subscribe — remove ads
            </button>
          </CheckoutButton>
        )}
        <Link
          href="/profile"
          onClick={onClose}
          className="px-3 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
        >
          Profile
        </Link>
        <div className="px-3 py-2">
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <SignInButton mode="modal">
        <button
          onClick={onClose}
          className="w-full text-left px-3 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
        >
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button
          onClick={onClose}
          className="w-full text-left px-3 py-3 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-md transition-colors"
        >
          Sign up
        </button>
      </SignUpButton>
    </div>
  );
}

function FeedbackMenuItem({ onClose }: { onClose: () => void }) {
  const { openFeedback } = useFeedback();
  return (
    <button
      onClick={() => { openFeedback(); onClose(); }}
      className="w-full text-left px-3 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
    >
      Feedback
    </button>
  );
}

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on navigation
  useEffect(() => { setIsOpen(false); }, [pathname]);

  return (
    <div className="md:hidden relative">
      {/* Hamburger / close button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Menu panel */}
          <div className="absolute right-0 top-10 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-gray-800 my-1" />
            <FeedbackMenuItem onClose={() => setIsOpen(false)} />
            <div className="border-t border-gray-800 my-1" />
            <MobileAuthSection onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

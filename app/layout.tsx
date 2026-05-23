import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { NavAuth } from "@/components/NavAuth";
import { FeedbackProvider } from "@/app/components/FeedbackProvider";
import { FeedbackNavButton } from "@/app/components/FeedbackNavButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SorcerySim — Sorcery: Contested Realm",
  description: "Card search, deck explorer, and match simulator for Sorcery: Contested Realm",
};

// Clerk requires keys to be present — only wrap with ClerkProvider when configured.
// Without keys the site runs exactly as before: all pages work, auth features are
// simply hidden until NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is added to the environment.
const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Impact affiliate site verification */}
        <meta name="impact-site-verification" content="a1f044c4-92d5-4a24-a3a3-791a56991846" />
      </head>
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
      <FeedbackProvider>
        <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <Link
                href="/"
                className="hover:opacity-80 transition-opacity"
              >
                <img
                  src="/logo-sorcerysim.svg"
                  alt="SorcerySim"
                  height={36}
                  className="h-9 w-auto"
                />
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href="/"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="/cards"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Cards
                </Link>
                <Link
                  href="/decks"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Decks
                </Link>
                <Link
                  href="/simulate"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Simulate
                </Link>
                <Link
                  href="/tournament"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Tournament
                </Link>
                <Link
                  href="/deckbuilder"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Builder
                </Link>
                <FeedbackNavButton />
                <NavAuth />
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-900 border-t border-gray-800 py-6 text-center text-sm text-gray-500">
          SorcerySim — Unofficial simulator for Sorcery: Contested Realm. Data from{" "}
          <a
            href="https://curiosa.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400"
          >
            curiosa.io
          </a>
        </footer>
      </FeedbackProvider>
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (clerkConfigured) {
    return (
      <ClerkProvider>
        <AppShell>{children}</AppShell>
      </ClerkProvider>
    );
  }
  return <AppShell>{children}</AppShell>;
}

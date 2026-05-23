import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel_Decorative } from "next/font/google";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Analytics } from "@vercel/analytics/next";
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

const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "SorcerySim — Sorcery: Contested Realm",
  description: "Card search, deck explorer, and match simulator for Sorcery: Contested Realm",
};

// Clerk requires keys to be present — only wrap with ClerkProvider when configured.
// Without keys the site runs exactly as before: all pages work, auth features are
// simply hidden until NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is added to the environment.
const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Renders the Google AdSense script unless the signed-in user is a subscriber.
// The Stripe webhook (app/api/webhooks/stripe/route.ts) sets
// publicMetadata.isSubscriber on the Clerk user when a subscription is created
// or cancelled.
async function ConditionalAds() {
  if (clerkConfigured) {
    const user = await currentUser();
    const meta = user?.publicMetadata as { isSubscriber?: boolean } | undefined;
    if (meta?.isSubscriber) return null;
  }
  return (
    <script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9007813398645252"
      crossOrigin="anonymous"
    />
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzelDecorative.variable} h-full antialiased`}
    >
      <head>
        {/* Impact affiliate site verification */}
        <meta name="impact-site-verification" content="a1f044c4-92d5-4a24-a3a3-791a56991846" />
        {/* Google AdSense — hidden for subscribers */}
        <ConditionalAds />
      </head>
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
      <FeedbackProvider>
        <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <Link
                href="/"
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                {/* Four elemental symbols — inline so the font loads correctly */}
                <svg width="32" height="32" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Air — upward △ + crossbar, purple */}
                  <g transform="translate(14,14)" stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M0,-11 L-9.5,5.5 L9.5,5.5Z"/>
                    <line x1="-4.8" y1="-2.5" x2="4.8" y2="-2.5"/>
                  </g>
                  {/* Earth — downward △ + crossbar, gold */}
                  <g transform="translate(42,14)" stroke="#d4a017" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M0,11 L-9.5,-5.5 L9.5,-5.5Z"/>
                    <line x1="-4.8" y1="2.5" x2="4.8" y2="2.5"/>
                  </g>
                  {/* Fire — upward △, orange */}
                  <g transform="translate(14,42)" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M0,-11 L-9.5,5.5 L9.5,5.5Z"/>
                  </g>
                  {/* Water — downward △, cyan */}
                  <g transform="translate(42,42)" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M0,11 L-9.5,-5.5 L9.5,-5.5Z"/>
                  </g>
                </svg>
                <span
                  className="text-amber-400 text-xl tracking-wide"
                  style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700 }}
                >
                  SorcerySim
                </span>
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
        <Analytics />
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

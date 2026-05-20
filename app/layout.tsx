import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Curiosa — Sorcery: Contested Realm",
  description: "Card search, deck browser, and match simulator for Sorcery: Contested Realm",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <Link
                href="/"
                className="text-amber-400 font-bold text-xl tracking-tight hover:text-amber-300 transition-colors"
              >
                Curiosa
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
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-900 border-t border-gray-800 py-6 text-center text-sm text-gray-500">
          Curiosa — Unofficial browser for Sorcery: Contested Realm. Data from{" "}
          <a
            href="https://curiosa.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400"
          >
            curiosa.io
          </a>
        </footer>
      </body>
    </html>
  );
}

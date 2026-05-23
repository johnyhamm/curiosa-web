"use client";

import { PricingTable } from "@clerk/nextjs";

export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-12">
        <h1
          className="text-3xl font-bold text-amber-400 mb-3"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Subscribe
        </h1>
        <p className="text-gray-400 text-sm max-w-xl mx-auto">
          Support SorcerySim and enjoy an ad-free experience. Cancel any time.
        </p>
      </div>

      <PricingTable />
    </div>
  );
}

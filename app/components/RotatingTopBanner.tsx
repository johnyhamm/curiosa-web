"use client";

import { useState, useEffect } from "react";

// ── Rotating top banner ───────────────────────────────────────────────────────
// Picks randomly between affiliate banners on each page load.
// Rendered as a client component so the selection is per-visitor, not
// cached server-side. The 100px placeholder prevents layout shift before
// hydration.

export function RotatingTopBanner() {
  const [pick, setPick] = useState<"tcg" | "bcw" | null>(null);

  useEffect(() => {
    setPick(Math.random() < 0.5 ? "tcg" : "bcw");
  }, []);

  // Pre-hydration: reserve the space so the nav doesn't jump
  if (!pick) {
    return <div className="w-full bg-black" style={{ height: 100 }} />;
  }

  if (pick === "bcw") {
    return (
      <div className="w-full bg-black flex justify-center overflow-hidden">
        <a
          href="https://www.bcwsupplies.com?acc=sorcerysim&b=1"
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sorcerysim_bcw_banner_fixed_600x100.png"
            alt="BCW Supplies – 10% off with code sorcerysim"
            width={600}
            height={100}
            style={{ maxWidth: "100%", height: "auto", display: "block" }}
          />
        </a>
      </div>
    );
  }

  // TCGplayer — includes Impact tracking pixels required by the affiliate programme
  return (
    <div className="w-full bg-black flex justify-center overflow-hidden">
      {/* Mobile (< md) */}
      <a
        rel="sponsored"
        href="https://partner.tcgplayer.com/c/7336784/3913672/21018"
        target="_top"
        id="3913672"
        className="block md:hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://a.impactradius-go.com/display-ad/21018-3913672"
          alt="Shop on TCGplayer"
          width={640}
          height={100}
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
        />
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img height={0} width={0} src="https://imp.pxf.io/i/7336784/3913672/21018"
        style={{ position: "absolute", visibility: "hidden" }} alt="" />

      {/* Desktop (md+) */}
      <a
        rel="sponsored"
        href="https://partner.tcgplayer.com/c/7336784/3904322/21018"
        target="_top"
        id="3904322"
        className="hidden md:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://a.impactradius-go.com/display-ad/21018-3904322"
          alt="Shop on TCGplayer"
          width={600}
          height={100}
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
        />
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img height={0} width={0} src="https://imp.pxf.io/i/7336784/3904322/21018"
        style={{ position: "absolute", visibility: "hidden" }} alt="" />
    </div>
  );
}

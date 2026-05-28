"use client";

import { useState, useEffect } from "react";

interface AffiliateBanner {
  /** Unique key — used as React key */
  id: string;
  /** Destination URL when the banner is clicked */
  href: string;
  /** Banner image URL (served by the affiliate / partner) */
  imgSrc: string;
  /** Accessible alt text */
  alt: string;
  /** Native pixel width of the banner */
  width: number;
  /** Native pixel height of the banner */
  height: number;
}

// ─── Add future banners here ───────────────────────────────────────────────
const BANNERS: AffiliateBanner[] = [
  {
    id: "bcw-1",
    href: "https://www.bcwsupplies.com?acc=sorcerysim&b=1",
    imgSrc: "https://www.bcwsupplies.com/affiliate/banner/view/?acc=sorcerysim&b=1",
    alt: "BCW Supplies – card storage & accessories",
    width: 300,
    height: 250,
  },
];
// ──────────────────────────────────────────────────────────────────────────

export function AffiliateBanners() {
  const [banner, setBanner] = useState<AffiliateBanner>(BANNERS[0]);

  // Pick a random banner on mount so each page load (and navigation) can
  // show a different one once there are multiple entries.
  useEffect(() => {
    if (BANNERS.length > 1) {
      setBanner(BANNERS[Math.floor(Math.random() * BANNERS.length)]);
    }
  }, []);

  return (
    <div className="mt-12">
      {/* Section header — same style as Community & Resources */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
          Affiliates &amp; Partners
        </h2>
        <div className="flex-1 border-t border-gray-800" />
      </div>

      {/* Banner(s) */}
      <div className="flex flex-wrap gap-4 items-start">
        <a
          key={banner.id}
          href={banner.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block rounded-lg overflow-hidden border border-gray-800
            hover:border-gray-600 transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.imgSrc}
            alt={banner.alt}
            width={banner.width}
            height={banner.height}
            loading="lazy"
          />
        </a>
      </div>
    </div>
  );
}

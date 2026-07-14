"use client";

import { useState, useEffect } from "react";

interface AffiliateBanner {
  id: string;
  href: string;
  imgSrc: string;
  alt: string;
  width: number;
  height: number;
}

// ─── Add future banners here ───────────────────────────────────────────────
const BANNERS: AffiliateBanner[] = [
  {
    id: "bcw-1",
    href: "https://www.bcwsupplies.com?acc=sorcerysim&b=1",
    imgSrc: "/sorcerysim_bcw_banner_fixed_600x100.png",
    alt: "BCW Supplies – 10% off a retail order with code sorcerysim",
    width: 600,
    height: 100,
  },
];
// ──────────────────────────────────────────────────────────────────────────

export function AffiliateBanners() {
  const [banner, setBanner] = useState<AffiliateBanner>(BANNERS[0]);

  // Pick a random banner on each page load / navigation
  useEffect(() => {
    setBanner(BANNERS[Math.floor(Math.random() * BANNERS.length)]);
  }, []);

  return (
    <div className="mt-12">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
          Affiliates &amp; Partners
        </h2>
        <div className="flex-1 border-t border-gray-800" />
      </div>

      <a
        href={banner.href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block rounded-lg overflow-hidden border border-gray-800
          hover:border-gray-600 transition-colors self-start"
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
  );
}

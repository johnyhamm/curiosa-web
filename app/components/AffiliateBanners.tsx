// ─── Add future banners here ───────────────────────────────────────────────
const BANNERS = [
  {
    id: "tcgplayer-1",
    href: "https://partner.tcgplayer.com/c/7336784/1780961/21018?u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fsorcery-contested-realm%2Fproduct%3FproductLineName%3Dsorcery-contested-realm%26view%3Dgrid",
    imgSrc: "/728x90.jpeg",
    alt: "TCGplayer – Shop Sorcery: Contested Realm singles and sealed product",
    width: 728,
    height: 90,
  },
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
  return (
    <div className="mt-12">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
          Affiliates &amp; Partners
        </h2>
        <div className="flex-1 border-t border-gray-800" />
      </div>

      <div className="flex flex-col gap-3">
        {BANNERS.map((banner) => (
          <a
            key={banner.id}
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
        ))}
      </div>
    </div>
  );
}

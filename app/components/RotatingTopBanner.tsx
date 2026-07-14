// ── Top banner ────────────────────────────────────────────────────────────────
// Shows the BCW Supplies affiliate banner at the top of every page (hidden for
// subscribers — see TopBanner in layout.tsx).

export function RotatingTopBanner() {
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

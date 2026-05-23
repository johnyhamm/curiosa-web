import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <h1
        className="text-3xl font-bold text-amber-400 mb-8"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        About
      </h1>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
        {/* Photo + bio side by side on larger screens */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="shrink-0 mx-auto sm:mx-0">
            <Image
              src="/john-hammond.jpg"
              alt="John Hammond"
              width={160}
              height={160}
              className="rounded-full object-cover border-2 border-amber-700/40 shadow-lg"
            />
          </div>

          <div className="text-gray-300 leading-relaxed space-y-4 text-sm sm:text-base">
            <p>
              This site was built by{" "}
              <span className="text-white font-semibold">John Hammond</span>, who has been a fan of
              Sorcery: Contested Realm since beta was released (missed out on the Kickstarter!).
            </p>
            <p>
              I wanted to build a site that lets me and other players run simulations using the
              decks they&apos;ve built against other decks.
            </p>
            <p>
              This is a work in progress and not perfect given the physical mechanics of the game
              board. That being said, I will endeavour to add fixes and improvements and welcome
              your feedback and bug reports as you use the site.
            </p>
            <p className="text-amber-400 font-medium">Thanks for your support!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

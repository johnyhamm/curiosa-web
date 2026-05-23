import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="text-5xl mb-6">🜄</div>
      <h1
        className="text-3xl font-bold text-gray-300 mb-4"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        Sorry to See You Go
      </h1>
      <p className="text-gray-400 mb-8 leading-relaxed">
        Your subscription wasn&apos;t completed. If you changed your mind or
        ran into an issue, you can try again any time.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/"
          className="inline-block bg-gray-800 hover:bg-gray-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

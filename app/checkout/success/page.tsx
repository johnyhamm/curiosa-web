import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="text-5xl mb-6">✦</div>
      <h1
        className="text-3xl font-bold text-amber-400 mb-4"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        Thank You for Subscribing!
      </h1>
      <p className="text-gray-400 mb-8 leading-relaxed">
        Your subscription is now active. You&apos;ll no longer see ads while
        signed in — enjoy the full SorcerySim experience.
      </p>
      <Link
        href="/"
        className="inline-block bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold px-8 py-3 rounded-lg transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}

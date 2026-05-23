import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const PRICE_ID = process.env.STRIPE_PRICE_ID ?? "price_1TaJqH6GgOgTItIdaLxj06Wp";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://sorcerysim.net";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorised", { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  // If the user already has a Stripe customer ID (from a previous subscription),
  // reuse it to avoid creating duplicate customers in Stripe.
  const existingCustomerId = (
    user?.publicMetadata as { stripeCustomerId?: string } | undefined
  )?.stripeCustomerId;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: email }),
    // Pass clerkUserId on both the session and the subscription so
    // the webhook can identify the user on any event type.
    metadata: { clerkUserId: userId },
    subscription_data: {
      metadata: { clerkUserId: userId },
    },
    success_url: `${BASE_URL}/checkout/success`,
    cancel_url: `${BASE_URL}/checkout/cancel`,
  });

  return Response.json({ url: session.url });
}

import { headers } from "next/headers";
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Tell Next.js to pass the raw body so Stripe can verify the signature.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  try {
    switch (event.type) {
      // User completed checkout — mark as subscriber
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerkUserId;
        if (!clerkUserId) break;

        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            isSubscriber: true,
            stripeCustomerId: session.customer as string,
          },
        });
        console.log(`Marked user ${clerkUserId} as subscriber`);
        break;
      }

      // Subscription resumed or payment succeeded after lapse
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.status !== "active") break;

        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) break;

        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { isSubscriber: true },
        });
        break;
      }

      // Subscription cancelled or payment failed — remove subscriber status
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) break;

        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: { isSubscriber: false },
        });
        console.log(`Removed subscriber status from user ${clerkUserId}`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Error processing Stripe webhook:", err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

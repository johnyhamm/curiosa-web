// Force the /pricing segment to render dynamically. Clerk's <PricingTable />
// needs the runtime ClerkProvider context and can fail during static
// prerendering, which intermittently breaks the production build. Rendering
// this segment at request time avoids prerendering it entirely.

export const dynamic = "force-dynamic";

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

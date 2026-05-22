import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ProfileDashboard } from "./ProfileDashboard";

export const metadata = { title: "Profile — SorcerySim" };

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <ProfileDashboard />;
}

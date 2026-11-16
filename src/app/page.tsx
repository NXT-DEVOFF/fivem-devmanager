import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/presentation");
  if (user.mustChangePassword) redirect("/change-password");
  redirect("/dashboard");
}

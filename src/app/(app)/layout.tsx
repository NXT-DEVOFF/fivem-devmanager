import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { effectivePermissionList } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/server/settings";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const [unread, settings] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    getSettings(),
  ]);

  return (
    <AppShell
      user={{
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        avatarColor: user.avatarColor,
        twoFactorEnabled: user.twoFactorEnabled,
      }}
      permissions={effectivePermissionList(user)}
      serverName={settings.serverName}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}

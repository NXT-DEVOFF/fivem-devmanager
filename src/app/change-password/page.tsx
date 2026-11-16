import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { ChangePasswordForm } from "@/app/change-password/change-password-form";

export const metadata = { title: "Changement de mot de passe" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15 ring-1 ring-primary-500/30">
            <KeyRound className="h-5 w-5 text-primary-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Nouveau mot de passe</h1>
            <p className="text-xs text-muted">
              {user.mustChangePassword
                ? "Un changement est requis avant de continuer."
                : "Renforcez la securite de votre compte."}
            </p>
          </div>
        </div>

        <div className="panel p-6">
          <ChangePasswordForm />
        </div>

        <p className="mt-5 text-center text-[11px] text-muted/70">
          12 caracteres minimum, avec majuscule, minuscule et chiffre. Toutes vos autres sessions
          seront deconnectees.
        </p>
      </div>
    </main>
  );
}

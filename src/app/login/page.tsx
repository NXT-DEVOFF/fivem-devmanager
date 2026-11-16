import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Code2, ShieldCheck, Timer, Users } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "@/app/login/login-form";
import { ThreeBackground } from "@/components/visual/three-background";
import { PageTransition } from "@/components/motion/page-transition";

export const metadata = { title: "Connexion" };

const FEATURES = [
  {
    icon: Timer,
    title: "Sessions de developpement",
    description: "Chronometre serveur, taches associees et rapports automatiques.",
  },
  {
    icon: Code2,
    title: "Editeur & fichiers distants",
    description: "Edition directe des ressources FiveM, detection des modifications.",
  },
  {
    icon: Activity,
    title: "Supervision Pterodactyl",
    description: "Statut, ressources, console et commandes en temps reel.",
  },
  {
    icon: Users,
    title: "Travail d'equipe",
    description: "Roles granulaires, validation des taches et journal d'audit.",
  },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");

  return (
    <main className="relative flex min-h-screen">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-border/60 bg-surface/40 p-12 lg:flex">
        <ThreeBackground className="pointer-events-none absolute inset-0 opacity-80" />
        <div className="pointer-events-none absolute inset-0 subtle-grid opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 shadow-[0_10px_30px_-12px_rgba(88,101,242,0.95)] ring-1 ring-primary-300/30">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">FiveM DevManager</p>
              <p className="text-[11px] text-muted">Centre de developpement</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-md text-[34px] font-semibold leading-[1.18] tracking-tight">
            Toute l&apos;equipe, toutes les ressources, <span className="text-gradient">un seul poste de pilotage.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            Connectez votre panel Pterodactyl, travaillez directement sur les fichiers du serveur
            et gardez une trace precise de chaque modification.
          </p>

          <div className="mt-10 grid max-w-md gap-5">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-gradient-to-br from-elevated to-card shadow-[0_8px_20px_-14px_rgba(0,0,0,0.9)]">
                  <feature.icon className="h-4 w-4 text-primary-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-fg">{feature.title}</p>
                  <p className="text-xs text-muted">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Sessions chiffrees, cookies HttpOnly, argon2id, RBAC et journal d&apos;audit.
        </div>
      </section>

      <section className="flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-[400px] rounded-2xl border border-border/70 bg-card/50 p-7 shadow-pop backdrop-blur-sm sm:p-8">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 shadow-[0_10px_30px_-12px_rgba(88,101,242,0.95)] ring-1 ring-primary-300/30">
                  <Code2 className="h-5 w-5 text-white" />
                </div>
              <div>
                <p className="text-sm font-semibold">FiveM DevManager</p>
                <p className="text-[11px] text-muted">Centre de developpement</p>
              </div>
            </div>
          </div>
          <h2 className="text-[22px] font-semibold leading-tight tracking-tight">Connexion</h2>
          <p className="mt-1 text-sm text-muted">Accedez a votre espace de developpement.</p>
          <div className="mt-7">
            <PageTransition>
              <LoginForm />
            </PageTransition>
          </div>
          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted/70">
            Les comptes sont crees par un administrateur. Contactez votre responsable si vous
            n&apos;avez pas encore d&apos;acces.
          </p>
          <Link
            href="/presentation"
            className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-primary-300 transition-colors hover:text-primary-200"
          >
            Découvrir FiveM DevManager
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </main>
  );
}

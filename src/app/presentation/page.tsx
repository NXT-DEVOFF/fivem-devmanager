import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Check,
  CheckCircle2,
  Code2,
  Database,
  Download,
  FileText,
  Gauge,
  Globe2,
  HardDrive,
  LayoutDashboard,
  LockKeyhole,
  Play,
  Rocket,
  ScrollText,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Timer,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const SALES_EMAIL = "contact@bl-host.site";
const SALES_HREF = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Démo FiveM DevManager")}`;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    absolute: "FiveM DevManager — Le cockpit tout-en-un pour développeurs FiveM",
  },
  description:
    "Sessions, FiveM Studio, anticheat, éditeur, déploiements et supervision Pterodactyl. FiveM DevManager centralise le travail de votre équipe dans un seul cockpit. Community AGPL, Self-hosted Commercial ou Managed.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/presentation" },
  openGraph: {
    title: "FiveM DevManager — Le cockpit tout-en-un pour développeurs FiveM",
    description:
      "Une seule plateforme pour développer, livrer et superviser votre serveur FiveM. Community AGPL, Self-hosted Commercial ou Managed.",
    type: "website",
    locale: "fr_FR",
    url: "/presentation",
    images: [
      {
        url: "/brand/fivem-devmgr-banner-og.png",
        width: 1200,
        height: 630,
        alt: "FiveM DevManager — Le cockpit tout-en-un pour développeurs FiveM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FiveM DevManager",
    description:
      "Le cockpit tout-en-un pour développeurs FiveM. Sessions, Studio, anticheat, éditeur, déploiements et supervision Pterodactyl.",
    images: ["/brand/fivem-devmgr-banner-og.png"],
  },
};

const NAV = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#apercu", label: "Aperçu" },
  { href: "#teaser", label: "Teaser" },
  { href: "#securite", label: "Sécurité" },
  { href: "#offres", label: "Offres" },
  { href: "#technique", label: "Technique" },
];

const FEATURES: Array<{
  icon: LucideIcon;
  number: string;
  kicker: string;
  title: string;
  description: string;
  points: string[];
}> = [
  {
    icon: LayoutDashboard,
    number: "01",
    kicker: "Pilotage",
    title: "Le cockpit temps réel",
    description:
      "La santé du serveur, les ressources Pterodactyl, le sprint actif et l'activité de l'équipe dans une seule vue.",
    points: ["CPU, RAM et disque", "Sprint, incidents et charge", "Fil d'activité Socket.IO"],
  },
  {
    icon: Wrench,
    number: "02",
    kicker: "FiveM Studio",
    title: "118 outils pour livrer plus vite",
    description:
      "Générez véhicules, MLO, mappings, scripts, configurations et ressources complètes sans repartir de zéro.",
    points: ["Builder MLO 3D", "Handling & vehicles.meta", "Export ZIP prêt à intégrer"],
  },
  {
    icon: Timer,
    number: "03",
    kicker: "Sessions",
    title: "Le travail laisse une trace",
    description:
      "Chronomètre calculé côté serveur, tâches et fichiers liés au travail réel, rapport de fin de session en PDF.",
    points: ["Temps actif serveur", "Kanban et validation", "Rapport PDF automatique"],
  },
  {
    icon: ShieldAlert,
    number: "04",
    kicker: "Anticheat",
    title: "Voir, prouver, décider",
    description:
      "Un anticheat server-authoritative en mode rapport. Les preuves sont conservées, la sanction reste humaine.",
    points: ["Aucune DLL cliente", "Agrégation des alertes", "Zéro ban automatique"],
  },
  {
    icon: Rocket,
    number: "05",
    kicker: "Livraison",
    title: "Déployer sans casser",
    description:
      "Monaco, diff, snapshots et déploiements avec approbation. Un rollback est toujours à portée de main.",
    points: ["Éditeur Monaco local", "Snapshot avant écriture", "Approbation et rollback"],
  },
  {
    icon: Users,
    number: "06",
    kicker: "Équipe",
    title: "Une équipe, des règles claires",
    description:
      "Rôles, permissions granulaires, 2FA, notifications et journal d'audit pour travailler à plusieurs sans angle mort.",
    points: ["RBAC + overrides", "2FA TOTP", "Audit et notifications"],
  },
];

const STACK = [
  "Next.js 15",
  "React 19",
  "TypeScript strict",
  "Prisma",
  "MariaDB / MySQL",
  "Socket.IO",
  "Pterodactyl API",
  "Monaco",
  "Three.js",
  "Tailwind CSS",
];

const FAQ = [
  {
    question: "FiveM DevManager remplace-t-il Pterodactyl ?",
    answer:
      "Non. Il s'y connecte pour lire l'état du serveur, ouvrir la console, agir sur les ressources et suivre les sauvegardes. Pterodactyl reste la couche d'hébergement ; DevManager est le cockpit de l'équipe de développement.",
  },
  {
    question: "L'anticheat bannit-il automatiquement les joueurs ?",
    answer:
      "Non. L'agent est server-authoritative et fonctionne en mode rapport : il détecte, agrège et conserve les preuves. L'équipe analyse puis décide. Aucune sanction n'est déclenchée automatiquement par le panel.",
  },
  {
    question: "Quelle différence entre Community, Self-hosted Commercial et Managed ?",
    answer:
      "Le code est le même. La Community Edition est gratuite sous AGPL-3.0 et s'auto-héberge sans support contractuel. L'offre Self-hosted Commercial ajoute une licence commerciale, le support, les garanties et le gate Keygate. En Managed, BL-Host fournit l'instance, les sauvegardes, la supervision, les mises à jour et le SLA.",
  },
  {
    question: "Quels sont les prérequis d'une installation auto-hébergée ?",
    answer:
      "Node.js 20.11 ou supérieur, une base MariaDB/MySQL dédiée et un reverse proxy HTTPS avec WebSocket. L'egg Pterodactyl fourni automatise l'installation, les migrations et le build.",
  },
  {
    question: "Le logiciel est-il open source ?",
    answer:
      "Oui. Le cœur est distribué sous AGPL-3.0-only : vous pouvez l'auto-héberger, le modifier et le redistribuer selon cette licence. L'édition commerciale, les secrets d'exploitation et l'infrastructure restent privés. Une démonstration dédiée peut être demandée pour une évaluation.",
  },
  {
    question: "Combien de temps prend la mise en service ?",
    answer:
      "Une mise en service assistée comprend l'installation, la configuration, la recette et deux heures de formation à distance. Le périmètre exact est confirmé dans le devis.",
  },
];

export default function PresentationPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-fg">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Aller au contenu
      </a>

      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/presentation" className="group flex min-w-0 items-center gap-3">
            <Image
              src="/brand/fivem-devmgr-logo-3d.png"
              alt=""
              width={40}
              height={40}
              className="h-9 w-9 shrink-0 rounded-xl object-contain"
            />
            <span className="truncate text-[13px] font-semibold tracking-tight sm:text-sm">
              FiveM <span className="text-primary-300">DevManager</span>
            </span>
          </Link>

          <nav aria-label="Navigation de présentation" className="hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[12px] text-muted transition-colors hover:text-fg"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-lg px-3 text-[12px] font-medium text-muted transition-colors hover:bg-white/5 hover:text-fg sm:inline-flex"
            >
              Connexion
            </Link>
            <a
              href={SALES_HREF}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-primary-400 to-primary-600 px-3.5 text-[12px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_24px_-12px_rgba(88,101,242,0.9)] transition hover:from-primary-400 hover:to-primary-500 sm:px-4"
            >
              <span className="hidden sm:inline">Demander une démo</span>
              <span className="sm:hidden">Démo</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </a>
            <MobileNav items={NAV} salesHref={SALES_HREF} />
          </div>
        </div>
      </header>

      <main id="contenu">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-350px] h-[760px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(88,101,242,0.22),rgba(88,101,242,0.06)_55%,transparent_75%)]" />
            <div className="absolute right-[-180px] top-[180px] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.13),transparent_70%)]" />
            <div className="absolute inset-0 subtle-grid opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:gap-10 lg:pb-28 lg:pt-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/25 bg-primary-500/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-200">
                <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                BL-Host · FiveM tooling
              </div>

              <h1 className="mt-6 text-[42px] font-semibold leading-[1.05] tracking-[-0.045em] text-balance sm:text-[58px] lg:text-[66px]">
                Le cockpit <span className="text-gradient">tout-en-un</span> pour développeurs FiveM.
              </h1>

              <p className="mt-6 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
                Sessions, Studio, anticheat, éditeur, déploiements et supervision Pterodactyl.
                Une seule plateforme pour livrer plus vite, sans perdre le contrôle.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={SALES_HREF}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-primary-400 to-primary-600 px-5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_30px_-14px_rgba(88,101,242,0.95)] transition hover:from-primary-400 hover:to-primary-500"
                >
                  Demander une démo
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <a
                  href="#fonctionnalites"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-border-strong bg-white/[0.03] px-5 text-sm font-medium text-fg transition hover:border-primary-400/50 hover:bg-white/[0.06]"
                >
                  Explorer les fonctionnalités
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted">
                {[
                  "Open source · AGPL-3.0",
                  "Self-hosted ou Managed",
                  "Pterodactyl ready",
                  "2FA & audit",
                  "Démo privée",
                ].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-success" aria-hidden />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[520px] lg:mx-0">
              <div className="relative flex aspect-square items-center justify-center">
                <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgba(88,101,242,0.34),rgba(56,189,248,0.08)_58%,transparent_76%)] blur-2xl" />
                <div className="absolute inset-[20%] rounded-full border border-primary-400/15" />
                <div className="absolute inset-[8%] rounded-full border border-white/[0.04]" />
                <Image
                  src="/brand/fivem-devmgr-logo-3d.png"
                  alt="Logo 3D FiveM DevManager"
                  width={1024}
                  height={1024}
                  priority
                  sizes="(max-width: 768px) 86vw, 440px"
                  className="relative z-10 h-auto w-[78%] max-w-[430px] object-contain drop-shadow-[0_36px_70px_rgba(0,0,0,0.55)]"
                />
                <div className="absolute left-0 top-[22%] z-20 hidden rounded-xl border border-border/80 bg-[#0C1220]/90 px-3 py-2 shadow-lift backdrop-blur-md sm:block">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Studio</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-fg">118 outils</p>
                </div>
                <div className="absolute bottom-[20%] right-0 z-20 hidden rounded-xl border border-success/25 bg-[#0B1716]/90 px-3 py-2 shadow-lift backdrop-blur-md sm:block">
                  <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Live
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-fg">Pterodactyl</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { value: "118", label: "outils Studio" },
                  { value: "99,5 %", label: "SLA Managed" },
                  { value: "0", label: "ban automatique" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border/80 bg-card/55 px-3 py-3 text-center backdrop-blur-sm sm:px-4"
                  >
                    <p className="text-lg font-semibold tracking-tight text-fg sm:text-xl">{stat.value}</p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-muted sm:text-[10px]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-7xl px-5 pb-12 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/[0.07] py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/70">
                Pensé pour l&apos;écosystème FiveM
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted/70">
                {["Pterodactyl", "MariaDB", "Socket.IO", "Monaco", "Three.js", "Discord"].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-white/[0.018] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Le problème
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                Trop d&apos;onglets. Trop de décisions sans trace.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                Un serveur FiveM se développe à plusieurs, avec des fichiers qui changent vite et des
                incidents qui n&apos;attendent pas. Le cockpit doit raconter la même histoire que le serveur.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  number: "01",
                  title: "L&apos;information est dispersée",
                  text: "Pterodactyl, console, Discord, tableurs, tickets : chacun voit une partie du serveur, personne ne voit le tout.",
                },
                {
                  number: "02",
                  title: "Le travail n&apos;est pas mesuré",
                  text: "Qui a touché quel fichier, pendant combien de temps, pour quelle tâche ? Sans trace, la confiance devient une opinion.",
                },
                {
                  number: "03",
                  title: "Les incidents arrivent avant les rapports",
                  text: "Une alerte anticheat, un déploiement raté ou une session oubliée coûtent plus cher quand ils sont découverts trop tard.",
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="rounded-2xl border border-border/80 bg-card/45 p-6 transition-colors hover:border-border-strong"
                >
                  <p className="mono text-[10px] font-semibold tracking-[0.18em] text-primary-300/80">
                    {item.number}
                  </p>
                  <h3 className="mt-5 text-base font-semibold text-fg">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-muted">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                  <span className="h-1 w-1 rounded-full bg-primary-400" />
                  Les modules essentiels
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                  Tout ce qu&apos;il faut pour livrer, <span className="text-gradient">sans lâcher le serveur.</span>
                </h2>
              </div>
              <a
                href={SALES_HREF}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-300 transition hover:text-primary-200"
              >
                Voir la démo
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.number}
                  className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/50 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-500/35 hover:bg-card/80 hover:shadow-[0_24px_50px_-36px_rgba(0,0,0,0.95)]"
                >
                  <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-primary-500/[0.06] blur-2xl transition-colors group-hover:bg-primary-500/[0.12]" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-300">
                      <feature.icon className="h-[18px] w-[18px]" aria-hidden />
                    </div>
                    <div className="text-right">
                      <p className="mono text-[10px] text-muted/50">{feature.number}</p>
                      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted/70">
                        {feature.kicker}
                      </p>
                    </div>
                  </div>

                  <h3 className="relative mt-6 text-lg font-semibold tracking-[-0.02em] text-fg">
                    {feature.title}
                  </h3>
                  <p className="relative mt-2 text-[13px] leading-6 text-muted">{feature.description}</p>

                  <ul className="relative mt-5 space-y-2 border-t border-white/[0.06] pt-4">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 text-[11px] text-muted">
                        <Check className="h-3 w-3 shrink-0 text-success" aria-hidden />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border/80 bg-card/40 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                  Le fil de travail
                </span>
                {["Session", "Édition", "Validation", "Rapport", "Patch note", "Discord"].map(
                  (step, index) => (
                    <span key={step} className="flex items-center gap-3">
                      <span className="mono text-[10px] text-muted">{step}</span>
                      {index < 5 ? <ArrowRight className="h-3 w-3 text-muted/30" aria-hidden /> : null}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="apercu" className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.018] py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-16">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Le cockpit
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                Une vue claire, même quand le serveur ne l&apos;est pas.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                Le dashboard rassemble les signaux qui comptent : état Pterodactyl, ressources,
                sprint actif, incidents et activité de l&apos;équipe. Pas un mur de métriques :
                un poste de commande.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  "Santé serveur et ressources Pterodactyl",
                  "Sprint actif, priorités et charge de l'équipe",
                  "Activité live : sessions, fichiers, bugs, déploiements",
                  "Actions rapides : session, console, déploiement",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-muted">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <DashboardPreview />
          </div>
        </section>

        <section id="teaser" className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.018] py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Teaser · 15 secondes
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                Le cockpit en <span className="text-gradient">15 secondes.</span>
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                Une vidéo verticale pensée pour Discord, TikTok, Reels et Shorts : l&apos;accroche,
                le cockpit, les six modules, la sécurité et l&apos;appel à l&apos;action.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  "Format 9:16 · 1080 × 1920 · 30 fps",
                  "MP4 H.264 de 8 Mo, compatible Discord",
                  "Sans son : prêt pour une musique ou une voix off",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-muted">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="/media/fivem-devmgr-teaser-vertical.mp4"
                  download
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-primary-400 to-primary-600 px-5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_30px_-14px_rgba(88,101,242,0.95)] transition hover:from-primary-400 hover:to-primary-500"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Télécharger le MP4
                </a>
                <a
                  href="#contact"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-border-strong bg-white/[0.03] px-5 text-sm font-medium text-fg transition hover:border-primary-400/50 hover:bg-white/[0.06]"
                >
                  Demander une démo
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>

              <p className="mt-4 text-[10px] leading-5 text-muted/60">
                Version haute qualité disponible sur demande. Le fichier est silencieux et ne
                contient ni sous-titres ni piste audio.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[360px]">
              <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(88,101,242,0.2),transparent_72%)] blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-border-strong/80 bg-[#050810] p-2 shadow-[0_35px_80px_-40px_rgba(0,0,0,1)]">
                <div className="relative overflow-hidden rounded-[1.45rem] bg-black">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] w-full bg-[#050810]"
                    aria-label="Teaser vertical FiveM DevManager — 15 secondes"
                  >
                    <source src="/media/fivem-devmgr-teaser-vertical.mp4" type="video/mp4" />
                    Votre navigateur ne prend pas en charge la vidéo HTML5.
                  </video>
                  <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/80 backdrop-blur-sm">
                    <Play className="h-2.5 w-2.5 fill-current" aria-hidden /> 9:16
                  </span>
                </div>
              </div>
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted/60">
                FiveM DevManager · teaser 15 s · sans son
              </p>
            </div>
          </div>
        </section>

        <section id="securite" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                  <span className="h-1 w-1 rounded-full bg-primary-400" />
                  Sécurité
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                  La confiance se construit <span className="text-gradient">côté serveur.</span>
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted">
                  Une plateforme qui touche à vos fichiers, à votre console et à vos secrets doit
                  être plus stricte qu&apos;un simple tableau de bord. Les décisions sensibles restent
                  côté serveur, jamais dans le navigateur.
                </p>

                <div className="mt-7 rounded-2xl border border-success/20 bg-success/[0.04] p-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-success">
                    <BadgeCheck className="h-4 w-4" aria-hidden />
                    Principe anticheat
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-muted">
                    Server-authoritative, aucune DLL cliente. Le panel conserve les preuves et
                    laisse la décision à l&apos;équipe : <span className="text-fg">aucun ban automatique.</span>
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: LockKeyhole,
                    title: "Secrets chiffrés",
                    text: "Clés Pterodactyl, SFTP et webhooks Discord chiffrés en AES-256-GCM. La clé maîtresse reste hors base.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Accès maîtrisés",
                    text: "RBAC, permissions granulaires, 2FA TOTP, révocation de sessions et journal d'audit.",
                  },
                  {
                    icon: ShieldAlert,
                    title: "Anticheat responsable",
                    text: "Détections agrégées, preuves techniques conservées, résolution motivée et faux positifs traçables.",
                  },
                  {
                    icon: ScrollText,
                    title: "Livraison réversible",
                    text: "Snapshot avant écriture, déploiement approuvé, rollback contrôlé. Aucun redémarrage automatique du serveur.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border/80 bg-card/45 p-5 transition-colors hover:border-border-strong"
                  >
                    <item.icon className="h-[18px] w-[18px] text-primary-300" aria-hidden />
                    <h3 className="mt-4 text-sm font-semibold text-fg">{item.title}</h3>
                    <p className="mt-2 text-[12px] leading-6 text-muted">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border/70 bg-card/30 px-5 py-4 text-[10px] font-medium uppercase tracking-[0.13em] text-muted/70">
              {["Cookies HttpOnly", "CSRF", "CSP", "Rate limiting", "Argon2id", "Audit immuable"].map(
                (item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-success" aria-hidden />
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        <section id="offres" className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.018] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Offres
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                Votre infrastructure, ou la nôtre.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                Le même code, trois façons de l&apos;exploiter. Le cœur est open source ; les offres
                payantes couvrent la licence commerciale, le support et l&apos;exploitation.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-success/20 bg-success/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-success/20 bg-success/10 text-success">
                  <Code2 className="h-[18px] w-[18px]" aria-hidden />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-fg">Community Edition</p>
                    <span className="rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-success">
                      AGPL-3.0
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-[12px] leading-6 text-muted">
                    Le cœur open source, gratuit et auto-hébergeable. Sans support contractuel,
                    garantie ni SLA.
                  </p>
                </div>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-2xl font-semibold tracking-[-0.03em]">0 €</p>
                <p className="text-[10px] text-muted/70">sous AGPL-3.0-only</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-border/80 bg-card/50 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Self-hosted Commercial</p>
                    <h3 className="mt-2 text-xl font-semibold">Votre infrastructure. Licence commerciale.</h3>
                  </div>
                  <Server className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </div>
                <p className="mt-4 text-[13px] leading-6 text-muted">
                  Pour les équipes qui veulent garder la maîtrise de leur hébergement et qui ont
                  besoin d&apos;une licence commerciale, du support et de garanties.
                </p>
                <div className="mt-7">
                  <span className="text-4xl font-semibold tracking-[-0.04em]">1 900 €</span>
                  <span className="ml-1 text-sm text-muted">HT</span>
                  <p className="mt-1 text-[11px] text-muted/70">Licence commerciale · 1 production + 1 staging</p>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {[
                    "Alternative à l'AGPL-3.0",
                    "12 mois de mises à jour et support",
                    "Onboarding assisté : 690 € HT en option",
                    "Maintenance : 380 € HT/an à partir de l'année 2",
                    "Installation sur Pterodactyl ou VPS",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[12px] text-muted">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Devis FiveM DevManager — Self-hosted Commercial")}`}
                  className="mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-strong bg-white/[0.03] px-4 text-sm font-medium text-fg transition hover:border-primary-400/50 hover:bg-white/[0.06]"
                >
                  Demander un devis
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>

              <div className="relative flex flex-col overflow-hidden rounded-2xl border border-primary-400/35 bg-gradient-to-b from-primary-500/[0.12] to-card/70 p-6 shadow-[0_0_0_1px_rgba(88,101,242,0.08),0_30px_70px_-44px_rgba(88,101,242,0.7)] sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-500/20 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-200">Managed</p>
                      <span className="rounded-full border border-primary-300/30 bg-primary-400/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary-100">
                        Accompagné
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-semibold">On héberge. Vous livrez.</h3>
                  </div>
                  <Globe2 className="h-5 w-5 shrink-0 text-primary-200" aria-hidden />
                </div>
                <p className="relative mt-4 text-[13px] leading-6 text-muted">
                  Une instance dédiée, supervisée et sauvegardée par BL-Host. Votre équipe se
                  concentre sur le serveur FiveM.
                </p>
                <div className="relative mt-7">
                  <span className="text-4xl font-semibold tracking-[-0.04em]">179 €</span>
                  <span className="ml-1 text-sm text-muted">HT / mois</span>
                  <p className="mt-1 text-[11px] text-muted/70">ou 1 790 € HT/an · mise en service 490 € HT</p>
                </div>
                <ul className="relative mt-6 space-y-2.5">
                  {[
                    "10 utilisateurs inclus",
                    "20 Go de sauvegardes",
                    "SLA 99,5 % · RPO 24 h / RTO 4 h",
                    "Supervision, mises à jour et support inclus",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[12px] text-muted">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Devis FiveM DevManager — Managed")}`}
                  className="relative mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-primary-400 to-primary-600 px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_24px_-12px_rgba(88,101,242,0.9)] transition hover:from-primary-400 hover:to-primary-500"
                >
                  Demander une démo
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </div>

            <p className="mt-4 text-[10px] leading-5 text-muted/60">
              Tarifs HT hors options, issus de la documentation commerciale v1.1. Contrat, DPA, SLA
              et licence AGPL communiqués sur demande. Les montants peuvent évoluer avant signature.
            </p>
          </div>
        </section>

        <section id="technique" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                  <span className="h-1 w-1 rounded-full bg-primary-400" />
                  Sous le capot
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                  Un dépôt, une stack lisible.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted">
                  Next.js et TypeScript strict côté application, Prisma et MariaDB côté données,
                  Socket.IO pour le temps réel, Pterodactyl pour l&apos;infrastructure. Les outils
                  FiveM sont générés localement, sans dépendance à un service opaque.
                </p>

                <div className="mt-7 flex flex-wrap gap-2">
                  {STACK.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-border/80 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-8 rounded-2xl border border-border/80 bg-card/40 p-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-fg">
                    <LockKeyhole className="h-4 w-4 text-primary-300" aria-hidden />
                    Open source & commercial
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-muted">
                    Le cœur est distribué sous AGPL-3.0-only. L&apos;édition commerciale ajoute le
                    support, les garanties et le gate Keygate. Les secrets d&apos;exploitation ne
                    sont jamais publiés.
                  </p>
                  <a
                    href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Conditions de licence FiveM DevManager")}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary-300 hover:text-primary-200"
                  >
                    Demander les conditions
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Wrench, value: "118", label: "outils FiveM Studio", hint: "5 catégories" },
                  { icon: Code2, value: "92", label: "routes API", hint: "Next.js App Router" },
                  { icon: ShieldCheck, value: "135", label: "tests unitaires", hint: "23 fichiers" },
                  { icon: FileText, value: "48", label: "pages produit", hint: "cockpit complet" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border/80 bg-card/45 p-5">
                    <div className="flex items-center justify-between">
                      <item.icon className="h-4 w-4 text-primary-300" aria-hidden />
                      <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted/50">
                        {item.hint}
                      </span>
                    </div>
                    <p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">{item.value}</p>
                    <p className="mt-1 text-[11px] text-muted">{item.label}</p>
                  </div>
                ))}

                <div className="rounded-2xl border border-border/80 bg-card/45 p-5 sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.12em] text-muted/70">
                    <span className="inline-flex items-center gap-1.5">
                      <TerminalSquare className="h-3.5 w-3.5 text-primary-300" aria-hidden /> Pterodactyl
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-primary-300" aria-hidden /> Prisma
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-primary-300" aria-hidden /> Socket.IO
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Boxes className="h-3.5 w-3.5 text-primary-300" aria-hidden /> Three.js
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5 text-primary-300" aria-hidden /> Recharts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-white/[0.018] py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Questions fréquentes
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                Les réponses avant la démo.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                Une question qui n&apos;est pas ici ? Écrivez-nous, on répond avec le périmètre exact.
              </p>
              <a
                href={SALES_HREF}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary-300 hover:text-primary-200"
              >
                Poser une question
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>

            <div className="space-y-2">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-border/80 bg-card/45 px-4 py-3.5 transition-colors open:border-border-strong sm:px-5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-medium text-fg marker:hidden">
                    {item.question}
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-muted transition-transform group-open:rotate-45">
                      <span className="text-base leading-none">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-[12px] leading-6 text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-3xl border border-primary-400/25 bg-gradient-to-br from-primary-500/[0.16] via-card/60 to-[#0A101C] p-7 shadow-[0_0_0_1px_rgba(88,101,242,0.08),0_40px_90px_-50px_rgba(0,0,0,1)] sm:p-12">
              <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-primary-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
              <Image
                src="/brand/fivem-devmgr-logo-3d.png"
                alt=""
                width={1024}
                height={1024}
                className="pointer-events-none absolute -right-8 bottom-[-110px] hidden h-[360px] w-[360px] object-contain opacity-[0.18] blur-[0.5px] lg:block"
              />

              <div className="relative max-w-2xl">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-200">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Démo privée
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-4xl">
                  Voyez le cockpit avec <span className="text-gradient">vos contraintes.</span>
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
                  Une démonstration sur une instance dédiée, avec vos cas d&apos;usage : Pterodactyl,
                  Studio, sessions, anticheat ou déploiements. Pas de slide, que du concret.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href={SALES_HREF}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-primary-400 to-primary-600 px-5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_30px_-14px_rgba(88,101,242,0.95)] transition hover:from-primary-400 hover:to-primary-500"
                  >
                    Demander une démo
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                  <Link
                    href="/login"
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-border-strong bg-white/[0.03] px-5 text-sm font-medium text-fg transition hover:border-primary-400/50 hover:bg-white/[0.06]"
                  >
                    Accéder au panel
                  </Link>
                </div>

                <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted/60">
                  <span className="inline-flex items-center gap-1.5">
                    <Globe2 className="h-3 w-3" aria-hidden /> Francophone
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <HardDrive className="h-3 w-3" aria-hidden /> Hébergement EU
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="h-3 w-3" aria-hidden /> Managed 99,5 %
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/fivem-devmgr-logo-3d.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-contain"
            />
            <div>
              <p className="text-[12px] font-semibold">FiveM DevManager</p>
              <p className="text-[10px] text-muted">BL-Host · v1.0.0 · AGPL-3.0</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
            <span>© {new Date().getFullYear()} BL-Host</span>
            <a href="#fonctionnalites" className="transition hover:text-fg">
              Fonctionnalités
            </a>
            <a href="#offres" className="transition hover:text-fg">
              Offres
            </a>
            <a href={SALES_HREF} className="transition hover:text-fg">
              Contact
            </a>
            <Link href="/mentions-legales" className="transition hover:text-fg">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="transition hover:text-fg">
              Confidentialité
            </Link>
            <Link href="/login" className="transition hover:text-fg">
              Connexion
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-7xl px-5 sm:px-8">
          <p className="border-t border-white/[0.05] pt-4 text-[10px] leading-5 text-muted">
            Projet indépendant, non affilié à Cfx.re, Rockstar Games ou Take-Two
            Interactive. FiveM est une marque de ses propriétaires respectifs.
          </p>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(88,101,242,0.14),transparent_70%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border-strong/80 bg-[#0A0F1B] shadow-[0_40px_90px_-50px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
              <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
              <span className="h-2 w-2 rounded-full bg-[#28C840]" />
            </div>
            <span className="mono text-[9px] text-muted/60">fdm / cockpit</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-success/20 bg-success/[0.07] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Temps réel
          </span>
        </div>

        <div className="p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted/60">Santé</p>
                  <p className="mt-1 text-lg font-semibold">92</p>
                </div>
                <HealthRing />
              </div>
              <p className="mt-2 text-[9px] text-muted/60">Tous les signaux sont verts</p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted/60">Serveur</p>
                <span className="inline-flex items-center gap-1 text-[8px] font-medium text-success">
                  <span className="h-1 w-1 rounded-full bg-success" /> running
                </span>
              </div>
              <p className="mt-1.5 text-[12px] font-semibold">Web — ChicagoRP</p>
              <div className="mt-3 space-y-2">
                <Meter label="CPU" value={34} />
                <Meter label="RAM" value={46} />
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted/60">Sprint 04</p>
                <span className="mono text-[8px] text-primary-300">68 %</span>
              </div>
              <p className="mt-1.5 text-[12px] font-semibold">Stabilité serveur</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary-500 to-info" />
              </div>
              <p className="mt-2 text-[9px] text-muted/60">12 / 18 tâches terminées</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted/60">
                Activité en direct
              </p>
              <span className="mono text-[8px] text-muted/40">socket.io</span>
            </div>
            <div className="mt-2.5 space-y-2.5">
              {[
                { color: "bg-primary-400", title: "Session démarrée", detail: "lead-dev · il y a 2 min" },
                { color: "bg-info", title: "Fichier modifié", detail: "[vehicles]/garage/client.lua" },
                { color: "bg-warning", title: "Alerte anticheat", detail: "Vitesse suspecte · 3 occurrences" },
                { color: "bg-success", title: "Déploiement approuvé", detail: "garage · snapshot 42 fichiers" },
              ].map((row) => (
                <div key={row.title} className="flex items-center gap-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.color}`} />
                  <p className="min-w-0 flex-1 truncate text-[9.5px] text-fg/90">{row.title}</p>
                  <p className="hidden max-w-[45%] truncate text-[8.5px] text-muted/55 sm:block">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-[8px] text-muted/60">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Pterodactyl connecté
            </span>
            <span className="mono text-[8px] text-muted/40">build 1.0.0 · eu-west</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthRing() {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r="17"
          fill="none"
          stroke="#22C55E"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 17}`}
          strokeDashoffset={`${2 * Math.PI * 17 * 0.08}`}
        />
      </svg>
      <span className="absolute text-[9px] font-semibold text-success">92</span>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[8px] text-muted/60">
        <span>{label}</span>
        <span>{value} %</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-primary-400/80" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

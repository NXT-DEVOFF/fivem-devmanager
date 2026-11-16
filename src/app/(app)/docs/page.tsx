"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookMarked,
  Check,
  Copy,
  ExternalLink,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  DOCS_FRAMEWORKS,
  FIVEM_DOCS,
  type DocsCodeBlock,
} from "@/lib/fivem-docs";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export default function DocsPage() {
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [framework, setFramework] = React.useState<string>("all");
  const [category, setCategory] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState(FIVEM_DOCS[0]?.id ?? "");
  const [copied, setCopied] = React.useState<string | null>(null);

  const categories = React.useMemo(
    () => [...new Set(FIVEM_DOCS.map((doc) => doc.category))].sort((a, b) => a.localeCompare(b, "fr")),
    [],
  );

  const filtered = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return FIVEM_DOCS.filter((doc) => {
      if (framework !== "all" && doc.framework !== framework) return false;
      if (category !== "all" && doc.category !== category) return false;
      if (!needle) return true;

      const searchable = [
        doc.title,
        doc.summary,
        doc.category,
        doc.level,
        ...doc.tags,
        ...doc.sections.flatMap((section) => [
          section.title,
          section.text ?? "",
          ...(section.bullets ?? []),
          section.code?.title ?? "",
          section.code?.code ?? "",
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(needle);
    });
  }, [category, deferredQuery, framework]);

  const active = filtered.find((doc) => doc.id === selectedId) ?? filtered[0] ?? null;
  const activeFramework = active
    ? DOCS_FRAMEWORKS.find((item) => item.id === active.framework) ?? DOCS_FRAMEWORKS[0]!
    : null;

  async function copyCode(block: DocsCodeBlock, key: string) {
    const ok = await copyToClipboard(block.code);
    if (!ok) {
      toast.error("Copie impossible sur ce navigateur.");
      return;
    }
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    toast.success("Code copié dans le presse-papiers");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Références"
        title="Documentation FiveM"
        description="Guides intégrés pour ESX, QBCore, ox, les échanges client/serveur et les systèmes de jeu. Chaque exemple est prêt à être adapté dans le Studio."
      >
        <Link href="/studio">
          <Button variant="secondary">
            <Wrench className="h-4 w-4" /> Ouvrir le Studio
          </Button>
        </Link>
        <a href="https://docs.fivem.net/natives/" target="_blank" rel="noreferrer">
          <Button variant="primary">
            <ExternalLink className="h-4 w-4" /> Natives FiveM
          </Button>
        </a>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Frameworks couverts</p>
          <p className="mt-1 text-xl font-semibold">{DOCS_FRAMEWORKS.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Guides intégrés</p>
          <p className="mt-1 text-xl font-semibold">{FIVEM_DOCS.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Systèmes et pratiques</p>
          <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-4 w-4 text-primary-300" /> ESX · QBCore · ox
          </p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une fonction, un système, un framework..."
          />
        </div>
        <Select
          value={framework}
          onChange={(event) => setFramework(event.target.value)}
          className="w-auto min-w-[170px]"
        >
          <option value="all">Tous les frameworks</option>
          {DOCS_FRAMEWORKS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </Select>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-auto min-w-[170px]"
        >
          <option value="all">Toutes les catégories</option>
          {categories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {filtered.length} / {FIVEM_DOCS.length} guide(s)
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardBody className="max-h-[520px] space-y-1 overflow-y-auto p-2 scrollbar-thin">
              {filtered.length === 0 ? (
                <p className="px-3 py-5 text-center text-xs text-muted">Aucun guide ne correspond.</p>
              ) : (
                filtered.map((doc) => {
                  const meta = DOCS_FRAMEWORKS.find((item) => item.id === doc.framework);
                  const isActive = active?.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedId(doc.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "border-primary-500/40 bg-primary-500/10"
                          : "border-transparent hover:border-border hover:bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("text-xs font-medium leading-snug", isActive ? "text-primary-200" : "text-fg")}>
                          {doc.title}
                        </span>
                        <Badge variant={meta?.accent ?? "neutral"}>{meta?.label ?? doc.framework}</Badge>
                      </div>
                      <p className="mt-1 text-[10px] text-muted">{doc.category} · {doc.level}</p>
                    </button>
                  );
                })
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> Rappel sécurité
              </p>
              <p className="text-[11px] leading-relaxed text-muted">
                Les exemples sont des bases de travail. Validez toujours les données client, les permissions et les montants côté serveur.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/snippets" className="text-[11px] text-primary-300 hover:text-primary-200">
                  Snippets
                </Link>
                <Link href="/knowledge" className="text-[11px] text-primary-300 hover:text-primary-200">
                  Base de connaissances
                </Link>
                <Link href="/studio" className="text-[11px] text-primary-300 hover:text-primary-200">
                  Générateurs
                </Link>
              </div>
            </CardBody>
          </Card>
        </aside>

        <section className="min-w-0">
          {!active ? (
            <Card>
              <EmptyState
                icon={<BookMarked className="h-5 w-5" />}
                title="Aucun guide trouvé"
                description="Essayez un autre mot-clé, un autre framework ou une autre catégorie."
              />
            </Card>
          ) : (
            <Card>
              <CardBody className="space-y-6">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={activeFramework?.accent ?? "neutral"}>{activeFramework?.label}</Badge>
                      <Badge variant="neutral">{active.category}</Badge>
                      <Badge variant="info">{active.level}</Badge>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold tracking-tight text-fg">{active.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{active.summary}</p>
                  </div>
                  <div className="flex max-w-xs flex-wrap gap-1.5">
                    {active.tags.map((tag) => (
                      <Badge key={tag} variant="neutral">{tag}</Badge>
                    ))}
                  </div>
                </header>

                <div className="space-y-7">
                  {active.sections.map((section, index) => {
                    const codeKey = `${active.id}-${index}`;
                    return (
                      <section key={section.title} className="space-y-3">
                        <h3 className="text-sm font-semibold text-fg">{section.title}</h3>
                        {section.text ? (
                          <p className="text-[13px] leading-relaxed text-muted">{section.text}</p>
                        ) : null}
                        {section.bullets ? (
                          <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted">
                            {section.bullets.map((bullet, bulletIndex) => (
                              <li key={`${section.title}-${bulletIndex}`} className="flex gap-2">
                                <span className="mt-[3px] text-primary-300">•</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {section.code ? (
                          <CodeBlock
                            block={section.code}
                            copied={copied === codeKey}
                            onCopy={() => void copyCode(section.code!, codeKey)}
                          />
                        ) : null}
                      </section>
                    );
                  })}
                </div>

                {active.tools && active.tools.length > 0 ? (
                  <div className="border-t border-border pt-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      <Wrench className="h-3.5 w-3.5" /> Générateurs liés
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {active.tools.map((tool) => (
                        <Link key={tool.slug} href={`/studio/${tool.slug}`}>
                          <Button size="sm" variant="secondary">{tool.label}</Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {active.links && active.links.length > 0 ? (
                  <div className="border-t border-border pt-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      <ExternalLink className="h-3.5 w-3.5" /> Références officielles
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {active.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-300 hover:text-primary-200"
                        >
                          {link.label} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <p className="border-t border-border pt-3 text-[10px] leading-relaxed text-muted">
                  Contenu intégré à FiveM DevManager. Il ne remplace pas la documentation officielle de chaque framework ou de FiveM.
                </p>
              </CardBody>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function CodeBlock({
  block,
  copied,
  onCopy,
}: {
  block: DocsCodeBlock;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#080b12]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="mono text-[10px] uppercase tracking-wide text-muted">
          {block.title} · {block.language}
        </span>
        <Button size="sm" variant="ghost" onClick={onCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
      <pre className="max-h-[460px] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-fg/90 scrollbar-thin">
        <code>{block.code}</code>
      </pre>
    </div>
  );
}

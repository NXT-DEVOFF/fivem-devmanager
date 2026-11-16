"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, Map as MapIcon, Search, Sparkles, Wrench } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { ToolIcon } from "@/components/studio/tool-icon";
import type { StudioCategory, StudioToolSummary } from "@/lib/studio/types";
import { cn } from "@/lib/cn";

export function StudioCatalog({
  tools,
  categories,
  counts,
}: {
  tools: StudioToolSummary[];
  categories: StudioCategory[];
  counts: Record<string, number>;
}) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tools.filter((tool) => {
      if (category !== "all" && tool.category !== category) return false;
      if (!needle) return true;
      return `${tool.name} ${tool.description} ${tool.tags.join(" ")} ${tool.slug}`
        .toLowerCase()
        .includes(needle);
    });
  }, [tools, search, category]);

  return (
    <div>
      <PageHeader
        eyebrow="FiveM Studio"
        title={`${tools.length} outils pour developper plus vite`}
        description="Generez du handling, des MLO, des manifests, des scripts gameplay et des rapports serveur. Chaque outil produit des fichiers prets a copier ou a telecharger en ZIP."
      >
        <Badge variant="primary">
          <Sparkles className="h-3 w-3" /> {tools.length} outils
        </Badge>
        <Link href="/vehicles">
          <Button variant="secondary">Debug vehicules</Button>
        </Link>
        <Link href="/mlo">
          <Button variant="primary">Constructeur MLO</Button>
        </Link>
        <Link href="/mappings">
          <Button variant="secondary">
            <MapIcon className="h-3.5 w-3.5" /> Carte des mappings
          </Button>
        </Link>
        <Link href="/docs">
          <Button variant="secondary">
            <BookMarked className="h-3.5 w-3.5" /> Documentation
          </Button>
        </Link>
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Outils disponibles" value={String(tools.length)} hint="5 categories, executions locales et API" accent="primary" />
        <Stat label="Vehicules" value={String(counts.vehicules ?? 0)} hint="Handling, tuning, debug et concessions" accent="info" />
        <Stat label="MLO & mapping" value={String(counts.mlo ?? 0)} hint="Pieces, portails, proxies et exports" accent="success" />
        <Stat label="Dev & serveur" value={String((counts.dev ?? 0) + (counts.serveur ?? 0))} hint="Ressources, ops, logs et performance" accent="warning" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un outil, un tag, un fichier..."
          />
        </div>
        <Button
          variant={category === "all" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setCategory("all")}
        >
          Tous <span className="text-[10px] opacity-70">{tools.length}</span>
        </Button>
        {categories.map((item) => (
          <Button
            key={item.id}
            variant={category === item.id ? "primary" : "secondary"}
            size="sm"
            onClick={() => setCategory(item.id)}
          >
            <ToolIcon name={item.icon} className="h-3.5 w-3.5" />
            {item.label}
            <span className="text-[10px] opacity-70">{counts[item.id] ?? 0}</span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench className="h-5 w-5" />}
            title="Aucun outil ne correspond"
            description="Essayez un autre mot-cle ou selectionnez une autre categorie."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tool) => {
            const cat = categories.find((item) => item.id === tool.category)!;
            return (
              <Link
                key={tool.slug}
                href={`/studio/${tool.slug}`}
                className="panel panel-interactive group flex flex-col p-4 transition-colors hover:border-primary-500/35"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", accentClass(cat.accent))}>
                    <ToolIcon name={tool.icon} className="h-4 w-4" />
                  </div>
                  <Badge variant={cat.accent}>{cat.label}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-fg transition-colors group-hover:text-primary-200">
                  {tool.name}
                </p>
                <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-muted">
                  {tool.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {tool.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded border border-border bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted">
                  <span>{tool.fields.length} champ(s)</span>
                  <span className="flex items-center gap-1 text-primary-300">
                    Ouvrir <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function accentClass(accent: StudioCategory["accent"]) {
  return {
    primary: "border-primary-500/30 bg-primary-500/10 text-primary-300",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-danger/30 bg-danger/10 text-danger",
    info: "border-info/30 bg-info/10 text-info",
  }[accent];
}

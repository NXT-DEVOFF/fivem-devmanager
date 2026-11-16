"use client";

import * as React from "react";
import { cn } from "@/components/ui/primitives";

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1 border-b border-border", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
            value === tab.id
              ? "border-primary-500 text-fg"
              : "border-transparent text-muted hover:text-fg",
          )}
        >
          {tab.label}
          {typeof tab.count === "number" ? (
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

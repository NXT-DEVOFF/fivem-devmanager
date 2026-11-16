"use client";

import { Badge } from "@/components/ui/primitives";

export interface DiscordEmbedData {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export function DiscordEmbedPreview({ embed }: { embed: DiscordEmbedData }) {
  return (
    <div className="rounded-lg bg-[#313338] p-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[11px] font-bold text-white">
          FD
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-white">FiveM DevManager</span>
            <Badge variant="primary" className="h-4 bg-[#5865f2] text-[9px] text-white">APP</Badge>
            <span className="text-[10px] text-[#949ba4]">Aujourd&apos;hui</span>
          </div>
          <div className="overflow-hidden rounded border-l-4 border-[#5865f2] bg-[#2b2d31] p-3">
            {embed.title ? (
              <p className="text-[13px] font-semibold text-white">{embed.title}</p>
            ) : null}
            {embed.description ? (
              <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[#dbdee1]">
                {embed.description}
              </p>
            ) : null}
            {embed.fields && embed.fields.length > 0 ? (
              <div className="mt-2 space-y-2">
                {embed.fields.map((field, index) => (
                  <div key={`${field.name}-${index}`}>
                    <p className="text-[11px] font-semibold text-white">{field.name}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#dbdee1]">
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {embed.footer ? (
              <p className="mt-3 text-[10px] text-[#949ba4]">{embed.footer.text}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

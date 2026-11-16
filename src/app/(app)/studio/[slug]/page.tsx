import Link from "next/link";
import { TerminalSquare } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { StudioToolClient } from "@/components/studio/studio-tool-client";
import { studioCategory } from "@/lib/studio/catalog";
import { getStudioTool, studioToolSummary } from "@/lib/studio/registry";

export default async function StudioToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getStudioTool(slug);

  if (!tool) {
    return (
      <Card>
        <EmptyState
          icon={<TerminalSquare className="h-5 w-5" />}
          title="Outil introuvable"
          description="Cet outil FiveM Studio n'existe pas ou a ete deplace."
          action={
            <Link href="/studio">
              <Button variant="primary">Retour au catalogue</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <StudioToolClient
      tool={studioToolSummary(tool)}
      category={studioCategory(tool.category)}
    />
  );
}

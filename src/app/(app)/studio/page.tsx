import { StudioCatalog } from "@/components/studio/studio-catalog";
import { STUDIO_CATEGORIES } from "@/lib/studio/catalog";
import {
  STUDIO_TOOLS,
  studioToolCountByCategory,
  studioToolSummary,
} from "@/lib/studio/registry";

export default function StudioPage() {
  const tools = STUDIO_TOOLS.map(studioToolSummary);

  return (
    <StudioCatalog
      tools={tools}
      categories={STUDIO_CATEGORIES}
      counts={studioToolCountByCategory()}
    />
  );
}

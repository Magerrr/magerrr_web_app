import { Badge } from "@/components/ui";
import type { PointKind } from "@/lib/core/scoring";

/** Penanda game point / match point (PRD SC5); `who` = nama sisi bila badge tidak menempel di sisinya. */
export function PointBadge({ kind, who }: { kind: PointKind | null; who?: string }) {
  if (!kind) return null;
  return (
    <Badge>
      {kind === "match" ? "Match point" : "Game point"}
      {who && ` · ${who}`}
    </Badge>
  );
}

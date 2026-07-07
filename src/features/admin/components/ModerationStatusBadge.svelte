<script lang="ts">
import type { ModerationCommentLike } from "@/features/admin/lib/moderation-display-types";
import { Badge } from "$lib/components/ui/badge/index.js";

export let label: string;
export let status: ModerationCommentLike["status"];
</script>

<Badge
  class={status === "active"
    ? "border-success/40 bg-success/10 text-success"
    : status === "deleted"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-warning/40 bg-warning/10 text-warning"}
>
  {label}
</Badge>

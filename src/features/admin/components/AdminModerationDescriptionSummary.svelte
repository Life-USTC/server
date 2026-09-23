<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import type { AdminModerationDescriptionCopy } from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let count: number;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<div class="flex justify-end">
  <Badge variant="ghost">
    {formatMessage(copy.showingResults, {
      count: String(count),
    })}
  </Badge>
</div>

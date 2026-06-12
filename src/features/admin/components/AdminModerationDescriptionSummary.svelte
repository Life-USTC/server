<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type {
  AdminModerationDescriptionCopy,
  AdminModerationDescriptionOption,
} from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let count: number;
export let descriptionContentFilter: string | null | undefined;
export let descriptionContentOptions: AdminModerationDescriptionOption[];
export let descriptionTargetFilter: string | null | undefined;
export let descriptionTargetOptions: AdminModerationDescriptionOption[];
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<Card.Root>
  <Card.Content class="flex flex-wrap items-center justify-between gap-3 pt-5">
    <div>
      <Card.Title>{copy.descriptionTarget}</Card.Title>
      <Card.Description>
        {descriptionTargetOptions.find((option) => option.value === descriptionTargetFilter)?.label ?? copy.descriptionTargetAll}
        ·
        {descriptionContentOptions.find((option) => option.value === descriptionContentFilter)?.label ?? copy.descriptionContentWith}
      </Card.Description>
    </div>
    <Badge variant="ghost">
      {formatMessage(copy.showingResults, {
        count: String(count),
      })}
    </Badge>
  </Card.Content>
</Card.Root>

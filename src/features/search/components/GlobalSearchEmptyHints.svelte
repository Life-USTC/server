<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import type { GlobalSearchResultGroupType } from "@/features/search/server/global-search-types";

export let copy: LayoutCopy["globalSearch"];
export let signedIn = false;
export let onPickExample: (query: string) => void = () => {};

const publicTypes: GlobalSearchResultGroupType[] = [
  "courses",
  "sections",
  "teachers",
  "links",
];
const workspaceTypes: GlobalSearchResultGroupType[] = ["homeworks", "todos"];

$: typeChips = signedIn ? [...publicTypes, ...workspaceTypes] : publicTypes;

$: exampleEntries = [
  { key: "course" as const, query: copy.examples.course },
  { key: "section" as const, query: copy.examples.section },
  { key: "teacher" as const, query: copy.examples.teacher },
  { key: "link" as const, query: copy.examples.link },
];
</script>

<div class="grid gap-4 px-1 py-4" data-search-empty-hints>
  <p class="text-center text-muted-foreground text-sm">{copy.emptyLead}</p>

  <div class="grid gap-2">
    <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {copy.typesLabel}
    </p>
    <div class="flex flex-wrap gap-2" role="list">
      {#each typeChips as type (type)}
        <Badge role="listitem" variant="outline">{copy.groups[type]}</Badge>
      {/each}
    </div>
  </div>

  <div class="grid gap-2">
    <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {copy.examplesLabel}
    </p>
    <div class="flex flex-wrap gap-2">
      {#each exampleEntries as example (example.key)}
        <button
          class="inline-flex"
          onclick={() => onPickExample(example.query)}
          type="button"
        >
          <Badge
            class="cursor-pointer hover:bg-muted"
            variant="secondary"
          >
            {example.query}
          </Badge>
        </button>
      {/each}
    </div>
  </div>
</div>

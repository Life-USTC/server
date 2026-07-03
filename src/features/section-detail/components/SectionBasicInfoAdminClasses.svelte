<script lang="ts">
import * as Accordion from "$lib/components/ui/accordion/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionPrimaryName,
} from "./section-basic-info-types";

export let primaryName: SectionPrimaryName;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;
</script>

{#if section.adminClasses.length > 0}
  <Accordion.Item class="rounded-none border-0 bg-transparent px-0 py-2" title={sectionCopy.adminClasses}>
    <div class="flex flex-wrap gap-2">
      {#each section.adminClasses as adminClass}
        <Badge variant="outline">{primaryName(adminClass)}</Badge>
      {/each}
    </div>
  </Accordion.Item>
{/if}

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
  <Accordion.Root type="single">
    <Accordion.Item value="admin-classes">
      <Accordion.Trigger>{sectionCopy.adminClasses}</Accordion.Trigger>
      <Accordion.Content>
        <div class="flex flex-wrap gap-2">
          {#each section.adminClasses as adminClass}
            <Badge variant="outline">{primaryName(adminClass)}</Badge>
          {/each}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
{/if}

<script lang="ts">
import GroupIcon from "@lucide/svelte/icons/users-round";
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
  <section class="grid gap-3">
    <h3 class="flex items-center gap-2 text-sm font-semibold tracking-tight"><GroupIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />{sectionCopy.adminClasses}</h3>
    <ul class="grid gap-1.5 text-sm leading-relaxed">
      {#each section.adminClasses as adminClass}
        <li class="min-w-0 font-medium">{primaryName(adminClass)}</li>
      {/each}
    </ul>
  </section>
{/if}

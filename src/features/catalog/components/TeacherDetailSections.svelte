<script lang="ts">
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";
import TeacherDetailSectionsMobile from "./TeacherDetailSectionsMobile.svelte";
import TeacherDetailSectionsTable from "./TeacherDetailSectionsTable.svelte";

export let copy: TeacherDetailCopy;
export let locale: string;
export let notAvailable: string;
export let teacher: TeacherDetailTeacher;
</script>

<section class="grid gap-4">
  <ResponsiveCollection>
    {#snippet mobile()}
      <TeacherDetailSectionsMobile
        {copy}
        {locale}
        {notAvailable}
        {teacher}
      />
    {/snippet}
    {#snippet desktop()}
      <TeacherDetailSectionsTable
        {copy}
        {locale}
        {notAvailable}
        {teacher}
      />
    {/snippet}
  </ResponsiveCollection>
</section>

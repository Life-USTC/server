<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
export let displayName: string;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryDisplayName: string;
export let teacher: TeacherDetailTeacher;
</script>

<dl class="grid border-base-300 border-y text-sm sm:grid-cols-2 xl:grid-cols-3">
  <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
    <dt class="text-base-content/60 text-xs">{copy.teacherDetail.name}</dt>
    <dd>
      <p class="mt-1 font-medium">{displayName}</p>
      {#if secondaryDisplayName}<p class="text-base-content/60">{secondaryDisplayName}</p>{/if}
    </dd>
  </div>
  <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
    <dt class="text-base-content/60 text-xs">{copy.teacherDetail.department}</dt>
    <dd class="mt-1 font-medium">{primaryName(teacher.department) || copy.teacherDetail.noDepartment}</dd>
  </div>
  <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
    <dt class="text-base-content/60 text-xs">{copy.teacherDetail.title}</dt>
    <dd class="mt-1 font-medium">{primaryName(teacher.teacherTitle) || notAvailable}</dd>
  </div>
  {#if teacher.email}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.teacherDetail.email}</dt>
      <dd class="mt-1 break-all font-medium">
        <Button class="h-auto justify-start whitespace-normal break-all p-0 text-left" href={`mailto:${teacher.email}`} variant="link">{teacher.email}</Button>
      </dd>
    </div>
  {/if}
  {#if teacher.telephone}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.teacherDetail.telephone}</dt>
      <dd class="mt-1 break-all font-medium">{teacher.telephone}</dd>
    </div>
  {/if}
  {#if teacher.mobile}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.teacherDetail.mobile}</dt>
      <dd class="mt-1 break-all font-medium">{teacher.mobile}</dd>
    </div>
  {/if}
  {#if teacher.address}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.teacherDetail.address}</dt>
      <dd class="mt-1 break-words font-medium">{teacher.address}</dd>
    </div>
  {/if}
</dl>

<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "$lib/components/detail-definition-list";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let teacher: TeacherDetailTeacher;
</script>

<dl class={detailDefinitionListClass}>
  <dt class={detailDefinitionTermClass}>{copy.teacherDetail.department}</dt>
  <dd class="m-0 min-w-0 font-medium">
    {primaryName(teacher.department) || copy.teacherDetail.noDepartment}
  </dd>

  <dt class={detailDefinitionTermClass}>{copy.teacherDetail.title}</dt>
  <dd class="m-0 min-w-0 font-medium">
    {primaryName(teacher.teacherTitle) || notAvailable}
  </dd>

  {#if teacher.email}
    <dt class={detailDefinitionTermClass}>{copy.teacherDetail.email}</dt>
    <dd class="m-0 min-w-0 break-all font-medium">
      <Button
        class="h-auto justify-start whitespace-normal break-all p-0 text-left"
        href={`mailto:${teacher.email}`}
        variant="link"
      >
        {teacher.email}
      </Button>
    </dd>
  {/if}

  {#if teacher.telephone}
    <dt class={detailDefinitionTermClass}>{copy.teacherDetail.telephone}</dt>
    <dd class="m-0 min-w-0 break-all font-medium">{teacher.telephone}</dd>
  {/if}

  {#if teacher.mobile}
    <dt class={detailDefinitionTermClass}>{copy.teacherDetail.mobile}</dt>
    <dd class="m-0 min-w-0 break-all font-medium">{teacher.mobile}</dd>
  {/if}

  {#if teacher.address}
    <dt class={detailDefinitionTermClass}>{copy.teacherDetail.address}</dt>
    <dd class="m-0 min-w-0 break-words font-medium">{teacher.address}</dd>
  {/if}
</dl>

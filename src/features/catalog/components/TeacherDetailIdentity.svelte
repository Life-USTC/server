<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "$lib/components/detail-definition-list";
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
</dl>

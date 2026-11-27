<script lang="ts">
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "#lib/components/detail-definition-list.js";
import { Button } from "#lib/components/ui/button/index.js";
import { catalogPrimaryName as primaryName } from "@/features/catalog/lib/catalog-list-display";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
export let notAvailable: string;
export let teacher: TeacherDetailTeacher;
</script>

{#snippet fact(label: string, value: string, wrapping = "")}
  <dt class={detailDefinitionTermClass}>{label}</dt>
  <dd class={`m-0 min-w-0 font-medium ${wrapping}`}>{value}</dd>
{/snippet}

<div data-detail-identity>
  <dl class={detailDefinitionListClass}>
    {@render fact(copy.teacherDetail.department, primaryName(teacher.department) || copy.teacherDetail.noDepartment)}
    {@render fact(copy.teacherDetail.title, primaryName(teacher.teacherTitle) || notAvailable)}
  </dl>
</div>
<dl class={detailDefinitionListClass}>
  {#if teacher.email}
    <dt class={detailDefinitionTermClass}>{copy.teacherDetail.email}</dt>
    <dd class="m-0 min-w-0 break-all font-medium">
      <Button
        class="h-auto min-h-11 justify-start whitespace-normal break-all p-0 text-left md:min-h-6"
        href={`mailto:${teacher.email}`}
        variant="link"
      >
        {teacher.email}
      </Button>
    </dd>
  {/if}

  {#if teacher.telephone}
    {@render fact(copy.teacherDetail.telephone, teacher.telephone, "break-all")}
  {/if}
  {#if teacher.mobile}
    {@render fact(copy.teacherDetail.mobile, teacher.mobile, "break-all")}
  {/if}
  {#if teacher.address}
    {@render fact(copy.teacherDetail.address, teacher.address, "break-words")}
  {/if}
</dl>

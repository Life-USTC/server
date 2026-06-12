<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type {
  CatalogDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: CatalogDetailCopy;
export let displayName: string;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryDisplayName: string;
export let teacher: TeacherDetailTeacher;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.teacherDetail.basicInfo}</Card.Title>
    <Card.Description>{copy.teacherDetail.basicInfoDescription}</Card.Description>
  </Card.Header>
  <Card.Content>
    <dl class="grid gap-3 text-sm">
      <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
        <dt class="text-base-content/60 text-xs">{copy.teacherDetail.name}</dt>
        <dd class="mt-1 font-medium">{displayName}</dd>
        {#if secondaryDisplayName}<dd class="text-base-content/60">{secondaryDisplayName}</dd>{/if}
      </div>
      <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
        <dt class="text-base-content/60 text-xs">{copy.teacherDetail.department}</dt>
        <dd class="mt-1 font-medium">{primaryName(teacher.department) || copy.teacherDetail.noDepartment}</dd>
      </div>
      <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
        <dt class="text-base-content/60 text-xs">{copy.teacherDetail.title}</dt>
        <dd class="mt-1 font-medium">{primaryName(teacher.teacherTitle) || notAvailable}</dd>
      </div>
      {#if teacher.email}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.teacherDetail.email}</dt>
          <dd class="mt-1 break-all font-medium">
            <Button class="h-auto whitespace-normal break-all text-left" href={`mailto:${teacher.email}`} variant="link">{teacher.email}</Button>
          </dd>
        </div>
      {/if}
      {#if teacher.telephone}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.teacherDetail.telephone}</dt>
          <dd class="mt-1 break-all font-medium">{teacher.telephone}</dd>
        </div>
      {/if}
      {#if teacher.mobile}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.teacherDetail.mobile}</dt>
          <dd class="mt-1 break-all font-medium">{teacher.mobile}</dd>
        </div>
      {/if}
      {#if teacher.address}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.teacherDetail.address}</dt>
          <dd class="mt-1 break-words font-medium">{teacher.address}</dd>
        </div>
      {/if}
    </dl>
  </Card.Content>
</Card.Root>

<script lang="ts">
import GroupIcon from "@lucide/svelte/icons/contact-round";
import TeacherIcon from "@lucide/svelte/icons/user-round";
import type {
  SectionPrimaryName,
  SectionTeacherCopy,
  SectionTeacherName,
  SectionTeacherSummary,
} from "./section-basic-info-types";

export let primaryName: SectionPrimaryName;
export let sectionCopy: SectionTeacherCopy;
export let teacherName: SectionTeacherName;
export let teachers: SectionTeacherSummary[];
</script>

<section id="teachers" class="grid gap-3">
  <h3 class="flex items-center gap-2 text-sm font-semibold tracking-tight"><GroupIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />{sectionCopy.teachers}</h3>
  {#if teachers.length > 0}
    <ul class="grid gap-1.5 text-sm leading-relaxed">
      {#each teachers as teacher}
        <li class="min-w-0">
          <a
            class="text-foreground"
            href={`/catalog/teachers/${teacher.id}`}
          >
            <TeacherIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{teacherName(teacher)}
            {#if teacher.teacherTitle}<span class="text-muted-foreground"> · {primaryName(teacher.teacherTitle)}</span>{/if}
            {#if teacher.department}
              <span class="text-muted-foreground">
                · {primaryName(teacher.department)}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-muted-foreground text-sm">{sectionCopy.noTeachersListed}</p>
  {/if}
</section>

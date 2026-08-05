<script lang="ts">
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
  <h3 class="text-sm font-semibold tracking-tight">{sectionCopy.teachers}</h3>
  {#if teachers.length > 0}
    <ul class="grid gap-1.5 text-sm leading-relaxed">
      {#each teachers as teacher}
        <li class="min-w-0">
          <a
            class="text-foreground hover:underline"
            href={`/catalog/teachers/${teacher.id}`}
          >
            {teacherName(teacher)}
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

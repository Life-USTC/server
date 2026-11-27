<script lang="ts">
import type { OfficialAcademicProfile } from "@/features/catalog/lib/official-academic-profile";
import type { AppLocale } from "@/i18n/config";

let {
  profile,
  locale,
  kind,
}: {
  profile: OfficialAcademicProfile;
  locale: AppLocale;
  kind: "course" | "section";
} = $props();

const labels = {
  zh: {
    course: "学校课程资料",
    section: "本学期教学班资料",
    credits: "学分",
    hours: "学时",
    department: "开课单位",
    language: "授课语言",
    prerequisites: "先修要求",
    assessment: "考核方式",
    grading: "评分制",
    textbook: "教材",
    references: "参考书",
    syllabus: "教学大纲",
  },
  en: {
    course: "Official course information",
    section: "Official information for this teaching section",
    credits: "Credits",
    hours: "Contact hours",
    department: "Department",
    language: "Language of instruction",
    prerequisites: "Prerequisites",
    assessment: "Assessment",
    grading: "Grading scheme",
    textbook: "Textbooks",
    references: "References",
    syllabus: "Syllabus",
  },
};
const lang = $derived(locale === "en-us" ? "en" : "zh");
const copy = $derived(labels[lang]);
const facts = $derived(
  [
    [copy.credits, profile.credits],
    [copy.hours, profile.hours],
    [copy.department, profile.department],
    [copy.language, profile.language],
    [copy.prerequisites, profile.prerequisites],
    [copy.assessment, profile.assessment],
    [copy.grading, profile.grading],
    [copy.textbook, profile.textbook],
    [copy.references, profile.references],
  ].filter(([, value]) => value !== null),
);
const description = $derived(
  profile.description[lang] ?? profile.description[lang === "zh" ? "en" : "zh"],
);
const paragraphs = $derived(
  profile.syllabus[lang].length
    ? profile.syllabus[lang]
    : profile.syllabus[lang === "zh" ? "en" : "zh"],
);
</script>

{#if description || facts.length || profile.textbooks.length || paragraphs.length || profile.syllabus.topics.length}
  <section class="mb-4 min-w-0 space-y-3 rounded-lg border p-4 text-sm [overflow-wrap:anywhere]" data-testid="official-academic-profile">
    <h2 class="section-heading">{copy[kind]}</h2>
    {#if description}
      <p class="whitespace-pre-wrap">{description}</p>
    {/if}
    {#if facts.length}
      <dl class="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {#each facts as [label, value] (label)}
          <div>
            <dt class="text-muted-foreground">{label}</dt>
            <dd class="whitespace-pre-wrap">{value}</dd>
          </div>
        {/each}
      </dl>
    {/if}
    {#if profile.textbooks.length}
      {#if !profile.textbook}<h3 class="font-medium">{copy.textbook}</h3>{/if}
      <ul class="list-disc space-y-1 ps-5">
        {#each profile.textbooks as book, index (index)}
          <li>{[lang === "zh" ? book.nameZh ?? book.nameEn : book.nameEn ?? book.nameZh, book.author, book.isbn].filter(Boolean).join(" · ")}</li>
        {/each}
      </ul>
    {/if}
    {#if paragraphs.length || profile.syllabus.topics.length}
      <details class="border-t pt-2" open={!paragraphs.length}>
        <summary class="min-h-11 cursor-pointer py-2 font-medium">{copy.syllabus}</summary>
        {#each paragraphs as paragraph, index (index)}
          {#if paragraph.title}<h3 class="mt-3 font-medium">{paragraph.title}</h3>{/if}
          <p class="mt-1 whitespace-pre-wrap">{paragraph.content}</p>
        {/each}
        {#if profile.syllabus.topics.length}
          <ul class="mt-2 list-disc space-y-1 ps-5">
            {#each profile.syllabus.topics as topic, index (index)}
              <li>{topic.name}{topic.hours === null ? "" : ` · ${topic.hours} ${copy.hours}`}</li>
            {/each}
          </ul>
        {/if}
      </details>
    {/if}
  </section>
{/if}

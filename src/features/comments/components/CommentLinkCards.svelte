<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";

type LinkCard = {
  description: string;
  href: string;
  label: string;
};

type CommentLinkCardsCopy = {
  linkHost: string;
  linkSection: string;
  linkTeacher: string;
};

export let content: string | null | undefined = "";
export let copy: CommentLinkCardsCopy;

const urlPattern = /\bhttps?:\/\/[^\s<>()]+/gi;
const mentionPattern = /\b(section|teacher)#(\d+)\b/gi;

function trimTrailingPunctuation(value: string) {
  return value.replace(/[.,;:!?，。；：！？]+$/u, "");
}

function labelFromTemplate(template: string, id: string) {
  return template.replace("{id}", id);
}

function extractLinkCards(
  value: string | null | undefined,
  labels: CommentLinkCardsCopy,
) {
  if (!value) return [];
  const cards: LinkCard[] = [];
  const seen = new Set<string>();

  for (const match of value.matchAll(mentionPattern)) {
    const kind = match[1]?.toLowerCase();
    const id = match[2] ?? "";
    const href = kind === "teacher" ? `/teachers/${id}` : `/sections/${id}`;
    if (seen.has(href)) continue;
    seen.add(href);
    cards.push({
      description: labels.linkHost,
      href,
      label: labelFromTemplate(
        kind === "teacher" ? labels.linkTeacher : labels.linkSection,
        id,
      ),
    });
  }

  for (const match of value.matchAll(urlPattern)) {
    const href = trimTrailingPunctuation(match[0]);
    if (seen.has(href)) continue;
    try {
      const url = new URL(href);
      if (
        url.hostname !== "life.ustc.tiankaima.dev" &&
        url.hostname !== globalThis.location?.hostname
      ) {
        continue;
      }
      seen.add(href);
      cards.push({
        description: url.hostname,
        href,
        label: url.pathname || href,
      });
    } catch {
      // Ignore malformed URLs matched from user content.
    }
  }

  return cards;
}

$: cards = extractLinkCards(content, copy);
</script>

{#if cards.length > 0}
  <div class="mt-3 grid gap-2 sm:grid-cols-2">
    {#each cards as card}
      <Card.Root class="border-base-300 bg-base-100 shadow-none">
        <Card.Content class="grid gap-1 p-3">
          <a class="font-medium text-primary text-sm hover:underline" href={card.href}>
            {card.label}
          </a>
          <p class="text-base-content/60 text-xs">{card.description}</p>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
{/if}

<script lang="ts">
import BookOpen from "@lucide/svelte/icons/book-open";
import GraduationCap from "@lucide/svelte/icons/graduation-cap";
import MapPinned from "@lucide/svelte/icons/map-pinned";
import UserRound from "@lucide/svelte/icons/user-round";

export let href: string;
const icons = new Map([
  ["courses", BookOpen],
  ["sections", GraduationCap],
  ["rooms", MapPinned],
  ["teachers", UserRound],
]);
$: [, collection] =
  new URL(href, "https://catalog.invalid").pathname.match(
    /^\/catalog\/(courses|sections|rooms|teachers)\/[^/]+/,
  ) ?? [];
$: icon = icons.get(collection);
</script>

{#if icon}<svelte:component this={icon} aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{/if}

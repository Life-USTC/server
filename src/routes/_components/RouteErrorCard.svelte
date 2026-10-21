<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import { page as routePage } from "$app/state";

type ErrorCopy = {
  backHome: string;
  error: string;
  notFoundDescription: string;
  notFoundTitle: string;
  somethingWentWrong: string;
  tryAgain: string;
};

const fallbackErrorCopy: ErrorCopy = {
  backHome: "Back to Home",
  error: "Error",
  notFoundDescription: "The page you are looking for does not exist.",
  notFoundTitle: "Page Not Found",
  somethingWentWrong: "Something went wrong!",
  tryAgain: "Try again",
};

interface Props {
  backHref?: string;
}

let { backHref = "/" }: Props = $props();

let isNotFound = $derived(routePage.status === 404);
let errorCopy = $derived(
  (routePage.data?.copy?.errorPage ?? fallbackErrorCopy) as ErrorCopy,
);
let title = $derived(
  isNotFound ? errorCopy.notFoundTitle : errorCopy.somethingWentWrong,
);
let description = $derived(
  isNotFound
    ? errorCopy.notFoundDescription
    : (routePage.error?.message ?? errorCopy.error),
);

let backLabel = $derived(
  backHref === "/catalog/courses"
    ? (routePage.data?.copy?.nav?.courses ?? errorCopy.backHome)
    : backHref === "/catalog/sections"
      ? (routePage.data?.copy?.nav?.sections ?? errorCopy.backHome)
      : backHref === "/catalog/teachers"
        ? (routePage.data?.copy?.nav?.teachers ?? errorCopy.backHome)
        : backHref.startsWith("/account/settings")
          ? (routePage.data?.copy?.menu?.settings ?? errorCopy.backHome)
          : errorCopy.backHome,
);
</script>

<svelte:head><title>{isNotFound ? errorCopy.notFoundTitle : errorCopy.error} - Life@USTC</title></svelte:head>

<section class="grid min-h-[calc(100dvh-8rem)] place-items-center">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <h1 class="font-semibold text-5xl">{routePage.status}</h1>
      <Card.Title>
        <h2>{title}</h2>
      </Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-wrap justify-center gap-2">
      {#if !isNotFound}
        <Button type="button" onclick={() => location.reload()}>{errorCopy.tryAgain}</Button>
      {/if}
      <Button href={backHref} variant={isNotFound ? "default" : "outline"}>{backLabel}</Button>
    </Card.Content>
  </Card.Root>
</section>

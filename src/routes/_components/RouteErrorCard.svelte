<script lang="ts">
import { page } from "$app/stores";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

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

export let backHref = "/";

$: isNotFound = $page.status === 404;
$: errorCopy = ($page.data?.copy?.errorPage ?? fallbackErrorCopy) as ErrorCopy;
$: title = isNotFound ? errorCopy.notFoundTitle : errorCopy.somethingWentWrong;
$: description = isNotFound
  ? errorCopy.notFoundDescription
  : ($page.error?.message ?? errorCopy.error);
$: backLabel =
  backHref === "/courses"
    ? ($page.data?.copy?.nav?.courses ?? errorCopy.backHome)
    : backHref === "/sections"
      ? ($page.data?.copy?.nav?.sections ?? errorCopy.backHome)
      : backHref === "/teachers"
        ? ($page.data?.copy?.nav?.teachers ?? errorCopy.backHome)
        : backHref === "/settings"
          ? ($page.data?.copy?.menu?.settings ?? errorCopy.backHome)
          : errorCopy.backHome;
</script>

<svelte:head><title>{isNotFound ? errorCopy.notFoundTitle : errorCopy.error} - Life@USTC</title></svelte:head>

<section class="grid min-h-[calc(100vh-8rem)] place-items-center px-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <h1 class="font-semibold text-5xl">{$page.status}</h1>
      <Card.Title class="text-2xl">{title}</Card.Title>
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

<script lang="ts">
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>Demo | Life@USTC</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="mx-auto max-w-2xl space-y-6 px-4 py-12">
  <div class="space-y-2">
    <p class="text-sm font-medium text-primary">Production-safe draft</p>
    <h1 class="text-3xl font-semibold">Demo workspace</h1>
    <p class="text-muted-foreground">
      This isolated session uses deterministic fixtures. Changes are simulated and never written to the application database.
    </p>
  </div>

  {#if data.authenticated}
    <section class="rounded-xl border bg-card p-5">
      <h2 class="mb-4 text-lg font-medium">Sample todos</h2>
      <ul class="space-y-3">
        {#each data.todos as todo}
          <li class="flex items-center justify-between gap-4">
            <span class:line-through={todo.completed}>{todo.title}</span>
            <span class="text-xs uppercase text-muted-foreground">{todo.priority}</span>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <form method="POST">
      <button class="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground" type="submit">
        Enter isolated demo
      </button>
    </form>
  {/if}
</main>

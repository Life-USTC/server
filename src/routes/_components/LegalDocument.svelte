<script lang="ts">
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";

export let content: {
  title: string;
  mdx: string;
};
</script>

<svelte:head><title>{content.title} - Life@USTC</title></svelte:head>

<article class="mx-auto w-full max-w-3xl">
  <MarkdownPreview
    class="legal-document rounded-md border border-base-300 bg-base-100 px-6 py-7 shadow-sm md:px-8 md:py-9"
    content={content.mdx}
  />
</article>

<style>
  :global(.markdown-preview.legal-document h1) {
    font-size: clamp(2rem, 4vw, 2.75rem);
    line-height: 1.1;
    letter-spacing: -0.025em;
  }

  :global(.markdown-preview.legal-document h2) {
    margin-top: 1.75rem;
    font-size: 1.25rem;
    line-height: 1.35;
  }

  :global(.markdown-preview.legal-document h3) {
    font-size: 1rem;
    line-height: 1.4;
  }
</style>

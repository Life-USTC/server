<script lang="ts">
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";

export let content: {
  title: string;
  mdx: string;
  renderedHtml: string;
};
</script>

<svelte:head><title>{content.title} - Life@USTC</title></svelte:head>

<article class="mx-auto min-w-0 w-full max-w-3xl" data-slot="legal-document">
  <RenderedMarkdown class="legal-document" html={content.renderedHtml} />
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

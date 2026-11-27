<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="alert-description"
  {...props}
  bind:ref
  baseClass="text-muted-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3"
/>

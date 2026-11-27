<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="item-title"
  {...props}
  bind:ref
  baseClass="gap-2 text-sm leading-snug font-medium underline-offset-4 line-clamp-1 flex w-fit items-center"
/>

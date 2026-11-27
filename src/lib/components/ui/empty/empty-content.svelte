<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="empty-content"
  {...props}
  bind:ref
  baseClass="gap-2.5 text-sm flex w-full max-w-sm min-w-0 flex-col items-center text-balance"
/>

<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="empty"
  {...props}
  bind:ref
  baseClass="gap-4 rounded-xl p-6 flex w-full min-w-0 flex-col items-center justify-center text-center text-balance"
/>

<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="empty-header"
  {...props}
  bind:ref
  baseClass="gap-2 flex max-w-sm flex-col items-center"
/>

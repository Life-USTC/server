<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="card-title"
  {...props}
  bind:ref
  baseClass="text-base leading-snug font-medium group-data-[size=sm]/card:text-sm"
/>

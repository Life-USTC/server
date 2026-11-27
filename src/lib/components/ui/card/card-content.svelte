<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="card-content"
  {...props}
  bind:ref
  baseClass="px-4 group-data-[size=sm]/card:px-3"
/>

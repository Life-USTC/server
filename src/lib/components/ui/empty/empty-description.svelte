<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="empty-description"
  {...props}
  bind:ref
  baseClass="text-sm/relaxed text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4"
/>

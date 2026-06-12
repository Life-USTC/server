<script lang="ts">
let className = "";

export { className as class };
</script>

<h2 class={`font-semibold text-lg leading-none tracking-normal ${className}`} data-slot="card-title" {...$$restProps}>
  <slot />
</h2>

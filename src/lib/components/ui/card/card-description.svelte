<script lang="ts">
let className = "";

export { className as class };
</script>

<p class={`text-base-content/60 text-sm ${className}`} data-slot="card-description" {...$$restProps}>
  <slot />
</p>

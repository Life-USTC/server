<script lang="ts">
export let href: string;
let className = "";

export { className as class };
</script>

<a class={`link-hover link ${className}`} data-slot="breadcrumb-link" {href} {...$$restProps}>
  <slot />
</a>

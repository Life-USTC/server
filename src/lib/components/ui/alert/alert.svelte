<script lang="ts">
type AlertVariant = "default" | "info" | "warning" | "destructive";

const _variants: Record<AlertVariant, string> = {
  default: "border-base-300 bg-base-100 text-base-content",
  info: "border-info/30 bg-info/10 text-base-content",
  warning: "border-warning/40 bg-warning/10 text-base-content",
  destructive: "border-error/40 bg-error/10 text-base-content",
};

export let variant: AlertVariant = "default";
let className = "";

export { className as class };
</script>

<div
  class={`min-w-0 rounded-xl border p-4 text-sm ${_variants[variant]} ${className}`}
  data-slot="alert"
  {...$$restProps}
>
  <slot />
</div>

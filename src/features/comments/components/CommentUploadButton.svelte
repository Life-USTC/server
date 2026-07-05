<script lang="ts">
import { buttonVariants } from "$lib/components/ui/button/index.js";
import { Label } from "$lib/components/ui/label/index.js";
import { cn } from "$lib/utils.js";

export let disabled = false;
export let onFile: (file: File) => void;
export let uploadLabel: string;
export let uploading = false;
export let uploadingLabel: string;
</script>

<Label
  aria-disabled={disabled}
  data-slot="button"
  class={cn(
    buttonVariants({ size: "sm", variant: "outline" }),
    "cursor-pointer focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/30 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  )}
>
  {uploading ? uploadingLabel : uploadLabel}
  <input
    class="sr-only"
    type="file"
    {disabled}
    onchange={(event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (file) onFile(file);
      input.value = "";
    }}
  />
</Label>

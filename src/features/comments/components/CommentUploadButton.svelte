<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";

export let disabled = false;
export let onFile: (file: File) => void;
export let uploadLabel: string;
export let uploading = false;
export let uploadingLabel: string;
</script>

<Button
  as="label"
  class="cursor-pointer"
  {disabled}
  size="sm"
  variant="outline"
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
</Button>

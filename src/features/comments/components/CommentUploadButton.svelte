<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";

export let disabled = false;
export let onFile: (file: File) => void;
export let uploadLabel: string;
export let uploading = false;
export let uploadingLabel: string;

let inputRef: HTMLInputElement | null = null;

function openFilePicker() {
  inputRef?.click();
}
</script>

<Button
  {disabled}
  size="sm"
  type="button"
  variant="outline"
  onclick={openFilePicker}
>
  {uploading ? uploadingLabel : uploadLabel}
</Button>
<Input
  bind:ref={inputRef}
  aria-hidden="true"
  class="sr-only h-px w-px p-0"
  tabindex={-1}
  type="file"
  {disabled}
  onchange={(event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file) onFile(file);
    input.value = "";
  }}
/>

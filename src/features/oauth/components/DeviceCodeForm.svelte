<script lang="ts">
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "bits-ui";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputOTP from "$lib/components/ui/input-otp/index.js";
import type { DeviceCopy } from "./device-component-types";

export let code: string;
export let copy: DeviceCopy;

let inputCode = sanitizeDeviceCode(code);

$: inputCode = sanitizeDeviceCode(code);

function sanitizeDeviceCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}
</script>

<form class="min-w-0" method="GET" action="/oauth/device">
  <input type="hidden" name="step" value="approve" />
  <Field.Group class="min-w-0">
    <Field.Field class="min-w-0">
      <Field.Label for="code">{copy.deviceCodeLabel}</Field.Label>
      <InputOTP.Root
        autocomplete="off"
        bind:value={inputCode}
        class="min-w-0 justify-center gap-1 sm:gap-2"
        id="device-code"
        inputId="code"
        inputmode="text"
        maxlength={8}
        name="code"
        onValueChange={(value) => {
          inputCode = sanitizeDeviceCode(value);
        }}
        pasteTransformer={sanitizeDeviceCode}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        required
      >
        {#snippet children({ cells })}
          <InputOTP.Group
          >
            {#each cells.slice(0, 4) as cell}
              <InputOTP.Slot class="size-7 sm:size-8" {cell} />
            {/each}
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group
          >
            {#each cells.slice(4, 8) as cell}
              <InputOTP.Slot class="size-7 sm:size-8" {cell} />
            {/each}
          </InputOTP.Group>
        {/snippet}
      </InputOTP.Root>
    </Field.Field>
    <Button type="submit">{copy.deviceVerify}</Button>
  </Field.Group>
</form>

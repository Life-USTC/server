<script lang="ts">
import MinusIcon from "@lucide/svelte/icons/minus";
import {
  OTPInput,
  OTPInputGroup,
  OTPInputSeparator,
  OTPInputSlot,
} from "@ui-sdk/svelte/otp-input";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
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
      <OTPInput
        id="code"
        name="code"
        autoComplete="off"
        inputMode="text"
        maxLength={8}
        pattern="alphanumeric"
        bind:value={() => inputCode, (next) => { inputCode = sanitizeDeviceCode(next); }}
        required
      >
        {#each [0, 4] as start (start)}
          {#if start > 0}
            <OTPInputSeparator><MinusIcon aria-hidden="true" /></OTPInputSeparator>
          {/if}
          <OTPInputGroup>
            {#each [0, 1, 2, 3] as offset (offset)}
              <OTPInputSlot index={start + offset} />
            {/each}
          </OTPInputGroup>
        {/each}
      </OTPInput>
    </Field.Field>
    <Button type="submit">{copy.deviceVerify}</Button>
  </Field.Group>
</form>

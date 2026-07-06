<script lang="ts">
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";

export let copy: Record<string, string>;
export let parsedRedirectUris: string[];
export let redirectCountLabel: (count: number) => string;
export let redirectDraft: string;
</script>

<Field.Group class="content-start gap-4">
  <Field.Field>
    <Field.Label for="admin-oauth-client-name">{copy.clientName}</Field.Label>
    <Input
      id="admin-oauth-client-name"
      name="name"
      autocomplete="off"
      placeholder={copy.clientNamePlaceholder}
      required
    />
  </Field.Field>
  <Field.Field>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <Field.Label for="admin-oauth-redirect-uris">
        {copy.redirectUris}
      </Field.Label>
      <Field.Description aria-live="polite">
        {redirectCountLabel(parsedRedirectUris.length)}
      </Field.Description>
    </div>
    <Textarea
      id="admin-oauth-redirect-uris"
      bind:value={redirectDraft}
      class="min-h-32"
      name="redirectUris"
      placeholder={copy.redirectUrisPlaceholder}
      required
    />
    <Field.Description>{copy.redirectUrisHint}</Field.Description>
  </Field.Field>
</Field.Group>

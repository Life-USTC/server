<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import type { HomeworkTagCopy } from "./homework-form-types";

export let copy: HomeworkTagCopy;
export let disabled = false;
export let idPrefix = "homework";
export let isMajor: boolean | undefined = undefined;
export let requiresTeam: boolean | undefined = undefined;

$: majorId = `${idPrefix}-is-major`;
$: teamId = `${idPrefix}-requires-team`;
</script>

<Field.Set data-disabled={disabled ? "true" : undefined}>
  <Field.Legend variant="label" class="sr-only">
    {copy.tagMajor} / {copy.tagTeam}
  </Field.Legend>
  <Field.Group class="flex-row flex-wrap gap-4" data-slot="checkbox-group">
    <Field.Field
      class="w-fit"
      data-disabled={disabled ? "true" : undefined}
      orientation="horizontal"
    >
      <Checkbox
        checked={isMajor}
        disabled={disabled}
        id={majorId}
        name="isMajor"
      />
      <Field.Label for={majorId}>{copy.tagMajor}</Field.Label>
    </Field.Field>
    <Field.Field
      class="w-fit"
      data-disabled={disabled ? "true" : undefined}
      orientation="horizontal"
    >
      <Checkbox
        checked={requiresTeam}
        disabled={disabled}
        id={teamId}
        name="requiresTeam"
      />
      <Field.Label for={teamId}>{copy.tagTeam}</Field.Label>
    </Field.Field>
  </Field.Group>
</Field.Set>

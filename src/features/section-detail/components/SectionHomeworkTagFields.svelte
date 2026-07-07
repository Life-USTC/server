<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";

export let homeworkCopy: {
  tagMajor: string;
  tagTeam: string;
};
export let idPrefix = "section-homework";
export let isMajor = false;
export let requiresTeam = false;

$: majorId = `${idPrefix}-is-major`;
$: teamId = `${idPrefix}-requires-team`;
</script>

<Field.Set>
  <Field.Legend variant="label" class="sr-only">
    {homeworkCopy.tagMajor} / {homeworkCopy.tagTeam}
  </Field.Legend>
  <Field.Group class="flex-row flex-wrap gap-4" data-slot="checkbox-group">
    <Field.Field class="w-fit" orientation="horizontal">
      <Checkbox id={majorId} checked={isMajor} name="isMajor" />
      <Field.Label for={majorId}>
        {homeworkCopy.tagMajor}
      </Field.Label>
    </Field.Field>
    <Field.Field class="w-fit" orientation="horizontal">
      <Checkbox id={teamId} checked={requiresTeam} name="requiresTeam" />
      <Field.Label for={teamId}>
        {homeworkCopy.tagTeam}
      </Field.Label>
    </Field.Field>
  </Field.Group>
</Field.Set>

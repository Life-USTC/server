<script lang="ts">
import { HOMEWORK_TITLE_MAX_LENGTH } from "@/features/homeworks/lib/homework-limits";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type { HomeworkFormCopy } from "./homework-form-types";

export let copy: HomeworkFormCopy;
export let disabled = false;
export let idPrefix = "homework";
export let title = "";
</script>

<Field.Field data-disabled={disabled ? "true" : undefined}>
  <Field.Label for={`${idPrefix}-title`}>{copy.titleLabel}</Field.Label>
  <Input
    data-testid={`${idPrefix}-title`}
    {disabled}
    id={`${idPrefix}-title`}
    maxlength={HOMEWORK_TITLE_MAX_LENGTH}
    name="title"
    placeholder={copy.titlePlaceholder}
    required
    value={title}
  />
</Field.Field>

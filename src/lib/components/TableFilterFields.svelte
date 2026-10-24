<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";
import { Checkbox } from "#lib/components/ui/checkbox/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import {
  type NumericFilterOperator,
  type TableFilterField,
  type TableFilterLabels,
  tableFilterValues,
} from "@/lib/table-filters";

let {
  fields,
  values,
  onchange,
  labels,
  idPrefix,
  formId,
}: {
  fields: TableFilterField[];
  values: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  labels: TableFilterLabels;
  idPrefix: string;
  formId?: string;
} = $props();

function toggle(name: string, value: string, checked: boolean) {
  const selected = tableFilterValues(values[name]);
  onchange({
    [name]: (checked
      ? [...selected, value]
      : selected.filter((item) => item !== value)
    ).join(","),
  });
}
</script>

<Field.Group class="gap-3">
  {#each fields as field (field.name)}
    {@const id = `${idPrefix}-${field.name}`}
    {#if field.options}
      {@const selected = tableFilterValues(values[field.name])}
      <Field.Set class="gap-2" data-filter-field={field.name}>
        <Field.Legend>{field.label}</Field.Legend>
        <Button type="button" variant="outline" size="sm" class="justify-start" onclick={() => onchange({ [field.name]: "" })} aria-pressed={selected.length === 0}>
          {selected.length === 0 ? labels.any : labels.selected.replace("{count}", String(selected.length))}
        </Button>
        <div class="grid max-h-56 gap-2 overflow-y-auto py-2">
          {#each [...field.options.filter((option) => option.value !== ""), ...selected.filter((value) => !field.options?.some((option) => option.value === value)).map((value) => ({ value, label: value }))] as option (option.value)}
            <Field.Field orientation="horizontal" class="min-h-11">
              <Checkbox id={`${id}-${option.value}`} checked={selected.includes(option.value)} onCheckedChange={(checked) => toggle(field.name, option.value, checked)} />
              <Field.Label for={`${id}-${option.value}`} class="min-h-11 flex-1">{option.label}</Field.Label>
            </Field.Field>
          {/each}
        </div>
        {#if field.description}<Field.Description>{field.description}</Field.Description>{/if}
      </Field.Set>
    {:else}
      <Field.Field data-filter-field={field.name}>
        <Field.Label for={id}>{field.label}</Field.Label>
        {#if field.type && field.type !== "text"}
          <NativeSelect.Root aria-label={`${field.label} · ${labels.operator}`} value={values[`${field.name}Op`] || "eq"} onchange={(event) => onchange({ [`${field.name}Op`]: event.currentTarget.value })} class="w-full">
            {#each Object.entries(labels.operators) as [operator, label]}
              <NativeSelect.Option value={operator as NumericFilterOperator}>{label}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        {/if}
        <Input {id} form={formId} type={field.type ?? "text"} min={field.min} step={field.step} placeholder={labels.any} value={values[field.name] ?? ""} oninput={(event) => onchange({ [field.name]: event.currentTarget.value })} />
        {#if field.type && field.type !== "text" && values[`${field.name}Op`] === "between"}
          <Field.Label for={`${id}-maximum`}>{labels.maximum}</Field.Label>
          <Input id={`${id}-maximum`} form={formId} type={field.type} min={field.min} step={field.step} placeholder={labels.any} value={values[`${field.name}Max`] ?? ""} oninput={(event) => onchange({ [`${field.name}Max`]: event.currentTarget.value })} />
        {/if}
        {#if field.description}<Field.Description>{field.description}</Field.Description>{/if}
      </Field.Field>
    {/if}
  {/each}
</Field.Group>

"use client";

import { usePathname, useRouter } from "next/navigation";
import type * as React from "react";
import { Fragment, useRef } from "react";
import { FiltersBarSearch } from "@/components/filters/filters-bar";
import { PageToolbar } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildSearchParams } from "@/lib/navigation/search-params";

export type SelectItemOption = { label: string; value: string };

type SelectField<TValues extends Record<string, string | undefined>> = {
  kind: "select";
  name: keyof TValues;
  value: string;
  items: SelectItemOption[];
  triggerClassName?: string;
};

type SearchField = {
  kind: "search";
  name: "search";
  defaultValue?: string;
  placeholder: string;
  fieldClassName?: string;
};

type ExtraField = { kind: "extra"; key: string; node: React.ReactNode };

export type ListFilterField<
  TValues extends Record<string, string | undefined>,
> = SelectField<TValues> | SearchField | ExtraField;

type ListFiltersToolbarProps<
  TValues extends Record<string, string | undefined>,
> = {
  defaultValues: TValues;
  fields: Array<ListFilterField<TValues>>;
  submitLabel: string;
  clearRender: React.ReactElement;
  clearLabel: string;
  showClearWhen: (values: TValues) => boolean;
  toolbarClassName?: string;
  formClassName?: string;
};

export function ListFiltersToolbar<
  TValues extends Record<string, string | undefined>,
>({
  defaultValues,
  fields,
  submitLabel,
  clearRender,
  clearLabel,
  showClearWhen,
  toolbarClassName,
  formClassName,
}: ListFiltersToolbarProps<TValues>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updateFilters = (name?: keyof TValues, value?: string) => {
    const currentValues: TValues = { ...defaultValues };

    if (name) {
      (currentValues as Record<string, string | undefined>)[String(name)] =
        value;
    }

    if (searchInputRef.current) {
      (currentValues as Record<string, string | undefined>).search =
        searchInputRef.current.value;
    }

    const query = buildSearchParams({
      values: currentValues,
    });

    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateFilters();
  };

  return (
    <PageToolbar className={toolbarClassName}>
      <Form layout="toolbar" className={formClassName} onSubmit={onSubmit}>
        {fields.map((field) => {
          if (field.kind === "extra") {
            return <Fragment key={field.key}>{field.node}</Fragment>;
          }

          if (field.kind === "search") {
            return (
              <Field
                key={field.name}
                className={
                  field.fieldClassName ?? "min-w-full flex-1 sm:min-w-64"
                }
              >
                <FiltersBarSearch
                  inputRef={searchInputRef}
                  defaultValue={field.defaultValue}
                  name={field.name}
                  placeholder={field.placeholder}
                />
              </Field>
            );
          }

          return (
            <Field key={String(field.name)} className="w-full sm:w-auto">
              <Select
                name={String(field.name)}
                value={field.value}
                onValueChange={(val) =>
                  updateFilters(field.name, val ?? undefined)
                }
                items={field.items}
              >
                <SelectTrigger
                  className={field.triggerClassName ?? "w-full sm:w-50"}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {field.items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Field>
          );
        })}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button className="w-full sm:w-auto" type="submit">
            {submitLabel}
          </Button>

          {showClearWhen(defaultValues) ? (
            <Button
              className="w-full sm:w-auto"
              render={clearRender}
              variant="outline"
            >
              {clearLabel}
            </Button>
          ) : null}
        </div>
      </Form>
    </PageToolbar>
  );
}

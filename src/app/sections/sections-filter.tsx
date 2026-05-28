"use client";

import { useTranslations } from "next-intl";
import type { SelectItemOption } from "@/components/filters/list-filters-toolbar";
import { ListFiltersToolbar } from "@/components/filters/list-filters-toolbar";
import { SearchHelpSheet } from "@/components/search-help-sheet";
import { Link } from "@/i18n/routing";

type SemesterOption = { id: number; nameCn: string };

interface SectionsFilterProps {
  semesters: SemesterOption[];
  defaultValues: {
    search?: string;
    semesterId?: string;
  };
}

type SectionsFilterValues = SectionsFilterProps["defaultValues"];

export function SectionsFilter({
  semesters,
  defaultValues,
}: SectionsFilterProps) {
  const t = useTranslations("sections");
  const tCommon = useTranslations("common");

  const getSelectItems = (options: SemesterOption[], allLabel: string) => {
    return [
      { label: allLabel, value: "" },
      ...options.map((opt) => ({
        label: opt.nameCn,
        value: opt.id.toString(),
      })),
    ];
  };

  const semesterItems: SelectItemOption[] = getSelectItems(
    semesters,
    tCommon("allSemesters"),
  );

  return (
    <ListFiltersToolbar<SectionsFilterValues>
      defaultValues={defaultValues}
      submitLabel={tCommon("search")}
      clearRender={<Link href="/sections" />}
      clearLabel={tCommon("clear")}
      showClearWhen={(values) => Boolean(values.search || values.semesterId)}
      toolbarClassName="mb-8"
      fields={[
        {
          kind: "select",
          name: "semesterId",
          value: defaultValues.semesterId || "",
          items: semesterItems,
          triggerClassName: "w-full sm:w-50",
        },
        {
          kind: "search",
          name: "search",
          defaultValue: defaultValues.search,
          placeholder: t("searchPlaceholder"),
        },
        {
          kind: "extra",
          key: "search-help",
          node: (
            <SearchHelpSheet
              trigger={t("searchHelp")}
              title={t("searchHelpTitle")}
              description={t("searchHelpDescription")}
              exampleLabel={t("searchHelpExample")}
              examples={t.raw("searchHelpExamples")}
            />
          ),
        },
      ]}
    />
  );
}

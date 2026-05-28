import type { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminDescription } from "./moderation-types";

type DescriptionsTableProps = {
  descriptions: AdminDescription[];
  formatTimestamp: (value: string | Date) => string;
  onSelect: (description: AdminDescription) => void;
  t: ReturnType<typeof useTranslations>;
};

export function DescriptionsTable({
  descriptions,
  formatTimestamp,
  onSelect,
  t,
}: DescriptionsTableProps) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {descriptions.map((d) => {
          const target = d.homework?.id
            ? d.homework.section?.jwId
              ? {
                  href: `/sections/${d.homework.section.jwId}#homework-${d.homework.id}`,
                  label: d.homework.title ?? "—",
                }
              : { href: "/", label: d.homework.title ?? "—" }
            : d.section?.jwId
              ? {
                  href: `/sections/${d.section.jwId}`,
                  label: d.section.course?.nameCn ?? "—",
                }
              : d.course?.jwId
                ? {
                    href: `/courses/${d.course.jwId}`,
                    label: d.course.nameCn ?? "—",
                  }
                : d.teacher?.id
                  ? {
                      href: `/teachers/${d.teacher.id}`,
                      label: d.teacher.nameCn,
                    }
                  : { href: "/", label: "—" };

          const authorName = d.lastEditedBy?.name ?? "—";
          const createdLabel = d.lastEditedAt ?? d.updatedAt;

          return (
            <button
              key={d.id}
              type="button"
              className="rounded-lg border border-border/60 bg-background/70 p-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(d)}
            >
              <p className="line-clamp-3 whitespace-pre-wrap font-medium text-sm leading-5">
                {d.content?.trim() ? d.content : "—"}
              </p>
              <div className="mt-3 space-y-1 text-xs">
                <div className="font-medium">{authorName}</div>
                <div className="text-muted-foreground">{target.label}</div>
                <div className="text-muted-foreground">
                  {formatTimestamp(createdLabel)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("descriptionPreview")}</TableHead>
              <TableHead>{t("author")}</TableHead>
              <TableHead>{t("postedIn")}</TableHead>
              <TableHead>{t("createdAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {descriptions.map((d) => {
              const target = d.homework?.id
                ? d.homework.section?.jwId
                  ? {
                      href: `/sections/${d.homework.section.jwId}#homework-${d.homework.id}`,
                      label: d.homework.title ?? "—",
                    }
                  : { href: "/", label: d.homework.title ?? "—" }
                : d.section?.jwId
                  ? {
                      href: `/sections/${d.section.jwId}`,
                      label: d.section.course?.nameCn ?? "—",
                    }
                  : d.course?.jwId
                    ? {
                        href: `/courses/${d.course.jwId}`,
                        label: d.course.nameCn ?? "—",
                      }
                    : d.teacher?.id
                      ? {
                          href: `/teachers/${d.teacher.id}`,
                          label: d.teacher.nameCn,
                        }
                      : { href: "/", label: "—" };

              const authorName = d.lastEditedBy?.name ?? "—";
              const createdLabel = d.lastEditedAt ?? d.updatedAt;

              return (
                <TableRow
                  key={d.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelect(d)}
                >
                  <TableCell className="max-w-md font-medium">
                    <p className="line-clamp-2 whitespace-pre-wrap text-sm">
                      {d.content?.trim() ? d.content : "—"}
                    </p>
                  </TableCell>
                  <TableCell className="font-medium">{authorName}</TableCell>
                  <TableCell className="max-w-sm text-sm">
                    {target.label}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatTimestamp(createdLabel)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

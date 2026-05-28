import { getTranslations } from "next-intl/server";
import { BulkImportSectionsDialog } from "@/components/bulk-import-sections-dialog";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { groupSectionsBySemester } from "@/features/home/lib/subscription-section-groups";
import type { SubscriptionsTabData } from "@/features/home/server/dashboard-tab-data";
import { Link } from "@/i18n/routing";
import { SubscriptionRowOptOutButton } from "./subscription-row-opt-out-button";

export async function SubscriptionsPanel({
  data,
}: {
  data: SubscriptionsTabData;
}) {
  const { subscriptions, semesters, currentSemesterId } = data;
  const t = await getTranslations("subscriptions");
  const tSection = await getTranslations("sectionDetail");

  return (
    <div className="space-y-6">
      <div className="mx-auto grid w-full min-w-0 max-w-5xl gap-6">
        {subscriptions.length === 0 ? (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyTitle>{t("noSubscriptions")}</EmptyTitle>
              <EmptyDescription>
                {t("noSubscriptionsDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="sm:max-w-none sm:flex-row sm:justify-center">
              <BulkImportSectionsDialog
                semesters={semesters}
                defaultSemesterId={currentSemesterId}
                triggerVariant="default"
                triggerSize="default"
              />
              <Button
                variant="outline"
                render={<Link className="no-underline" href="/sections" />}
              >
                {t("browseSections")}
              </Button>
              <Button
                variant="outline"
                render={<Link className="no-underline" href="/courses" />}
              >
                {t("browseCourses")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          subscriptions.map(
            (sub: SubscriptionsTabData["subscriptions"][number]) => {
              const groupedSections = groupSectionsBySemester(sub.sections);
              type SectionType = (typeof sub.sections)[number];

              return (
                <div
                  key={sub.id}
                  className="group/subscription-card flex min-w-0 flex-col gap-6"
                >
                  <CardPanel className="min-w-0">
                    <div className="min-w-0 space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <BulkImportSectionsDialog
                          semesters={semesters}
                          defaultSemesterId={currentSemesterId}
                        />
                      </div>
                      {groupedSections.map((group) => (
                        <div key={group.key} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-sm">
                            <span>
                              {tSection("semester")}: {group.label}
                            </span>
                            <span className="text-muted-foreground">
                              {t("sectionsIncluded", {
                                count: group.sections.length,
                              })}
                            </span>
                          </div>
                          <Table
                            data-slot="frame"
                            className="min-w-[760px] table-fixed"
                          >
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[18%]">
                                  {tSection("sectionCode")}
                                </TableHead>
                                <TableHead className="w-[31%]">
                                  {t("courseName")}
                                </TableHead>
                                <TableHead className="w-[29%]">
                                  {tSection("teachers")}
                                </TableHead>
                                <TableHead className="w-[10%]">
                                  {t("credits")}
                                </TableHead>
                                <TableHead className="w-[12%] text-right">
                                  <span className="sr-only">
                                    {t("rowActions")}
                                  </span>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.sections.map((section: SectionType) => {
                                const teacherNames = section.teachers
                                  .map(
                                    (tr: { namePrimary: string }) =>
                                      tr.namePrimary,
                                  )
                                  .filter(Boolean);
                                return (
                                  <TableRow
                                    key={section.jwId}
                                    className="group/section-row [&_td]:py-0"
                                  >
                                    <TableCell className="w-[18%] max-w-0 truncate py-0 font-medium">
                                      <Link
                                        className="block px-2 py-2 text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                        href={`/sections/${section.jwId}`}
                                      >
                                        {section.code}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="w-[31%] max-w-0 truncate py-0">
                                      <Link
                                        className="block px-2 py-2 text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                        href={`/sections/${section.jwId}`}
                                      >
                                        {section.course.namePrimary}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="w-[29%] max-w-0 truncate py-0">
                                      <Link
                                        className="block px-2 py-2 text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                        href={`/sections/${section.jwId}`}
                                      >
                                        {teacherNames.length > 0
                                          ? teacherNames.join(", ")
                                          : "—"}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="w-[10%] max-w-0 truncate py-0">
                                      <Link
                                        className="block px-2 py-2 text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                        href={`/sections/${section.jwId}`}
                                      >
                                        {section.credits}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="w-[12%] py-1 text-right">
                                      <SubscriptionRowOptOutButton
                                        sectionId={section.id}
                                        label={t("optOut")}
                                        confirmLabel={t("optOutConfirm")}
                                        successLabel={t("optOutSuccess")}
                                        successDescription={t(
                                          "optOutSuccessDescription",
                                        )}
                                        errorLabel={t("optOutError")}
                                        retryLabel={t("optOutRetry")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  </CardPanel>
                </div>
              );
            },
          )
        )}
      </div>
    </div>
  );
}

"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { addSectionsToSubscription } from "@/app/actions/subscription";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import type { Semester } from "@/generated/prisma/client";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import { matchSectionCodesResponseSchema } from "@/lib/api/schemas/response-schemas";

type SectionData = z.infer<
  typeof matchSectionCodesResponseSchema
>["sections"][number];

type SemesterOption = Pick<Semester, "id" | "nameCn"> & {
  namePrimary?: string;
};

export interface BulkImportSectionsProps {
  semesters: SemesterOption[];
  defaultSemesterId?: number | null;
  variant?: "card" | "plain";
  showDescription?: boolean;
  /** When provided, the match button is not rendered in the form; parent should render it using these props */
  onMatchButtonRender?: (props: {
    onClick: () => void;
    disabled: boolean;
    label: string;
  }) => void;
}

export function BulkImportSections({
  semesters,
  defaultSemesterId,
  variant = "card",
  showDescription = true,
  onMatchButtonRender,
}: BulkImportSectionsProps) {
  const t = useTranslations("subscriptions");
  const locale = useLocale();
  const router = useRouter();

  // Bulk import state
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [matchedSections, setMatchedSections] = useState<SectionData[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<number>>(
    new Set(),
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState(
    defaultSemesterId ? defaultSemesterId.toString() : "",
  );

  const getNamePrimary = (item: {
    namePrimary?: string;
    nameCn?: string | null;
    nameEn?: string | null;
  }) => {
    if (item.namePrimary) return item.namePrimary;
    const english = item.nameEn?.trim();
    if (locale === "en-us" && english) return english;
    return item.nameCn ?? "";
  };

  const getNameSecondary = (item: {
    nameSecondary?: string | null;
    nameCn?: string | null;
    nameEn?: string | null;
  }) => {
    if (item.nameSecondary !== undefined) return item.nameSecondary;
    const english = item.nameEn?.trim();
    if (locale === "en-us") {
      return english ? (item.nameCn ?? null) : null;
    }
    return english ?? null;
  };

  const semesterItems = semesters.map((semester) => ({
    label: getNamePrimary(semester),
    value: semester.id.toString(),
  }));

  const handleFetchSections = useCallback(async () => {
    if (!importText.trim()) return;

    setImporting(true);
    try {
      // Extract section codes using regex
      const codePattern = /[A-Z0-9_.-]+\.[A-Z0-9]{2}/g;
      const extractedCodes = importText.match(codePattern) || [];

      if (extractedCodes.length === 0) {
        toastManager.add({
          type: "warning",
          title: t("bulkImport.noValidCodes"),
          description: t("bulkImport.checkFormat"),
        });
        setImporting(false);
        return;
      }

      // Remove duplicates
      const uniqueCodes = [...new Set(extractedCodes)];

      // Call API to match codes
      const {
        data,
        error: errorBody,
        response,
      } = await apiClient.POST("/api/sections/match-codes", {
        body: {
          codes: uniqueCodes,
          semesterId: selectedSemesterId || undefined,
        },
      });

      if (!response.ok) {
        const apiMessage = extractApiErrorMessage(errorBody);
        throw new Error(apiMessage ?? "Failed to fetch sections");
      }

      const parsedData = matchSectionCodesResponseSchema.safeParse(data);
      if (!parsedData.success) {
        throw parsedData.error;
      }

      setMatchedSections(parsedData.data.sections || []);
      setUnmatchedCodes(parsedData.data.unmatchedCodes || []);

      // Select all matched sections by default
      setSelectedSectionIds(
        new Set(parsedData.data.sections.map((section) => section.id)),
      );

      setShowConfirmDialog(true);
    } catch (error) {
      console.error("Failed to fetch sections:", error);
      toastManager.add({
        type: "error",
        title: t("bulkImport.fetchFailed"),
        description: t("bulkImport.pleaseRetry"),
      });
    } finally {
      setImporting(false);
    }
  }, [importText, selectedSemesterId, t]);

  const handleConfirmImport = async () => {
    try {
      const idsToAdd = Array.from(selectedSectionIds);
      if (idsToAdd.length === 0) {
        setShowConfirmDialog(false);
        return;
      }

      await addSectionsToSubscription(idsToAdd);

      // Reset state
      setImportText("");
      setMatchedSections([]);
      setSelectedSectionIds(new Set());
      setUnmatchedCodes([]);
      setShowConfirmDialog(false);

      toastManager.add({
        type: "success",
        title: t("bulkImport.success"),
        description: t("bulkImport.successDescription", {
          count: idsToAdd.length,
        }),
      });

      // Refresh the page to show updated subscriptions
      router.refresh();
    } catch (error) {
      console.error("Failed to import sections:", error);
      toastManager.add({
        type: "error",
        title: t("bulkImport.importFailed"),
        description: t("bulkImport.pleaseRetry"),
      });
    }
  };

  const toggleSectionSelection = (sectionId: number) => {
    setSelectedSectionIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    onMatchButtonRender?.({
      onClick: handleFetchSections,
      disabled: !importText.trim() || importing,
      label: importing ? t("bulkImport.matching") : t("bulkImport.matchButton"),
    });
  }, [onMatchButtonRender, importText, importing, t, handleFetchSections]);

  const description = (
    <p className="mb-4 text-muted-foreground text-small">
      {t("bulkImport.description")}
    </p>
  );

  const form = (
    <>
      {showDescription && description}
      <Field className="mb-4">
        <FieldLabel>{t("bulkImport.semesterLabel")}</FieldLabel>
        <Select
          name="semesterId"
          value={selectedSemesterId}
          onValueChange={(value) => setSelectedSemesterId(value ?? "")}
          items={semesterItems}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("bulkImport.semesterPlaceholder")} />
          </SelectTrigger>
          <SelectPopup>
            {semesterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </Field>
      <Textarea
        placeholder={t("bulkImport.placeholder")}
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        rows={4}
        className="mb-4"
      />
      {!onMatchButtonRender && (
        <Button
          onClick={handleFetchSections}
          disabled={!importText.trim() || importing}
          className="w-full"
        >
          {importing ? t("bulkImport.matching") : t("bulkImport.matchButton")}
        </Button>
      )}
    </>
  );

  return (
    <>
      {variant === "card" ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t("bulkImport.title")}
            </CardTitle>
          </CardHeader>
          <div className="p-6 pt-0">{form}</div>
        </Card>
      ) : (
        <div className="space-y-4">{form}</div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("bulkImport.confirmTitle", { count: matchedSections.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {matchedSections.length > 0 && (
                <>
                  <p className="mb-4">
                    {t("bulkImport.foundSections", {
                      count: matchedSections.length,
                    })}
                  </p>
                  <div className="mb-4 max-h-96 space-y-2 overflow-y-auto">
                    {matchedSections.map((section) => (
                      <Button
                        type="button"
                        key={section.id}
                        variant="outline"
                        className="h-auto w-full items-start justify-start gap-3 p-3 text-left"
                        onClick={() => toggleSectionSelection(section.id)}
                      >
                        <Checkbox
                          checked={selectedSectionIds.has(section.id)}
                          onCheckedChange={() =>
                            toggleSectionSelection(section.id)
                          }
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            {getNamePrimary(section.course)}
                            {getNameSecondary(section.course) && (
                              <span className="ml-2 text-muted-foreground">
                                ({getNameSecondary(section.course)})
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {section.code} ·
                            {section.semester
                              ? getNamePrimary(section.semester)
                              : "—"}
                            {section.campus
                              ? ` · ${getNamePrimary(section.campus)}`
                              : ""}
                            {section.teachers.length > 0
                              ? ` · ${section.teachers
                                  .map((teacher) => getNamePrimary(teacher))
                                  .filter(Boolean)
                                  .join(", ")}`
                              : ""}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {unmatchedCodes.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("bulkImport.unmatchedCodes", {
                    count: unmatchedCodes.length,
                  })}
                  : {unmatchedCodes.join(", ")}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              {t("bulkImport.cancel")}
            </AlertDialogClose>
            <Button onClick={handleConfirmImport}>
              {t("bulkImport.subscribeSelected", {
                count: selectedSectionIds.size,
              })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

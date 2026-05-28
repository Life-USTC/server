"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SUSPENSION_DURATION_OPTIONS } from "@/features/admin/constants";
import { useToast } from "@/hooks/use-toast";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import { adminUserResponseSchema } from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import { getPaginationTokens } from "@/lib/navigation/pagination";
import { buildSearchParams } from "@/lib/navigation/search-params";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  createShanghaiDateTimeFormatter,
  parseShanghaiDateTimeLocalInput,
} from "@/lib/time/shanghai-format";

type AdminUser = {
  id: string;
  name: string | null;
  username: string | null;
  isAdmin: boolean;
  email: string | null;
  createdAt: string;
};

type AdminUsersTableProps = {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
  search: string;
};

export function AdminUsersTable({
  users: initialUsers,
  total,
  page,
  totalPages,
  search,
}: AdminUsersTableProps) {
  const locale = useLocale();
  const suspendDurationLabelId = "admin-user-suspend-duration-label";
  const suspendExpiresInputId = "admin-user-suspend-expires-at";
  const suspendReasonInputId = "admin-user-suspend-reason";
  const t = useTranslations("adminUsers");
  const tModeration = useTranslations("moderation");
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [suspendDuration, setSuspendDuration] = useState("3d");
  const [suspendExpiresAt, setSuspendExpiresAt] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const dateTimeFormatter = useMemo(
    () =>
      createShanghaiDateTimeFormatter(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );
  const formatTimestamp = useCallback(
    (value: string | Date) => dateTimeFormatter.format(new Date(value)),
    [dateTimeFormatter],
  );

  const buildUrl = (nextPage: number) => {
    const query = buildSearchParams({
      values: {
        search,
        page: nextPage > 1 ? String(nextPage) : "",
      },
    });
    return query ? `/admin/users?${query}` : "/admin/users";
  };

  const openDialog = (user: AdminUser) => {
    setSelectedUser(user);
    setEditName(user.name ?? "");
    setEditUsername(user.username ?? "");
    setEditIsAdmin(user.isAdmin);
    setSuspendDuration("3d");
    setSuspendExpiresAt("");
    setSuspendReason("");
    setDialogOpen(true);
  };

  const calculateExpiresAt = () => {
    if (suspendDuration === "permanent") return null;
    if (suspendDuration === "custom") {
      const parsed = parseShanghaiDateTimeLocalInput(suspendExpiresAt);
      return parsed ? toShanghaiIsoString(parsed) : null;
    }
    const amount =
      suspendDuration === "1d"
        ? 1
        : suspendDuration === "3d"
          ? 3
          : suspendDuration === "7d"
            ? 7
            : 30;
    return toShanghaiIsoString(addShanghaiTime(new Date(), amount, "day"));
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const result = await apiClient.PATCH("/api/admin/users/{id}", {
        params: {
          path: { id: selectedUser.id },
        },
        body: {
          name: editName.trim() || null,
          username: editUsername.trim() || null,
          isAdmin: editIsAdmin,
        },
      });

      if (!result.response.ok || !result.data) {
        const apiMessage = extractApiErrorMessage(result.error);
        throw new Error(apiMessage ?? "Update failed");
      }

      const parsed = adminUserResponseSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new Error("Update failed");
      }

      setUsers((current) =>
        current.map((entry) =>
          entry.id === parsed.data.user.id
            ? { ...entry, ...parsed.data.user }
            : entry,
        ),
      );
      toast({
        title: t("updateSuccess"),
        variant: "success",
      });
      setDialogOpen(false);
    } catch (error) {
      logClientError("Failed to update user", error, {
        component: "AdminUsersTable",
        userId: selectedUser?.id ?? null,
      });
      toast({
        title: t("updateFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedUser) return;
    setIsSuspending(true);
    try {
      const expiresAt = calculateExpiresAt();
      const result = await apiClient.POST("/api/admin/suspensions", {
        body: {
          userId: selectedUser.id,
          reason: suspendReason.trim() || undefined,
          expiresAt: expiresAt ?? undefined,
        },
      });

      if (!result.response.ok) {
        const apiMessage = extractApiErrorMessage(result.error);
        throw new Error(apiMessage ?? "Suspend failed");
      }
      toast({
        title: tModeration("suspendSuccess"),
        variant: "success",
      });
    } catch (error) {
      logClientError("Failed to suspend user", error, {
        component: "AdminUsersTable",
        userId: selectedUser?.id ?? null,
      });
      toast({
        title: tModeration("suspendFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSuspending(false);
    }
  };

  if (users.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("noResults")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <p className="mb-3 text-muted-foreground text-sm">
        {t("showing", { count: users.length, total })}
      </p>
      <div className="grid gap-3 md:hidden">
        {users.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="rounded-lg border border-border/60 bg-background/70 p-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => openDialog(entry)}
          >
            <div className="space-y-1">
              <div className="font-medium leading-5">{entry.name ?? "—"}</div>
              <div className="text-muted-foreground text-sm">
                {entry.username ?? "—"}
              </div>
              <div className="break-words text-muted-foreground text-xs leading-5">
                {entry.email ?? "—"}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-border/60 px-2 py-1">
                {entry.isAdmin ? t("adminRole") : t("userRole")}
              </span>
              <span className="text-muted-foreground">
                {formatTimestamp(entry.createdAt)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("username")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("createdAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((entry) => (
              <TableRow
                key={entry.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => openDialog(entry)}
              >
                <TableCell className="font-medium">
                  {entry.name ?? "—"}
                </TableCell>
                <TableCell>{entry.username ?? "—"}</TableCell>
                <TableCell className="text-sm">{entry.email ?? "—"}</TableCell>
                <TableCell>
                  {entry.isAdmin ? t("adminRole") : t("userRole")}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatTimestamp(entry.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={buildUrl(page - 1)} />
              </PaginationItem>
            )}
            {getPaginationTokens({
              currentPage: page,
              totalPages,
              maxVisible: 7,
            }).map((pageNum, index) => (
              <PaginationItem
                key={pageNum === "ellipsis" ? `ellipsis-${index}` : pageNum}
              >
                {pageNum === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href={buildUrl(pageNum)}
                    isActive={pageNum === page}
                  >
                    {pageNum}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            {page < totalPages && (
              <PaginationItem>
                <PaginationNext href={buildUrl(page + 1)} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{t("editDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 p-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("nameLabel")}</Label>
                <Input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder={t("name")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("usernameLabel")}</Label>
                <Input
                  value={editUsername}
                  onChange={(event) => setEditUsername(event.target.value)}
                  placeholder={t("username")}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editIsAdmin}
                  onCheckedChange={(value) => setEditIsAdmin(Boolean(value))}
                />
                <span className="text-sm">{t("adminToggleLabel")}</span>
              </div>
            </div>

            {selectedUser && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="font-medium text-destructive">
                  {t("suspendTitle")}
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label id={suspendDurationLabelId}>
                      {tModeration("durationLabel")}
                    </Label>
                    <Select
                      value={suspendDuration}
                      onValueChange={(value) =>
                        setSuspendDuration(value ?? "3d")
                      }
                      items={SUSPENSION_DURATION_OPTIONS.map((opt) => ({
                        value: opt.value,
                        label: tModeration(opt.labelKey),
                      }))}
                    >
                      <SelectTrigger aria-labelledby={suspendDurationLabelId}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        {SUSPENSION_DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {tModeration(opt.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>
                  {suspendDuration === "custom" && (
                    <div className="space-y-2">
                      <Label htmlFor={suspendExpiresInputId}>
                        {tModeration("suspendExpires")}
                      </Label>
                      <Input
                        id={suspendExpiresInputId}
                        type="datetime-local"
                        value={suspendExpiresAt}
                        onChange={(event) =>
                          setSuspendExpiresAt(event.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={suspendReasonInputId}>
                    {tModeration("reason")}
                  </Label>
                  <Input
                    id={suspendReasonInputId}
                    value={suspendReason}
                    onChange={(event) => setSuspendReason(event.target.value)}
                    placeholder={tModeration("suspendReason")}
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleSuspend}
                  disabled={isSuspending}
                >
                  {tModeration("suspendAction")}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {tModeration("cancelButton")}
            </DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>
              {t("saveAction")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

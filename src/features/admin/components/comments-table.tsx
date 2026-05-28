import type { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminComment } from "./moderation-types";

type CommentsTableProps = {
  comments: AdminComment[];
  formatTimestamp: (value: string | Date) => string;
  onSelect: (comment: AdminComment) => void;
  getTargetLink: (comment: AdminComment) => { href: string; label: string };
  t: ReturnType<typeof useTranslations>;
};

export function CommentsTable({
  comments,
  formatTimestamp,
  onSelect,
  getTargetLink,
  t,
}: CommentsTableProps) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {comments.map((comment) => {
          const authorName =
            comment.user?.name ?? comment.authorName ?? t("guestLabel");
          const target = getTargetLink(comment);
          const statusLabel =
            comment.status === "softbanned"
              ? t("statusSoftbanned")
              : comment.status === "deleted"
                ? t("statusDeleted")
                : t("statusActive");

          return (
            <button
              key={comment.id}
              type="button"
              className="rounded-lg border border-border/60 bg-background/70 p-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(comment)}
            >
              <p className="line-clamp-3 text-sm leading-5">{comment.body}</p>
              <div className="mt-3 space-y-1 text-xs">
                <div className="font-medium">{authorName}</div>
                <div className="text-muted-foreground">{target.label}</div>
                <div className="text-muted-foreground">
                  {formatTimestamp(comment.createdAt)}
                </div>
              </div>
              <div className="mt-3">
                <Badge
                  variant={
                    comment.status === "active"
                      ? "default"
                      : comment.status === "softbanned"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {statusLabel}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("content")}</TableHead>
              <TableHead>{t("author")}</TableHead>
              <TableHead>{t("postedIn")}</TableHead>
              <TableHead>{t("createdAt")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comments.map((comment) => {
              const authorName =
                comment.user?.name ?? comment.authorName ?? t("guestLabel");
              const target = getTargetLink(comment);
              const statusLabel =
                comment.status === "softbanned"
                  ? t("statusSoftbanned")
                  : comment.status === "deleted"
                    ? t("statusDeleted")
                    : t("statusActive");

              return (
                <TableRow
                  key={comment.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelect(comment)}
                >
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2 text-sm">{comment.body}</p>
                  </TableCell>
                  <TableCell className="font-medium">{authorName}</TableCell>
                  <TableCell className="max-w-sm text-sm">
                    {target.label}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatTimestamp(comment.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        comment.status === "active"
                          ? "default"
                          : comment.status === "softbanned"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {statusLabel}
                    </Badge>
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

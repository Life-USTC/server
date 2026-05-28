import type { ReactNode } from "react";
import { Card, CardPanel } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CommentMarkdown } from "@/features/comments/components/comment-markdown";
import { cn } from "@/lib/utils";

type HomeworkItemCardProps = {
  cardId?: string;
  cardClassName?: string;
  title: string;
  secondaryLabel?: string;
  headerActions?: ReactNode;
  submissionDueLabel: string;
  submissionDueValue: string;
  submissionDueRelativeLabel?: string;
  description: string | null;
  descriptionEmptyLabel: string;
  startAtLabel: string;
  startAtValue: string;
  publishedAtLabel: string;
  publishedAtValue: string;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  detailAfter?: ReactNode;
  expanded?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function HomeworkItemCard({
  cardId,
  cardClassName,
  title,
  secondaryLabel,
  headerActions,
  submissionDueLabel,
  submissionDueValue,
  submissionDueRelativeLabel,
  description,
  descriptionEmptyLabel,
  startAtLabel,
  startAtValue,
  publishedAtLabel,
  publishedAtValue,
  footerStart,
  footerEnd,
  detailAfter,
  expanded = false,
  onOpenChange,
}: HomeworkItemCardProps) {
  return (
    <Card
      id={cardId}
      className={cn("group border-border/70 bg-card/72 py-0", cardClassName)}
    >
      <CardPanel className="flex items-start gap-3 px-4 py-3">
        <Dialog open={expanded} onOpenChange={onOpenChange}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-expanded={expanded}
              />
            }
          >
            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <p className="truncate font-semibold text-[1rem] text-foreground leading-6">
                  {title}
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {secondaryLabel ? (
                    <span className="truncate text-muted-foreground text-xs">
                      {secondaryLabel}
                    </span>
                  ) : null}
                  {footerStart}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {submissionDueLabel}
                </p>
                <p className="font-semibold text-base text-foreground leading-6">
                  {submissionDueValue}
                </p>
                {submissionDueRelativeLabel ? (
                  <p className="text-muted-foreground text-xs leading-4">
                    {submissionDueRelativeLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </DialogTrigger>
          <DialogPopup
            className={detailAfter ? "max-w-5xl" : "max-w-xl"}
            bottomStickOnMobile={false}
          >
            <DialogHeader className="gap-3 border-border/60 border-b bg-muted/18 pb-4">
              <DialogTitle className="pr-8 text-[1.35rem] leading-7">
                {title}
              </DialogTitle>
              {secondaryLabel || footerStart ? (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {secondaryLabel ? (
                    <span className="truncate text-muted-foreground text-xs">
                      {secondaryLabel}
                    </span>
                  ) : null}
                  {footerStart}
                </div>
              ) : null}
            </DialogHeader>
            <DialogPanel className="pt-5!">
              <div
                className={
                  detailAfter
                    ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]"
                    : "space-y-5"
                }
              >
                <div className="space-y-5">
                  <div className="border-primary/35 border-l-2 py-1 pl-4">
                    {description ? (
                      <CommentMarkdown content={description} />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {descriptionEmptyLabel}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground text-xs">
                          {submissionDueLabel}
                        </p>
                        <p className="font-semibold text-foreground text-xl tabular-nums leading-7">
                          {submissionDueValue}
                        </p>
                      </div>
                      {submissionDueRelativeLabel ? (
                        <p className="text-muted-foreground text-xs">
                          {submissionDueRelativeLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1.5 border-border/40 border-b pb-3 text-[11px] text-muted-foreground/64">
                    <p className="leading-4">
                      {startAtLabel} · {startAtValue}
                    </p>
                    <p className="leading-4">
                      {publishedAtLabel} · {publishedAtValue}
                    </p>
                  </div>
                  {headerActions || footerEnd ? (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-border/60 border-t pt-1">
                      {headerActions}
                      {footerEnd}
                    </div>
                  ) : null}
                </div>
                {detailAfter ? (
                  <div className="min-w-0 border-border/60 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                    {detailAfter}
                  </div>
                ) : null}
              </div>
            </DialogPanel>
          </DialogPopup>
        </Dialog>
        {footerEnd ? <div className="shrink-0">{footerEnd}</div> : null}
      </CardPanel>
    </Card>
  );
}

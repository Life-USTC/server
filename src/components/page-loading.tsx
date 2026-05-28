import type * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function PageLoading({
  label,
  className,
}: {
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="page-loading"
      className={cn(
        "flex min-h-[400px] items-center justify-center",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <Spinner className="size-6 text-primary" />
        {label ? <p className="text-muted-foreground">{label}</p> : null}
      </div>
    </div>
  );
}

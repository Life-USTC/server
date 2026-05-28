import type * as React from "react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function MobileList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-3 md:hidden", className)} {...props} />;
}

export function MobileListCard({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "group block w-full rounded-xl border border-border/60 bg-background/70 p-3 no-underline transition-[background-color,border-color,box-shadow] hover:border-border hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-muted/55",
        className,
      )}
      {...props}
    />
  );
}

export function MobileListCardBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 space-y-1.5", className)} {...props} />;
}

export function MobileListCardTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("font-medium leading-5", className)} {...props} />;
}

export function MobileListCardDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-muted-foreground text-xs leading-5", className)}
      {...props}
    />
  );
}

export function MobileListCardMeta({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-3 flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

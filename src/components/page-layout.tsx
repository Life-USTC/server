import { ArrowUpRight } from "lucide-react";
import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type PageBreadcrumbItem = {
  key?: string;
  label: React.ReactNode;
  href?: string;
};

type PageLayoutProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  headerChildren?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

function PageLayout({
  title,
  description,
  actions,
  breadcrumbs,
  headerChildren,
  className,
  headerClassName,
  contentClassName,
  children,
}: PageLayoutProps) {
  const hasIntro = title || description || actions;
  const hasHeader = hasIntro || headerChildren;

  return (
    <main className={cn("page-main flex flex-col gap-5 md:gap-6", className)}>
      {breadcrumbs}
      {hasHeader && (
        <header
          className={cn(
            "flex flex-col gap-5 border-border/70 border-b pb-5 md:pb-6",
            headerClassName,
          )}
        >
          {hasIntro ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-3xl space-y-2">
                {title && (
                  <h1 className="text-balance font-heading text-title-2 md:text-title">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="max-w-2xl text-muted-foreground text-sm leading-6 md:text-[0.95rem]">
                    {description}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {actions}
                </div>
              )}
            </div>
          ) : null}
          {headerChildren ? <div>{headerChildren}</div> : null}
        </header>
      )}
      <div className={cn("flex min-w-0 flex-col gap-4", contentClassName)}>
        {children}
      </div>
    </main>
  );
}

type PageSectionProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

function PageSection({
  title,
  description,
  actions,
  footer,
  className,
  children,
}: PageSectionProps) {
  const hasHeader = title || description || actions;

  return (
    <Card className={cn("h-full", className)}>
      {hasHeader && (
        <CardHeader>
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <CardAction>{actions}</CardAction>}
        </CardHeader>
      )}
      <CardPanel>{children}</CardPanel>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}

const Panel = PageSection;

function PageBreadcrumbs({
  items,
  className,
}: {
  items: PageBreadcrumbItem[];
  className?: string;
}) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item) => (
          <React.Fragment key={item.key ?? item.href ?? String(item.label)}>
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink render={<Link href={item.href} />}>
                  {item.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {item !== items.at(-1) ? <BreadcrumbSeparator /> : null}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function PageToolbar({ className, children }: React.ComponentProps<"div">) {
  return (
    <div className={cn("border-border/70 border-y py-3 md:py-4", className)}>
      {children}
    </div>
  );
}

function PageMeta({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm leading-6", className)}
      {...props}
    />
  );
}

function PageStatGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}
      {...props}
    />
  );
}

function PageStatCard({
  label,
  value,
  description,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("gap-0 rounded-xl border-border/70 bg-card/72", className)}
    >
      <CardPanel className="space-y-1.5 py-4">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
          {label}
        </p>
        <p className="font-semibold text-2xl tracking-tight">{value}</p>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </CardPanel>
    </Card>
  );
}

function PageLinkGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
      {...props}
    />
  );
}

function PageLinkCard({
  href,
  title,
  description,
  icon: Icon,
  meta,
  className,
}: {
  href: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      className="group block h-full rounded-xl no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      href={href}
    >
      <div
        className={cn(
          "flex h-full flex-col gap-4 rounded-xl border border-border/70 bg-card/68 px-5 py-5 transition-colors hover:border-border hover:bg-card",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/85 text-primary">
              <Icon className="size-4.5" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-[0.95rem] leading-6">{title}</p>
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            {description ? (
              <p className="text-muted-foreground text-sm leading-6">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {meta ? (
          <div className="mt-auto border-border/60 border-t pt-3 text-muted-foreground text-xs">
            {meta}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export {
  PageBreadcrumbs,
  PageLayout,
  PageLinkCard,
  PageLinkGrid,
  PageMeta,
  PageSection,
  PageStatCard,
  PageStatGrid,
  PageToolbar,
  Panel,
};

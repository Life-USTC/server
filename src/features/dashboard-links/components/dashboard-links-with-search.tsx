"use client";

import {
  BookOpen,
  Building,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  List,
  Mail,
  MonitorPlay,
  Network,
  Pin,
  School,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DashboardTabToolbar,
  DashboardTabToolbarGroup,
  dashboardTabToolbarItemClass,
} from "@/components/filters/dashboard-tab-toolbar";
import { FiltersBarSearch } from "@/components/filters/filters-bar";
import { Button } from "@/components/ui/button";
import type { DashboardLinkSummary } from "@/features/home/server/dashboard-link-data";
import { useToast } from "@/hooks/use-toast";
import { usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type {
  DashboardLinkGroup,
  DashboardLinkIcon,
} from "../lib/dashboard-links";

type LinkViewMode = "grid" | "list";

const LINK_VIEW_MODE_PARAM = "linkView";
const LINK_VIEW_MODE_STORAGE_KEY = "life-ustc-dashboard-links-view-mode";

function normalizeLinkViewMode(value: string | null): LinkViewMode {
  return value === "list" ? "list" : "grid";
}

function isLinkViewMode(value: string | null): value is LinkViewMode {
  return value === "grid" || value === "list";
}

const ICON_MAP: Record<DashboardLinkIcon, typeof BookOpen> = {
  "book-open": BookOpen,
  building: Building,
  "clipboard-list": ClipboardList,
  "graduation-cap": GraduationCap,
  mail: Mail,
  "monitor-play": MonitorPlay,
  network: Network,
  school: School,
  users: Users,
};

export type GroupedLinksEntry = {
  group: DashboardLinkGroup;
  label: string;
  links: DashboardLinkSummary[];
};

/** Normalize search query: trim, collapse spaces, split into tokens. */
function searchQueryToTokens(query: string): string[] {
  const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function linkMatchesTokens(
  link: {
    title: string;
    description: string;
    titlePinyin: string;
    descriptionPinyin: string;
  },
  tokens: string[],
): boolean {
  const titleLower = link.title.toLowerCase();
  const descLower = (link.description ?? "").toLowerCase();
  const titlePy = link.titlePinyin;
  const descPy = link.descriptionPinyin ?? "";
  return tokens.every(
    (token) =>
      titleLower.includes(token) ||
      descLower.includes(token) ||
      titlePy.includes(token) ||
      descPy.includes(token),
  );
}

function filterGroupedBySearch(
  grouped: GroupedLinksEntry[],
  query: string,
): GroupedLinksEntry[] {
  const tokens = searchQueryToTokens(query);
  if (tokens.length === 0) return grouped;
  return grouped
    .map((entry) => ({
      ...entry,
      links: entry.links.filter((link) => linkMatchesTokens(link, tokens)),
    }))
    .filter((entry) => entry.links.length > 0);
}

export function DashboardLinksWithSearch({
  groupedLinks,
  returnTo,
  children,
  showSearch = false,
  allowPinning = true,
}: {
  groupedLinks: GroupedLinksEntry[];
  returnTo: string;
  children?: React.ReactNode;
  showSearch?: boolean;
  allowPinning?: boolean;
}) {
  const t = useTranslations("meDashboard");
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [linksState, setLinksState] = useState(groupedLinks);
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);
  const [linkViewMode, setLinkViewMode] = useState<LinkViewMode>(() =>
    showSearch
      ? normalizeLinkViewMode(searchParams.get(LINK_VIEW_MODE_PARAM))
      : "grid",
  );

  useEffect(() => {
    setLinksState(groupedLinks);
  }, [groupedLinks]);

  useEffect(() => {
    if (!showSearch) return;

    const viewModeParam = searchParams.get(LINK_VIEW_MODE_PARAM);
    if (isLinkViewMode(viewModeParam)) {
      setLinkViewMode(viewModeParam);
      window.localStorage.setItem(LINK_VIEW_MODE_STORAGE_KEY, viewModeParam);
      return;
    }

    const cachedViewMode = window.localStorage.getItem(
      LINK_VIEW_MODE_STORAGE_KEY,
    );
    if (isLinkViewMode(cachedViewMode)) {
      setLinkViewMode(cachedViewMode);
      return;
    }

    if (cachedViewMode !== null) {
      window.localStorage.removeItem(LINK_VIEW_MODE_STORAGE_KEY);
    }
    setLinkViewMode("grid");
  }, [searchParams, showSearch]);

  useEffect(() => {
    if (searchParams.get("dashboardLinkPinError") !== "1") {
      return;
    }

    toast({
      title: t("linkHub.pinFailedTitle"),
      description: t("linkHub.pinFailedDescription"),
      variant: "destructive",
    });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("dashboardLinkPinError");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, t, toast]);

  const filteredGroups = useMemo(
    () => filterGroupedBySearch(linksState, deferredSearchQuery),
    [deferredSearchQuery, linksState],
  );
  const pinReturnTo = useMemo(() => {
    if (!showSearch) return returnTo;
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, returnTo, searchParams, showSearch]);

  const handlePinSubmit = useCallback(
    async (slug: string, nextAction: "pin" | "unpin") => {
      setUpdatingSlug(slug);
      try {
        const formData = new FormData();
        formData.set("slug", slug);
        formData.set("action", nextAction);
        formData.set("returnTo", pinReturnTo);

        const response = await fetch("/api/dashboard-links/pin", {
          method: "POST",
          body: formData,
          headers: {
            accept: "application/json",
          },
        });

        const data = (await response.json()) as {
          error?: string | null;
          pinnedSlugs?: string[];
        };
        if (!response.ok) {
          toast({
            title: t("linkHub.pinFailedTitle"),
            description: data.error ?? t("linkHub.pinFailedDescription"),
            variant: "destructive",
          });
          return;
        }
        const pinnedSlugs = new Set(data.pinnedSlugs ?? []);

        setLinksState((previous) =>
          previous.map((entry) => ({
            ...entry,
            links: entry.links.map((link) => ({
              ...link,
              isPinned: pinnedSlugs.has(link.slug),
            })),
          })),
        );
      } catch (error) {
        const description =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : t("linkHub.pinFailedDescription");
        toast({
          title: t("linkHub.pinFailedTitle"),
          description,
          variant: "destructive",
        });
      } finally {
        setUpdatingSlug(null);
      }
    },
    [pinReturnTo, t, toast],
  );

  const handleViewModeChange = useCallback(
    (mode: LinkViewMode) => {
      setLinkViewMode(mode);
      window.localStorage.setItem(LINK_VIEW_MODE_STORAGE_KEY, mode);

      const nextParams = new URLSearchParams(searchParams.toString());
      if (mode === "grid") {
        nextParams.delete(LINK_VIEW_MODE_PARAM);
      } else {
        nextParams.set(LINK_VIEW_MODE_PARAM, mode);
      }
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-4">
      {showSearch && (
        <DashboardTabToolbar>
          <FiltersBarSearch
            className="sm:max-w-xl"
            ariaLabel={t("linkHub.searchPlaceholder")}
            placeholder={t("linkHub.searchPlaceholder")}
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <DashboardTabToolbarGroup aria-label={t("linkHub.viewMode")}>
            {(
              [
                {
                  mode: "grid" as const,
                  label: t("linkHub.gridView"),
                  icon: LayoutGrid,
                },
                {
                  mode: "list" as const,
                  label: t("linkHub.listView"),
                  icon: List,
                },
              ] satisfies {
                mode: LinkViewMode;
                label: string;
                icon: typeof LayoutGrid;
              }[]
            ).map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                className={dashboardTabToolbarItemClass(
                  linkViewMode === mode,
                  "inline-flex items-center gap-2",
                )}
                aria-pressed={linkViewMode === mode}
                title={label}
                onClick={() => handleViewModeChange(mode)}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </DashboardTabToolbarGroup>
        </DashboardTabToolbar>
      )}
      {filteredGroups.map((entry) => (
        <section
          key={entry.group}
          className={entry.label ? "space-y-2" : undefined}
        >
          {entry.label ? (
            <h3 className="font-medium text-muted-foreground text-sm">
              {entry.label}
            </h3>
          ) : null}
          <div
            className={cn(
              linkViewMode === "grid"
                ? "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card/72",
            )}
          >
            {entry.links.map((link) => {
              const Icon = ICON_MAP[link.icon];
              const pinLabel = link.isPinned
                ? t("linkHub.unpin")
                : t("linkHub.pin");
              return (
                <div
                  key={link.slug}
                  className={cn(
                    "group relative min-w-0 overflow-hidden transition-colors hover:bg-background/90",
                    linkViewMode === "grid" &&
                      "rounded-xl border border-border/70 bg-card/72",
                  )}
                >
                  <form
                    action="/api/dashboard-links/visit"
                    method="post"
                    target="_blank"
                    rel="noopener"
                  >
                    <input type="hidden" name="slug" value={link.slug} />
                    <button
                      type="submit"
                      className={cn(
                        "w-full text-left no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        linkViewMode === "grid"
                          ? "flex min-h-20 flex-col justify-between gap-2.5 px-3 py-2.5"
                          : "flex min-h-12 items-center gap-2.5 px-3 py-2",
                        allowPinning &&
                          (linkViewMode === "grid" ? "pr-12" : "pr-14"),
                      )}
                    >
                      <div
                        className={cn(
                          "flex gap-3",
                          linkViewMode === "grid"
                            ? "items-start"
                            : "items-center",
                          linkViewMode === "list" && "w-full",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center justify-center border border-border/60 bg-background/85 text-primary",
                            linkViewMode === "grid"
                              ? "size-8 rounded-md"
                              : "size-7 rounded-md",
                          )}
                        >
                          <Icon
                            className={
                              linkViewMode === "grid"
                                ? "h-4 w-4"
                                : "h-3.5 w-3.5"
                            }
                          />
                        </span>
                        <div
                          className={cn(
                            "min-w-0",
                            linkViewMode === "grid"
                              ? "space-y-1"
                              : "flex-1 space-y-0.5 sm:grid sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:items-center sm:gap-4 sm:space-y-0",
                          )}
                        >
                          <p
                            className={cn(
                              "break-words font-medium text-sm",
                              linkViewMode === "grid"
                                ? "line-clamp-2 leading-5"
                                : "line-clamp-1 leading-4.5",
                            )}
                          >
                            {link.title}
                          </p>
                          <p
                            className={cn(
                              "break-words text-muted-foreground",
                              linkViewMode === "grid"
                                ? "line-clamp-1 text-xs leading-4.5"
                                : "line-clamp-1 text-xs leading-4.5",
                            )}
                          >
                            {link.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  </form>
                  {allowPinning ? (
                    <form
                      action="/api/dashboard-links/pin"
                      method="post"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handlePinSubmit(
                          link.slug,
                          link.isPinned ? "unpin" : "pin",
                        );
                      }}
                      className={cn(
                        "pointer-events-auto absolute right-2 opacity-100 transition-opacity",
                        linkViewMode === "grid"
                          ? "top-2"
                          : "top-1/2 -translate-y-1/2",
                        !link.isPinned &&
                          "md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100",
                      )}
                    >
                      <input type="hidden" name="slug" value={link.slug} />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={pinReturnTo}
                      />
                      <input
                        type="hidden"
                        name="action"
                        value={link.isPinned ? "unpin" : "pin"}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon-sm"
                        disabled={updatingSlug === link.slug}
                        aria-label={pinLabel}
                        title={pinLabel}
                        className="bg-background/90"
                      >
                        <Pin
                          className={`h-4 w-4 ${link.isPinned ? "fill-current text-primary" : ""}`}
                        />
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {children}
    </div>
  );
}

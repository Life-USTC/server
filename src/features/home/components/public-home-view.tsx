import { getTranslations } from "next-intl/server";
import { PageLayout } from "@/components/page-layout";
import { SignInLink } from "@/components/sign-in-link";
import { Button } from "@/components/ui/button";
import { BusPanel } from "@/features/bus/components/bus-panel";
import type { BusTimetableData } from "@/features/bus/lib/bus-types";
import { LinksTabPanel } from "@/features/dashboard-links/components/links-tab-panel";
import type { DashboardLinkSummary } from "@/features/home/server/dashboard-link-data";
import { type HomeTabId, HomeTabNav } from "./home-tab-nav";

const VALID_PUBLIC_TABS = ["bus", "links"] as const satisfies HomeTabId[];

function parsePublicTab(
  tab: string | undefined,
): (typeof VALID_PUBLIC_TABS)[number] {
  if (
    tab &&
    VALID_PUBLIC_TABS.includes(tab as (typeof VALID_PUBLIC_TABS)[number])
  ) {
    return tab as (typeof VALID_PUBLIC_TABS)[number];
  }
  return "bus";
}

export async function PublicHomeView({
  searchParams,
  dashboardLinks,
  busData,
}: {
  searchParams: Promise<{ tab?: string }>;
  dashboardLinks: DashboardLinkSummary[];
  busData: BusTimetableData | null;
}) {
  const [params, t] = await Promise.all([
    searchParams,
    getTranslations("homepage"),
  ]);
  const currentTab = parsePublicTab(params.tab);

  return (
    <PageLayout
      className="home-dashboard-layout pt-2 md:pt-3 lg:pt-3"
      description={t("subtitle")}
      headerClassName="gap-5 pb-4.5 md:gap-6 md:pb-5.5"
      headerChildren={
        <HomeTabNav
          currentTab={currentTab}
          visibleTabs={["bus", "links"]}
          trailingTabIds={[]}
          trailingContent={
            <Button
              variant="outline"
              render={<SignInLink className="no-underline" />}
            >
              {t("actions.signIn")}
            </Button>
          }
        />
      }
    >
      {currentTab === "links" && (
        <LinksTabPanel links={dashboardLinks} allowPinning={false} />
      )}
      {currentTab === "bus" && busData && (
        <BusPanel data={busData} signedIn={false} />
      )}
      {currentTab === "bus" && !busData && (
        <p className="py-8 text-center text-muted-foreground text-sm">
          {/* Fallback handled by translation in BusPanel; minimal fallback here */}
        </p>
      )}
    </PageLayout>
  );
}

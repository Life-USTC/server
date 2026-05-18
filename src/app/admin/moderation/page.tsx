import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageBreadcrumbs, PageLayout } from "@/components/page-layout";
import { requireAdminPage } from "@/lib/admin-utils";

const ModerationDashboard = dynamic(() =>
  import("@/features/admin/components/moderation-dashboard").then(
    (mod) => mod.ModerationDashboard,
  ),
);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return {
    title: t("title"),
  };
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const admin = await requireAdminPage("/admin/moderation");
  if (!admin) {
    notFound();
  }

  const [t, tCommon, tAdmin, params] = await Promise.all([
    getTranslations("moderation"),
    getTranslations("common"),
    getTranslations("admin"),
    searchParams,
  ]);

  return (
    <PageLayout
      title={t("title")}
      description={t("subtitle")}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: tCommon("home"), href: "/" },
            { label: tAdmin("title"), href: "/admin" },
            { label: t("title") },
          ]}
        />
      }
    >
      <ModerationDashboard initialSearchQuery={params.search ?? ""} />
    </PageLayout>
  );
}

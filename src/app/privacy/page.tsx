import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageLayout } from "@/components/page-layout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("pages.privacy"),
  };
}

type LegalSection = { title: string; items: string[] };

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("legal.privacy");
  const sections = t.raw("sections") as LegalSection[];

  return (
    <PageLayout
      title={t("title")}
      description={t("intro")}
      contentClassName="mx-auto w-full max-w-3xl"
    >
      {sections.map((section) => (
        <section key={section.title} className="min-w-0 space-y-3">
          <h2 className="text-title-2">{section.title}</h2>
          <ul className="list-disc space-y-2 break-words pl-6 text-body text-muted-foreground">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </PageLayout>
  );
}

import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

const metadataSelectors = {
  canonical: 'link[rel="canonical"]',
  description: 'meta[name="description"]',
  favicon: 'link[rel="icon"]',
  ogDescription: 'meta[property="og:description"]',
  ogImage: 'meta[property="og:image"]',
  ogImageAlt: 'meta[property="og:image:alt"]',
  ogImageHeight: 'meta[property="og:image:height"]',
  ogImageType: 'meta[property="og:image:type"]',
  ogImageWidth: 'meta[property="og:image:width"]',
  ogLocale: 'meta[property="og:locale"]',
  ogLocaleAlternate: 'meta[property="og:locale:alternate"]',
  ogSiteName: 'meta[property="og:site_name"]',
  ogTitle: 'meta[property="og:title"]',
  ogType: 'meta[property="og:type"]',
  ogUrl: 'meta[property="og:url"]',
  twitterCard: 'meta[name="twitter:card"]',
  twitterDescription: 'meta[name="twitter:description"]',
  twitterImage: 'meta[name="twitter:image"]',
  twitterImageAlt: 'meta[name="twitter:image:alt"]',
  twitterTitle: 'meta[name="twitter:title"]',
} as const;

type MetadataKey = keyof typeof metadataSelectors;
type RawSocialMetadata = {
  contentLanguage: string | undefined;
  documentTitle: string;
  htmlLang: string | null;
  origin: string;
  values: Record<MetadataKey, string[]>;
};

type StructuredDataGraph = {
  "@context": string;
  "@graph": Array<Record<string, unknown>>;
};

async function setLocale(page: Page, locale: "en-us" | "zh-cn") {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  expect(response.status()).toBe(200);
}

async function readRawSocialMetadata(
  page: Page,
  path: string,
): Promise<RawSocialMetadata> {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  const html = await response.text();

  const parsed = await page.evaluate(
    ({ markup, selectors }) => {
      const document = new DOMParser().parseFromString(markup, "text/html");
      const values = Object.fromEntries(
        Object.entries(selectors).map(([key, selector]) => [
          key,
          Array.from(document.querySelectorAll(selector)).map((element) =>
            element instanceof HTMLLinkElement
              ? (element.getAttribute("href") ?? "")
              : (element.getAttribute("content") ?? ""),
          ),
        ]),
      );

      return {
        documentTitle: document.title,
        htmlLang: document.documentElement.getAttribute("lang"),
        values,
      };
    },
    { markup: html, selectors: metadataSelectors },
  );

  return {
    ...parsed,
    contentLanguage: response.headers()["content-language"],
    origin: new URL(response.url()).origin,
    values: parsed.values as Record<MetadataKey, string[]>,
  };
}

function expectCompleteSocialMetadata(
  metadata: RawSocialMetadata,
  expected: {
    canonicalPath: string;
    description: string;
    imageAlt: string;
    locale: "en-us" | "zh-cn";
    title: string;
  },
) {
  for (const [key, values] of Object.entries(metadata.values)) {
    expect(values, `${key} should occur exactly once`).toHaveLength(1);
  }

  const canonicalUrl = `${metadata.origin}${expected.canonicalPath}`;
  const imageUrl = new URL(metadata.values.ogImage[0] ?? "");
  const locale = expected.locale === "zh-cn" ? "zh_CN" : "en_US";
  const alternateLocale = expected.locale === "zh-cn" ? "en_US" : "zh_CN";
  expect(metadata.htmlLang).toBe(expected.locale);
  expect(metadata.contentLanguage).toBe(expected.locale);
  expect(metadata.values.canonical[0]).toBe(canonicalUrl);
  expect(metadata.values.description[0]).toBe(expected.description);
  expect(metadata.values.favicon[0]).toMatch(
    /\/life-ustc-icon-192\.[A-Za-z0-9_-]+\.png$/,
  );
  expect(metadata.values.ogTitle[0]).toBe(expected.title);
  expect(metadata.values.ogDescription[0]).toBe(expected.description);
  expect(metadata.values.ogType[0]).toBe("website");
  expect(metadata.values.ogUrl[0]).toBe(canonicalUrl);
  expect(metadata.values.ogSiteName[0]).toBe("Life@USTC");
  expect(metadata.values.ogLocale[0]).toBe(locale);
  expect(metadata.values.ogLocaleAlternate[0]).toBe(alternateLocale);
  expect(imageUrl.origin).toBe(metadata.origin);
  expect(imageUrl.pathname).toBe("/open-graph.png");
  expect(imageUrl.search).toBe("");
  expect(metadata.values.ogImageType[0]).toBe("image/png");
  expect(metadata.values.ogImageWidth[0]).toBe("1200");
  expect(metadata.values.ogImageHeight[0]).toBe("630");
  expect(metadata.values.ogImageAlt[0]).toBe(expected.imageAlt);
  expect(metadata.values.twitterCard[0]).toBe("summary_large_image");
  expect(metadata.values.twitterTitle[0]).toBe(expected.title);
  expect(metadata.values.twitterDescription[0]).toBe(expected.description);
  expect(metadata.values.twitterImage[0]).toBe(imageUrl.href);
  expect(metadata.values.twitterImageAlt[0]).toBe(expected.imageAlt);
}

async function readRawStructuredData(page: Page, path: string) {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  const html = await response.text();

  return await page.evaluate((markup) => {
    const document = new DOMParser().parseFromString(markup, "text/html");
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    );
    return {
      data: scripts.map((script) => JSON.parse(script.textContent ?? "")),
      count: scripts.length,
    } as { count: number; data: StructuredDataGraph[] };
  }, html);
}

test("首页原始 SSR HTML 输出双语且唯一的完整分享元数据", async ({ page }) => {
  const cases = [
    {
      locale: "zh-cn" as const,
      title: "Life@USTC - 课程与日程管理",
      description: "中国科学技术大学课程与日程管理系统",
      imageAlt: "Life@USTC 课程与日程工作台分享卡片",
    },
    {
      locale: "en-us" as const,
      title: "Life@USTC - Course and Schedule Management",
      description: "USTC course and schedule management system",
      imageAlt: "Life@USTC course and schedule workspace social card",
    },
  ];

  for (const current of cases) {
    await setLocale(page, current.locale);
    const metadata = await readRawSocialMetadata(page, "/?utm_source=e2e#top");
    expectCompleteSocialMetadata(metadata, {
      canonicalPath: "/",
      ...current,
    });
  }
});

test("课程、班级与教师列表页输出本地化 SSR 分享元数据", async ({ page }) => {
  const cases = [
    {
      locale: "zh-cn" as const,
      imageAlt: "Life@USTC 课程与日程工作台分享卡片",
      pages: [
        {
          canonicalPath: "/catalog/courses",
          description: "浏览和搜索所有可用课程",
          title: "课程 - Life@USTC",
        },
        {
          canonicalPath: "/catalog/sections",
          description: "浏览和筛选所有可用的课程班级",
          title: "班级 - Life@USTC",
        },
        {
          canonicalPath: "/catalog/teachers",
          description: "浏览和搜索所有教师",
          title: "教师 - Life@USTC",
        },
      ],
    },
    {
      locale: "en-us" as const,
      imageAlt: "Life@USTC course and schedule workspace social card",
      pages: [
        {
          canonicalPath: "/catalog/courses",
          description: "Browse and search through all available courses",
          title: "Courses - Life@USTC",
        },
        {
          canonicalPath: "/catalog/sections",
          description:
            "Browse and filter through all available course sections",
          title: "Sections - Life@USTC",
        },
        {
          canonicalPath: "/catalog/teachers",
          description: "Browse and search through all teachers",
          title: "Teachers - Life@USTC",
        },
      ],
    },
  ];

  for (const current of cases) {
    await setLocale(page, current.locale);
    for (const collection of current.pages) {
      const metadata = await readRawSocialMetadata(
        page,
        `${collection.canonicalPath}?utm_source=e2e#catalog`,
      );
      expectCompleteSocialMetadata(metadata, {
        ...collection,
        imageAlt: current.imageAlt,
        locale: current.locale,
      });
      expect(metadata.documentTitle).toBe(collection.title);
    }
  }
});

test("ui.social-sharing-metadata-3", async ({ page }) => {
  const base = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
  const marker = `authored-description-${crypto.randomUUID()}`;
  const fixture = await withE2ePrisma((db) =>
    db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: "Metadata author",
          email: `${crypto.randomUUID()}@example.test`,
        },
      });
      const course = await tx.course.create({
        data: {
          jwId: base,
          code: `META-${base}`,
          nameCn: "元数据测试课程",
          nameEn: "Metadata course",
        },
      });
      const teacher = await tx.teacher.create({
        data: {
          jwId: base + 1,
          code: `META-T-${base}`,
          nameCn: "元数据测试教师",
          nameEn: "Metadata teacher",
        },
      });
      const section = await tx.section.create({
        data: {
          jwId: base + 2,
          code: `META-S-${base}`,
          courseId: course.id,
          teachers: { connect: { id: teacher.id } },
        },
      });
      for (const target of [
        { courseId: course.id },
        { teacherId: teacher.id },
        { sectionId: section.id },
      ])
        await tx.description.create({
          data: { ...target, content: marker, lastEditedById: user.id },
        });
      return { user, course, section, teacher };
    }),
  );
  try {
    for (const locale of ["zh-cn", "en-us"] as const) {
      await setLocale(page, locale);
      const cn = locale === "zh-cn";
      const courseName = cn ? fixture.course.nameCn : fixture.course.nameEn;
      const teacherName = cn ? fixture.teacher.nameCn : fixture.teacher.nameEn;
      const imageAlt = cn
        ? "Life@USTC 课程与日程工作台分享卡片"
        : "Life@USTC course and schedule workspace social card";
      const cases = [
        {
          path: `/catalog/courses/${fixture.course.jwId}`,
          title: `${courseName} (${fixture.course.code}) - Life@USTC`,
          description: cn
            ? `在 Life@USTC 查看${courseName}（${fixture.course.code}）的班级、简介与讨论。`
            : `View ${courseName} (${fixture.course.code}), teaching sections, descriptions, and discussions on Life@USTC.`,
        },
        {
          path: `/catalog/sections/${fixture.section.jwId}`,
          title: cn
            ? `${courseName}(${fixture.section.code}) - Life@USTC`
            : `${courseName} · Section ${fixture.section.code} - Life@USTC`,
          description: cn
            ? `在 Life@USTC 查看${courseName}（${fixture.section.code}）的课表、作业、考试、教师与讨论。`
            : `View section ${fixture.section.code} for ${courseName}, including schedules, homework, exams, teachers, and discussions on Life@USTC.`,
        },
        {
          path: `/catalog/teachers/${fixture.teacher.id}`,
          title: cn
            ? `教师：${teacherName} - Life@USTC`
            : `Teacher: ${teacherName} - Life@USTC`,
          description: cn
            ? `在 Life@USTC 查看${teacherName}的教师资料、授课班级、简介与讨论。`
            : `View ${teacherName}'s profile, teaching sections, descriptions, and discussions on Life@USTC.`,
        },
      ];
      for (const current of cases) {
        const path = `${current.path}?utm_source=e2e&title=${encodeURIComponent(marker)}#comments`;
        const raw = await page.request.get(path);
        expect(raw.status()).toBe(200);
        expect(await raw.text()).toContain(marker);
        const metadata = await readRawSocialMetadata(page, path);
        expectCompleteSocialMetadata(metadata, {
          canonicalPath: current.path,
          description: current.description,
          title: current.title,
          imageAlt,
          locale,
        });
        expect(JSON.stringify(metadata.values)).not.toContain(marker);
      }
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.section.delete({ where: { id: fixture.section.id } });
      await db.teacher.delete({ where: { id: fixture.teacher.id } });
      await db.course.delete({ where: { id: fixture.course.id } });
      await db.user.delete({ where: { id: fixture.user.id } });
    });
  }
});

test("公开实体的原始 SSR HTML 输出双语 JSON-LD 且不包含用户字段", async ({
  page,
}) => {
  await setLocale(page, "zh-cn");
  const courseResult = await readRawStructuredData(
    page,
    `/catalog/courses/${DEV_SEED.course.jwId}/introduction`,
  );
  expect(courseResult.count).toBe(1);
  expect(courseResult.data[0]?.["@context"]).toBe("https://schema.org");
  expect(courseResult.data[0]?.["@graph"]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        "@type": "Course",
        courseCode: DEV_SEED.course.code,
        name: DEV_SEED.course.nameCn,
      }),
      expect.objectContaining({ "@type": "BreadcrumbList" }),
    ]),
  );

  await setLocale(page, "en-us");
  const sectionResult = await readRawStructuredData(
    page,
    `/catalog/sections/${DEV_SEED.section.jwId}#teachers`,
  );
  expect(sectionResult.count).toBe(1);
  expect(sectionResult.data[0]?.["@graph"]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        "@type": "CourseInstance",
        instructor: expect.arrayContaining([
          expect.objectContaining({
            "@type": "Person",
            name: DEV_SEED.teacher.nameEn,
          }),
        ]),
        isPartOf: expect.objectContaining({
          "@type": "Course",
          name: DEV_SEED.course.nameEn,
        }),
      }),
      expect.objectContaining({ "@type": "BreadcrumbList" }),
    ]),
  );

  await gotoAndWaitForReady(
    page,
    `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}`,
  );
  const teacherHref = await page
    .locator("#main-content a[href^='/catalog/teachers/']:visible")
    .first()
    .getAttribute("href");
  expect(teacherHref).toMatch(/^\/catalog\/teachers\/\d+$/);
  const teacherResult = await readRawStructuredData(page, teacherHref ?? "");
  expect(teacherResult.count).toBe(1);
  expect(teacherResult.data[0]?.["@graph"]).toEqual(
    expect.arrayContaining([
      {
        "@id": `${teacherResult.data[0]?.["@graph"][0]?.url}#person`,
        "@type": "Person",
        name: DEV_SEED.teacher.nameEn,
        url: teacherResult.data[0]?.["@graph"][0]?.url,
      },
      expect.objectContaining({ "@type": "BreadcrumbList" }),
    ]),
  );

  for (const result of [courseResult, sectionResult, teacherResult]) {
    expect(JSON.stringify(result.data)).not.toMatch(
      /"viewer"|"session"|"email"|"telephone"|"mobile"|"address"/i,
    );
  }
});

test("ui.social-sharing-metadata-6", async ({ request }) => {
  const response = await request.get("/open-graph.png");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");

  const image = await response.body();
  expect(image).toEqual(
    await readFile(
      new URL("../../../../../public/open-graph.png", import.meta.url),
    ),
  );
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(image.readUInt32BE(16)).toBe(1200);
  expect(image.readUInt32BE(20)).toBe(630);
  expect(image[24]).toBe(8);
  expect([2, 6]).toContain(image[25]);
  expect(image.byteLength).toBeGreaterThan(10_000);
  expect(image.byteLength).toBeLessThan(500_000);
  expect(response.headers()["x-request-id"]).toBeUndefined();
  expect(response.headers()["cache-control"]).toBe("public, max-age=86400");
  const withQuery = await request.get(
    "/open-graph.png?title=Another+page&variant=profile&avatar=https://example.com/avatar.png",
  );
  expect(withQuery.status()).toBe(200);
  expect(await withQuery.body()).toEqual(image);
  expect(withQuery.headers()["x-request-id"]).toBeUndefined();
  const head = await request.head("/open-graph.png");
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  const conditional = await request.get("/open-graph.png", {
    headers: { "If-None-Match": response.headers().etag },
  });
  expect(conditional.status()).toBe(304);
});

test("分享元数据不改变首页与课程详情可见布局", async ({ page }, testInfo) => {
  await setLocale(page, "en-us");
  await gotoAndWaitForReady(page, "/");
  await expect(page.getByRole("main")).toBeVisible();
  await captureStepScreenshot(page, testInfo, "social-metadata/home-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await setLocale(page, "zh-cn");
  await gotoAndWaitForReady(page, `/catalog/courses/${DEV_SEED.course.jwId}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: DEV_SEED.course.nameCn,
    }),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "social-metadata/course-mobile");
});

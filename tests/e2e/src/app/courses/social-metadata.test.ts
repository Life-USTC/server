import { expect, type Page, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

const metadataSelectors = {
  canonical: 'link[rel="canonical"]',
  description: 'meta[name="description"]',
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
  const imageUrl = `${metadata.origin}/images/social-card.png`;
  const locale = expected.locale === "zh-cn" ? "zh_CN" : "en_US";
  const alternateLocale = expected.locale === "zh-cn" ? "en_US" : "zh_CN";

  expect(metadata.htmlLang).toBe(expected.locale);
  expect(metadata.contentLanguage).toBe(expected.locale);
  expect(metadata.values.canonical[0]).toBe(canonicalUrl);
  expect(metadata.values.description[0]).toBe(expected.description);
  expect(metadata.values.ogTitle[0]).toBe(expected.title);
  expect(metadata.values.ogDescription[0]).toBe(expected.description);
  expect(metadata.values.ogType[0]).toBe("website");
  expect(metadata.values.ogUrl[0]).toBe(canonicalUrl);
  expect(metadata.values.ogSiteName[0]).toBe("Life@USTC");
  expect(metadata.values.ogLocale[0]).toBe(locale);
  expect(metadata.values.ogLocaleAlternate[0]).toBe(alternateLocale);
  expect(metadata.values.ogImage[0]).toBe(imageUrl);
  expect(metadata.values.ogImageType[0]).toBe("image/png");
  expect(metadata.values.ogImageWidth[0]).toBe("1200");
  expect(metadata.values.ogImageHeight[0]).toBe("630");
  expect(metadata.values.ogImageAlt[0]).toBe(expected.imageAlt);
  expect(metadata.values.twitterCard[0]).toBe("summary_large_image");
  expect(metadata.values.twitterTitle[0]).toBe(expected.title);
  expect(metadata.values.twitterDescription[0]).toBe(expected.description);
  expect(metadata.values.twitterImage[0]).toBe(imageUrl);
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

test("课程与班级详情子路由规范化 canonical 并使用受控摘要", async ({
  page,
}) => {
  await setLocale(page, "zh-cn");
  const courseMetadata = await readRawSocialMetadata(
    page,
    `/catalog/courses/${DEV_SEED.course.jwId}/introduction?utm_source=e2e`,
  );
  expectCompleteSocialMetadata(courseMetadata, {
    canonicalPath: `/catalog/courses/${DEV_SEED.course.jwId}`,
    description: `在 Life@USTC 查看${DEV_SEED.course.nameCn}（${DEV_SEED.course.code}）的班级、简介与讨论。`,
    imageAlt: "Life@USTC 课程与日程工作台分享卡片",
    locale: "zh-cn",
    title: `${DEV_SEED.course.nameCn} (${DEV_SEED.course.code}) - Life@USTC`,
  });

  await setLocale(page, "en-us");
  const sectionMetadata = await readRawSocialMetadata(
    page,
    `/catalog/sections/${DEV_SEED.section.jwId}/calendar?subscribe=1#week`,
  );
  expectCompleteSocialMetadata(sectionMetadata, {
    canonicalPath: `/catalog/sections/${DEV_SEED.section.jwId}`,
    description: `View section ${DEV_SEED.section.code} for ${DEV_SEED.course.nameEn}, including schedules, homework, exams, teachers, and discussions on Life@USTC.`,
    imageAlt: "Life@USTC course and schedule workspace social card",
    locale: "en-us",
    title: `${DEV_SEED.course.nameEn} · Section ${DEV_SEED.section.code} - Life@USTC`,
  });
});

test("教师详情原始 SSR HTML 使用实体根路径与本地化摘要", async ({ page }) => {
  await setLocale(page, "en-us");
  await gotoAndWaitForReady(
    page,
    `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}`,
  );
  const teacherHref = await page
    .locator("#main-content a[href^='/catalog/teachers/']:visible")
    .first()
    .getAttribute("href");
  expect(teacherHref).toMatch(/^\/catalog\/teachers\/\d+$/);

  const metadata = await readRawSocialMetadata(
    page,
    `${teacherHref}/sections?utm_source=e2e`,
  );
  expectCompleteSocialMetadata(metadata, {
    canonicalPath: teacherHref ?? "",
    description: `View ${DEV_SEED.teacher.nameEn}'s profile, teaching sections, descriptions, and discussions on Life@USTC.`,
    imageAlt: "Life@USTC course and schedule workspace social card",
    locale: "en-us",
    title: `Teacher: ${DEV_SEED.teacher.nameEn} - Life@USTC`,
  });
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
    `/catalog/sections/${DEV_SEED.section.jwId}/teachers`,
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

test("社交分享图片是可抓取的 1200×630 8-bit RGBA PNG", async ({ request }) => {
  const response = await request.get("/images/social-card.png");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");

  const image = await response.body();
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(image.readUInt32BE(16)).toBe(1200);
  expect(image.readUInt32BE(20)).toBe(630);
  expect(image[24]).toBe(8);
  expect(image[25]).toBe(6);
  expect(image.byteLength).toBeGreaterThan(10_000);
  expect(image.byteLength).toBeLessThan(500_000);
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

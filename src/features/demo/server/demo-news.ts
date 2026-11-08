import { DEMO_NEWS_IDS } from "@/features/demo/lib/demo-news-ids";
import { DEMO_REFERENCE_NOW } from "@/features/demo/lib/demo-types";
import { annotatePublicationImages } from "@/features/publications/lib/publication-image-metadata";
import type { PublicationsQuery } from "@/features/publications/lib/publication-read-request-schemas";
import { PUBLICATION_SOURCE_ORGANIZATION_LEVELS } from "@/features/publications/lib/publication-source-levels";
import type {
  PublicPublicationDetail,
  PublicPublicationList,
  PublicPublicationListItem,
  PublicPublicationObject,
} from "@/features/publications/server/publication-public-read-service";
import type {
  PublicPublicationSourceDirectory,
  PublicPublicationSourceOption,
} from "@/features/publications/server/publication-source-directory-service";
import type { AnonymousHomeInformation } from "@/features/workspace/server/anonymous-home-sections";
import type { AppLocale } from "@/i18n/config";
import { renderEmbeddedMarkdown } from "@/lib/components/markdown-preview-renderer";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  DEMO_NEWS_IMAGE_ID,
  demoNewsAttachmentBytes,
  demoNewsContentHash,
  demoNewsImageBytes,
} from "./demo-news-assets";

export type DemoNewsBinary = {
  bytes: Uint8Array;
  contentType: string;
  sha256: string;
  kind: "body_markdown" | "media" | "asset";
};
const sources = [
  {
    id: "demo-study",
    organizationLevel: "student",
    en: "Fictional study circle",
    zh: "虚构学习小组",
  },
  {
    id: "demo-society",
    organizationLevel: "society",
    en: "Fictional sample society",
    zh: "虚构样例社团",
  },
  {
    id: "demo-center",
    organizationLevel: "center",
    en: "Fictional sample center",
    zh: "虚构样例中心",
  },
  {
    id: "demo-empty",
    organizationLevel: "student",
    en: "Fictional empty source",
    zh: "虚构空白来源",
  },
] as const;

export function getDemoNewsSourceOptions(
  locale: AppLocale,
): PublicPublicationSourceOption[] {
  return sources
    .map((source) => ({
      id: source.id,
      name: locale === "en-us" ? source.en : source.zh,
      organizationLevel: source.organizationLevel,
    }))
    .sort(
      (a, b) =>
        PUBLICATION_SOURCE_ORGANIZATION_LEVELS.indexOf(a.organizationLevel) -
          PUBLICATION_SOURCE_ORGANIZATION_LEVELS.indexOf(b.organizationLevel) ||
        a.name.localeCompare(b.name, locale),
    );
}
function titles(locale: AppLocale) {
  return locale === "en-us"
    ? [
        "Sample reading room hours",
        "Sample study group registration",
        "Sample library workshop",
        "Sample campus walk",
        "Sample learning resources",
      ]
    : [
        "虚构阅览室开放时间",
        "虚构学习小组报名",
        "虚构图书馆工作坊",
        "虚构校园漫步",
        "虚构学习资源介绍",
      ];
}
function binary(
  kind: DemoNewsBinary["kind"],
  bytes: Uint8Array,
  contentType: string,
): DemoNewsBinary {
  return { kind, bytes, contentType, sha256: demoNewsContentHash(bytes) };
}
function object(item: DemoNewsBinary): PublicPublicationObject {
  return {
    kind: item.kind,
    sha256: item.sha256,
    size: item.bytes.byteLength,
    contentType: item.contentType,
    status: "verified",
    url: `/api/publications/objects/${item.kind}/${item.sha256}`,
    sortOrder: null,
    altText: null,
    filename: item.kind === "asset" ? "fictional-checklist.txt" : null,
    sourceUrl: null,
  };
}
function article(locale: AppLocale, index: number) {
  const english = locale === "en-us";
  const id = DEMO_NEWS_IDS[index];
  const number = index + 1;
  // The final pair has exactly the same stored title/date. No new title
  // normalization algorithm is introduced: ordinary ingestion/SQL are untouched.
  const report = index === 21 ? 21 : number;
  const title =
    titles(locale)[index] ??
    (english ? `Fictional sample report ${report}` : `虚构样例报道 ${report}`);
  const dateIndex = index === 21 ? 20 : index;
  const published = shanghaiDayjs(DEMO_REFERENCE_NOW).subtract(
    dateIndex,
    "day",
  );
  const source = sources[index % 3];
  const projectedSource = {
    id: source.id,
    name: english ? source.en : source.zh,
    organizationLevel: source.organizationLevel,
  };
  const bodyMarkdown = english
    ? `**Fictional demo sample — not a school announcement.**\n\n${title}. This fixed article demonstrates the existing news reader.\n\n- Bring a sample notebook.\n- Explore the read-only sample links.\n\n| Sample item | Fictional count |\n| --- | --- |\n| Reading groups | 2 |\n| Notebooks | 5 |\n\nRecord: \`sample-${number}\`. [Return to sample news](/news).${index === 0 ? `\n\n![Fictional DEMO diagram](/api/publications/images/${DEMO_NEWS_IMAGE_ID})` : ""}\n`
    : `**虚构演示样例，并非学校通知。**\n\n${title}。此固定文章用于体验现有新闻阅读页面。\n\n- 带上虚构样例笔记本。\n- 浏览只读样例链接。\n\n| 样例项目 | 虚构数量 |\n| --- | --- |\n| 学习小组 | 2 |\n| 笔记本 | 5 |\n\n样例编号：\`sample-${number}\`。[返回样例新闻](/news)。${index === 0 ? `\n\n![虚构 DEMO 示意图](/api/publications/images/${DEMO_NEWS_IMAGE_ID})` : ""}\n`;
  const bodies = [
    binary(
      "body_markdown",
      new TextEncoder().encode(bodyMarkdown),
      "text/markdown; charset=utf-8",
    ),
  ];
  if (index === 0)
    bodies.push(
      binary("media", demoNewsImageBytes(), "image/png"),
      binary("asset", demoNewsAttachmentBytes(), "text/plain"),
    );
  const revision = {
    id: `${id}-revision-${locale}`,
    revisionHash: demoNewsContentHash(
      `${id}\n${locale}\n${title}\n${bodyMarkdown}`,
    ),
    observedAt: new Date(DEMO_REFERENCE_NOW),
    title,
    author: english ? "Fictional demo editors" : "虚构样例编辑组",
    reporter: null,
    editor: null,
    originalPublisher: null,
    publishedAt: published.toDate(),
    updatedAtSource: null,
    category: english ? "Fictional sample" : "虚构样例",
    summary: english
      ? `Fictional demo sample ${number}; not an official school publication.`
      : `虚构演示样例 ${number}，并非学校正式发布。`,
    sourcePageUrl: `https://demo.invalid/news/${number}`,
  };
  const row: PublicPublicationListItem = {
    id,
    canonicalUrl: `https://demo.invalid/news/${number}`,
    publicationType:
      index < 5
        ? "notice"
        : index >= 20 || number % 2 === 0
          ? "news"
          : "notice",
    source: projectedSource,
    revision,
    objects: bodies.map(object),
  };
  return {
    row,
    bodyMarkdown,
    bodies,
    publishedMillis: published.valueOf(),
    group: index >= 20 ? "demo-known-reprint-pair" : id,
  };
}
function graph(locale: AppLocale) {
  return DEMO_NEWS_IDS.map((_, index) => article(locale, index));
}
function ordered(a: ReturnType<typeof article>, b: ReturnType<typeof article>) {
  return (
    b.publishedMillis - a.publishedMillis ||
    a.row.id.localeCompare(b.row.id, "en")
  );
}

export function getDemoNewsList(
  locale: AppLocale,
  query: PublicationsQuery = {},
): PublicPublicationList | null {
  const page = query.page ?? 1,
    pageSize = query.pageSize ?? 20;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50 ||
    query.source?.some((id) => !sources.some((source) => source.id === id))
  )
    return null;
  const text = query.query?.toLocaleLowerCase(locale);
  let rows = graph(locale).filter(
    ({ row }) =>
      (!query.type || row.publicationType === query.type) &&
      (!query.source || query.source.includes(row.source.id)) &&
      (!query.organizationLevel ||
        query.organizationLevel.includes(row.source.organizationLevel)) &&
      (!text ||
        [row.revision.title, row.revision.summary, row.canonicalUrl].some(
          (value) => value?.toLocaleLowerCase(locale).includes(text),
        )),
  );
  let data: PublicPublicationListItem[];
  if (query.fold) {
    const groups = new Map<string, typeof rows>();
    for (const entry of rows)
      groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry]);
    rows = [...groups.values()]
      .map((group) => group.sort(ordered)[0])
      .sort(ordered);
    data = rows.map(({ row, group }) => {
      const members = groups.get(group);
      if (!members) throw new Error("Missing fixed demo reprint group");
      const size = members.length;
      return size > 1 ? { ...row, foldGroup: { siblingCount: size - 1 } } : row;
    });
  } else data = rows.sort(ordered).map(({ row }) => row);
  const total = data.length;
  return {
    data: data.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
export function getDemoNewsDetail(
  locale: AppLocale,
  id: string,
): PublicPublicationDetail | null {
  const rows = graph(locale),
    entry = rows.find(({ row }) => row.id === id);
  if (!entry) return null;
  const english = locale === "en-us";
  const images =
    entry.row.id === DEMO_NEWS_IDS[0]
      ? [
          {
            id: DEMO_NEWS_IMAGE_ID,
            url: `/api/publications/images/${DEMO_NEWS_IMAGE_ID}`,
            altText: english ? "Fictional DEMO diagram" : "虚构 DEMO 示意图",
            title: english ? "Fictional sample diagram" : "虚构样例示意图",
            caption: english
              ? "Code-generated fictional DEMO diagram, not a school image."
              : "代码生成的虚构 DEMO 示意图，非学校图片。",
          },
        ]
      : [];
  return {
    id: entry.row.id,
    canonicalUrl: entry.row.canonicalUrl,
    publicationType: entry.row.publicationType,
    source: entry.row.source,
    renderedBodyHtml: annotatePublicationImages(
      renderEmbeddedMarkdown(entry.bodyMarkdown),
      images,
    ),
    revision: {
      ...entry.row.revision,
      images,
      bodyText: entry.bodyMarkdown,
      bodyMarkdown: entry.bodyMarkdown,
      extractionMethod: "demo-fixture",
      classifierVersion: null,
      objects: entry.row.objects,
    },
    alsoPublishedIn: rows
      .filter((other) => other.group === entry.group && other.row.id !== id)
      .sort(ordered)
      .map(({ row }) => ({
        id: row.id,
        canonicalUrl: row.canonicalUrl,
        source: row.source,
        publishedAt: row.revision.publishedAt,
      })),
  };
}
export function getDemoNewsSources(
  locale: AppLocale,
): PublicPublicationSourceDirectory {
  const rows = graph(locale),
    options = getDemoNewsSourceOptions(locale);
  const projected = options.map((source) => {
    const records = rows
      .filter(({ row }) => row.source.id === source.id)
      .sort(ordered);
    return {
      ...source,
      hosts: ["demo.invalid"],
      publicationCount: records.length,
      lastPublishedAt: records[0]?.row.revision.publishedAt ?? null,
    };
  });
  return {
    groups: PUBLICATION_SOURCE_ORGANIZATION_LEVELS.flatMap(
      (organizationLevel) => {
        const items = projected.filter(
          (source) => source.organizationLevel === organizationLevel,
        );
        return items.length
          ? [
              {
                organizationLevel,
                sourceCount: items.length,
                publicationCount: items.reduce(
                  (sum, source) => sum + source.publicationCount,
                  0,
                ),
                sources: items,
              },
            ]
          : [];
      },
    ),
    totals: { sourceCount: projected.length, publicationCount: rows.length },
  };
}
export function getDemoNewsHomeNotices(
  locale: AppLocale,
): NonNullable<AnonymousHomeInformation["notices"]> {
  return graph(locale)
    .slice(0, 5)
    .map(({ row }, index) => ({
      key: `demo-notice-${index + 1}`,
      href: `/news/${row.id}`,
      title: row.revision.title,
      meta:
        locale === "en-us"
          ? "Fictional demo sample · Not a school announcement"
          : "虚构演示样例 · 非学校通知",
      dateLabel: shanghaiDayjs(row.revision.publishedAt).format("YYYY-MM-DD"),
    }));
}
/** Only bytes linked by a current revision in the sealed bilingual graph. */
export function getDemoNewsObject(
  kind: string,
  sha256: string,
): DemoNewsBinary | null {
  for (const locale of ["en-us", "zh-cn"] as const)
    for (const entry of graph(locale)) {
      const found = entry.bodies.find(
        (item) => item.kind === kind && item.sha256 === sha256,
      );
      if (found) return { ...found, bytes: found.bytes.slice() };
    }
  return null;
}
export function getDemoNewsImage(imageSourceId: string): DemoNewsBinary | null {
  if (imageSourceId !== DEMO_NEWS_IMAGE_ID) return null;
  return binary("media", demoNewsImageBytes(), "image/png");
}

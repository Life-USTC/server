import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Locator, test } from "@playwright/test";
import {
  localizeCatalogLink,
  USTC_CATALOG_LINKS,
} from "@/features/catalog-links/lib/catalog-links";
import {
  formatShanghaiDate,
  formatShanghaiTime,
} from "@/lib/time/shanghai-format";
import en from "../../../../../messages/en-us.json" with { type: "json" };
import zh from "../../../../../messages/zh-cn.json" with { type: "json" };
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import {
  createPublicationFixture,
  deletePublicationFixture,
  publicationFixtureObjectCommand,
} from "../../../utils/e2e-db/publications";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  createPriorityViewAudit,
  type VisiblePriorityField,
} from "../../../utils/property-priority";
import { showWeatherFixture } from "../../../utils/weather-fixture";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

const visible = (
  locator: Locator,
  expected: string | RegExp,
): VisiblePriorityField => ({ locator, expected });
const icon = (
  locator: Locator,
  expected: string | RegExp,
  attribute: "src" | "aria-label",
): VisiblePriorityField => ({ locator, expected, attribute });

async function fixture() {
  const marker = crypto.randomUUID();
  const publication = await createPublicationFixture(`priority-${marker}`);
  const bytes = Buffer.from(`Priority attachment ${marker}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const objectKey = `publications/asset/sha256/${hash.slice(0, 2)}/${hash}`;
  publicationFixtureObjectCommand("put", objectKey, bytes, "application/pdf");
  const data = await withE2ePrisma(async (db) => {
    const user = await db.user.create({
      data: {
        name: "Priority reader",
        username: `priority-${marker}`,
        email: `priority-${marker}@example.test`,
        emailVerified: true,
        workspaceLinkPins: { create: { slug: "jw" } },
      },
    });
    const current = await db.publication.findUniqueOrThrow({
      where: { id: publication.id },
    });
    if (!current.currentRevisionId)
      throw new Error("Publication fixture has no current revision");
    const revision = await db.publicationRevision.update({
      where: { id: current.currentRevisionId },
      data: {
        summary: "Priority article summary",
        author: "Priority author",
        reporter: "Priority reporter",
        editor: "Priority editor",
        originalPublisher: "Priority publisher",
        rawMetadata: { privateMarker: `raw-publication-${marker}` },
      },
    });
    const asset = await db.publicationObject.create({
      data: {
        kind: "asset",
        sha256: hash,
        r2Key: objectKey,
        size: bytes.byteLength,
        contentType: "application/pdf",
        status: "verified",
        verifiedAt: new Date(),
      },
    });
    await db.publicationObjectLink.create({
      data: {
        revisionId: revision.id,
        objectId: asset.id,
        role: "asset",
        filename: "Priority attachment.pdf",
      },
    });
    const organizer = await db.youngOrganizer.create({
      data: {
        id: `priority-organizer-id-${marker}`,
        name: `Priority organizer ${marker.slice(0, 8)}`,
        normalizedName: `priority-organizer-${marker}`,
      },
    });
    const young = await db.youngEvent.create({
      data: {
        youngId: `priority-event-id-${marker}`,
        name: `Priority 活动 ${marker.slice(0, 8)}`,
        organizerId: organizer.id,
        organizer: organizer.name,
        rawJson: { privateMarker: `young-raw-${marker}` },
        isActive: true,
        sourceMissing: true,
        status: "报名中",
        category: "Priority category",
        module: "智",
        activityLevel: "校级",
        form: "讲座",
        grades: "2026 cohort",
        department: "Priority department",
        sponsor: "Priority sponsor",
        externalSponsor: "Priority partner",
        contactName: "Priority contact",
        contactTel: "0551-63600000",
        location: "Priority venue",
        imageUrl: `group1/priority-${marker}.png`,
        description: "<p>Priority event description</p>",
        participationNotes: "<p>Priority participation notes</p>",
        startAt: new Date("2035-09-15T10:00:00+08:00"),
        endAt: new Date("2035-09-15T12:00:00+08:00"),
        applyStartAt: new Date("2035-09-01T08:00:00+08:00"),
        applyEndAt: new Date("2035-09-14T20:00:00+08:00"),
        hours: 2.5,
        capacity: 47,
        appliedCount: 13,
        duration: 2,
        serviceHour: 3.5,
        sumHours: 59,
        sumPersons: 23,
        partakeNum: 17,
        favCount: 7,
        limitNum: 41,
        createdAtUpstream: new Date("2035-08-01T09:11:00+08:00"),
        auditedAt: new Date("2035-08-02T09:12:00+08:00"),
        updatedAtUpstream: new Date("2035-08-03T09:13:00+08:00"),
        requiresSignup: true,
        requiresSignupInfo: true,
        signupScopeCode: `opaque-scope-${marker}`,
        signupDepartmentIds: [`opaque-department-${marker}`],
        allowedAttachmentTypes: ["pdf", "docx"],
        isOnline: true,
        onlineMeetingInfo: "Priority meeting 8123",
        places: [
          {
            placeInfo: "Priority room 3A204",
            placeSt: "2035-09-15T10:00:00+08:00",
            placeEt: "2035-09-15T12:00:00+08:00",
          },
        ],
      },
    });
    const base = 1_600_000_000 + Math.floor(Math.random() * 50_000_000);
    const campuses = await Promise.all(
      [0, 1].map((i) =>
        db.busCampus.create({
          data: {
            id: base + i,
            nameCn: `优先级${i === 0 ? "甲" : "乙"}站${marker.slice(0, 4)}`,
            nameEn: `Priority ${i === 0 ? "Alpha" : "Beta"} ${marker.slice(0, 4)}`,
            latitude: 31.82 + i * 0.01,
            longitude: 117.26 + i * 0.01,
          },
        }),
      ),
    );
    const route = await db.busRoute.create({
      data: {
        id: base + 2,
        nameCn: "优先级测试线路",
        nameEn: "Priority route",
        stops: {
          create: campuses.map((campus, i) => ({
            campusId: campus.id,
            stopOrder: i + 1,
          })),
        },
      },
    });
    const rawCampuses = campuses.map((c) => ({
      id: c.id,
      name: c.nameCn,
      latitude: c.latitude,
      longitude: c.longitude,
    }));
    const rawRoute = { id: route.id, campuses: rawCampuses };
    const schedules = [
      {
        id: route.id,
        route: rawRoute,
        time: [
          ["13:00", "13:20"],
          ["00:00", "23:59"],
        ],
      },
    ];
    const version = await db.busScheduleVersion.create({
      data: {
        key: `priority-version-${marker}`,
        title: "Priority timetable",
        checksum: marker,
        isEnabled: true,
        effectiveFrom: new Date(`${formatShanghaiDate(new Date())}T00:00:00Z`),
        rawJson: {
          campuses: rawCampuses,
          routes: [rawRoute],
          weekday_routes: schedules,
          saturday_routes: schedules,
          sunday_routes: schedules,
        },
      },
    });
    const trips = [];
    for (const [dayIndex, dayType] of (
      ["weekday", "saturday", "sunday"] as const
    ).entries())
      for (const position of [0, 1])
        trips.push(
          await db.busTrip.create({
            data: {
              id: base + 10 + dayIndex * 2 + position,
              versionId: version.id,
              routeId: route.id,
              dayType,
              position,
              stopTimes: schedules[0].time[position],
            },
          }),
        );
    return {
      user,
      revision,
      asset,
      organizer,
      young,
      campuses,
      route,
      version,
      trips,
    };
  });
  return {
    ...data,
    publication,
    marker,
    async close() {
      await withE2ePrisma(async (db) => {
        await db.user.delete({ where: { id: data.user.id } });
        await db.youngEvent.delete({ where: { youngId: data.young.youngId } });
        await db.youngOrganizer.delete({ where: { id: data.organizer.id } });
        await db.busScheduleVersion.delete({ where: { id: data.version.id } });
        await db.busRouteStop.deleteMany({ where: { routeId: data.route.id } });
        await db.busRoute.delete({ where: { id: data.route.id } });
        await db.busCampus.deleteMany({
          where: { id: { in: data.campuses.map((c) => c.id) } },
        });
      });
      await deletePublicationFixture(publication);
      await withE2ePrisma((db) =>
        db.publicationObject.delete({ where: { id: data.asset.id } }),
      );
      publicationFixtureObjectCommand("delete", objectKey);
    },
  };
}

test("ui.model-property-priority-discovery-views", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const f = await fixture();
  const main = page.locator("#main-content");
  const title = () => main.getByRole("heading", { level: 1 });
  const clock = new Date();
  clock.setUTCHours(3, 0, 0, 0);
  await page.clock.setFixedTime(clock);
  const image = readFileSync("public/images/icon.png");
  await page.route("**/api/catalog/young-events/**", async (route) => {
    if (route.request().resourceType() === "image")
      await route.fulfill({ body: image, contentType: "image/png" });
    else await route.fallback();
  });
  try {
    for (const locale of ["zh-cn", "en-us"] as const) {
      const copy = locale === "zh-cn" ? zh : en;
      const y = copy.youngEvents;
      const p = copy.publications;
      const audit = createPriorityViewAudit("discovery");
      for (const width of [1280, 390]) {
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
          ]);
        await page.setViewportSize({ width, height: 1000 });
        await test.step(`${locale}/${width}: landing`, async () => {
          await gotoAndWaitForReady(page, "/");
          await audit.check({
            feature: "overview",
            capability: "anonymous-overview",
            view: "web",
            scope: main,
            identity: title(),
            primary: {
              "catalog.title": visible(
                title(),
                copy.homepage.publicWorkspace.title,
              ),
            },
            secondary: {
              "catalog.description": visible(
                main.getByText(copy.homepage.publicWorkspace.description, {
                  exact: true,
                }),
                copy.homepage.publicWorkspace.description,
              ),
            },
            tertiary: {},
          });
        });
        await test.step(`${locale}/${width}: bus`, async () => {
          await gotoAndWaitForReady(page, "/catalog/bus");
          const section = page.getByTestId("bus-route-section").first();
          const routeTitle = section.getByRole("heading", { level: 3 });
          const start = f.campuses[0].nameCn;
          const end = f.campuses[1].nameCn;
          await expect(routeTitle).toContainText(start);
          const trip = section
            .getByRole("row")
            .filter({ hasText: "13:00" })
            .first();
          await audit.check({
            feature: "bus",
            capability: "bus-timetable",
            view: "web",
            scope: main,
            identity: routeTitle,
            primary: {
              "route.descriptionPrimary": visible(routeTitle, start),
              "trip.departureTime": visible(
                trip.getByRole("cell").first(),
                "13:00",
              ),
            },
            secondary: {
              "route.stops.name": visible(
                section.getByRole("columnheader").last(),
                end,
              ),
              "trip.stopTimes": visible(trip.getByRole("cell").last(), "13:20"),
            },
            tertiary: {
              "version.key": { value: f.version.key },
              "version.importedAt": {
                value: f.version.importedAt.toISOString(),
              },
              "route.id": { value: String(f.route.id) },
            },
          });
          if (width === 390) {
            const summary = page.getByTestId("bus-compact-summary");
            await audit.check({
              feature: "bus",
              capability: "bus-next-departures",
              view: "web",
              scope: summary,
              identity: summary.getByText("13:00", { exact: true }).first(),
              primary: {
                "trip.departureTime": visible(
                  summary.getByText("13:00", { exact: true }).first(),
                  "13:00",
                ),
                "trip.arrivalTime": visible(
                  summary.getByText("13:20", { exact: true }).first(),
                  "13:20",
                ),
              },
              secondary: {
                "originCampus.name": visible(
                  summary.locator("p").filter({ hasText: start }).last(),
                  start,
                ),
                "destinationCampus.name": visible(
                  summary.locator("p").filter({ hasText: end }).last(),
                  end,
                ),
                "route.descriptionPrimary": visible(
                  summary
                    .locator('[data-slot="bus-route-description"]')
                    .first(),
                  start,
                ),
              },
              tertiary: { "route.id": { value: String(f.route.id) } },
            });
            await main
              .getByRole("button", {
                name: copy.bus.changeRoute,
                exact: true,
              })
              .click();
          }
          await audit.check({
            feature: "bus",
            capability: "bus-route-search",
            view: "web",
            scope: main,
            identity: routeTitle,
            primary: {
              "originCampus.name": visible(
                page
                  .getByTestId("bus-start-stop-group")
                  .getByRole("radio", { name: start, exact: true }),
                start,
              ),
              "destinationCampus.name": visible(
                page
                  .getByTestId("bus-end-stop-group")
                  .getByRole("radio", { name: end, exact: true }),
                end,
              ),
              "route.descriptionPrimary": visible(routeTitle, start),
            },
            secondary: {
              "route.stops.name": visible(
                section.getByRole("columnheader").last(),
                end,
              ),
            },
            tertiary: { "route.id": { value: String(f.route.id) } },
          });
          await page.screenshot({
            path: testInfo.outputPath(`after-bus-${locale}-${width}.png`),
            fullPage: true,
          });
          await gotoAndWaitForReady(page, "/catalog/bus/map");
          const label = main
            .locator("text[data-campus-label]")
            .filter({ hasText: start })
            .first();
          await audit.check({
            feature: "bus",
            capability: "bus-map",
            view: "web",
            scope: main,
            identity: label,
            primary: { "campus.namePrimary": visible(label, start) },
            secondary: {},
            tertiary: {
              "route.id": { value: String(f.route.id) },
              "trip.id": { value: String(f.trips[1].id) },
            },
          });
        });
        await test.step(`${locale}/${width}: publications`, async () => {
          await gotoAndWaitForReady(
            page,
            `/news?source=${f.publication.sourceId}`,
          );
          const link = main.getByRole("link", {
            name: f.publication.title,
            exact: true,
          });
          const row = link.locator("xpath=ancestor::li[1]");
          await audit.check({
            feature: "publications",
            capability: "publication-read",
            view: "web-list",
            scope: row,
            identity: link,
            primary: { "revision.title": visible(link, f.publication.title) },
            secondary: {
              "source.name": visible(
                row.getByRole("link", {
                  name: f.publication.sourceName,
                  exact: true,
                }),
                f.publication.sourceName,
              ),
              "source.organizationLevel": visible(
                row.getByText(p.organizationLevelLabels.university, {
                  exact: true,
                }),
                p.organizationLevelLabels.university,
              ),
              "publication.publicationType": visible(
                row.getByText(p.news, { exact: true }),
                p.news,
              ),
              "revision.summary": visible(
                row.locator("p"),
                "Priority article summary",
              ),
              "revision.publishedAt": visible(
                row.getByText("2026-09-01", { exact: true }),
                "2026-09-01",
              ),
            },
            tertiary: {
              "publication.id": { value: f.publication.id },
              "revision.id": { value: f.revision.id },
            },
          });
          await page.screenshot({
            path: testInfo.outputPath(`after-news-${locale}-${width}.png`),
            fullPage: true,
          });
          await gotoAndWaitForReady(page, `/news/${f.publication.id}`);
          const sourceLink = main.getByRole("link", {
            name: p.sourcePage,
            exact: true,
          });
          await expect(sourceLink).toHaveAttribute(
            "href",
            f.publication.canonicalUrl,
          );
          await audit.check({
            feature: "publications",
            capability: "publication-read",
            view: "web-detail",
            scope: main,
            identity: title(),
            primary: {
              "revision.title": visible(title(), f.publication.title),
            },
            secondary: {
              "source.name": visible(
                main
                  .getByRole("link", {
                    name: f.publication.sourceName,
                    exact: true,
                  })
                  .first(),
                f.publication.sourceName,
              ),
              "revision.summary": visible(
                main.getByText("Priority article summary", { exact: true }),
                "Priority article summary",
              ),
              "revision.publishedAt": visible(
                main
                  .locator("span")
                  .filter({ hasText: `${p.publishedAt}: 2026-09-01` })
                  .first(),
                "2026-09-01",
              ),
              "revision.author": visible(
                main.locator("dd").filter({ hasText: "Priority author" }),
                "Priority author",
              ),
              "revision.reporter": visible(
                main.locator("dd").filter({ hasText: "Priority reporter" }),
                "Priority reporter",
              ),
              "revision.editor": visible(
                main.locator("dd").filter({ hasText: "Priority editor" }),
                "Priority editor",
              ),
              "revision.originalPublisher": visible(
                main.locator("dd").filter({ hasText: "Priority publisher" }),
                "Priority publisher",
              ),
              "revision.sourcePageUrl": visible(sourceLink, p.sourcePage),
              "revision.bodyMarkdown": visible(
                main.locator(".publication-body p").first(),
                "This is the body text rendered by the public detail page.",
              ),
              "attachments.filename": visible(
                main.getByRole("link", { name: /Priority attachment\.pdf/ }),
                "Priority attachment.pdf",
              ),
            },
            tertiary: {
              "publication.id": { value: f.publication.id },
              "revision.id": { value: f.revision.id },
              "revision.rawMetadata": { value: `raw-publication-${f.marker}` },
            },
          });
          await gotoAndWaitForReady(page, "/news/sources");
          const source = main
            .locator(`a[href="/news?source=${f.publication.sourceId}"]`)
            .filter({ visible: true });
          const sourceRow =
            width === 1280 ? source.locator("xpath=ancestor::tr[1]") : source;
          const host =
            width === 1280
              ? sourceRow.locator("p")
              : sourceRow.locator('[data-slot="item-description"]').first();
          const count =
            width === 1280
              ? sourceRow.getByRole("cell").nth(1)
              : sourceRow.locator('[data-slot="item-description"]').last();
          const date =
            width === 1280 ? sourceRow.getByRole("cell").nth(2) : count;
          await audit.check({
            feature: "publications",
            capability: "publication-source-directory",
            view: "web",
            scope: sourceRow,
            identity:
              width === 1280
                ? source
                : source.locator('[data-slot="item-title"]'),
            primary: {
              "source.name": visible(source, f.publication.sourceName),
              "source.organizationLevel": visible(
                main.getByRole("heading", {
                  level: 2,
                  name: p.organizationLevelLabels.university,
                  exact: true,
                }),
                p.organizationLevelLabels.university,
              ),
            },
            secondary: {
              "source.allowedHosts": visible(host, "news.example.test"),
              "source.publicationCount": visible(count, "21"),
              "source.latestPublishedAt": visible(date, "2026-09-01"),
            },
            tertiary: { "source.id": { value: f.publication.sourceId } },
          });
          await page.screenshot({
            path: testInfo.outputPath(`after-sources-${locale}-${width}.png`),
            fullPage: true,
          });
        });
        await test.step(`${locale}/${width}: Young`, async () => {
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events?search=${encodeURIComponent(f.young.name)}`,
          );
          const link = main
            .locator(`a[href^="/catalog/young-events/${f.young.youngId}?"]`)
            .filter({ visible: true })
            .first();
          const row =
            width === 1280 ? link.locator("xpath=ancestor::tr[1]") : link;
          const identity =
            width === 1280
              ? link.locator("span").first()
              : link.locator('[data-slot="item-title"]');
          const meta = (text: string) =>
            row.locator("span").filter({ hasText: text }).last();
          await audit.check({
            feature: "young-event",
            capability: "young-event",
            view: "web-list",
            scope: row,
            identity,
            primary: {
              "event.name": visible(identity, f.young.name),
              "event.startAt": visible(
                row.getByText("2035-09-15 10:00", { exact: true }),
                "2035-09-15 10:00",
              ),
              "event.status": visible(
                row.getByText("报名中", { exact: true }),
                "报名中",
              ),
            },
            secondary: {
              "event.location": visible(
                meta("Priority venue"),
                "Priority venue",
              ),
              "event.category": visible(
                meta("Priority category"),
                "Priority category",
              ),
              "event.module": visible(meta("智"), "智"),
              "event.organizer": visible(
                meta(f.organizer.name),
                f.organizer.name,
              ),
            },
            tertiary: {},
          });
          await page.screenshot({
            path: testInfo.outputPath(
              `after-young-list-${locale}-${width}.png`,
            ),
            fullPage: true,
          });
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events/${f.young.youngId}`,
          );
          await main
            .getByRole("button", { name: y.poster, exact: true })
            .click();
          await main
            .getByRole("button", { name: y.moreDetails, exact: true })
            .click();
          const dd = (label: string) =>
            main
              .locator("dt")
              .filter({
                hasText: new RegExp(
                  `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                ),
              })
              .first()
              .locator("..")
              .locator("dd");
          const fieldValues: Record<string, [string, string]> = {
            "event.allowedAttachmentTypes": [
              y.allowedAttachmentTypes,
              "PDF, DOCX",
            ],
            "event.appliedCount": [y.appliedCount, "13"],
            "event.applyEndAt": [y.signupWindow, "2035-09-14 20:00"],
            "event.applyStartAt": [y.signupWindow, "2035-09-01 08:00"],
            "event.capacity": [y.capacity, "47"],
            "event.contactName": [y.contactName, "Priority contact"],
            "event.contactTel": [y.contactTel, "0551-63600000"],
            "event.department": [y.department, "Priority department"],
            "event.duration": [
              y.duration,
              y.durationHours.replace("{value}", "2"),
            ],
            "event.externalSponsor": [y.externalSponsor, "Priority partner"],
            "event.favCount": [y.favCount, "7"],
            "event.grades": [y.grades, "2026 cohort"],
            "event.hours": [y.hours, "2.5"],
            "event.limitNum": [y.limitNum, "41"],
            "event.location": [y.location, "Priority venue"],
            "event.onlineMeetingInfo": [
              y.onlineMeetingInfo,
              "Priority meeting 8123",
            ],
            "event.organizer": [y.organizer, f.organizer.name],
            "event.partakeNum": [y.partakeNum, "17"],
            "event.requiresSignup": [y.signupRequirement, y.signupRequired],
            "event.serviceHour": [y.serviceHour, "3.5"],
            "event.sponsor": [y.sponsor, "Priority sponsor"],
            "event.sumHours": [y.sumHours, "59"],
            "event.sumPersons": [y.sumPersons, "23"],
          };
          const secondary = Object.fromEntries(
            Object.entries(fieldValues).map(([field, [label, value]]) => [
              field,
              visible(dd(label), value),
            ]),
          );
          const badges = main.getByTestId("young-event-badges");
          Object.assign(secondary, {
            "event.activityLevel": visible(
              badges.getByText("校级", { exact: true }),
              "校级",
            ),
            "event.category": visible(dd(y.category), "Priority category"),
            "event.description": visible(
              main.getByText("Priority event description", { exact: true }),
              "Priority event description",
            ),
            "event.form": visible(
              badges.getByText("讲座", { exact: true }),
              "讲座",
            ),
            "event.imageUrl": icon(
              main.getByRole("img", { name: f.young.name, exact: true }),
              /^\/api\/catalog\/young-events\//,
              "src",
            ),
            "event.isActive": visible(
              badges.getByText("报名中", { exact: true }),
              "报名中",
            ),
            "event.isOnline": visible(
              badges.getByText(y.online, { exact: true }),
              y.online,
            ),
            "event.module": visible(
              badges.getByText("智", { exact: true }),
              "智",
            ),
            "event.participationNotes": visible(
              main.getByText("Priority participation notes", { exact: true }),
              "Priority participation notes",
            ),
            "event.places": visible(
              main.getByText("Priority room 3A204", { exact: true }),
              "Priority room 3A204",
            ),
            "event.requiresSignupInfo": visible(
              main.getByText(y.signupInfoRequired, { exact: true }),
              y.signupInfoRequired,
            ),
          });
          await audit.check({
            feature: "young-event",
            capability: "young-event",
            view: "web-detail",
            scope: main,
            identity: title(),
            primary: {
              "event.name": visible(title(), f.young.name),
              "event.startAt": visible(dd(y.eventTime), "2035-09-15 10:00"),
              "event.endAt": visible(dd(y.eventTime), "2035-09-15 12:00"),
              "event.status": visible(
                badges.getByText("报名中", { exact: true }),
                "报名中",
              ),
            },
            secondary,
            tertiary: {
              "event.youngId": { value: f.young.youngId },
              "event.organizerId": { value: f.organizer.id },
              "event.createdAtUpstream": {
                value: "2035-08-01 09:11",
                locator: dd(y.createdAtUpstream),
              },
              "event.auditedAt": {
                value: "2035-08-02 09:12",
                locator: dd(y.auditedAt),
              },
              "event.updatedAtUpstream": {
                value: "2035-08-03 09:13",
                locator: dd(y.updatedAtUpstream),
              },
              "event.sourceMissing": {
                value: y.sourceMissing,
                locator: main
                  .getByTestId("young-source-freshness")
                  .locator("span")
                  .last(),
              },
              "event.signupDepartmentIds": {
                value: `opaque-department-${f.marker}`,
              },
              "event.signupScopeCode": { value: `opaque-scope-${f.marker}` },
            },
          });
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events/calendar?date=2035-09-15&view=day&search=${encodeURIComponent(f.young.name)}`,
          );
          const event = main
            .locator(`a[href^="/catalog/young-events/${f.young.youngId}?"]`)
            .filter({ visible: true })
            .first();
          const eventTitle =
            width === 1280
              ? event.locator(":scope > div").first()
              : event.locator('[data-slot="item-title"]');
          const eventMeta =
            width === 1280
              ? event.locator(":scope > div").nth(1)
              : event.locator('[data-slot="item-description"]').first();
          const withdrawn =
            width === 1280
              ? event.locator(":scope > div").last()
              : event.locator('[data-slot="item-description"]').last();
          await audit.check({
            feature: "young-event",
            capability: "young-event",
            view: "web-calendar",
            scope: event,
            identity: eventTitle,
            primary: {
              "event.name": visible(eventTitle, f.young.name),
              "event.startAt": visible(eventMeta, "10:00"),
              "event.endAt": visible(eventMeta, "12:00"),
            },
            secondary: {
              "event.location": visible(eventMeta, "Priority venue"),
              "event.sourceMissing": visible(withdrawn, y.sourceMissing),
            },
            tertiary: {},
          });
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events/organizers?search=${encodeURIComponent(f.organizer.name)}`,
          );
          const organizerLink = main
            .locator(
              `a[href="/catalog/young-events/organizers/${f.organizer.id}"]`,
            )
            .filter({ visible: true });
          const organizerRow =
            width === 1280
              ? organizerLink.locator("xpath=ancestor::tr[1]")
              : organizerLink;
          const counts =
            width === 1280
              ? organizerRow.getByRole("cell")
              : organizerRow.locator('[data-slot="item-description"]');
          await audit.check({
            feature: "young-event",
            capability: "young-event",
            view: "web-organizers",
            scope: organizerRow,
            identity:
              width === 1280
                ? organizerLink
                : organizerLink.locator('[data-slot="item-title"]'),
            primary: {
              "organizer.name": visible(organizerLink, f.organizer.name),
            },
            secondary: {
              "organizer.activeCount": visible(
                width === 1280 ? counts.nth(1) : counts,
                "1",
              ),
              "organizer.upcomingCount": visible(
                width === 1280 ? counts.nth(2) : counts,
                "1",
              ),
              "organizer.historyCount": visible(
                width === 1280 ? counts.nth(3) : counts,
                "0",
              ),
            },
            tertiary: { "organizer.id": { value: f.organizer.id } },
          });
        });
        await test.step(`${locale}/${width}: weather`, async () => {
          const snapshot = await showWeatherFixture(page, 24, {
            alerts: [{ title: "Priority weather alert", level: "yellow" }],
            extensions: { amap: { rawMarker: `weather-raw-${f.marker}` } },
          });
          const location = page.getByTestId("weather-location").first();
          const card = location.locator(
            'xpath=ancestor::*[@data-slot="card"][1]',
          );
          const heading = card.getByRole("heading", { level: 2 });
          const chart = location.getByTestId("weather-hourly-chart");
          await chart.getByRole("slider").focus();
          await page.keyboard.press("Home");
          const tooltip = chart.getByRole("tooltip");
          const daily = location
            .locator("section")
            .filter({
              has: page.getByRole("heading", {
                name: copy.weather.dailyForecast,
                exact: true,
              }),
            })
            .getByRole("listitem")
            .first();
          await audit.check({
            feature: "weather",
            capability: "weather",
            view: "web",
            scope: main,
            identity: heading,
            primary: {
              "location.name": visible(
                heading,
                copy.weather.locationNames["ustc-main"],
              ),
              "current.temperature": visible(
                location.getByTestId("weather-temperature"),
                "24°",
              ),
              "current.condition": visible(
                location.getByTestId("weather-condition"),
                "多云",
              ),
            },
            secondary: {
              "hourly.time": visible(
                tooltip.locator("p").first(),
                formatShanghaiTime(snapshot.hourly[0].at),
              ),
              "hourly.temperature": visible(
                tooltip.getByText("28°C", { exact: true }),
                "28°C",
              ),
              "hourly.precipitationProbability": visible(
                tooltip.getByText(
                  copy.weather.precipitationProbability.replace("{value}", "3"),
                  { exact: true },
                ),
                "3",
              ),
              "daily.high": visible(
                daily.getByText("26°", { exact: true }),
                "26°",
              ),
              "daily.low": visible(
                daily.getByText("20°", { exact: true }),
                "20°",
              ),
              "alerts.title": visible(
                location.getByText("Priority weather alert", { exact: true }),
                "Priority weather alert",
              ),
            },
            tertiary: {
              "provider.rawResponse": { value: `weather-raw-${f.marker}` },
            },
          });
          await page.unroute("**/catalog/weather/__data.json*");
        });
        await test.step(`${locale}/${width}: signed-in links`, async () => {
          await page
            .context()
            .addCookies([await createSignedSessionCookie(f.user.id)]);
          await gotoAndWaitForReady(page, "/catalog/links");
          const catalogLink = USTC_CATALOG_LINKS.find(
            (link) => link.slug === "jw",
          );
          if (!catalogLink)
            throw new Error("Academic Affairs catalog link is missing");
          const item = localizeCatalogLink(catalogLink, locale);
          const link = main
            .locator('a[href="/api/catalog/links/resolve?slug=jw"]')
            .filter({ visible: true })
            .first();
          const row =
            width === 1280
              ? link.locator("xpath=ancestor::tr[1]")
              : link.locator(
                  "xpath=ancestor::div[contains(@class,'group')][1]",
                );
          const identity =
            width === 1280
              ? link.locator('[data-slot="truncated-text"]').first()
              : link.locator('[data-slot="item-title"]');
          const actualIdentity =
            width === 1280
              ? link.getByText(item.title, { exact: true })
              : identity;
          const description =
            width === 1280
              ? row
                  .getByRole("cell")
                  .nth(1)
                  .getByText(item.description, { exact: true })
              : row.locator('[data-slot="item-description"]');
          const pin = row.getByRole("button", {
            name: copy.workspace.linkHub.unpin,
            exact: true,
          });
          await expect(pin).toBeVisible();
          const group = row
            .locator("xpath=ancestor::section[1]")
            .getByRole("heading", { level: 3 });
          await audit.check({
            feature: "catalog-link",
            capability: "link-browse",
            view: "web",
            scope: row,
            identity: actualIdentity,
            primary: { "link.title": visible(actualIdentity, item.title) },
            secondary: {
              "link.description": visible(description, item.description),
              "link.group": visible(
                group,
                copy.workspace.linkHub.groups.mostClicked,
              ),
              "link.icon": visible(row.getByText("CL", { exact: true }), "CL"),
              "link.isPinned": icon(
                pin,
                copy.workspace.linkHub.unpin,
                "aria-label",
              ),
            },
            tertiary: { "link.slug": { value: item.slug } },
          });
          await audit.check({
            feature: "catalog-link",
            capability: "link-pin-and-visit",
            view: "web",
            scope: row,
            identity: actualIdentity,
            primary: {
              "link.title": visible(actualIdentity, item.title),
              "link.isPinned": icon(
                pin,
                copy.workspace.linkHub.unpin,
                "aria-label",
              ),
            },
            secondary: {},
            tertiary: { "link.slug": { value: item.slug } },
          });
          await page.screenshot({
            path: testInfo.outputPath(`after-links-${locale}-${width}.png`),
            fullPage: true,
          });
        });
      }
      audit.finish();
    }
  } finally {
    await f.close();
  }
});

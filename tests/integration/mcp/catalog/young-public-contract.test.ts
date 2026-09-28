import { afterAll, expect, vi } from "vitest";
import { listYoungEvents } from "@/features/young/server/young-event-service";
import { getYoungEventDetailRoute } from "@/lib/api/routes/young-event-routes";
import { createGraphqlYoga } from "@/lib/graphql/server";
import { syncYoungEvents } from "@/static-loader/import-young";
import type { Snapshot } from "@/static-loader/snapshot";
import { loadYoungEvents } from "@/static-loader/young-plan";
import { createFixturePrisma } from "../../../shared/prisma";
import { createAnonymousMcpHarness, type McpHarness } from "../_harness/client";
import { mcpTest } from "../_harness/context";

const contractTest = mcpTest
  .extend(
    "network",
    { scope: "file" },
    ({ mcpConnections: _connections }, { onCleanup }) => {
      const network = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("Upstream network unavailable"));
      onCleanup(() => network.mockRestore());
      return network;
    },
  )
  .extend("state", async ({ mcpConnections: _connections }, { onCleanup }) => {
    const youngId = `public-contract-${crypto.randomUUID()}`;
    let client: McpHarness;
    const description =
      '<p onclick="evil()">Description</p><script>evil()</script><iframe src="https://evil.test"></iframe><img src="https://young.ustc.edu.cn/login/group1/M00/example.jpg">';
    const notes =
      '<strong onmouseover="evil()">Notes</strong><script>evil()</script><iframe></iframe>';
    const upstream = {
      id: youngId,
      itemName: "Public source fixture",
      baseContent: description,
      conceive: notes,
      module_dictText: "智",
      activityLevel_dictText: "校级",
      form_dictText: "现场参与",
      sponsor_dictText: "Event sponsor",
      linkMan: "Published event contact",
      tel: "0551-12345678",
      validHour: 2,
      duration: 3,
      serviceHour: 1,
      sumHours: 8,
      sumPersons: 4,
      partakeNum: 5,
      favCount: 6,
      itemLimitNum: 10,
      itemStatus: "activity-code",
      itemStatus_dictText: "Published",
      applyStatus: "signup-code",
      needApply: "0",
      registrationStatus: "",
      st: "2026-09-20 08:30:00",
      et: "2026-09-20 09:30:00",
    };
    const rawPlace = {
      id: "slot-source-id",
      placeInfo: "East hall",
      placeSt: "2026-09-20 08:30:00",
      placeEt: "2026-09-20 09:30:00",
    };
    const expectedRaw = {
      ...upstream,
      itemPlaceDTO: { itemId: youngId, places: [rawPlace] },
    };
    async function publicDetails() {
      const response = await getYoungEventDetailRoute(
        new Request(`https://example.test/api/catalog/young-events/${youngId}`),
        { youngId },
      );
      expect(response.status).toBe(200);
      const rest = await response.json();
      const gqlResponse = await createGraphqlYoga(false).fetch(
        "https://example.test/api/graphql",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: `query($id: String!) { catalog { youngEvent(youngId: $id) { youngId description participationNotes rawJson module activityLevel form sponsor contactName contactTel hours duration serviceHour sumHours sumPersons partakeNum favCount limitNum status activityStatusCode signupStatusCode requiresSignup isActive startAt endAt places { placeInfo placeSt placeEt } } } }`,
            variables: { id: youngId },
          }),
        },
        { locals: { locale: "zh-cn" }, principal: { kind: "anonymous" } },
      );
      const gql = await gqlResponse.json();
      expect(gql.errors).toBeUndefined();
      const mcp = await client.call<{
        found: boolean;
        event: Record<string, unknown>;
      }>("catalog_young_event_get", { youngId, mode: "full" });
      expect(mcp.found).toBe(true);
      return [rest, gql.data.catalog.youngEvent, mcp.event] as Record<
        string,
        unknown
      >[];
    }
    onCleanup(async () => {
      await client?.close();
      const event = await db.youngEvent.findUnique({
        where: { youngId },
        select: { organizerId: true },
      });
      await db.youngEvent.deleteMany({ where: { youngId } });
      if (event?.organizerId)
        await db.youngOrganizer.deleteMany({
          where: { id: event.organizerId, events: { none: {} } },
        });
    });

    const table = "young_mobile_item_enrolment_list_result_records";
    const tables: Record<string, Record<string, unknown>[]> = {
      [table]: [{ ...upstream, store_id: 1 }],
      [`${table}_itemPlaceDTO`]: [
        { store_id: 10, parent_store_id: 1, itemId: youngId },
      ],
      [`${table}_itemPlaceDTO_places`]: [
        { ...rawPlace, store_id: 100, parent_store_id: 10, position: 0 },
      ],
    };
    const snapshot = {
      metadata: () => ({ young_events_mode: "full" }),
      hasTable: (name: string) => name in tables,
      queryAll: (name: string) => tables[name] ?? [],
      queryGrouped: (name: string, key = "parent_store_id") => {
        const grouped = new Map<number, Record<string, unknown>[]>();
        for (const row of tables[name] ?? [])
          grouped.set(Number(row[key]), [
            ...(grouped.get(Number(row[key])) ?? []),
            row,
          ]);
        return grouped;
      },
    } as unknown as Snapshot;
    await db.$transaction(async (tx) => {
      await syncYoungEvents(tx, loadYoungEvents(snapshot) ?? []);
    });
    client = await createAnonymousMcpHarness();

    return {
      youngId,
      client,
      description,
      notes,
      upstream,
      rawPlace,
      expectedRaw,
      publicDetails,
    };
  });

const db = createFixturePrisma();

contractTest("young-event.raw-payload-preserved", async ({ state, expect }) => {
  const { rawPlace, expectedRaw, publicDetails } = state;

  for (const event of await publicDetails()) {
    const raw =
      typeof event.rawJson === "string"
        ? JSON.parse(event.rawJson)
        : event.rawJson;
    expect(raw).toEqual(expectedRaw);
    expect(event).toMatchObject({
      module: "智",
      activityLevel: "校级",
      form: "现场参与",
      sponsor: "Event sponsor",
      contactName: "Published event contact",
      contactTel: "0551-12345678",
      hours: 2,
      duration: 3,
      serviceHour: 1,
      sumHours: 8,
      sumPersons: 4,
      partakeNum: 5,
      favCount: 6,
      limitNum: 10,
      places: [
        {
          placeInfo: rawPlace.placeInfo,
          placeSt: rawPlace.placeSt,
          placeEt: rawPlace.placeEt,
        },
      ],
    });
    for (const privateField of [
      "userId",
      "email",
      "account",
      "subscribed",
      "participated",
    ])
      expect(event).not.toHaveProperty(privateField);
  }
});

contractTest("young-event.rich-text-sanitized", async ({ state, expect }) => {
  const { publicDetails } = state;

  for (const event of await publicDetails()) {
    expect(event.description).toContain("<p>Description</p>");
    expect(event.description).toContain(
      "/api/catalog/young-events/images/group1/M00/example.jpg",
    );
    expect(event.participationNotes).toBe("<strong>Notes</strong>");
    for (const field of ["description", "participationNotes"])
      expect(event[field]).not.toMatch(
        /<script\b|<iframe\b|onclick=|onmouseover=|young\.ustc\.edu\.cn/,
      );
  }
});

contractTest("young-event.signup-state", async ({ state, expect }) => {
  const { publicDetails } = state;

  for (const event of await publicDetails()) {
    expect(event).toMatchObject({
      status: "Published",
      activityStatusCode: "activity-code",
      signupStatusCode: "signup-code",
      requiresSignup: false,
      isActive: true,
    });
    expect(event).not.toHaveProperty("registrationStatus");
    const raw =
      typeof event.rawJson === "string"
        ? JSON.parse(event.rawJson)
        : event.rawJson;
    expect(raw).toHaveProperty("registrationStatus", "");
  }
});

contractTest(
  "young-event.static-snapshot-sourced",
  async ({ state, network, expect }) => {
    const { youngId, publicDetails } = state;

    for (const event of await publicDetails())
      expect(event.youngId).toBe(youngId);
    expect(network).not.toHaveBeenCalled();
  },
);

contractTest("young-event.shanghai-local-times", async ({ state, expect }) => {
  const { youngId, publicDetails } = state;

  for (const event of await publicDetails()) {
    expect(event.startAt).toBe("2026-09-20T08:30:00+08:00");
    expect(event.endAt).toBe("2026-09-20T09:30:00+08:00");
  }
  const localDay = await listYoungEvents({
    search: "Public source fixture",
    dateFrom: "2026-09-20",
    dateTo: "2026-09-20",
  });
  expect(localDay.data.map((event) => event.youngId)).toContain(youngId);
  const previousDay = await listYoungEvents({
    search: "Public source fixture",
    dateFrom: "2026-09-19",
    dateTo: "2026-09-19",
  });
  expect(previousDay.data.map((event) => event.youngId)).not.toContain(youngId);
});

afterAll(() => db.$disconnect());

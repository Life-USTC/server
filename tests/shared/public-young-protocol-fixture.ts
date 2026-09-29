import { getYoungEventDetailRoute } from "@/lib/api/routes/young-event-routes";
import { createGraphqlYoga } from "@/lib/graphql/server";
import { syncYoungEvents } from "@/static-loader/import-young";
import type { Snapshot } from "@/static-loader/snapshot";
import { loadYoungEvents } from "@/static-loader/young-plan";
import { publicCatalogProtocolTest } from "./public-catalog-protocol-fixture";

export const publicYoungProtocolTest = publicCatalogProtocolTest.extend(
  "state",
  async ({
    isolatedDatabase: { owner: db },
    protocolRuntime,
    publicCatalogMcp,
    task: {
      context: { expect },
    },
  }) =>
    protocolRuntime.run(async () => {
      const youngId = `public-contract-${crypto.randomUUID()}`;
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
        const response = await protocolRuntime.request(() =>
          getYoungEventDetailRoute(
            new Request(
              `https://example.test/api/catalog/young-events/${youngId}`,
            ),
            { youngId },
          ),
        );
        expect(response.status).toBe(200);
        const rest = await response.json();
        const gqlResponse = await protocolRuntime.request(() =>
          createGraphqlYoga(false).fetch(
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
          ),
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
      await publicCatalogMcp.initialize();
      const client = publicCatalogMcp.client;

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
    }),
);

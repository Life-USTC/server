import { listYoungEvents } from "@/features/young/server/young-event-service";
import { publicYoungProtocolTest } from "../../../shared/public-young-protocol-fixture";

publicYoungProtocolTest(
  "young-event.raw-payload-preserved",
  async ({ state, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
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
    }),
);

publicYoungProtocolTest(
  "young-event.rich-text-sanitized",
  async ({ state, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
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
    }),
);

publicYoungProtocolTest(
  "young-event.signup-state",
  async ({ state, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
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
    }),
);

publicYoungProtocolTest(
  "young-event.shanghai-local-times",
  async ({ state, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
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
      expect(previousDay.data.map((event) => event.youngId)).not.toContain(
        youngId,
      );
    }),
);

import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";

test("Cloudflare Worker serves the public GraphQL endpoint", async ({
  request,
}) => {
  const response = await request.post("/api/graphql", {
    data: {
      query: /* GraphQL */ `
        query WorkerSmoke($courseJwId: Int!, $sectionJwId: Int!) {
          course(jwId: $courseJwId) {
            jwId
            code
          }
          section(jwId: $sectionJwId) {
            jwId
            code
            course {
              jwId
            }
          }
        }
      `,
      variables: {
        courseJwId: DEV_SEED.course.jwId,
        sectionJwId: DEV_SEED.section.jwId,
      },
    },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({
    data: {
      course: {
        jwId: DEV_SEED.course.jwId,
        code: DEV_SEED.course.code,
      },
      section: {
        jwId: DEV_SEED.section.jwId,
        code: DEV_SEED.section.code,
        course: { jwId: DEV_SEED.course.jwId },
      },
    },
  });
});

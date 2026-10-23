import { json } from "@sveltejs/kit";

/**
 * Public Apple association for the native app's supported content routes.
 * @response appleAppSiteAssociationResponseSchema
 */
export function GET() {
  return json(
    {
      applinks: {
        details: [
          {
            appIDs: ["VUW8FV5HN5.dev.tiankaima.Life-USTC"],
            components: [
              { "/": "/catalog/courses/*/*", exclude: true },
              { "/": "/catalog/courses/*" },
              { "/": "/catalog/sections/*/*", exclude: true },
              { "/": "/catalog/sections/*" },
              { "/": "/catalog/teachers/*/*", exclude: true },
              { "/": "/catalog/teachers/*" },
              { "/": "/catalog/young-events/organizers/*" },
              { "/": "/catalog/young-events/calendar", exclude: true },
              { "/": "/catalog/young-events/organizers", exclude: true },
              { "/": "/catalog/young-events/*/*", exclude: true },
              { "/": "/catalog/young-events/*" },
              { "/": "/community/comments/guide", exclude: true },
              { "/": "/community/comments/*" },
              { "/": "/community/users/*" },
              { "/": "/news/*" },
              { "/": "/workspace/todos" },
              { "/": "/workspace/homeworks" },
              { "/": "/workspace/exams" },
              { "/": "/workspace/calendar" },
            ],
          },
        ],
      },
      webcredentials: { apps: ["VUW8FV5HN5.dev.tiankaima.Life-USTC"] },
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}

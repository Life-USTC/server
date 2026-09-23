import type { PersistedGraphqlOperationDefinition } from "../operation-types";
import { query } from "./helpers";

export const accountGraphqlOperationDefinitions = [
  query({
    id: "account.profile.get.v1",
    title: "Get account profile",
    description: "Returns the current account's private profile.",
    document: /* GraphQL */ `
      query AccountProfile {
        account {
          profile {
            id
            email
            username
            name
            image
            isAdmin
            createdAt
            updatedAt
          }
        }
      }
    `,
    scopes: ["account.profile:read"],
  }),
  query({
    id: "account.client_activity.get.v1",
    title: "Get current OAuth client activity",
    description:
      "Returns only activity performed by the calling OAuth client for the current user.",
    document: /* GraphQL */ `
      query AccountClientActivity($cursor: String, $limit: Int) {
        account {
          clientActivity(cursor: $cursor, limit: $limit) {
            items {
              id
              action
              outcome
              channel
              createdAt
              targetType
            }
            nextCursor
          }
        }
      }
    `,
    scopes: ["account.client-activity:read"],
  }),
] as const satisfies readonly PersistedGraphqlOperationDefinition[];

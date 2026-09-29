import { describe } from "vitest";
import { expectCompletionBatchRejected } from "../shared/graphql-homework-completion-scenarios";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL completion batch boundaries", () => {
  graphqlHomeworkTest.for([{ name: "empty", count: 0 }])(
    "rejects $name batches without changing existing completion",
    expectCompletionBatchRejected,
  );
});

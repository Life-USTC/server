import { describe } from "vitest";
import { expectCompletionBatchPersisted } from "../shared/graphql-homework-completion-scenarios";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL completion batch boundaries", () => {
  graphqlHomeworkTest.for([1])(
    "accepts %s items and persists every completion",
    expectCompletionBatchPersisted,
  );
});

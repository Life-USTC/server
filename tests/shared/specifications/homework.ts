import { readFileSync } from "node:fs";
import { parseSpecificationYaml } from "../../../scripts/specifications/yaml";

type HomeworkExpectations = {
  authorization: {
    kind: "authorization";
    surface: "service";
    operation: "deleteHomework" | "deleteHomeworkForModeration";
    cases: Array<{
      id: string;
      authenticated: boolean;
      suspended: boolean;
      role: "user" | "admin";
      relationship: "creator" | "other";
      outcome: "allowed" | "forbidden" | "suspended";
    }>;
    denied_effects: Array<"homework" | "audit" | "calendar">;
  };
  collection_input: {
    kind: "collection_input";
    surface: "rest" | "graphql";
    operation: string;
    input: "items";
    min_items: number;
    max_items: number;
    unique_items: boolean;
  };
  subscription_completion: {
    kind: "subscription_completion";
    subscription_kind: "regular" | "auditor" | "teaching_assistant";
    completion_required: boolean;
    preserve_records: boolean;
  };
  pending_deadline: {
    kind: "pending_deadline";
    subscription_kind: "regular" | "auditor" | "teaching_assistant";
    without_deadline: boolean;
    before_deadline: boolean;
    at_deadline: boolean;
    after_deadline: boolean;
    completed: boolean;
  };
  target_size: {
    kind: "target_size";
    surface: "web";
    target: { by: "test_id" | "css"; value: string };
    viewport: { width: number; height: number };
    min_width: number;
    min_height: number;
  };
  state_visibility: {
    kind: "state_visibility";
    surface: "web";
    targets: Array<"workspace-list" | "workspace-card" | "detail-dialog">;
    state: { completed: boolean };
    visible: Array<"due_at" | "completion" | "major" | "team">;
    hidden: Array<"deadline_reminder">;
    restore_on_incomplete: Array<"deadline_reminder">;
  };
};

const source = new URL("../../../docs/features/homework.yaml", import.meta.url);
const specification = parseSpecificationYaml(
  readFileSync(source, "utf8"),
  source.pathname,
) as {
  requirements: Array<{ id: string; expectation?: { kind: string } }>;
};

/** Shapes and references are independently checked by specs:check before test execution. */
export function homeworkExpectation<K extends keyof HomeworkExpectations>(
  id: string,
  kind: K,
): HomeworkExpectations[K] {
  const expectation = specification.requirements.find(
    (item) => item.id === id,
  )?.expectation;
  if (!expectation || expectation.kind !== kind)
    throw new Error(`Missing ${kind} expectation ${id}`);
  return expectation as HomeworkExpectations[K];
}

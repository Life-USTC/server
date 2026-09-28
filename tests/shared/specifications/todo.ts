import { readSpecification } from "../../../scripts/specifications/yaml";

type NumericInput = {
  kind: "numeric_input";
  surface: "rest" | "mcp";
  operation: string;
  input: "limit";
  minimum: number;
  maximum: number;
  default: number;
  integer: boolean;
};
type CollectionInput = {
  kind: "collection_input";
  surface: "rest";
  operation: string;
  input: "items" | "ids";
  min_items: number;
  max_items: number;
  unique_items: boolean;
};
type Authorization = {
  kind: "authorization";
  surface: "rest";
  operation: string;
  cases: {
    id: string;
    authenticated: boolean;
    suspended: boolean;
    role: "user" | "admin";
    relationship: "owner" | "other";
    outcome: "allowed" | "not_found" | "unauthenticated";
  }[];
  denied_effects: "todo"[];
};
type OrderedItems = {
  kind: "ordered_items";
  surface: "web";
  target: { by: "test_id" | "css"; value: string };
  items: ("delete" | "completion" | "edit")[];
};
type TargetSize = {
  kind: "target_size";
  surface: "web";
  target: { by: "test_id" | "css"; value: string };
  viewport: { width: number; height: number };
  min_width: number;
  min_height: number;
};
type StatePresentation = {
  kind: "state_presentation";
  surface: "web";
  target: { by: "test_id" | "css"; value: string };
  state: { completed: boolean };
  text_decoration: string;
};
type TodoExpectation =
  | NumericInput
  | CollectionInput
  | Authorization
  | OrderedItems
  | TargetSize
  | StatePresentation;

const specification = readSpecification<{
  requirements: { id: string; expectation?: TodoExpectation }[];
}>("docs/features/todo.yaml");

/** Load normative values; actual observations always come from app execution. */
export async function todoExpectation<K extends TodoExpectation["kind"]>(
  id: string,
  kind: K,
) {
  const expectation = (await specification).requirements.find(
    (requirement) => requirement.id === id,
  )?.expectation;
  if (!expectation || expectation.kind !== kind)
    throw new Error(`Missing ${kind} expectation: ${id}`);
  return expectation as Extract<TodoExpectation, { kind: K }>;
}

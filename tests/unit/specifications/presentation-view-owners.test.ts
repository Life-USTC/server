import { expect, it } from "vitest";
import { readSpecifications } from "../../../scripts/specifications/repository";
import { PRESENTATION_VIEW_FAMILIES } from "../../shared/presentation-view-owners";

it("assigns every declared Web field view to exactly one finite browser owner", async () => {
  const declared = (await readSpecifications()).flatMap(({ data }) =>
    Object.entries(
      (data.capabilities ?? {}) as Record<
        string,
        { presentation?: { views?: Record<string, unknown> } }
      >,
    ).flatMap(([capability, { presentation }]) =>
      Object.keys(presentation?.views ?? {})
        .filter((view) => view.startsWith("web"))
        .map((view) => `${data.id}/${capability}/${view}`),
    ),
  );
  const assigned = Object.values(PRESENTATION_VIEW_FAMILIES).flatMap(
    (owner) => [...owner.views],
  );
  expect(new Set(assigned).size).toBe(assigned.length);
  expect(assigned.sort()).toEqual(declared.sort());
});

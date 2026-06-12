import type {
  DescriptionPayload,
  DescriptionTargetType,
} from "./description-card-types";

export async function fetchDescriptionPayload(input: {
  targetId: number | string;
  targetType: DescriptionTargetType;
}) {
  const params = new URLSearchParams({
    targetType: input.targetType,
    targetId: String(input.targetId),
  });
  const response = await fetch(`/api/descriptions?${params.toString()}`);
  return {
    ok: response.ok,
    payload: response.ok
      ? ((await response.json()) as DescriptionPayload)
      : null,
  };
}

export async function saveDescriptionPayload(input: {
  content: string;
  targetId: number | string;
  targetType: DescriptionTargetType;
}) {
  return fetch("/api/descriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

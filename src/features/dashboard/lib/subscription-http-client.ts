async function responsePayload(response: Response) {
  return response.json().catch(() => ({}));
}

export async function fetchCurrentSubscriptionSectionIds(errorMessage: string) {
  const currentResponse = await fetch("/api/calendar-subscriptions/current");
  const currentPayload = await responsePayload(currentResponse);
  if (!currentResponse.ok) {
    throw new Error(currentPayload?.error ?? errorMessage);
  }

  return (
    currentPayload.subscription?.sections?.map(
      (section: { id: number }) => section.id,
    ) ?? []
  );
}

export async function updateSubscriptionSectionIds(
  sectionIds: number[],
  errorMessage: string,
) {
  const updateResponse = await fetch("/api/calendar-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sectionIds }),
  });
  const updatePayload = await responsePayload(updateResponse);
  if (!updateResponse.ok) {
    throw new Error(updatePayload?.error ?? errorMessage);
  }
}

export async function parseSubscriptionResponse(response: Response) {
  return responsePayload(response);
}

type EventState = {
  name: string;
  location: string | null;
  status: string | null;
  sourceMissing: boolean;
  startAt: Date | null;
  endAt: Date | null;
  applyStartAt: Date | null;
  applyEndAt: Date | null;
};

export function youngEventState(event: EventState) {
  return JSON.stringify([
    event.name,
    event.location,
    event.status,
    // Placeholder for the dropped registrationStatus column. Keeping the tuple
    // shape stable means existing subscriptions are not all flagged as changed
    // once, which would push a false "event details changed" notification.
    null,
    event.sourceMissing,
    event.startAt,
    event.endAt,
    event.applyStartAt,
    event.applyEndAt,
  ]);
}

export function youngReminderCandidates(
  event: EventState,
  subscription: {
    createdAt: Date;
    remindSignup: boolean;
    remindDeadline: boolean;
    remindStart: boolean;
  },
  now: Date,
) {
  if (event.sourceMissing) return [];
  const candidates = [
    {
      kind: "signup_open",
      enabled: subscription.remindSignup,
      at: event.applyStartAt,
      lead: 0,
      end: event.applyEndAt,
      label: "报名已开始 / Registration opened",
    },
    {
      kind: "signup_deadline",
      enabled: subscription.remindDeadline,
      at: event.applyEndAt,
      lead: 24 * 60 * 60 * 1000,
      end: event.applyEndAt,
      label: "报名即将截止 / Registration closes soon",
    },
    {
      kind: "event_start",
      enabled: subscription.remindStart,
      at: event.startAt,
      lead: 60 * 60 * 1000,
      end: event.startAt,
      label: "活动即将开始 / Event starts soon",
    },
  ];
  return candidates.filter(
    (item) =>
      item.enabled &&
      item.at &&
      item.at.getTime() - item.lead <= now.getTime() &&
      (item.end
        ? item.end > now
        : now.getTime() - item.at.getTime() < 24 * 60 * 60 * 1000) &&
      (item.kind !== "signup_open" || item.at >= subscription.createdAt),
  );
}

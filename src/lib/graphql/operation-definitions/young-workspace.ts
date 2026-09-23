import { mutation, query } from "./helpers";

export const youngWorkspaceOperationDefinitions = [
  query({
    id: "workspace.young_event_subscription.list.v1",
    title: "youngEventSubscriptions",
    description: "Personal Young workspace capability: youngEventSubscriptions",
    document: `query YoungEventSubscriptions($page: PageInput) { workspace { youngEventSubscriptions(page: $page) { items { youngId createdAt remindSignup remindDeadline remindStart event { youngId name startAt endAt } } pageInfo { page pageSize total totalPages } } } }`,
    scopes: ["workspace.young-subscription:read"],
  }),
  query({
    id: "workspace.young_event_subscription.get.v1",
    title: "youngEventSubscription",
    description: "Personal Young workspace capability: youngEventSubscription",
    document: `query YoungEventSubscription($youngId: String!) { workspace { youngEventSubscription(youngId: $youngId) { youngId subscribed remindSignup remindDeadline remindStart } } }`,
    scopes: ["workspace.young-subscription:read"],
  }),
  query({
    id: "workspace.young_organizer_subscription.list.v1",
    title: "youngOrganizerSubscriptions",
    description:
      "Personal Young workspace capability: youngOrganizerSubscriptions",
    document: `query YoungOrganizerSubscriptions($page: PageInput) { workspace { youngOrganizerSubscriptions(page: $page) { items { organizerId createdAt organizer { id name } } pageInfo { page pageSize total totalPages } } } }`,
    scopes: ["workspace.young-subscription:read"],
  }),
  query({
    id: "workspace.young_organizer_subscription.get.v1",
    title: "youngOrganizerSubscription",
    description:
      "Personal Young workspace capability: youngOrganizerSubscription",
    document: `query YoungOrganizerSubscription($organizerId: ID!) { workspace { youngOrganizerSubscription(organizerId: $organizerId) { organizerId subscribed } } }`,
    scopes: ["workspace.young-subscription:read"],
  }),
  query({
    id: "workspace.young_notification.list.v1",
    title: "youngNotifications",
    description: "Personal Young workspace capability: youngNotifications",
    document: `query YoungNotifications($unread: Boolean, $page: PageInput) { workspace { youngNotifications(unread: $unread, page: $page) { items { id youngId organizerId kind title body createdAt readAt expiresAt } pageInfo { page pageSize total totalPages } } } }`,
    scopes: ["workspace.young-notification:read"],
  }),
  query({
    id: "workspace.calendar.events.list.v1",
    title: "calendarEvents",
    description: "Personal Young workspace capability: calendarEvents",
    document: `query CalendarEvents($dateFrom: String, $dateTo: String, $page: PageInput) { workspace { calendarEvents(dateFrom: $dateFrom, dateTo: $dateTo, page: $page) { items { id type at endsAt title location url youngId } pageInfo { page pageSize total totalPages } } } }`,
    scopes: ["workspace.calendar:read"],
  }),
  mutation({
    id: "workspace.young_event_subscription.set.v1",
    title: "youngEventSubscriptionSet",
    description:
      "Personal Young workspace capability: youngEventSubscriptionSet",
    document: `mutation YoungEventSubscriptionSet($youngId: String!, $input: YoungEventSubscriptionInput!) { youngEventSubscriptionSet(youngId: $youngId, input: $input) { youngId subscribed remindSignup remindDeadline remindStart } }`,
    scopes: ["workspace.young-subscription:write"],
    destructive: false,
    openWorld: false,
  }),
  mutation({
    id: "workspace.young_organizer_subscription.set.v1",
    title: "youngOrganizerSubscriptionSet",
    description:
      "Personal Young workspace capability: youngOrganizerSubscriptionSet",
    document: `mutation YoungOrganizerSubscriptionSet($organizerId: ID!, $subscribed: Boolean!) { youngOrganizerSubscriptionSet(organizerId: $organizerId, subscribed: $subscribed) { organizerId subscribed } }`,
    scopes: ["workspace.young-subscription:write"],
    destructive: false,
    openWorld: false,
  }),
  mutation({
    id: "workspace.young_notification.read.v1",
    title: "youngNotificationRead",
    description: "Personal Young workspace capability: youngNotificationRead",
    document: `mutation YoungNotificationRead($id: ID!) { youngNotificationRead(id: $id) { id success } }`,
    scopes: ["workspace.young-notification:write"],
    destructive: false,
    openWorld: false,
  }),
];

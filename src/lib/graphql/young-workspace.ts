import { GraphQLError } from "graphql";
import {
  InvalidCalendarRangeError,
  listPersonalCalendarPage,
} from "@/features/calendar/server/personal-calendar-page";
import {
  listYoungNotifications,
  readYoungNotification,
} from "@/features/young/server/young-notification-service";
import {
  getYoungEventSubscription,
  getYoungOrganizerSubscription,
  listYoungEventSubscriptions,
  listYoungOrganizerSubscriptions,
  setYoungEventSubscription,
  setYoungOrganizerSubscription,
  YoungSubscriptionNotFoundError,
} from "@/features/young/server/young-subscription-service";
import { youngEventSubscriptionRequestSchema } from "@/lib/api/schemas/young-workspace-schemas";
import { requireGraphqlScope } from "./auth";
import type { GraphqlContext } from "./context";
import { requireGraphqlMutation } from "./mutation-guard";
import {
  type GraphqlPageInput,
  graphqlPageResolvers,
  normalizeGraphqlPage,
} from "./pagination";

export const youngWorkspaceTypeDefs = /* GraphQL */ `
  type YoungEventSubscription { youngId: String!, createdAt: DateTime!, remindSignup: Boolean!, remindDeadline: Boolean!, remindStart: Boolean!, event: YoungEvent! }
  type YoungEventSubscriptionPage { items: [YoungEventSubscription!]!, pageInfo: PageInfo! }
  type YoungOrganizerReference { id: ID!, name: String! }
  type YoungOrganizerSubscription { organizerId: ID!, createdAt: DateTime!, organizer: YoungOrganizerReference! }
  type YoungOrganizerSubscriptionPage { items: [YoungOrganizerSubscription!]!, pageInfo: PageInfo! }
  type YoungEventSubscriptionState { youngId: String!, subscribed: Boolean!, remindSignup: Boolean!, remindDeadline: Boolean!, remindStart: Boolean! }
  type YoungOrganizerSubscriptionState { organizerId: ID!, subscribed: Boolean! }
  type YoungNotification { id: ID!, youngId: String, organizerId: ID, kind: String!, title: String!, body: String!, createdAt: DateTime!, readAt: DateTime, expiresAt: DateTime }
  type YoungNotificationPage { items: [YoungNotification!]!, pageInfo: PageInfo! }
  input YoungEventSubscriptionInput { subscribed: Boolean!, remindSignup: Boolean, remindDeadline: Boolean, remindStart: Boolean }
  type PersonalCalendarEvent { id: ID!, type: String!, at: DateTime, endsAt: DateTime, title: String!, location: String, url: String!, youngId: String }
  type PersonalCalendarEventPage { items: [PersonalCalendarEvent!]!, pageInfo: PageInfo! }
  extend type Workspace {
    calendarEvents(dateFrom: String, dateTo: String, page: PageInput): PersonalCalendarEventPage!
    youngEventSubscriptions(page: PageInput): YoungEventSubscriptionPage!
    youngEventSubscription(youngId: String!): YoungEventSubscriptionState!
    youngOrganizerSubscription(organizerId: ID!): YoungOrganizerSubscriptionState!
    youngOrganizerSubscriptions(page: PageInput): YoungOrganizerSubscriptionPage!
    youngNotifications(unread: Boolean = false, page: PageInput): YoungNotificationPage!
  }
  extend type Mutation {
    youngEventSubscriptionSet(youngId: String!, input: YoungEventSubscriptionInput!): YoungEventSubscriptionState!
    youngOrganizerSubscriptionSet(organizerId: ID!, subscribed: Boolean!): YoungOrganizerSubscriptionState!
    youngNotificationRead(id: ID!): DeleteMutationPayload!
  }
`;

function identifier(value: string) {
  const id = value.trim();
  if (!id || id.length > 200)
    throw new GraphQLError("Invalid identifier", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  return id;
}
const reader = (context: GraphqlContext, notifications = false) =>
  requireGraphqlScope(context.principal, {
    feature: notifications
      ? "workspace.young-notification"
      : "workspace.young-subscription",
    action: "read",
  }).userId;

export const youngWorkspaceResolvers = {
  youngOrganizerSubscription(
    _parent: unknown,
    args: { organizerId: string },
    context: GraphqlContext,
  ) {
    return getYoungOrganizerSubscription(
      reader(context),
      identifier(args.organizerId),
    );
  },
  async calendarEvents(
    _parent: unknown,
    args: { dateFrom?: string; dateTo?: string; page?: GraphqlPageInput },
    context: GraphqlContext,
  ) {
    const principal = requireGraphqlScope(context.principal, {
      feature: "workspace.calendar",
      action: "read",
    });
    try {
      return await listPersonalCalendarPage(principal.userId, {
        ...normalizeGraphqlPage(args.page),
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        locale: context.locale,
      });
    } catch (error) {
      if (error instanceof InvalidCalendarRangeError)
        throw new GraphQLError(error.message, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      throw error;
    }
  },
  youngEventSubscriptions(
    _parent: unknown,
    args: { page?: GraphqlPageInput },
    context: GraphqlContext,
  ) {
    return listYoungEventSubscriptions(
      reader(context),
      normalizeGraphqlPage(args.page),
    );
  },
  youngEventSubscription(
    _parent: unknown,
    args: { youngId: string },
    context: GraphqlContext,
  ) {
    return getYoungEventSubscription(reader(context), identifier(args.youngId));
  },
  youngOrganizerSubscriptions(
    _parent: unknown,
    args: { page?: GraphqlPageInput },
    context: GraphqlContext,
  ) {
    return listYoungOrganizerSubscriptions(
      reader(context),
      normalizeGraphqlPage(args.page),
    );
  },
  youngNotifications(
    _parent: unknown,
    args: { page?: GraphqlPageInput; unread?: boolean },
    context: GraphqlContext,
  ) {
    return listYoungNotifications(reader(context, true), {
      ...normalizeGraphqlPage(args.page),
      unread: args.unread,
    });
  },
};
async function subscriptionMutation<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof YoungSubscriptionNotFoundError)
      throw new GraphQLError(error.message, {
        extensions: { code: "NOT_FOUND" },
      });
    throw error;
  }
}
export const youngWorkspaceMutationResolvers = {
  async youngEventSubscriptionSet(
    _parent: unknown,
    args: {
      youngId: string;
      input: {
        subscribed: boolean;
        remindSignup?: boolean | null;
        remindDeadline?: boolean | null;
        remindStart?: boolean | null;
      };
    },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.young-subscription",
    );
    const input = youngEventSubscriptionRequestSchema.parse(
      Object.fromEntries(
        Object.entries(args.input).filter(([, value]) => value != null),
      ),
    );
    const { subscribed, ...settings } = input;
    return subscriptionMutation(() =>
      setYoungEventSubscription(
        principal.userId,
        identifier(args.youngId),
        subscribed,
        settings,
      ),
    );
  },
  async youngOrganizerSubscriptionSet(
    _parent: unknown,
    args: { organizerId: string; subscribed: boolean },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.young-subscription",
    );
    return subscriptionMutation(() =>
      setYoungOrganizerSubscription(
        principal.userId,
        identifier(args.organizerId),
        args.subscribed,
      ),
    );
  },
  async youngNotificationRead(
    _parent: unknown,
    args: { id: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.young-notification",
    );
    return readYoungNotification(principal.userId, identifier(args.id));
  },
};
export const youngWorkspacePageResolvers = {
  PersonalCalendarEventPage: graphqlPageResolvers,
  YoungEventSubscriptionPage: graphqlPageResolvers,
  YoungOrganizerSubscriptionPage: graphqlPageResolvers,
  YoungNotificationPage: graphqlPageResolvers,
};

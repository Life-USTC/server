import type { PersistedGraphqlOperationDefinition } from "../operation-types";
import { pageInfoFields, sectionFields, todoFields } from "./fragments";
import { mutation, query } from "./helpers";

export const workspaceGraphqlOperationDefinitions = [
  query({
    id: "workspace.overview.get.v1",
    title: "Get workspace overview",
    description:
      "Returns bounded personal workspace counts at an optional instant.",
    document: /* GraphQL */ `
      query WorkspaceOverview($atTime: DateTime) {
        workspace {
          overview(atTime: $atTime) {
            atTime
            today
            homeworkWindowEnd
            incompleteTodos
            completedTodos
            overdueTodos
            pendingHomeworks
            dueSoonHomeworks
            todaySchedules
            upcomingExams
          }
        }
      }
    `,
    scopes: ["workspace.overview:read"],
  }),
  query({
    id: "workspace.todo.list.v1",
    title: "List workspace todos",
    description:
      "Lists the authenticated workspace's todos with filters and bounded pagination.",
    document: /* GraphQL */ `
      query WorkspaceTodos($filter: TodoFilter, $page: PageInput) {
        workspace {
          todos(filter: $filter, page: $page) {
            items {
              ${todoFields}
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: ["workspace.todo:read"],
  }),
  query({
    id: "workspace.subscription.list.v1",
    title: "List workspace subscriptions",
    description:
      "Lists the authenticated workspace's subscribed sections with bounded pagination.",
    document: /* GraphQL */ `
      query WorkspaceSubscribedSections($page: PageInput) {
        workspace {
          subscribedSections(page: $page) {
            items {
              ${sectionFields}
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: ["workspace.subscription:read"],
  }),
  query({
    id: "workspace.homework.list.v1",
    title: "List workspace homeworks",
    description:
      "Lists the authenticated workspace's homeworks with filters and bounded pagination.",
    document: /* GraphQL */ `
      query WorkspaceHomeworks($filter: HomeworkFilter, $page: PageInput) {
        workspace {
          homeworks(filter: $filter, page: $page) {
            items {
              id
              title
              isMajor
              requiresTeam
              publishedAt
              submissionStartAt
              submissionDueAt
              createdAt
              updatedAt
              completed
              completedAt
              commentCount
              section {
                id
                jwId
                code
                course {
                  id
                  jwId
                  code
                  nameCn
                  nameEn
                }
              }
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: ["workspace.homework:read"],
  }),
  query({
    id: "workspace.schedule.list.v1",
    title: "List workspace schedules",
    description:
      "Lists the authenticated workspace's schedules with filters and bounded pagination.",
    document: /* GraphQL */ `
      query WorkspaceSchedules($filter: ScheduleFilter, $page: PageInput) {
        workspace {
          schedules(filter: $filter, page: $page) {
            items {
              id
              periods
              date
              weekday
              startTime
              endTime
              experiment
              customPlace
              lessonType
              weekIndex
              startUnit
              endUnit
              room {
                id
                jwId
                code
                nameCn
                nameEn
              }
              scheduleGroup {
                id
                jwId
                no
                isDefault
              }
              section {
                id
                jwId
                code
                course {
                  id
                  jwId
                  code
                  nameCn
                  nameEn
                }
              }
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: ["workspace.schedule:read"],
  }),
  query({
    id: "workspace.exam.list.v1",
    title: "List workspace exams",
    description:
      "Lists the authenticated workspace's exams with filters and bounded pagination.",
    document: /* GraphQL */ `
      query WorkspaceExams($filter: ExamFilter, $page: PageInput) {
        workspace {
          exams(filter: $filter, page: $page) {
            items {
              id
              jwId
              examType
              startTime
              endTime
              examDate
              examTakeCount
              examMode
              examBatch {
                id
                nameCn
                nameEn
              }
              examRooms(page: { pageSize: 10 }) {
                items {
                  id
                  room
                  count
                }
                pageInfo {
                  ${pageInfoFields}
                }
              }
              section {
                id
                jwId
                code
                course {
                  id
                  jwId
                  code
                  nameCn
                  nameEn
                }
              }
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: ["workspace.exam:read"],
  }),
  mutation({
    id: "workspace.todo.create.v1",
    title: "Create todo",
    description: "Creates a todo owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation TodoCreate($input: CreateTodoInput!) {
        todoCreate(input: $input) {
          id
        }
      }
    `,
    scopes: ["workspace.todo:write"],
    destructive: false,
    openWorld: false,
  }),
  mutation({
    id: "workspace.todo.update.v1",
    title: "Update todo",
    description: "Updates a todo owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation TodoUpdate($id: ID!, $input: UpdateTodoInput!) {
        todoUpdate(id: $id, input: $input) {
          id
        }
      }
    `,
    scopes: ["workspace.todo:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.todo.delete.v1",
    title: "Delete todo",
    description: "Deletes a todo owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation TodoDelete($id: ID!) {
        todoDelete(id: $id) {
          id
          success
        }
      }
    `,
    scopes: ["workspace.todo:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.todo.completions.set.v1",
    title: "Set todo completions in batch",
    description:
      "Sets completion state for up to 100 workspace-owned todos with per-item results.",
    document: /* GraphQL */ `
      mutation TodoSetCompletionsBatch(
        $items: [TodoCompletionBatchItemInput!]!
      ) {
        todoCompletionsSet(items: $items) {
          results {
            success
            todoId
            completed
            error {
              code
              message
            }
          }
        }
      }
    `,
    scopes: ["workspace.todo:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.todos.delete.v1",
    title: "Delete todos in batch",
    description:
      "Deletes up to 100 workspace-owned todos with per-item results.",
    document: /* GraphQL */ `
      mutation TodoDeleteBatch($ids: [ID!]!) {
        todosDelete(ids: $ids) {
          results {
            success
            id
            error {
              code
              message
            }
          }
        }
      }
    `,
    scopes: ["workspace.todo:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.homework.completion.set.v1",
    title: "Set homework completion",
    description:
      "Sets the authenticated workspace's personal completion state for homework.",
    document: /* GraphQL */ `
      mutation HomeworkSetCompletion(
        $homeworkId: ID!
        $completed: Boolean!
      ) {
        homeworkCompletionSet(
          homeworkId: $homeworkId
          completed: $completed
        ) {
          homeworkId
          completed
          completedAt
        }
      }
    `,
    scopes: ["workspace.homework:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.homework.completions.set.v1",
    title: "Set homework completions in batch",
    description:
      "Sets personal completion state for up to 100 homework items with per-item results.",
    document: /* GraphQL */ `
      mutation HomeworkSetCompletionsBatch(
        $items: [HomeworkCompletionBatchItemInput!]!
      ) {
        homeworkCompletionsSet(items: $items) {
          results {
            success
            homeworkId
            completed
            completedAt
            error {
              code
              message
            }
          }
        }
      }
    `,
    scopes: ["workspace.homework:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.subscription.add.v1",
    title: "Subscribe to section",
    description:
      "Subscribes the authenticated workspace to one teaching-system section.",
    document: /* GraphQL */ `
      mutation SubscriptionSubscribeSection($jwId: Int!) {
        subscriptionAdd(jwId: $jwId) {
          sectionJwId
          subscribed
        }
      }
    `,
    scopes: ["workspace.subscription:write"],
    destructive: false,
    openWorld: false,
  }),
  mutation({
    id: "workspace.subscription.remove.v1",
    title: "Unsubscribe from section",
    description:
      "Removes the authenticated workspace's subscription to one section.",
    document: /* GraphQL */ `
      mutation SubscriptionUnsubscribeSection($jwId: Int!) {
        subscriptionRemove(jwId: $jwId) {
          sectionJwId
          subscribed
        }
      }
    `,
    scopes: ["workspace.subscription:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.subscription.import.v1",
    title: "Update section subscriptions in batch",
    description:
      "Adds, removes, or replaces section subscriptions by public codes.",
    document: /* GraphQL */ `
      mutation SubscriptionUpdateSectionsBatch(
        $input: UpdateSectionSubscriptionsInput!
      ) {
        subscriptionsImport(input: $input) {
          action
          semesterId
          matchedCodes
          unmatchedCodes
          addedCount
          removedCount
          unchangedCount
          total
        }
      }
    `,
    scopes: ["workspace.subscription:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.link.pin.set.v1",
    title: "Set workspace link pin state",
    description: "Pins or unpins one catalog link for the workspace.",
    document: /* GraphQL */ `
      mutation WorkspaceSetLinkPinState($slug: String!, $pinned: Boolean!) {
        linkPinSet(slug: $slug, pinned: $pinned) {
          slug
          pinned
          pinnedSlugs
          maxPinnedLinks
        }
      }
    `,
    scopes: ["workspace.link-pin:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.link_pin.batch_set.v1",
    title: "Set workspace link pin states in batch",
    description:
      "Applies up to 10 workspace pin changes in order and returns the final pin state.",
    document: /* GraphQL */ `
      mutation WorkspaceSetLinkPinStatesBatch(
        $items: [WorkspaceLinkPinBatchItemInput!]!
      ) {
        linkPinsSet(items: $items) {
          pinnedSlugs
          maxPinnedLinks
        }
      }
    `,
    scopes: ["workspace.link-pin:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.bus_preferences.set.v1",
    title: "Save bus preferences",
    description: "Saves the authenticated workspace's campus bus preferences.",
    document: /* GraphQL */ `
      mutation BusSavePreferences($input: BusPreferenceInput!) {
        busPreferencesSet(input: $input) {
          preferredOriginCampusId
          preferredDestinationCampusId
          showDepartedTrips
        }
      }
    `,
    scopes: ["workspace.bus-preferences:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.upload.session.create.v1",
    title: "Create upload session",
    description:
      "Reserves quota and returns metadata for the authenticated on-site object upload workflow; bounded stale-session cleanup removes expired reservation rows only.",
    document: /* GraphQL */ `
      mutation UploadCreateSession($input: CreateUploadSessionInput!) {
        uploadSessionCreate(input: $input) {
          key
          url
          maxFileSizeBytes
          quotaBytes
          usedBytes
        }
      }
    `,
    scopes: ["workspace.upload:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "workspace.upload.complete.v1",
    title: "Complete upload",
    description:
      "Validates an already-uploaded R2 object and commits its owned metadata; failure leaves R2 lifecycle cleanup to the dedicated storage workflow.",
    document: /* GraphQL */ `
      mutation UploadComplete($input: CompleteUploadSessionInput!) {
        uploadSessionComplete(input: $input) {
          upload {
            id
            key
            filename
            size
            createdAt
          }
          usedBytes
          quotaBytes
        }
      }
    `,
    scopes: ["workspace.upload:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "workspace.upload.rename.v1",
    title: "Rename upload",
    description: "Renames one upload owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation UploadRename($id: ID!, $filename: String!) {
        uploadRename(id: $id, filename: $filename) {
          upload {
            id
            key
            filename
            size
            createdAt
          }
        }
      }
    `,
    scopes: ["workspace.upload:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.upload.delete.v1",
    title: "Delete upload",
    description:
      "Deletes one workspace-owned R2 object before transactionally deleting its metadata and recording the audit entry.",
    document: /* GraphQL */ `
      mutation UploadDelete($id: ID!) {
        uploadDelete(id: $id) {
          id
          success
          deletedSize
        }
      }
    `,
    scopes: ["workspace.upload:write"],
    destructive: true,
    openWorld: true,
  }),
] as const satisfies readonly PersistedGraphqlOperationDefinition[];

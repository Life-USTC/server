import type { PersistedGraphqlOperationDefinition } from "./operations";

type QueryDefinitionInput = Omit<
  PersistedGraphqlOperationDefinition,
  "destructive" | "openWorld" | "readOnly" | "requiresConfirmation"
>;

type MutationDefinitionInput = Omit<
  PersistedGraphqlOperationDefinition,
  "readOnly" | "requiresConfirmation"
>;

function query(
  input: QueryDefinitionInput,
): PersistedGraphqlOperationDefinition {
  return {
    ...input,
    destructive: false,
    openWorld: false,
    readOnly: true,
    requiresConfirmation: false,
  };
}

function mutation(
  input: MutationDefinitionInput,
): PersistedGraphqlOperationDefinition {
  return {
    ...input,
    readOnly: false,
    requiresConfirmation: true,
  };
}

const pageInfoFields = /* GraphQL */ `
  page
  pageSize
  total
  totalPages
`;

const semesterFields = /* GraphQL */ `
  id
  jwId
  code
  nameCn
  startDate
  endDate
`;

const courseFields = /* GraphQL */ `
  id
  jwId
  code
  nameCn
  nameEn
  category {
    id
    nameCn
    nameEn
  }
  classType {
    id
    nameCn
    nameEn
  }
  educationLevel {
    id
    nameCn
    nameEn
  }
`;

const sectionFields = /* GraphQL */ `
  id
  jwId
  code
  credits
  period
  periodsPerWeek
  timesPerWeek
  stdCount
  limitCount
  remark
  course {
    id
    jwId
    code
    nameCn
    nameEn
  }
  semester {
    ${semesterFields}
  }
  campus {
    id
    jwId
    code
    nameCn
    nameEn
  }
  openDepartment {
    id
    code
    nameCn
    nameEn
  }
`;

const teacherFields = /* GraphQL */ `
  id
  personId
  teacherId
  code
  nameCn
  nameEn
  email
  telephone
  mobile
  address
  department {
    id
    code
    nameCn
    nameEn
  }
  teacherTitle {
    id
    nameCn
    nameEn
  }
  sectionCount
`;

const busRouteFields = /* GraphQL */ `
  id
  nameCn
  nameEn
  descriptionPrimary
  stops {
    stopOrder
    campusId
    campusName
  }
`;

const todoFields = /* GraphQL */ `
  id
  title
  content
  priority
  completed
  dueAt
  createdAt
  updatedAt
`;

export const persistedGraphqlOperationDefinitions = [
  query({
    id: "catalog.semester.list.v1",
    title: "List semesters",
    description: "Lists the public semester catalog with bounded pagination.",
    document: /* GraphQL */ `
      query CatalogSemesters($page: PageInput) {
        catalog {
          semesters(page: $page) {
            items {
              ${semesterFields}
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.semester.current.get.v1",
    title: "Get current semester",
    description: "Returns the current public semester, when configured.",
    document: /* GraphQL */ `
      query CatalogCurrentSemester {
        catalog {
          currentSemester {
            ${semesterFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.course.search.v1",
    title: "Search courses",
    description:
      "Searches the public course catalog with filters and bounded pagination.",
    document: /* GraphQL */ `
      query CatalogCourses($page: PageInput, $filter: CourseFilter) {
        catalog {
          courses(page: $page, filter: $filter) {
            items {
              ${courseFields}
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.course.get.v1",
    title: "Get course",
    description: "Returns one public course by its teaching-system ID.",
    document: /* GraphQL */ `
      query CatalogCourse($jwId: Int!) {
        catalog {
          course(jwId: $jwId) {
            ${courseFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.section.search.v1",
    title: "Search sections",
    description:
      "Searches public course sections with filters and bounded pagination.",
    document: /* GraphQL */ `
      query CatalogSections($page: PageInput, $filter: SectionFilter) {
        catalog {
          sections(page: $page, filter: $filter) {
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
    scopes: [],
  }),
  query({
    id: "catalog.section.get.v1",
    title: "Get section",
    description: "Returns one public section by its teaching-system ID.",
    document: /* GraphQL */ `
      query CatalogSection($jwId: Int!) {
        catalog {
          section(jwId: $jwId) {
            ${sectionFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.teacher.search.v1",
    title: "Search teachers",
    description:
      "Searches the public teacher catalog with filters and bounded pagination.",
    document: /* GraphQL */ `
      query CatalogTeachers($page: PageInput, $filter: TeacherFilter) {
        catalog {
          teachers(page: $page, filter: $filter) {
            items {
              ${teacherFields}
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.teacher.get.v1",
    title: "Get teacher",
    description: "Returns one public teacher by internal numeric ID.",
    document: /* GraphQL */ `
      query CatalogTeacher($id: Int!) {
        catalog {
          teacher(id: $id) {
            ${teacherFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.bus.route.list.v1",
    title: "List bus routes",
    description: "Lists public campus bus routes with bounded pagination.",
    document: /* GraphQL */ `
      query BusRoutes($page: PageInput) {
        catalog {
          busRoutes(page: $page) {
            items {
              ${busRouteFields}
            }
            campuses {
              id
              nameCn
              nameEn
              namePrimary
              nameSecondary
              latitude
              longitude
            }
            pageInfo {
              ${pageInfoFields}
            }
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.bus.timetable.get.v1",
    title: "Get bus timetable",
    description:
      "Returns a public route timetable for an optional version and instant.",
    document: /* GraphQL */ `
      query BusTimetable(
        $routeId: Int!
        $page: PageInput
        $now: DateTime
        $versionKey: String
      ) {
        catalog {
          busTimetable(
            routeId: $routeId
            page: $page
            now: $now
            versionKey: $versionKey
          ) {
            route {
              ${busRouteFields}
            }
            weekday {
              position
              stopTimes {
                stopOrder
                time
              }
            }
            weekend {
              position
              stopTimes {
                stopOrder
                time
              }
            }
            weekdayPageInfo {
              ${pageInfoFields}
            }
            weekendPageInfo {
              ${pageInfoFields}
            }
            alternateRoutes {
              ${busRouteFields}
            }
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "account.profile.get.v1",
    title: "Get account profile",
    description: "Returns the current account's private profile.",
    document: /* GraphQL */ `
      query AccountProfile {
        account {
          profile {
            id
            email
            username
            name
            image
            isAdmin
            createdAt
            updatedAt
          }
        }
      }
    `,
    scopes: ["me:read"],
  }),
  query({
    id: "community.user.get.v1",
    title: "Get community user",
    description: "Returns one public community identity by username.",
    document: /* GraphQL */ `
      query CommunityUser($username: String!) {
        community {
          user(username: $username) {
            id
            username
            name
            image
            createdAt
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "workspace.overview.get.v1",
    title: "Get workspace overview",
    description:
      "Returns bounded personal dashboard counts at an optional instant.",
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
    scopes: ["dashboard:read"],
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
    scopes: ["todo:read"],
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
    scopes: ["subscription:read"],
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
    scopes: ["homework:read"],
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
    scopes: ["schedule:read"],
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
    scopes: ["exam:read"],
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
    scopes: ["todo:write"],
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
    scopes: ["todo:write"],
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
    scopes: ["todo:write"],
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
    scopes: ["todo:write"],
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
    scopes: ["todo:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "community.section_homework.create.v1",
    title: "Create homework",
    description: "Creates collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkCreate($input: CreateHomeworkInput!) {
        homeworkCreate(input: $input) {
          id
          homework {
            id
            title
            isMajor
            requiresTeam
            publishedAt
            submissionStartAt
            submissionDueAt
            createdAt
            updatedAt
            commentCount
            section {
              id
              jwId
              code
            }
          }
        }
      }
    `,
    scopes: ["homework:write"],
    destructive: false,
    openWorld: true,
  }),
  mutation({
    id: "community.section_homework.update.v1",
    title: "Update homework",
    description: "Updates collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkUpdate($id: ID!, $input: UpdateHomeworkInput!) {
        homeworkUpdate(id: $id, input: $input) {
          id
          homework {
            id
            title
            isMajor
            requiresTeam
            publishedAt
            submissionStartAt
            submissionDueAt
            createdAt
            updatedAt
            commentCount
            section {
              id
              jwId
              code
            }
          }
        }
      }
    `,
    scopes: ["homework:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.section_homework.delete.v1",
    title: "Delete homework",
    description: "Soft-deletes collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkDelete($id: ID!) {
        homeworkDelete(id: $id) {
          id
          success
          alreadyDeleted
        }
      }
    `,
    scopes: ["homework:write"],
    destructive: true,
    openWorld: true,
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
    scopes: ["homework:write"],
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
    scopes: ["homework:write"],
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
    scopes: ["subscription:write"],
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
    scopes: ["subscription:write"],
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
    scopes: ["subscription:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.link.pin.set.v1",
    title: "Set dashboard link pin state",
    description: "Pins or unpins one dashboard link for the workspace.",
    document: /* GraphQL */ `
      mutation DashboardSetLinkPinState($slug: String!, $pinned: Boolean!) {
        linkPinSet(slug: $slug, pinned: $pinned) {
          slug
          pinned
          pinnedSlugs
          maxPinnedLinks
        }
      }
    `,
    scopes: ["dashboard:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "workspace.link.pins.set.v1",
    title: "Set dashboard link pin states in batch",
    description:
      "Applies up to 10 workspace pin changes in order and returns the final pin state.",
    document: /* GraphQL */ `
      mutation DashboardSetLinkPinStatesBatch(
        $items: [DashboardLinkPinBatchItemInput!]!
      ) {
        linkPinsSet(items: $items) {
          pinnedSlugs
          maxPinnedLinks
        }
      }
    `,
    scopes: ["dashboard:write"],
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
    scopes: ["bus:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "community.description.set.v1",
    title: "Upsert description",
    description: "Creates or updates collaborative object description text.",
    document: /* GraphQL */ `
      mutation DescriptionUpsert($input: UpsertDescriptionInput!) {
        descriptionSet(input: $input) {
          id
          updated
        }
      }
    `,
    scopes: ["description:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.create.v1",
    title: "Create comment",
    description: "Creates a collaborative comment or reply.",
    document: /* GraphQL */ `
      mutation CommentCreate($input: CreateCommentInput!) {
        commentCreate(input: $input) {
          id
        }
      }
    `,
    scopes: ["comment:write"],
    destructive: false,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.update.v1",
    title: "Update comment",
    description: "Updates a comment owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation CommentUpdate($id: ID!, $input: UpdateCommentInput!) {
        commentUpdate(id: $id, input: $input) {
          id
        }
      }
    `,
    scopes: ["comment:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.delete.v1",
    title: "Delete comment",
    description: "Deletes a comment owned by the authenticated workspace.",
    document: /* GraphQL */ `
      mutation CommentDelete($id: ID!) {
        commentDelete(id: $id) {
          id
          success
        }
      }
    `,
    scopes: ["comment:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comments.delete.v1",
    title: "Delete comments in batch",
    description:
      "Deletes up to 50 workspace-owned comments with stable per-item results.",
    document: /* GraphQL */ `
      mutation CommentDeleteBatch($ids: [ID!]!) {
        commentsDelete(ids: $ids) {
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
    scopes: ["comment:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.reaction.add.v1",
    title: "Add comment reaction",
    description: "Adds the workspace's reaction to a visible comment.",
    document: /* GraphQL */ `
      mutation CommentAddReaction(
        $commentId: ID!
        $type: CommentReactionType!
      ) {
        commentReactionAdd(commentId: $commentId, type: $type) {
          commentId
          type
          active
          changed
        }
      }
    `,
    scopes: ["comment:write"],
    destructive: false,
    openWorld: true,
  }),
  mutation({
    id: "community.comment.reaction.remove.v1",
    title: "Remove comment reaction",
    description: "Removes the workspace's reaction from a visible comment.",
    document: /* GraphQL */ `
      mutation CommentRemoveReaction(
        $commentId: ID!
        $type: CommentReactionType!
      ) {
        commentReactionRemove(commentId: $commentId, type: $type) {
          commentId
          type
          active
          changed
        }
      }
    `,
    scopes: ["comment:write"],
    destructive: true,
    openWorld: true,
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
    scopes: ["upload:write"],
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
    scopes: ["upload:write"],
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
    scopes: ["upload:write"],
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
    scopes: ["upload:write"],
    destructive: true,
    openWorld: true,
  }),
] as const satisfies readonly PersistedGraphqlOperationDefinition[];

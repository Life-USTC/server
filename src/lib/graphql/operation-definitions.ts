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
    id: "catalog.semesters.v1",
    title: "List semesters",
    description: "Lists the public semester catalog with bounded pagination.",
    document: /* GraphQL */ `
      query CatalogSemesters($page: PageInput) {
        semesters(page: $page) {
          items {
            ${semesterFields}
          }
          pageInfo {
            ${pageInfoFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.current_semester.v1",
    title: "Get current semester",
    description: "Returns the current public semester, when configured.",
    document: /* GraphQL */ `
      query CatalogCurrentSemester {
        currentSemester {
          ${semesterFields}
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.courses.v1",
    title: "Search courses",
    description:
      "Searches the public course catalog with filters and bounded pagination.",
    document: /* GraphQL */ `
      query CatalogCourses($page: PageInput, $filter: CourseFilter) {
        courses(page: $page, filter: $filter) {
          items {
            ${courseFields}
          }
          pageInfo {
            ${pageInfoFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.course.v1",
    title: "Get course",
    description: "Returns one public course by its teaching-system ID.",
    document: /* GraphQL */ `
      query CatalogCourse($jwId: Int!) {
        course(jwId: $jwId) {
          ${courseFields}
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.sections.v1",
    title: "Search sections",
    description:
      "Searches public course sections with filters and bounded pagination.",
    document: /* GraphQL */ `
      query CatalogSections($page: PageInput, $filter: SectionFilter) {
        sections(page: $page, filter: $filter) {
          items {
            ${sectionFields}
          }
          pageInfo {
            ${pageInfoFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.section.v1",
    title: "Get section",
    description: "Returns one public section by its teaching-system ID.",
    document: /* GraphQL */ `
      query CatalogSection($jwId: Int!) {
        section(jwId: $jwId) {
          ${sectionFields}
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.teachers.v1",
    title: "Search teachers",
    description:
      "Searches the public teacher catalog with filters and bounded pagination.",
    document: /* GraphQL */ `
      query CatalogTeachers($page: PageInput, $filter: TeacherFilter) {
        teachers(page: $page, filter: $filter) {
          items {
            ${teacherFields}
          }
          pageInfo {
            ${pageInfoFields}
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.teacher.v1",
    title: "Get teacher",
    description: "Returns one public teacher by internal numeric ID.",
    document: /* GraphQL */ `
      query CatalogTeacher($id: Int!) {
        teacher(id: $id) {
          ${teacherFields}
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "bus.routes.v1",
    title: "List bus routes",
    description: "Lists public campus bus routes with bounded pagination.",
    document: /* GraphQL */ `
      query BusRoutes($page: PageInput) {
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
    `,
    scopes: [],
  }),
  query({
    id: "bus.timetable.v1",
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
    `,
    scopes: [],
  }),
  query({
    id: "viewer.profile.v1",
    title: "Get viewer profile",
    description: "Returns the authenticated viewer's private profile.",
    document: /* GraphQL */ `
      query ViewerProfile {
        viewer {
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
    id: "viewer.overview.v1",
    title: "Get viewer overview",
    description:
      "Returns bounded personal dashboard counts at an optional instant.",
    document: /* GraphQL */ `
      query ViewerOverview($atTime: DateTime) {
        viewer {
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
    id: "viewer.todos.v1",
    title: "List viewer todos",
    description:
      "Lists the authenticated viewer's todos with filters and bounded pagination.",
    document: /* GraphQL */ `
      query ViewerTodos($filter: TodoFilter, $page: PageInput) {
        viewer {
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
    id: "viewer.subscribed_sections.v1",
    title: "List viewer subscriptions",
    description:
      "Lists the authenticated viewer's subscribed sections with bounded pagination.",
    document: /* GraphQL */ `
      query ViewerSubscribedSections($page: PageInput) {
        viewer {
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
    id: "viewer.homeworks.v1",
    title: "List viewer homeworks",
    description:
      "Lists the authenticated viewer's homeworks with filters and bounded pagination.",
    document: /* GraphQL */ `
      query ViewerHomeworks($filter: HomeworkFilter, $page: PageInput) {
        viewer {
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
    id: "viewer.schedules.v1",
    title: "List viewer schedules",
    description:
      "Lists the authenticated viewer's schedules with filters and bounded pagination.",
    document: /* GraphQL */ `
      query ViewerSchedules($filter: ScheduleFilter, $page: PageInput) {
        viewer {
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
    id: "viewer.exams.v1",
    title: "List viewer exams",
    description:
      "Lists the authenticated viewer's exams with filters and bounded pagination.",
    document: /* GraphQL */ `
      query ViewerExams($filter: ExamFilter, $page: PageInput) {
        viewer {
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
    id: "todo.create.v1",
    title: "Create todo",
    description: "Creates a todo owned by the authenticated viewer.",
    document: /* GraphQL */ `
      mutation TodoCreate($input: CreateTodoInput!) {
        createTodo(input: $input) {
          id
        }
      }
    `,
    scopes: ["todo:write"],
    destructive: false,
    openWorld: false,
  }),
  mutation({
    id: "todo.update.v1",
    title: "Update todo",
    description: "Updates a todo owned by the authenticated viewer.",
    document: /* GraphQL */ `
      mutation TodoUpdate($id: ID!, $input: UpdateTodoInput!) {
        updateTodo(id: $id, input: $input) {
          id
        }
      }
    `,
    scopes: ["todo:write"],
    destructive: true,
    openWorld: false,
  }),
  mutation({
    id: "todo.delete.v1",
    title: "Delete todo",
    description: "Deletes a todo owned by the authenticated viewer.",
    document: /* GraphQL */ `
      mutation TodoDelete($id: ID!) {
        deleteTodo(id: $id) {
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
    id: "todo.set_completions_batch.v1",
    title: "Set todo completions in batch",
    description:
      "Sets completion state for up to 100 viewer-owned todos with per-item results.",
    document: /* GraphQL */ `
      mutation TodoSetCompletionsBatch(
        $items: [TodoCompletionBatchItemInput!]!
      ) {
        setTodoCompletions(items: $items) {
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
    id: "todo.delete_batch.v1",
    title: "Delete todos in batch",
    description: "Deletes up to 100 viewer-owned todos with per-item results.",
    document: /* GraphQL */ `
      mutation TodoDeleteBatch($ids: [ID!]!) {
        deleteTodos(ids: $ids) {
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
    id: "homework.create.v1",
    title: "Create homework",
    description: "Creates collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkCreate($input: CreateHomeworkInput!) {
        createHomework(input: $input) {
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
    id: "homework.update.v1",
    title: "Update homework",
    description: "Updates collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkUpdate($id: ID!, $input: UpdateHomeworkInput!) {
        updateHomework(id: $id, input: $input) {
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
    id: "homework.delete.v1",
    title: "Delete homework",
    description: "Soft-deletes collaborative homework on a section.",
    document: /* GraphQL */ `
      mutation HomeworkDelete($id: ID!) {
        deleteHomework(id: $id) {
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
    id: "homework.set_completion.v1",
    title: "Set homework completion",
    description:
      "Sets the authenticated viewer's personal completion state for homework.",
    document: /* GraphQL */ `
      mutation HomeworkSetCompletion(
        $homeworkId: ID!
        $completed: Boolean!
      ) {
        setHomeworkCompletion(
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
    id: "homework.set_completions_batch.v1",
    title: "Set homework completions in batch",
    description:
      "Sets personal completion state for up to 100 homework items with per-item results.",
    document: /* GraphQL */ `
      mutation HomeworkSetCompletionsBatch(
        $items: [HomeworkCompletionBatchItemInput!]!
      ) {
        setHomeworkCompletions(items: $items) {
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
    id: "subscription.subscribe_section.v1",
    title: "Subscribe to section",
    description:
      "Subscribes the authenticated viewer to one teaching-system section.",
    document: /* GraphQL */ `
      mutation SubscriptionSubscribeSection($jwId: Int!) {
        subscribeSection(jwId: $jwId) {
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
    id: "subscription.unsubscribe_section.v1",
    title: "Unsubscribe from section",
    description:
      "Removes the authenticated viewer's subscription to one section.",
    document: /* GraphQL */ `
      mutation SubscriptionUnsubscribeSection($jwId: Int!) {
        unsubscribeSection(jwId: $jwId) {
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
    id: "subscription.update_sections_batch.v1",
    title: "Update section subscriptions in batch",
    description:
      "Adds, removes, or replaces section subscriptions by public codes.",
    document: /* GraphQL */ `
      mutation SubscriptionUpdateSectionsBatch(
        $input: UpdateSectionSubscriptionsInput!
      ) {
        updateSectionSubscriptions(input: $input) {
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
    id: "dashboard.set_link_pin_state.v1",
    title: "Set dashboard link pin state",
    description: "Pins or unpins one dashboard link for the viewer.",
    document: /* GraphQL */ `
      mutation DashboardSetLinkPinState($slug: String!, $pinned: Boolean!) {
        setDashboardLinkPinState(slug: $slug, pinned: $pinned) {
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
    id: "dashboard.set_link_pin_states_batch.v1",
    title: "Set dashboard link pin states in batch",
    description:
      "Applies up to 10 viewer dashboard pin changes in order and returns the final pin state.",
    document: /* GraphQL */ `
      mutation DashboardSetLinkPinStatesBatch(
        $items: [DashboardLinkPinBatchItemInput!]!
      ) {
        setDashboardLinkPinStates(items: $items) {
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
    id: "bus.save_preferences.v1",
    title: "Save bus preferences",
    description: "Saves the authenticated viewer's campus bus preferences.",
    document: /* GraphQL */ `
      mutation BusSavePreferences($input: BusPreferenceInput!) {
        saveBusPreferences(input: $input) {
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
    id: "description.upsert.v1",
    title: "Upsert description",
    description: "Creates or updates collaborative object description text.",
    document: /* GraphQL */ `
      mutation DescriptionUpsert($input: UpsertDescriptionInput!) {
        upsertDescription(input: $input) {
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
    id: "comment.create.v1",
    title: "Create comment",
    description: "Creates a collaborative comment or reply.",
    document: /* GraphQL */ `
      mutation CommentCreate($input: CreateCommentInput!) {
        createComment(input: $input) {
          id
        }
      }
    `,
    scopes: ["comment:write"],
    destructive: false,
    openWorld: true,
  }),
  mutation({
    id: "comment.update.v1",
    title: "Update comment",
    description: "Updates a comment owned by the authenticated viewer.",
    document: /* GraphQL */ `
      mutation CommentUpdate($id: ID!, $input: UpdateCommentInput!) {
        updateComment(id: $id, input: $input) {
          id
        }
      }
    `,
    scopes: ["comment:write"],
    destructive: true,
    openWorld: true,
  }),
  mutation({
    id: "comment.delete.v1",
    title: "Delete comment",
    description: "Deletes a comment owned by the authenticated viewer.",
    document: /* GraphQL */ `
      mutation CommentDelete($id: ID!) {
        deleteComment(id: $id) {
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
    id: "comment.delete_batch.v1",
    title: "Delete comments in batch",
    description:
      "Deletes up to 50 viewer-owned comments with stable per-item results.",
    document: /* GraphQL */ `
      mutation CommentDeleteBatch($ids: [ID!]!) {
        deleteComments(ids: $ids) {
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
    id: "comment.add_reaction.v1",
    title: "Add comment reaction",
    description: "Adds the viewer's reaction to a visible comment.",
    document: /* GraphQL */ `
      mutation CommentAddReaction(
        $commentId: ID!
        $type: CommentReactionType!
      ) {
        addCommentReaction(commentId: $commentId, type: $type) {
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
    id: "comment.remove_reaction.v1",
    title: "Remove comment reaction",
    description: "Removes the viewer's reaction from a visible comment.",
    document: /* GraphQL */ `
      mutation CommentRemoveReaction(
        $commentId: ID!
        $type: CommentReactionType!
      ) {
        removeCommentReaction(commentId: $commentId, type: $type) {
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
    id: "upload.create_session.v1",
    title: "Create upload session",
    description:
      "Reserves quota and returns metadata for the authenticated on-site object upload workflow; bounded stale-session cleanup removes expired reservation rows only.",
    document: /* GraphQL */ `
      mutation UploadCreateSession($input: CreateUploadSessionInput!) {
        createUploadSession(input: $input) {
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
    id: "upload.complete.v1",
    title: "Complete upload",
    description:
      "Validates an already-uploaded R2 object and commits its owned metadata; failure leaves R2 lifecycle cleanup to the dedicated storage workflow.",
    document: /* GraphQL */ `
      mutation UploadComplete($input: CompleteUploadSessionInput!) {
        completeUploadSession(input: $input) {
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
    id: "upload.rename.v1",
    title: "Rename upload",
    description: "Renames one upload owned by the authenticated viewer.",
    document: /* GraphQL */ `
      mutation UploadRename($id: ID!, $filename: String!) {
        renameUpload(id: $id, filename: $filename) {
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
    id: "upload.delete.v1",
    title: "Delete upload",
    description:
      "Deletes one viewer-owned R2 object before transactionally deleting its metadata and recording the audit entry.",
    document: /* GraphQL */ `
      mutation UploadDelete($id: ID!) {
        deleteUpload(id: $id) {
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

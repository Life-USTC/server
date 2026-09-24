import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import {
  getBusRouteTimetable,
  listBusRoutes,
} from "@/features/bus/server/bus-catalog";
import {
  getCachedCurrentSemester,
  listSemesters,
} from "@/features/catalog/server/academic-metadata-read-model";
import { listCourseSummaries } from "@/features/catalog/server/course-summary-read-model";
import { listSections } from "@/features/catalog/server/section-summary-read-model";
import { listTeacherSummaries } from "@/features/catalog/server/teacher-summary-read-model";
import {
  linkMatchesTokens,
  searchQueryToTokens,
} from "@/features/catalog-links/lib/catalog-link-search";
import { getPublicCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import { getPublicUserIdentityByIdentifier } from "@/features/profile/server/user-profile-page-data";
import { getRoomMap } from "@/features/rooms/server/room-map-service";
import { getWeatherSnapshot } from "@/features/weather/server/weather-service";
import {
  getYoungEvent,
  getYoungOrganizer,
  listYoungEvents,
  listYoungOrganizers,
} from "@/features/young/server/young-event-service";
import {
  capGraphqlAlternateRoutes,
  capGraphqlBusCampuses,
  capGraphqlBusRoute,
  capGraphqlBusTripSlots,
} from "./bus-output";
import type { GraphqlContext, GraphqlServerContext } from "./context";
import { graphqlDateScalar, graphqlDateTimeScalar } from "./date-scalar";
import {
  GRAPHQL_FEATURE_RESOLVER_MAPPINGS,
  observeGraphqlResolverMap,
} from "./feature-observability";
import {
  requireGraphqlId,
  requireGraphqlYoungEventId,
  requireGraphqlYoungOrganizerId,
  validateGraphqlIdList,
  validateGraphqlRoomCode,
  validateGraphqlSearch,
  validateGraphqlTeacherCode,
  validateGraphqlVersionKey,
  validateGraphqlWeatherLocationKey,
  validateGraphqlYoungDate,
  validateOptionalGraphqlId,
} from "./input-boundaries";
import { graphqlMutationResolvers, graphqlMutationTypeDefs } from "./mutations";
import {
  type GraphqlPageInput,
  graphqlPageResolvers,
  normalizeGraphqlPage,
  paginateGraphqlArray,
} from "./pagination";
import {
  graphqlAuthenticatedScopeResolver,
  graphqlScopeResolvers,
  graphqlScopeTypeDefs,
} from "./workspace";
import {
  youngWorkspaceMutationResolvers,
  youngWorkspacePageResolvers,
  youngWorkspaceResolvers,
  youngWorkspaceTypeDefs,
} from "./young-workspace";

type TeacherParent = {
  id: number;
  _count?: { sections?: number };
};

export const graphqlTypeDefs = /* GraphQL */ `
  scalar Date
  scalar DateTime

  input PageInput {
    page: Int = 1
    pageSize: Int = 20
  }

  input CourseFilter {
    search: String
    educationLevelId: Int
    categoryId: Int
    classTypeId: Int
  }

  input SectionFilter {
    courseId: Int
    courseJwId: Int
    semesterId: Int
    semesterJwId: Int
    campusId: Int
    departmentId: Int
    teacherId: Int
    teacherCode: String
    ids: [Int!]
    jwIds: [Int!]
    search: String
  }

  input TeacherFilter {
    departmentId: Int
    search: String
  }

  type PageInfo {
    page: Int!
    pageSize: Int!
    total: Int!
    totalPages: Int!
  }

  type NamedCatalogValue {
    id: Int!
    nameCn: String!
    nameEn: String
  }

  type Department {
    id: Int!
    code: String!
    nameCn: String!
    nameEn: String
  }

  type Campus {
    id: Int!
    jwId: Int!
    code: String
    nameCn: String!
    nameEn: String
  }

  type Semester {
    id: Int!
    jwId: Int!
    code: String!
    nameCn: String!
    startDate: Date
    endDate: Date
  }

  type Course {
    id: Int!
    jwId: Int!
    code: String!
    nameCn: String!
    nameEn: String
    category: NamedCatalogValue
    classType: NamedCatalogValue
    classify: NamedCatalogValue
    educationLevel: NamedCatalogValue
    gradation: NamedCatalogValue
    type: NamedCatalogValue
  }

  type Section {
    id: Int!
    jwId: Int!
    code: String!
    credits: Float
    period: Int
    periodsPerWeek: Float
    timesPerWeek: Int
    stdCount: Int
    limitCount: Int
    remark: String
    course: Course!
    semester: Semester
    campus: Campus
    openDepartment: Department
    examMode: NamedCatalogValue
    teachLanguage: NamedCatalogValue
  }

  type Teacher {
    id: Int!
    jwId: Int!
    personId: Int
    code: String
    nameCn: String!
    nameEn: String
    email: String
    telephone: String
    mobile: String
    address: String
    department: Department
    teacherTitle: NamedCatalogValue
    sectionCount: Int!
  }

  type SemesterPage {
    items: [Semester!]!
    pageInfo: PageInfo!
  }

  type CoursePage {
    items: [Course!]!
    pageInfo: PageInfo!
  }

  type SectionPage {
    items: [Section!]!
    pageInfo: PageInfo!
  }

  type TeacherPage {
    items: [Teacher!]!
    pageInfo: PageInfo!
  }

  input YoungEventFilter {
    dateUnknown: Boolean
    active: Boolean
    category: String
    module: String
    activityLevel: String
    search: String
    organizerId: String
    dateFrom: String
    dateTo: String
    timeBasis: YoungEventTimeBasis
  }

  enum YoungEventTimeBasis {
    activity
    registration
  }

  enum YoungSourceStatus {
    fresh
    stale
    unknown
  }

  type YoungEventPlace {
    placeInfo: String
    placeSt: String
    placeEt: String
  }

  type YoungEvent {
    youngId: String!
    name: String!
    category: String
    department: String
    organizer: String
    organizerId: String
    status: String
    activityStatusCode: String
    signupStatusCode: String
    requiresSignup: Boolean
    categoryCode: String
    moduleCode: String
    formCode: String
    activityLevelCode: String
    departmentId: String
    upstreamOrganizerIds: [String!]!
    upstreamSponsorIds: [String!]!
    tagIds: [String!]!
    signupScopeCode: String
    signupDepartmentIds: [String!]!
    requiresSignupInfo: Boolean
    allowedAttachmentTypes: [String!]!
    isOnline: Boolean
    onlineMeetingInfo: String
    externalSponsor: String
    location: String
    imageUrl: String
    hours: Float
    capacity: Int
    appliedCount: Int
    startAt: DateTime
    endAt: DateTime
    applyStartAt: DateTime
    applyEndAt: DateTime
    isActive: Boolean!
    sourceMissing: Boolean!
    lastSeenAt: DateTime
    createdAt: DateTime
    activityLevel: String
    module: String
    form: String
    grades: String
    sponsor: String
    contactName: String
    contactTel: String
    duration: Float
    serviceHour: Float
    sumHours: Float
    sumPersons: Int
    partakeNum: Int
    favCount: Int
    limitNum: Int
    createdAtUpstream: DateTime
    auditedAt: DateTime
    updatedAtUpstream: DateTime
    places: [YoungEventPlace!]
    """
    Sanitized upstream rich text. Only populated by the single-event query.
    """
    description: String
    participationNotes: String
    """
    The complete upstream record as a JSON string. Only populated by the
    single-event query.
    """
    rawJson: String
  }

  type YoungSourceFreshness {
    status: YoungSourceStatus!
    lastSyncedAt: DateTime
  }

  type YoungEventPage {
    items: [YoungEvent!]!
    unknownDateCount: Int!
    source: YoungSourceFreshness!
    pageInfo: PageInfo!
  }

  type YoungOrganizer {
    id: String!
    name: String!
    normalizedName: String!
    totalCount: Int!
    activeCount: Int!
    upcomingCount: Int!
    historyCount: Int!
  }

  type YoungOrganizerPage {
    items: [YoungOrganizer!]!
    pageInfo: PageInfo!
  }

  type BusCampus {
    id: Int!
    nameCn: String!
    nameEn: String
    namePrimary: String!
    nameSecondary: String
    latitude: Float!
    longitude: Float!
  }

  type BusRouteStop {
    stopOrder: Int!
    campusId: Int!
    campusName: String!
  }

  type BusRoute {
    id: Int!
    nameCn: String!
    nameEn: String
    descriptionPrimary: String!
    stops: [BusRouteStop!]!
  }

  type BusStopTime {
    stopOrder: Int!
    time: String
  }

  type BusTripSlot {
    position: Int!
    stopTimes: [BusStopTime!]!
  }

  type BusRoutePage {
    items: [BusRoute!]!
    campuses: [BusCampus!]!
    pageInfo: PageInfo!
  }

  type BusRouteTimetable {
    route: BusRoute!
    weekday: [BusTripSlot!]!
    saturday: [BusTripSlot!]!
    sunday: [BusTripSlot!]!
    weekdayPageInfo: PageInfo!
    saturdayPageInfo: PageInfo!
    sundayPageInfo: PageInfo!
    alternateRoutes: [BusRoute!]!
  }

  ${graphqlScopeTypeDefs}

  type WeatherCondition {
    text: String!
    icon: String!
  }

  type WeatherCurrent {
    temperature: Float!
    feelsLike: Float
    humidity: Float
    windDirection: String
    windSpeed: Float
    pressure: Float
    visibility: Float
    condition: WeatherCondition!
  }

  type WeatherHourly {
    at: DateTime!
    temperature: Float!
    condition: WeatherCondition
    precipitationProbability: Float
    precipitationAmount: Float
  }

  type WeatherDaily {
    date: Date!
    temperatureHigh: Float!
    temperatureLow: Float!
    condition: WeatherCondition
  }

  type WeatherAlert {
    title: String!
    level: String
    content: String
    issuedAt: DateTime
  }

  type WeatherLocation {
    key: String!
    name: String!
    adcode: String!
  }

  type WeatherSnapshot {
    location: WeatherLocation!
    fetchedAt: DateTime!
    providers: [String!]!
    current: WeatherCurrent!
    hourly: [WeatherHourly!]!
    daily: [WeatherDaily!]!
    alerts: [WeatherAlert!]!
  }

  type Catalog {
    semesters(page: PageInput): SemesterPage!
    currentSemester: Semester
    courses(page: PageInput, filter: CourseFilter): CoursePage!
    course(jwId: Int!): Course
    sections(page: PageInput, filter: SectionFilter): SectionPage!
    section(jwId: Int!): Section
    teachers(page: PageInput, filter: TeacherFilter): TeacherPage!
    teacher(id: Int!): Teacher
    busRoutes(page: PageInput): BusRoutePage!
    busTimetable(
      routeId: Int!
      page: PageInput
      now: DateTime
      versionKey: String
    ): BusRouteTimetable
    links(query: String): [CatalogLink!]!
    roomMap(code: String!): RoomMap!
    weather(locationKey: String!): WeatherSnapshot
    youngEvents(page: PageInput, filter: YoungEventFilter): YoungEventPage!
    youngEvent(youngId: String!): YoungEvent
    youngOrganizers(page: PageInput, search: String): YoungOrganizerPage!
    youngOrganizer(organizerId: String!): YoungOrganizer
  }

  type RoomMap {
    code: String!
    building: String
    floor: String
    status: String!
    imageUrl: String
    sourceImageUrl: String
  }

  type CatalogLink {
    slug: String!
    title: String!
    description: String!
    url: String!
    icon: String!
    group: String!
  }

  type CommunityUser {
    id: ID!
    username: String
    name: String!
    image: String
    createdAt: DateTime!
  }

  type Community {
    user(identifier: String!): CommunityUser
  }

  type Query {
    catalog: Catalog!
    workspace: Workspace
    community: Community!
    account: Account
  }

  ${graphqlMutationTypeDefs}
  ${youngWorkspaceTypeDefs}
`;

export const graphqlSchema = createSchema<
  GraphqlServerContext & GraphqlContext
>({
  typeDefs: graphqlTypeDefs,
  resolvers: {
    Date: graphqlDateScalar,
    DateTime: graphqlDateTimeScalar,
    SemesterPage: graphqlPageResolvers,
    CoursePage: graphqlPageResolvers,
    SectionPage: graphqlPageResolvers,
    SubscribedSectionPage: graphqlPageResolvers,
    TeacherPage: graphqlPageResolvers,
    BusRoutePage: graphqlPageResolvers,
    YoungEventPage: graphqlPageResolvers,
    ...youngWorkspacePageResolvers,
    YoungOrganizerPage: graphqlPageResolvers,
    ...graphqlScopeResolvers,
    ...graphqlMutationResolvers,
    Workspace: observeGraphqlResolverMap(
      { ...graphqlScopeResolvers.Workspace, ...youngWorkspaceResolvers },
      GRAPHQL_FEATURE_RESOLVER_MAPPINGS.Workspace,
    ),
    Mutation: observeGraphqlResolverMap(
      {
        ...graphqlMutationResolvers.Mutation,
        ...youngWorkspaceMutationResolvers,
      },
      GRAPHQL_FEATURE_RESOLVER_MAPPINGS.Mutation,
    ),
    YoungEvent: {
      // rawJson is an arbitrary upstream object and the schema has no JSON
      // scalar, so hand it to clients as a JSON string.
      rawJson(event: { rawJson?: unknown }) {
        return event.rawJson == null ? null : JSON.stringify(event.rawJson);
      },
    },
    Teacher: {
      async sectionCount(teacher: TeacherParent, _args, context) {
        const count = teacher._count?.sections;
        if (typeof count === "number") return count;
        const detail = await context.loaders.teacherById.load(teacher.id);
        return detail?._count.sections ?? 0;
      },
    },
    Query: {
      catalog: () => ({}),
      workspace: graphqlAuthenticatedScopeResolver,
      community: () => ({}),
      account: graphqlAuthenticatedScopeResolver,
    },
    Community: {
      async user(_parent, args: { identifier: string }) {
        return getPublicUserIdentityByIdentifier(args.identifier);
      },
    },
    Catalog: observeGraphqlResolverMap(
      {
        semesters(_parent, args: { page?: GraphqlPageInput | null }) {
          const pagination = normalizeGraphqlPage(args.page);
          return listSemesters(pagination);
        },
        currentSemester() {
          return getCachedCurrentSemester(new Date());
        },
        courses(
          _parent,
          args: {
            filter?: {
              search?: string | null;
              educationLevelId?: number | null;
              categoryId?: number | null;
              classTypeId?: number | null;
            } | null;
            page?: GraphqlPageInput | null;
          },
          context,
        ) {
          const filter = args.filter;
          return listCourseSummaries({
            filters: {
              search: validateGraphqlSearch(filter?.search),
              educationLevelId: validateOptionalGraphqlId(
                filter?.educationLevelId,
                "educationLevelId",
              ),
              categoryId: validateOptionalGraphqlId(
                filter?.categoryId,
                "categoryId",
              ),
              classTypeId: validateOptionalGraphqlId(
                filter?.classTypeId,
                "classTypeId",
              ),
            },
            locale: context.locale,
            pagination: normalizeGraphqlPage(args.page),
          });
        },
        course(_parent, args: { jwId: number }, context) {
          return context.loaders.courseByJwId.load(
            requireGraphqlId(args.jwId, "jwId"),
          );
        },
        sections(
          _parent,
          args: {
            filter?: {
              courseId?: number | null;
              courseJwId?: number | null;
              semesterId?: number | null;
              semesterJwId?: number | null;
              campusId?: number | null;
              departmentId?: number | null;
              teacherId?: number | null;
              teacherCode?: string | null;
              ids?: number[] | null;
              jwIds?: number[] | null;
              search?: string | null;
            } | null;
            page?: GraphqlPageInput | null;
          },
          context,
        ) {
          const filter = args.filter;
          return listSections({
            filters: {
              courseId: validateOptionalGraphqlId(filter?.courseId, "courseId"),
              courseJwId: validateOptionalGraphqlId(
                filter?.courseJwId,
                "courseJwId",
              ),
              semesterId: validateOptionalGraphqlId(
                filter?.semesterId,
                "semesterId",
              ),
              semesterJwId: validateOptionalGraphqlId(
                filter?.semesterJwId,
                "semesterJwId",
              ),
              campusId: validateOptionalGraphqlId(filter?.campusId, "campusId"),
              departmentId: validateOptionalGraphqlId(
                filter?.departmentId,
                "departmentId",
              ),
              teacherId: validateOptionalGraphqlId(
                filter?.teacherId,
                "teacherId",
              ),
              teacherCode: validateGraphqlTeacherCode(filter?.teacherCode),
              ids: validateGraphqlIdList(filter?.ids, "ids"),
              jwIds: validateGraphqlIdList(filter?.jwIds, "jwIds"),
              search: validateGraphqlSearch(filter?.search),
            },
            locale: context.locale,
            pagination: normalizeGraphqlPage(args.page),
          });
        },
        section(_parent, args: { jwId: number }, context) {
          return context.loaders.sectionByJwId.load(
            requireGraphqlId(args.jwId, "jwId"),
          );
        },
        teachers(
          _parent,
          args: {
            filter?: {
              departmentId?: number | null;
              search?: string;
            } | null;
            page?: GraphqlPageInput | null;
          },
          context,
        ) {
          return listTeacherSummaries({
            filters: {
              departmentId: validateOptionalGraphqlId(
                args.filter?.departmentId,
                "departmentId",
              ),
              search: validateGraphqlSearch(args.filter?.search),
            },
            locale: context.locale,
            pagination: normalizeGraphqlPage(args.page),
          });
        },
        teacher(_parent, args: { id: number }, context) {
          return context.loaders.teacherById.load(
            requireGraphqlId(args.id, "id"),
          );
        },
        async busRoutes(
          _parent,
          args: { page?: GraphqlPageInput | null },
          context,
        ) {
          const { routes, campuses } = await listBusRoutes(context.locale);
          return {
            ...paginateGraphqlArray(routes.map(capGraphqlBusRoute), args.page),
            campuses: capGraphqlBusCampuses(campuses),
          };
        },
        async busTimetable(
          _parent,
          args: {
            routeId: number;
            page?: GraphqlPageInput | null;
            now?: string | null;
            versionKey?: string | null;
          },
          context,
        ) {
          const routeId = requireGraphqlId(args.routeId, "routeId");
          const result = await getBusRouteTimetable({
            routeId,
            locale: context.locale,
            now: args.now ?? undefined,
            versionKey: validateGraphqlVersionKey(args.versionKey),
          });
          if (!result) return null;

          const weekdayPage = paginateGraphqlArray(result.weekday, args.page);
          const saturdayPage = paginateGraphqlArray(result.saturday, args.page);
          const sundayPage = paginateGraphqlArray(result.sunday, args.page);
          return {
            route: capGraphqlBusRoute(result.route),
            weekday: capGraphqlBusTripSlots(weekdayPage.data),
            saturday: capGraphqlBusTripSlots(saturdayPage.data),
            sunday: capGraphqlBusTripSlots(sundayPage.data),
            weekdayPageInfo: weekdayPage.pagination,
            saturdayPageInfo: saturdayPage.pagination,
            sundayPageInfo: sundayPage.pagination,
            alternateRoutes: capGraphqlAlternateRoutes(result.alternateRoutes),
          };
        },
        links(_parent, args: { query?: string | null }, context) {
          const links = getPublicCatalogLinksData(context.locale).catalogLinks;
          const query = args.query?.trim();
          if (!query) return links;
          const tokens = searchQueryToTokens(query);
          return links.filter((link) => linkMatchesTokens(link, tokens));
        },
        roomMap(_parent, args: { code: string }) {
          return getRoomMap(validateGraphqlRoomCode(args.code));
        },
        weather(_parent, args: { locationKey: string }) {
          return getWeatherSnapshot(
            validateGraphqlWeatherLocationKey(args.locationKey),
          );
        },
        async youngEvents(
          _parent,
          args: {
            filter?: {
              active?: boolean | null;
              category?: string | null;
              module?: string | null;
              activityLevel?: string | null;
              search?: string | null;
              organizerId?: string | null;
              dateFrom?: string | null;
              dateTo?: string | null;
              dateUnknown?: boolean | null;
              timeBasis?: "activity" | "registration" | null;
            } | null;
            page?: GraphqlPageInput | null;
          },
        ) {
          const pagination = normalizeGraphqlPage(args.page);
          const dateFrom = validateGraphqlYoungDate(
            args.filter?.dateFrom,
            "dateFrom",
          );
          const dateTo = validateGraphqlYoungDate(
            args.filter?.dateTo,
            "dateTo",
          );
          try {
            return await listYoungEvents({
              active: args.filter?.active ?? undefined,
              dateUnknown: args.filter?.dateUnknown ?? undefined,
              category: validateGraphqlSearch(args.filter?.category),
              module: validateGraphqlSearch(args.filter?.module),
              activityLevel: validateGraphqlSearch(args.filter?.activityLevel),
              search: validateGraphqlSearch(args.filter?.search),
              organizerId: args.filter?.organizerId
                ? requireGraphqlYoungOrganizerId(args.filter.organizerId)
                : undefined,
              dateFrom,
              dateTo,
              timeBasis: args.filter?.timeBasis ?? undefined,
              page: pagination.page,
              pageSize: pagination.pageSize,
            });
          } catch (error) {
            if (error instanceof RangeError) {
              throw new GraphQLError(error.message, {
                extensions: { code: "BAD_USER_INPUT" },
              });
            }
            throw error;
          }
        },
        async youngEvent(_parent, args: { youngId: string }) {
          return getYoungEvent(requireGraphqlYoungEventId(args.youngId));
        },
        youngOrganizers(
          _parent,
          args: { page?: GraphqlPageInput | null; search?: string | null },
        ) {
          const pagination = normalizeGraphqlPage(args.page);
          return listYoungOrganizers({
            search: validateGraphqlSearch(args.search),
            page: pagination.page,
            pageSize: pagination.pageSize,
          });
        },
        async youngOrganizer(_parent, args: { organizerId: string }) {
          return getYoungOrganizer(
            requireGraphqlYoungOrganizerId(args.organizerId),
          );
        },
      },
      GRAPHQL_FEATURE_RESOLVER_MAPPINGS.Catalog,
    ),
  },
});

import { createSchema } from "graphql-yoga";
import {
  getBusRouteTimetable,
  listBusRoutes,
} from "@/features/bus/server/bus-catalog";
import {
  getCurrentSemester,
  listSemesters,
} from "@/features/catalog/server/academic-metadata-read-model";
import { listCourseSummaries } from "@/features/catalog/server/course-summary-read-model";
import { listSections } from "@/features/catalog/server/section-summary-read-model";
import { listTeacherSummaries } from "@/features/catalog/server/teacher-summary-read-model";
import {
  capGraphqlAlternateRoutes,
  capGraphqlBusCampuses,
  capGraphqlBusRoute,
  capGraphqlBusTripSlots,
} from "./bus-output";
import type { GraphqlContext, GraphqlServerContext } from "./context";
import { graphqlDateScalar, graphqlDateTimeScalar } from "./date-scalar";
import {
  requireGraphqlId,
  validateGraphqlIdList,
  validateGraphqlSearch,
  validateGraphqlTeacherCode,
  validateGraphqlVersionKey,
  validateOptionalGraphqlId,
} from "./input-boundaries";
import {
  type GraphqlPageInput,
  graphqlPageResolvers,
  normalizeGraphqlPage,
  paginateGraphqlArray,
} from "./pagination";
import {
  graphqlViewerQueryResolver,
  graphqlViewerResolvers,
  graphqlViewerTypeDefs,
} from "./viewer";

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
    jwId: Int
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
    periodsPerWeek: Int
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
    personId: Int
    teacherId: Int
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
    weekend: [BusTripSlot!]!
    weekdayPageInfo: PageInfo!
    weekendPageInfo: PageInfo!
    alternateRoutes: [BusRoute!]!
  }

  ${graphqlViewerTypeDefs}

  type Query {
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
    viewer: Viewer
  }
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
    TeacherPage: graphqlPageResolvers,
    BusRoutePage: graphqlPageResolvers,
    ...graphqlViewerResolvers,
    Teacher: {
      async sectionCount(teacher: TeacherParent, _args, context) {
        const count = teacher._count?.sections;
        if (typeof count === "number") return count;
        const detail = await context.loaders.teacherById.load(teacher.id);
        return detail?._count.sections ?? 0;
      },
    },
    Query: {
      viewer: graphqlViewerQueryResolver,
      semesters(_parent, args: { page?: GraphqlPageInput | null }) {
        const pagination = normalizeGraphqlPage(args.page);
        return listSemesters(pagination);
      },
      currentSemester() {
        return getCurrentSemester(new Date());
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
        const weekendPage = paginateGraphqlArray(result.weekend, args.page);
        return {
          route: capGraphqlBusRoute(result.route),
          weekday: capGraphqlBusTripSlots(weekdayPage.data),
          weekend: capGraphqlBusTripSlots(weekendPage.data),
          weekdayPageInfo: weekdayPage.pagination,
          weekendPageInfo: weekendPage.pagination,
          alternateRoutes: capGraphqlAlternateRoutes(result.alternateRoutes),
        };
      },
    },
  },
});

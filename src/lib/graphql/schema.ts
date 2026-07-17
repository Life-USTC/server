import type { RequestEvent } from "@sveltejs/kit";
import { GraphQLError, GraphQLScalarType, Kind } from "graphql";
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
import { listSectionSummaries } from "@/features/catalog/server/section-summary-read-model";
import { listTeacherSummaries } from "@/features/catalog/server/teacher-summary-read-model";
import type { AppLocale } from "@/i18n/config";
import type { GraphqlLoaders } from "./loaders";
import {
  type GraphqlPageInput,
  normalizeGraphqlPage,
  paginateGraphqlArray,
} from "./pagination";

export type GraphqlContext = {
  loaders: GraphqlLoaders;
  locale: AppLocale;
};

type ServicePage = {
  data: readonly unknown[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type CourseParent = {
  jwId: number;
  sections?: unknown;
};

type TeacherParent = {
  id: number;
  sections?: unknown;
  _count?: { sections?: number };
};

const dateScalar = new GraphQLScalarType({
  name: "Date",
  description: "A calendar date serialized as YYYY-MM-DD.",
  serialize(value) {
    const date =
      value instanceof Date
        ? value
        : typeof value === "string" || typeof value === "number"
          ? new Date(value)
          : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new GraphQLError("Date cannot represent this value.");
    }
    return date.toISOString().slice(0, 10);
  },
  parseValue() {
    throw new GraphQLError("Date is output-only.");
  },
  parseLiteral(node) {
    if (node.kind !== Kind.STRING) {
      throw new GraphQLError("Date must be a string.");
    }
    return node.value;
  },
});

const pageResolvers = {
  items: (page: ServicePage) => page.data,
  pageInfo: (page: ServicePage) => page.pagination,
};

export const graphqlTypeDefs = /* GraphQL */ `
  scalar Date

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
    sections: [Section!]!
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
    teachers: [Teacher!]!
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
    sections: [Section!]!
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
      now: String
      versionKey: String
    ): BusRouteTimetable
  }
`;

export const graphqlSchema = createSchema<RequestEvent & GraphqlContext>({
  typeDefs: graphqlTypeDefs,
  resolvers: {
    Date: dateScalar,
    SemesterPage: pageResolvers,
    CoursePage: pageResolvers,
    SectionPage: pageResolvers,
    TeacherPage: pageResolvers,
    BusRoutePage: pageResolvers,
    Course: {
      async sections(course: CourseParent, _args, context) {
        if (Array.isArray(course.sections)) return course.sections;
        const detail = await context.loaders.courseByJwId.load(course.jwId);
        return detail?.sections ?? [];
      },
    },
    Teacher: {
      async sectionCount(teacher: TeacherParent, _args, context) {
        const count = teacher._count?.sections;
        if (typeof count === "number") return count;
        const detail = await context.loaders.teacherById.load(teacher.id);
        return detail?._count.sections ?? 0;
      },
      async sections(teacher: TeacherParent, _args, context) {
        if (Array.isArray(teacher.sections)) return teacher.sections;
        const detail = await context.loaders.teacherById.load(teacher.id);
        return detail?.sections ?? [];
      },
    },
    Query: {
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
        return listCourseSummaries({
          filters: args.filter ?? {},
          locale: context.locale,
          pagination: normalizeGraphqlPage(args.page),
        });
      },
      course(_parent, args: { jwId: number }, context) {
        return context.loaders.courseByJwId.load(args.jwId);
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
        return listSectionSummaries({
          filters: args.filter ?? {},
          locale: context.locale,
          pagination: normalizeGraphqlPage(args.page),
        });
      },
      section(_parent, args: { jwId: number }, context) {
        return context.loaders.sectionByJwId.load(args.jwId);
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
            departmentId: args.filter?.departmentId ?? undefined,
            search: args.filter?.search,
          },
          locale: context.locale,
          pagination: normalizeGraphqlPage(args.page),
        });
      },
      teacher(_parent, args: { id: number }, context) {
        return context.loaders.teacherById.load(args.id);
      },
      async busRoutes(
        _parent,
        args: { page?: GraphqlPageInput | null },
        context,
      ) {
        const { routes, campuses } = await listBusRoutes(context.locale);
        return {
          ...paginateGraphqlArray(routes, args.page),
          campuses,
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
        const result = await getBusRouteTimetable({
          routeId: args.routeId,
          locale: context.locale,
          now: args.now ?? undefined,
          versionKey: args.versionKey,
        });
        if (!result) return null;

        const weekdayPage = paginateGraphqlArray(result.weekday, args.page);
        const weekendPage = paginateGraphqlArray(result.weekend, args.page);
        return {
          route: result.route,
          weekday: weekdayPage.data,
          weekend: weekendPage.data,
          weekdayPageInfo: weekdayPage.pagination,
          weekendPageInfo: weekendPage.pagination,
          alternateRoutes: result.alternateRoutes.slice(0, 100),
        };
      },
    },
  },
});

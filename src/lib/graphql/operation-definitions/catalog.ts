import type { PersistedGraphqlOperationDefinition } from "../operation-types";
import {
  busRouteFields,
  courseFields,
  pageInfoFields,
  sectionFields,
  semesterFields,
  teacherFields,
} from "./fragments";
import { query } from "./helpers";

export const catalogGraphqlOperationDefinitions = [
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
            saturday {
              position
              stopTimes {
                stopOrder
                time
              }
            }
            sunday {
              position
              stopTimes {
                stopOrder
                time
              }
            }
            weekdayPageInfo {
              ${pageInfoFields}
            }
            saturdayPageInfo {
              ${pageInfoFields}
            }
            sundayPageInfo {
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
    id: "catalog.weather.get.v1",
    title: "Get weather",
    description:
      "Returns the merged weather snapshot for one USTC campus location.",
    document: /* GraphQL */ `
      query CatalogWeather($locationKey: String!) {
        catalog {
          weather(locationKey: $locationKey) {
            location {
              key
              name
              adcode
            }
            fetchedAt
            providers
            current {
              temperature
              feelsLike
              humidity
              windDirection
              windSpeed
              pressure
              visibility
              condition {
                text
                icon
              }
            }
            hourly {
              at
              temperature
              precipitationProbability
              precipitationAmount
              condition {
                text
                icon
              }
            }
            daily {
              date
              temperatureHigh
              temperatureLow
              condition {
                text
                icon
              }
            }
            alerts {
              title
              level
              content
              issuedAt
            }
          }
        }
      }
    `,
    scopes: [],
  }),
  query({
    id: "catalog.young_event.list.v1",
    title: "List Young events",
    description:
      "Lists second-classroom signup events from young.ustc.edu.cn with filters and bounded pagination.",
    document: /* GraphQL */ `
      query CatalogYoungEvents($page: PageInput, $filter: YoungEventFilter) {
        catalog {
          youngEvents(page: $page, filter: $filter) {
            items {
              youngId
              name
              category
              department
              organizer
              status
              registrationStatus
              location
              imageUrl
              hours
              capacity
              appliedCount
              startAt
              endAt
              applyStartAt
              applyEndAt
              isActive
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
    id: "catalog.young_event.get.v1",
    title: "Get Young event",
    description:
      "Returns one second-classroom signup event by its young.ustc.edu.cn identifier.",
    document: /* GraphQL */ `
      query CatalogYoungEvent($youngId: String!) {
        catalog {
          youngEvent(youngId: $youngId) {
            youngId
            name
            category
            department
            organizer
            status
            registrationStatus
            location
            imageUrl
            hours
            capacity
            appliedCount
            startAt
            endAt
            applyStartAt
            applyEndAt
            isActive
          }
        }
      }
    `,
    scopes: [],
  }),
] as const satisfies readonly PersistedGraphqlOperationDefinition[];

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- Keep the named scenario repeatable without deleting unrelated local data.
-- Every fixture INSERT below is conflict-tolerant by design.

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."User" (id, name, image, "createdAt", "updatedAt", "profilePictures", username, "isAdmin", "calendarFeedToken", email, "emailVerified") VALUES ('cmqw1sr9e0000bqt4j4a16ffb', '校园管理员', 'https://api.dicebear.com/9.x/shapes/svg?seed=life-ustc-admin', '2026-06-27 07:38:09.794', '2026-06-27 07:38:09.794', '{}', 'dev-admin', true, NULL, 'dev-admin@debug.local', true) ON CONFLICT DO NOTHING;
INSERT INTO public."User" (id, name, image, "createdAt", "updatedAt", "profilePictures", username, "isAdmin", "calendarFeedToken", email, "emailVerified") VALUES ('cmqw1sr9g0001bqt44c3s0kqa', 'Dev User', 'https://api.dicebear.com/9.x/shapes/svg?seed=life-ustc-dev-user', '2026-06-27 07:38:09.796', '2026-06-27 07:38:09.796', '{}', 'dev-user', false, NULL, 'dev-user@debug.local', true) ON CONFLICT DO NOTHING;


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Account" ("userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, "createdAt", "updatedAt", id, "accessTokenExpiresAt", "refreshTokenExpiresAt", password) VALUES ('cmqw1sr9g0001bqt44c3s0kqa', 'oidc', 'dev-scenario-oidc', 'dev-user-account', NULL, 'scenario-access-token', 1777564740, 'Bearer', 'openid profile email', NULL, NULL, '2026-06-27 07:38:10.042', '2026-06-27 07:38:10.042', 'cmqw1srga0021bqt4me6hh68q', NULL, NULL, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: AdminClass; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."AdminClass" (id, "jwId", code, grade, "nameCn", "nameEn", "stdCount", "planCount", enabled, "abbrZh", "abbrEn") VALUES (1, 9910061, 'CS-2022-01', '2026', '计算机01', 'CS Class 01', 32, 35, true, NULL, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Authenticator; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Authenticator" ("credentialID", "userId", "providerAccountId", "credentialPublicKey", counter, "credentialDeviceType", "credentialBackedUp", transports) VALUES ('dev-scenario/credential-dev-user', 'cmqw1sr9g0001bqt44c3s0kqa', 'dev-user-account', 'scenario-public-key', 1, 'singleDevice', false, 'usb') ON CONFLICT DO NOTHING;


--
-- Data for Name: Campus; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Campus" (id, "jwId", "nameCn", "nameEn", code) VALUES (1, 9910001, '东校区', 'East Campus', 'EAST') ON CONFLICT DO NOTHING;


--
-- Data for Name: Building; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Building" (id, "jwId", "nameCn", "nameEn", code, "campusId") VALUES (1, 9910021, '第一教学楼', 'Teaching Building 1', 'BLDG-1', 1) ON CONFLICT DO NOTHING;


--
-- Data for Name: BusCampus; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BusCampus" (id, "nameCn", "nameEn", latitude, longitude) VALUES (1, '东区', NULL, 117.268264, 31.83892) ON CONFLICT DO NOTHING;
INSERT INTO public."BusCampus" (id, "nameCn", "nameEn", latitude, longitude) VALUES (2, '西区', NULL, 117.256645, 31.839258) ON CONFLICT DO NOTHING;
INSERT INTO public."BusCampus" (id, "nameCn", "nameEn", latitude, longitude) VALUES (3, '北区', NULL, 117.268125, 31.841933) ON CONFLICT DO NOTHING;
INSERT INTO public."BusCampus" (id, "nameCn", "nameEn", latitude, longitude) VALUES (4, '南区', NULL, 117.283853, 31.822112) ON CONFLICT DO NOTHING;
INSERT INTO public."BusCampus" (id, "nameCn", "nameEn", latitude, longitude) VALUES (5, '先研院', NULL, 117.129257, 31.826345) ON CONFLICT DO NOTHING;
INSERT INTO public."BusCampus" (id, "nameCn", "nameEn", latitude, longitude) VALUES (6, '高新', NULL, 117.129369, 31.820447) ON CONFLICT DO NOTHING;


--
-- Data for Name: BusRoute; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BusRoute" (id, "nameCn", "nameEn") VALUES (1, '东区 -> 北区 -> 西区', '东区 to 西区') ON CONFLICT DO NOTHING;
INSERT INTO public."BusRoute" (id, "nameCn", "nameEn") VALUES (3, '东区 -> 南区', '东区 to 南区') ON CONFLICT DO NOTHING;
INSERT INTO public."BusRoute" (id, "nameCn", "nameEn") VALUES (7, '高新 -> 先研院 -> 西区 -> 东区', '高新 to 东区') ON CONFLICT DO NOTHING;
INSERT INTO public."BusRoute" (id, "nameCn", "nameEn") VALUES (8, '东区 -> 西区 -> 先研院 -> 高新', '东区 to 高新') ON CONFLICT DO NOTHING;


--
-- Data for Name: BusRouteStop; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (1, 1, 1, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (2, 1, 3, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (3, 1, 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (4, 3, 1, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (5, 3, 4, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (6, 7, 6, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (7, 7, 5, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (8, 7, 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (9, 7, 1, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (10, 8, 1, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (11, 8, 2, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (12, 8, 5, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."BusRouteStop" (id, "routeId", "campusId", "stopOrder") VALUES (13, 8, 6, 3) ON CONFLICT DO NOTHING;


--
-- Data for Name: BusScheduleVersion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BusScheduleVersion" (id, key, title, checksum, "sourceMessage", "sourceUrl", "rawJson", "effectiveFrom", "effectiveUntil", "isEnabled", "importedAt", "createdAt", "updatedAt") VALUES (1, 'static-bus-structured', 'Static Structured Bus Timetable', '50ad13be65bfb29bd4db352fb60973dc92b875b112674f6085cad85e982fda58', '校车运营数据仅供测试使用。', 'https://github.com/Life-USTC/static', '{"routes": [{"id": 1, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 3, "name": "北区", "latitude": 117.268125, "longitude": 31.841933}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}]}, {"id": 3, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 4, "name": "南区", "latitude": 117.283853, "longitude": 31.822112}]}, {"id": 7, "campuses": [{"id": 6, "name": "高新", "latitude": 117.129369, "longitude": 31.820447}, {"id": 5, "name": "先研院", "latitude": 117.129257, "longitude": 31.826345}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}, {"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}]}, {"id": 8, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}, {"id": 5, "name": "先研院", "latitude": 117.129257, "longitude": 31.826345}, {"id": 6, "name": "高新", "latitude": 117.129369, "longitude": 31.820447}]}], "message": {"url": "https://github.com/Life-USTC/static", "message": "校车运营数据仅供测试使用。"}, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}, {"id": 3, "name": "北区", "latitude": 117.268125, "longitude": 31.841933}, {"id": 4, "name": "南区", "latitude": 117.283853, "longitude": 31.822112}, {"id": 5, "name": "先研院", "latitude": 117.129257, "longitude": 31.826345}, {"id": 6, "name": "高新", "latitude": 117.129369, "longitude": 31.820447}], "weekday_routes": [{"id": 1, "time": [["07:30", null, "07:40"], ["09:20", null, "09:30"], ["18:40", null, "18:50"], ["21:15", null, "21:25"]], "route": {"id": 1, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 3, "name": "北区", "latitude": 117.268125, "longitude": 31.841933}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}]}}, {"id": 3, "time": [["08:30", "08:45"], ["12:35", "12:50"], ["17:45", "18:00"]], "route": {"id": 3, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 4, "name": "南区", "latitude": 117.283853, "longitude": 31.822112}]}}, {"id": 7, "time": [["08:00", "08:05", null, "08:50"], ["14:30", "14:35", null, "15:25"], ["18:30", "18:35", null, "19:25"]], "route": {"id": 7, "campuses": [{"id": 6, "name": "高新", "latitude": 117.129369, "longitude": 31.820447}, {"id": 5, "name": "先研院", "latitude": 117.129257, "longitude": 31.826345}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}, {"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}]}}, {"id": 8, "time": [["06:50", "07:00", null, "07:40"], ["12:50", "13:00", null, "13:40"], ["21:20", "21:30", null, "22:00"]], "route": {"id": 8, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}, {"id": 5, "name": "先研院", "latitude": 117.129257, "longitude": 31.826345}, {"id": 6, "name": "高新", "latitude": 117.129369, "longitude": 31.820447}]}}], "weekend_routes": [{"id": 1, "time": [["07:30", null, "07:40"], ["17:30", null, "17:40"], ["21:15", null, "21:25"]], "route": {"id": 1, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 3, "name": "北区", "latitude": 117.268125, "longitude": 31.841933}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}]}}, {"id": 3, "time": [["11:45", "12:00"], ["19:00", "19:15"]], "route": {"id": 3, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 4, "name": "南区", "latitude": 117.283853, "longitude": 31.822112}]}}, {"id": 7, "time": [["08:00", "08:05", null, "08:50"], ["21:50", "21:55", null, "22:40"]], "route": {"id": 7, "campuses": [{"id": 6, "name": "高新", "latitude": 117.129369, "longitude": 31.820447}, {"id": 5, "name": "先研院", "latitude": 117.129257, "longitude": 31.826345}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}, {"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}]}}, {"id": 8, "time": [["07:00", "07:10", null, "07:50"], ["18:30", "18:40", null, "19:30"]], "route": {"id": 8, "campuses": [{"id": 1, "name": "东区", "latitude": 117.268264, "longitude": 31.83892}, {"id": 2, "name": "西区", "latitude": 117.256645, "longitude": 31.839258}, {"id": 5, "name": "先研院", "latitude": 117.129257, "longitude": 31.826345}, {"id": 6, "name": "高新", "latitude": 117.129369, "longitude": 31.820447}]}}]}', '2026-04-22', NULL, true, '2026-06-27 07:38:10.061', '2026-06-27 07:38:10.061', '2026-06-27 07:38:10.061') ON CONFLICT DO NOTHING;


--
-- Data for Name: BusTrip; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (1, 1, 1, 'weekday', 0, '["07:30", null, "07:40"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (2, 1, 1, 'weekday', 1, '["09:20", null, "09:30"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (3, 1, 1, 'weekday', 2, '["18:40", null, "18:50"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (4, 1, 1, 'weekday', 3, '["21:15", null, "21:25"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (5, 1, 3, 'weekday', 0, '["08:30", "08:45"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (6, 1, 3, 'weekday', 1, '["12:35", "12:50"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (7, 1, 3, 'weekday', 2, '["17:45", "18:00"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (8, 1, 7, 'weekday', 0, '["08:00", "08:05", null, "08:50"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (9, 1, 7, 'weekday', 1, '["14:30", "14:35", null, "15:25"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (10, 1, 7, 'weekday', 2, '["18:30", "18:35", null, "19:25"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (11, 1, 8, 'weekday', 0, '["06:50", "07:00", null, "07:40"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (12, 1, 8, 'weekday', 1, '["12:50", "13:00", null, "13:40"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (13, 1, 8, 'weekday', 2, '["21:20", "21:30", null, "22:00"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (14, 1, 1, 'weekend', 0, '["07:30", null, "07:40"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (15, 1, 1, 'weekend', 1, '["17:30", null, "17:40"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (16, 1, 1, 'weekend', 2, '["21:15", null, "21:25"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (17, 1, 3, 'weekend', 0, '["11:45", "12:00"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (18, 1, 3, 'weekend', 1, '["19:00", "19:15"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (19, 1, 7, 'weekend', 0, '["08:00", "08:05", null, "08:50"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (20, 1, 7, 'weekend', 1, '["21:50", "21:55", null, "22:40"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (21, 1, 8, 'weekend', 0, '["07:00", "07:10", null, "07:50"]') ON CONFLICT DO NOTHING;
INSERT INTO public."BusTrip" (id, "versionId", "routeId", "dayType", "position", "stopTimes") VALUES (22, 1, 8, 'weekend', 1, '["18:30", "18:40", null, "19:30"]') ON CONFLICT DO NOTHING;


--
-- Data for Name: BusUserPreference; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BusUserPreference" ("userId", "preferredOriginCampusId", "preferredDestinationCampusId", "favoriteCampusIds", "favoriteRouteIds", "showDepartedTrips", "createdAt", "updatedAt") VALUES ('cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, '{1}', '{}', false, '2026-06-27 07:38:10.072', '2026-06-27 07:38:10.072') ON CONFLICT DO NOTHING;


--
-- Data for Name: ClassType; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."ClassType" (id, "nameCn", "nameEn") VALUES (1, '理论课', 'Lecture') ON CONFLICT DO NOTHING;


--
-- Data for Name: CourseCategory; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CourseCategory" (id, "nameCn", "nameEn") VALUES (1, '学科基础课', 'Disciplinary Foundation') ON CONFLICT DO NOTHING;


--
-- Data for Name: CourseClassify; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CourseClassify" (id, "nameCn", "nameEn") VALUES (1, '必修', 'Required') ON CONFLICT DO NOTHING;


--
-- Data for Name: CourseGradation; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CourseGradation" (id, "nameCn", "nameEn") VALUES (1, '进阶', 'Advanced') ON CONFLICT DO NOTHING;


--
-- Data for Name: CourseType; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CourseType" (id, "nameCn", "nameEn") VALUES (1, '专业核心', 'Core Major') ON CONFLICT DO NOTHING;


--
-- Data for Name: EducationLevel; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."EducationLevel" (id, "nameCn", "nameEn") VALUES (1, '本科生', 'Undergraduate') ON CONFLICT DO NOTHING;


--
-- Data for Name: Course; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Course" (id, "jwId", code, "nameCn", "nameEn", "categoryId", "classTypeId", "classifyId", "educationLevelId", "gradationId", "typeId") VALUES (1, 9901002, 'ASTRON1501', '天体物理概观', 'Introduction to Astrophysics', 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Course" (id, "jwId", code, "nameCn", "nameEn", "categoryId", "classTypeId", "classifyId", "educationLevelId", "gradationId", "typeId") VALUES (3, 9901003, 'ENVS3002', '环境微生物学', 'Environmental Microbiology', 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Course" (id, "jwId", code, "nameCn", "nameEn", "categoryId", "classTypeId", "classifyId", "educationLevelId", "gradationId", "typeId") VALUES (2, 9901004, 'MATH2001', '线性代数进阶', 'Advanced Linear Algebra', 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Course" (id, "jwId", code, "nameCn", "nameEn", "categoryId", "classTypeId", "classifyId", "educationLevelId", "gradationId", "typeId") VALUES (4, 9901001, 'IS3003', '密码工程原理与实践', 'Cryptographic Engineering: Principles and Practice', 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Department" (id, code, "nameCn", "nameEn", "isCollege") VALUES (1, 'DPT-IS', '网络空间安全学院', 'School of Cyber Science and Technology', true) ON CONFLICT DO NOTHING;


--
-- Data for Name: ExamMode; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."ExamMode" (id, "nameCn", "nameEn") VALUES (1, '闭卷', 'Closed Book') ON CONFLICT DO NOTHING;


--
-- Data for Name: RoomType; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."RoomType" (id, "jwId", "nameCn", "nameEn", code) VALUES (1, 9910011, '多媒体教室', 'Multimedia Classroom', 'MULTIMEDIA') ON CONFLICT DO NOTHING;


--
-- Data for Name: Semester; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Semester" (id, "jwId", "nameCn", code, "startDate", "endDate") VALUES (1, 9900001, '2026年春季学期', '421', '2026-04-08', '2026-09-06') ON CONFLICT DO NOTHING;
INSERT INTO public."Semester" (id, "jwId", "nameCn", code, "startDate", "endDate") VALUES (2, 9900000, '2025年秋季学期', '420', '2025-10-21', '2026-03-30') ON CONFLICT DO NOTHING;


--
-- Data for Name: TeachLanguage; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."TeachLanguage" (id, "nameCn", "nameEn") VALUES (1, '中文', 'Chinese') ON CONFLICT DO NOTHING;


--
-- Data for Name: Section; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Section" (id, "jwId", code, "bizTypeId", credits, period, "periodsPerWeek", "timesPerWeek", "stdCount", "limitCount", "graduateAndPostgraduate", "dateTimePlaceText", "dateTimePlacePersonText", "actualPeriods", "theoryPeriods", "practicePeriods", "experimentPeriods", "machinePeriods", "designPeriods", "testPeriods", "scheduleState", "suggestScheduleWeeks", "suggestScheduleWeekInfo", "scheduleJsonParams", "selectedStdCount", remark, "scheduleRemark", "courseId", "semesterId", "campusId", "examModeId", "openDepartmentId", "teachLanguageId", "roomTypeId") VALUES (1, 9902002, 'ASTRON1501.01', NULL, 2, 32, 2, 2, 33, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '围绕天体物理基础主题组织阅读、讨论和期末考核。', '包含早课、午后与晚课时段。', 1, 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Section" (id, "jwId", code, "bizTypeId", credits, period, "periodsPerWeek", "timesPerWeek", "stdCount", "limitCount", "graduateAndPostgraduate", "dateTimePlaceText", "dateTimePlacePersonText", "actualPeriods", "theoryPeriods", "practicePeriods", "experimentPeriods", "machinePeriods", "designPeriods", "testPeriods", "scheduleState", "suggestScheduleWeeks", "suggestScheduleWeekInfo", "scheduleJsonParams", "selectedStdCount", remark, "scheduleRemark", "courseId", "semesterId", "campusId", "examModeId", "openDepartmentId", "teachLanguageId", "roomTypeId") VALUES (2, 9902001, 'IS3003.01', NULL, 2.5, 40, 2, 2, 58, 80, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '结合密码协议与工程实现，强调课堂演示和实验复盘。', '包含早课、午后与晚课时段。', 4, 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Section" (id, "jwId", code, "bizTypeId", credits, period, "periodsPerWeek", "timesPerWeek", "stdCount", "limitCount", "graduateAndPostgraduate", "dateTimePlaceText", "dateTimePlacePersonText", "actualPeriods", "theoryPeriods", "practicePeriods", "experimentPeriods", "machinePeriods", "designPeriods", "testPeriods", "scheduleState", "suggestScheduleWeeks", "suggestScheduleWeekInfo", "scheduleJsonParams", "selectedStdCount", remark, "scheduleRemark", "courseId", "semesterId", "campusId", "examModeId", "openDepartmentId", "teachLanguageId", "roomTypeId") VALUES (3, 9902004, 'MATH2001.01', NULL, 4, 64, 2, 2, 45, 70, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '用于验证跨学期关注班级、历史考试与订阅分组展示。', '包含早课、午后与晚课时段。', 2, 2, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Section" (id, "jwId", code, "bizTypeId", credits, period, "periodsPerWeek", "timesPerWeek", "stdCount", "limitCount", "graduateAndPostgraduate", "dateTimePlaceText", "dateTimePlacePersonText", "actualPeriods", "theoryPeriods", "practicePeriods", "experimentPeriods", "machinePeriods", "designPeriods", "testPeriods", "scheduleState", "suggestScheduleWeeks", "suggestScheduleWeekInfo", "scheduleJsonParams", "selectedStdCount", remark, "scheduleRemark", "courseId", "semesterId", "campusId", "examModeId", "openDepartmentId", "teachLanguageId", "roomTypeId") VALUES (4, 9902003, 'ENVS3002.01', NULL, 3, 48, 2, 2, 57, 90, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '课程覆盖环境样品分析、微生物过程与阶段性实验报告。', '包含早课、午后与晚课时段。', 3, 1, 1, 1, 1, 1, 1) ON CONFLICT DO NOTHING;


--
-- Data for Name: Homework; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0002bqt4l5neqtsa', '迭代一需求拆解', false, false, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-04-27 12:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 2, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0003bqt45qjilal7', '逾期实验数据补交', true, false, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-04-28 14:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 2, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0006bqt4j01p7cwx', '线性变换证明题', false, false, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-05-01 14:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 1, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0005bqt41y0wbcrp', '迭代二系统设计评审', true, true, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-05-03 15:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 2, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0009bqt4i5lpmutg', '历史学期复盘作业', false, false, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-03-20 12:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 3, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0004bqt4qy3jviis', '今日课堂反馈整理', false, false, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-04-29 15:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 2, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0008bqt467yuqdec', '实验报告与误差分析', true, true, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-05-02 13:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 4, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez0007bqt4p55o2ara', '特征值综合练习', false, false, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-05-05 14:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:09.995', NULL, 1, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Homework" (id, title, "isMajor", "requiresTeam", "publishedAt", "submissionStartAt", "submissionDueAt", "createdAt", "updatedAt", "deletedAt", "sectionId", "createdById", "updatedById", "deletedById") VALUES ('cmqw1srez000abqt4el2uqvbq', '已删除作业', false, false, '2026-04-28 01:00:00', '2026-04-28 01:00:00', '2026-05-04 15:00:00', '2026-06-27 07:38:09.995', '2026-06-27 07:38:10.004', '2026-04-29 04:00:00', 2, 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;


--
-- Data for Name: TeacherTitle; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."TeacherTitle" (id, "jwId", "nameCn", "nameEn", code, enabled) VALUES (1, 9910041, '教授', 'Professor', 'PROF', true) ON CONFLICT DO NOTHING;


--
-- Data for Name: Teacher; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Teacher" (id, "personId", "teacherId", code, "nameCn", "nameEn", age, email, telephone, mobile, address, postcode, qq, wechat, "departmentId", "teacherTitleId") VALUES (1, NULL, NULL, 'T2401001', '林璟锵', 'Lin Jingqiang', NULL, 'jqlin@ustc.edu.cn', NULL, '13800001111', '中国科学技术大学', NULL, NULL, NULL, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Teacher" (id, "personId", "teacherId", code, "nameCn", "nameEn", age, email, telephone, mobile, address, postcode, qq, wechat, "departmentId", "teacherTitleId") VALUES (2, NULL, NULL, 'T2401002', '王伟', 'Wang Wei', NULL, 'wangwei@ustc.edu.cn', NULL, '13800002222', '中国科学技术大学', NULL, NULL, NULL, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Teacher" (id, "personId", "teacherId", code, "nameCn", "nameEn", age, email, telephone, mobile, address, postcode, qq, wechat, "departmentId", "teacherTitleId") VALUES (3, NULL, NULL, 'T2401003', '童中华', 'Tong Zhonghua', NULL, 'zhtong@ustc.edu.cn', NULL, '13800003333', '中国科学技术大学', NULL, NULL, NULL, 1, 1) ON CONFLICT DO NOTHING;


--
-- Data for Name: SectionTeacher; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."SectionTeacher" (id, "sectionId", "teacherId", "createdAt", "updatedAt", "retiredAt") VALUES (1, 2, 1, '2026-06-27 07:38:09.965', '2026-06-27 07:38:09.965', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SectionTeacher" (id, "sectionId", "teacherId", "createdAt", "updatedAt", "retiredAt") VALUES (2, 2, 2, '2026-06-27 07:38:09.965', '2026-06-27 07:38:09.965', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SectionTeacher" (id, "sectionId", "teacherId", "createdAt", "updatedAt", "retiredAt") VALUES (3, 1, 2, '2026-06-27 07:38:09.965', '2026-06-27 07:38:09.965', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SectionTeacher" (id, "sectionId", "teacherId", "createdAt", "updatedAt", "retiredAt") VALUES (4, 4, 3, '2026-06-27 07:38:09.965', '2026-06-27 07:38:09.965', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."SectionTeacher" (id, "sectionId", "teacherId", "createdAt", "updatedAt", "retiredAt") VALUES (5, 3, 1, '2026-06-27 07:38:09.965', '2026-06-27 07:38:09.965', NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfd000obqt41ss1dl3f', '这门课节奏快，建议每周固定做一次代码评审。', 'public', 'active', NULL, '2026-06-27 07:38:10.009', '2026-06-27 07:38:10.009', NULL, NULL, NULL, 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 2, NULL, NULL, NULL, false, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfg000pbqt45u2otis8', '回复：推荐先写测试用例再实现。', 'logged_in_only', 'active', NULL, '2026-06-27 07:38:10.013', '2026-06-27 07:38:10.013', NULL, NULL, NULL, 'cmqw1sr9g0001bqt44c3s0kqa', NULL, 'cmqw1srfd000obqt41ss1dl3f', 'cmqw1srfd000obqt41ss1dl3f', 2, NULL, NULL, NULL, false, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfg000qbqt47k01wejs', '课程难度中上，适合作为线代进阶。', 'public', 'active', '匿名同学', '2026-06-27 07:38:10.013', '2026-06-27 07:38:10.013', NULL, NULL, NULL, 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, NULL, 1, NULL, NULL, true, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfg000rbqt4lby47ozs', '实验指导细致，答疑响应很及时。', 'public', 'active', NULL, '2026-06-27 07:38:10.013', '2026-06-27 07:38:10.013', NULL, NULL, NULL, 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, NULL, NULL, 3, NULL, false, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfh000sbqt4rlvla7qd', '注意提交报告时附上原始数据截图。', 'public', 'softbanned', NULL, '2026-06-27 07:38:10.013', '2026-06-27 07:38:10.013', NULL, '2026-04-29 02:00:00', '仅用于验证私密评论状态展示。', 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9e0000bqt4j4a16ffb', NULL, NULL, NULL, NULL, NULL, NULL, false, 'cmqw1srez0008bqt467yuqdec') ON CONFLICT DO NOTHING;
INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfk000tbqt4exepeg0j', '班级-教师评论：该教师讲解清晰。', 'public', 'active', NULL, '2026-06-27 07:38:10.016', '2026-06-27 07:38:10.016', NULL, NULL, NULL, 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfm000ubqt49czkg88r', '[DEV-SCENARIO] 已删除评论，用于列表过滤测试。', 'public', 'deleted', NULL, '2026-06-27 07:38:10.018', '2026-06-27 07:38:10.018', '2026-04-29 03:00:00', NULL, NULL, 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 1, NULL, NULL, NULL, false, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Comment" (id, body, visibility, status, "authorName", "createdAt", "updatedAt", "deletedAt", "moderatedAt", "moderationNote", "userId", "moderatedById", "parentId", "rootId", "sectionId", "courseId", "teacherId", "sectionTeacherId", "isAnonymous", "homeworkId") VALUES ('cmqw1srfn000vbqt41hlp6few', '附上实验模板，方便大家统一格式。', 'public', 'active', NULL, '2026-06-27 07:38:10.019', '2026-06-27 07:38:10.019', NULL, NULL, NULL, 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 4, NULL, NULL, NULL, false, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: Upload; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Upload" (id, key, filename, "contentType", size, "createdAt", "updatedAt", "userId") VALUES ('cmqw1srfc000nbqt4qgaf8n33', 'dev-scenario/1782545890007-2-physics-lab-template.xlsx', 'physics-lab-template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 94220, '2026-06-27 07:38:10.008', '2026-06-27 07:38:10.008', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."Upload" (id, key, filename, "contentType", size, "createdAt", "updatedAt", "userId") VALUES ('cmqw1srfb000lbqt4ke6z43wc', 'dev-scenario/1782545890007-0-software-engineering-checklist.pdf', 'software-engineering-checklist.pdf', 'application/pdf', 1258220, '2026-06-27 07:38:10.008', '2026-06-27 07:38:10.008', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."Upload" (id, key, filename, "contentType", size, "createdAt", "updatedAt", "userId") VALUES ('cmqw1srfb000mbqt4ubflxqu5', 'dev-scenario/1782545890007-1-linear-algebra-notes.md', 'linear-algebra-notes.md', 'text/markdown', 18432, '2026-06-27 07:38:10.008', '2026-06-27 07:38:10.008', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;


--
-- Data for Name: CommentAttachment; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CommentAttachment" (id, "commentId", "uploadId", "createdAt") VALUES ('cmqw1srfo000wbqt4a75bq2u2', 'cmqw1srfn000vbqt41hlp6few', 'cmqw1srfc000nbqt4qgaf8n33', '2026-06-27 07:38:10.02') ON CONFLICT DO NOTHING;


--
-- Data for Name: CommentReaction; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CommentReaction" (id, type, "createdAt", "commentId", "userId") VALUES ('cmqw1srfp000xbqt4emmb5j8p', 'upvote', '2026-06-27 07:38:10.021', 'cmqw1srfd000obqt41ss1dl3f', 'cmqw1sr9e0000bqt4j4a16ffb') ON CONFLICT DO NOTHING;
INSERT INTO public."CommentReaction" (id, type, "createdAt", "commentId", "userId") VALUES ('cmqw1srfp000ybqt4oac2fjyw', 'heart', '2026-06-27 07:38:10.021', 'cmqw1srfn000vbqt41hlp6few', 'cmqw1sr9e0000bqt4j4a16ffb') ON CONFLICT DO NOTHING;


--
-- Data for Name: DashboardLinkClick; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."DashboardLinkClick" (id, "userId", slug, count, "lastClickedAt", "createdAt", "updatedAt") VALUES ('cmqw1srg4001rbqt4hw3745va', 'cmqw1sr9g0001bqt44c3s0kqa', 'jw', 6, '2026-04-29 02:00:00', '2026-06-27 07:38:10.036', '2026-06-27 07:38:10.036') ON CONFLICT DO NOTHING;
INSERT INTO public."DashboardLinkClick" (id, "userId", slug, count, "lastClickedAt", "createdAt", "updatedAt") VALUES ('cmqw1srg4001sbqt4qxj6mt2a', 'cmqw1sr9g0001bqt44c3s0kqa', 'mail', 5, '2026-04-29 03:00:00', '2026-06-27 07:38:10.036', '2026-06-27 07:38:10.036') ON CONFLICT DO NOTHING;
INSERT INTO public."DashboardLinkClick" (id, "userId", slug, count, "lastClickedAt", "createdAt", "updatedAt") VALUES ('cmqw1srg4001tbqt4hou8tuds', 'cmqw1sr9g0001bqt44c3s0kqa', 'confession-wall', 4, '2026-04-29 04:00:00', '2026-06-27 07:38:10.036', '2026-06-27 07:38:10.036') ON CONFLICT DO NOTHING;
INSERT INTO public."DashboardLinkClick" (id, "userId", slug, count, "lastClickedAt", "createdAt", "updatedAt") VALUES ('cmqw1srg4001ubqt4s4f8uffi', 'cmqw1sr9g0001bqt44c3s0kqa', 'official', 3, '2026-04-29 05:00:00', '2026-06-27 07:38:10.036', '2026-06-27 07:38:10.036') ON CONFLICT DO NOTHING;
INSERT INTO public."DashboardLinkClick" (id, "userId", slug, count, "lastClickedAt", "createdAt", "updatedAt") VALUES ('cmqw1srg4001vbqt4ixame69s', 'cmqw1sr9g0001bqt44c3s0kqa', 'icourse', 2, '2026-04-29 06:00:00', '2026-06-27 07:38:10.036', '2026-06-27 07:38:10.036') ON CONFLICT DO NOTHING;


--
-- Data for Name: DashboardLinkPin; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."DashboardLinkPin" (id, "userId", slug, "createdAt", "updatedAt") VALUES ('cmqw1srg5001wbqt481a7iqs3', 'cmqw1sr9g0001bqt44c3s0kqa', 'jw', '2026-06-27 07:38:10.037', '2026-06-27 07:38:10.037') ON CONFLICT DO NOTHING;
INSERT INTO public."DashboardLinkPin" (id, "userId", slug, "createdAt", "updatedAt") VALUES ('cmqw1srg5001xbqt4tep8wgdo', 'cmqw1sr9g0001bqt44c3s0kqa', 'confession-wall', '2026-06-27 07:38:10.037', '2026-06-27 07:38:10.037') ON CONFLICT DO NOTHING;
INSERT INTO public."DashboardLinkPin" (id, "userId", slug, "createdAt", "updatedAt") VALUES ('cmqw1srg5001ybqt4y7cwzufi', 'cmqw1sr9g0001bqt44c3s0kqa', 'mail', '2026-06-27 07:38:10.037', '2026-06-27 07:38:10.037') ON CONFLICT DO NOTHING;
INSERT INTO public."DashboardLinkPin" (id, "userId", slug, "createdAt", "updatedAt") VALUES ('cmqw1srg5001zbqt4c1erutxb', 'cmqw1sr9g0001bqt44c3s0kqa', 'official', '2026-06-27 07:38:10.037', '2026-06-27 07:38:10.037') ON CONFLICT DO NOTHING;


--
-- Data for Name: Description; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr0016bqt4eal5mfwu', '证明题需写出完整推导过程，可参考教材第三章习题 3.2。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:34:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0006bqt4j01p7cwx') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr0012bqt48tp2cabf', '作业要求：提交仓库链接和测试截图。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:30:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0002bqt4l5neqtsa') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr000zbqt4ln3pn2bx', '# 课程建议
- 每周提前阅读需求文档
- 课堂展示前先做一次组内彩排
', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 13:00:00', 'cmqw1sr9g0001bqt44c3s0kqa', 2, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfs0017bqt4jet79wk0', '综合运用特征值与特征向量，建议先化简再计算。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:35:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0007bqt4p55o2ara') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfs0019bqt40ikrhz30', '历史学期复盘作业用于验证跨学期订阅数据。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:37:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0009bqt4i5lpmutg') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr0013bqt4q1sekrdj', '逾期补交实验数据，保留原始记录并说明补交原因。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:31:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0003bqt45qjilal7') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr0015bqt45oaku90g', '完成系统设计文档，包含模块划分与接口说明，并在评审会上做 10 分钟展示。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:33:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0005bqt41y0wbcrp') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr0014bqt4rubvfj9b', '整理今日课堂反馈，标注需要二次确认的问题。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:32:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0004bqt4qy3jviis') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfs0018bqt4rhrzvb4p', '实验报告需包含：实验目的、步骤、数据记录、误差分析与结论。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:36:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, NULL, 'cmqw1srez0008bqt467yuqdec') ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr0010bqt4qdow8lbv', '实验课建议准备护目镜并提前完成预习问答。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 13:30:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, 3, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Description" (id, content, "createdAt", "updatedAt", "lastEditedAt", "lastEditedById", "sectionId", "courseId", "teacherId", "homeworkId") VALUES ('cmqw1srfr0011bqt4odrw0q28', '老师偏好通过 PR review 反馈代码风格问题。', '2026-06-27 07:38:10.024', '2026-06-27 07:38:10.024', '2026-04-28 14:00:00', 'cmqw1sr9g0001bqt44c3s0kqa', NULL, NULL, 1, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: DescriptionEdit; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001abqt4birdj5e8', 'cmqw1srfr000zbqt4ln3pn2bx', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #1', '2026-04-28 14:40:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001bbqt4c9bv5pku', 'cmqw1srfr0010bqt4qdow8lbv', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #2', '2026-04-28 14:41:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001cbqt4wxx3vegf', 'cmqw1srfr0011bqt4odrw0q28', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #3', '2026-04-28 14:42:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001dbqt4cbol545k', 'cmqw1srfr0012bqt48tp2cabf', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #4', '2026-04-28 14:43:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001ebqt48qbsb5f1', 'cmqw1srfr0013bqt4q1sekrdj', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #5', '2026-04-28 14:44:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001fbqt4scvv9krc', 'cmqw1srfr0014bqt4rubvfj9b', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #6', '2026-04-28 14:45:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001gbqt4p3gy3gou', 'cmqw1srfr0015bqt45oaku90g', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #7', '2026-04-28 14:46:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001hbqt4cgp8cn6o', 'cmqw1srfr0016bqt4eal5mfwu', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #8', '2026-04-28 14:47:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001ibqt4d0k4gjc6', 'cmqw1srfs0017bqt4jet79wk0', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #9', '2026-04-28 14:48:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001jbqt4ognf9zll', 'cmqw1srfs0018bqt4rhrzvb4p', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #10', '2026-04-28 14:49:00') ON CONFLICT DO NOTHING;
INSERT INTO public."DescriptionEdit" (id, "descriptionId", "editorId", "previousContent", "nextContent", "createdAt") VALUES ('cmqw1srfw001kbqt4ubazzvpb', 'cmqw1srfs0019bqt40ikrhz30', 'cmqw1sr9g0001bqt44c3s0kqa', '', '[DEV-SCENARIO] description edit #11', '2026-04-28 14:50:00') ON CONFLICT DO NOTHING;


--
-- Data for Name: OAuthClient; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: DeviceCode; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ExamBatch; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."ExamBatch" (id, "nameCn", "nameEn") VALUES (1, '2026年春季学期 期末考试', 'Final Exam 2026 Spring') ON CONFLICT DO NOTHING;


--
-- Data for Name: Exam; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Exam" (id, "jwId", "examType", "startTime", "endTime", "examDate", "examTakeCount", "examMode", "examBatchId", "sectionId") VALUES (1, 9904002, 1, 900, 1100, '2026-05-10', 1, '闭卷', 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Exam" (id, "jwId", "examType", "startTime", "endTime", "examDate", "examTakeCount", "examMode", "examBatchId", "sectionId") VALUES (4, 9904004, 1, 900, 1100, '2026-03-20', 1, '闭卷', 1, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."Exam" (id, "jwId", "examType", "startTime", "endTime", "examDate", "examTakeCount", "examMode", "examBatchId", "sectionId") VALUES (2, 9904001, 1, 900, 1100, '2026-05-09', 1, '闭卷', 1, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."Exam" (id, "jwId", "examType", "startTime", "endTime", "examDate", "examTakeCount", "examMode", "examBatchId", "sectionId") VALUES (3, 9904003, 1, 900, 1100, '2026-05-11', 1, '闭卷', 1, 4) ON CONFLICT DO NOTHING;


--
-- Data for Name: ExamRoom; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."ExamRoom" (id, room, count, "examId") VALUES (1, '一教101', 30, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."ExamRoom" (id, room, count, "examId") VALUES (2, '一教101', 35, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."ExamRoom" (id, room, count, "examId") VALUES (3, '一教101', 40, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."ExamRoom" (id, room, count, "examId") VALUES (4, '一教101', 45, 4) ON CONFLICT DO NOTHING;


--
-- Data for Name: HomeworkAuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000bbqt45m41c8yz', 'created', '迭代一需求拆解', '2026-04-28 01:30:00', 2, 'cmqw1srez0002bqt4l5neqtsa', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000cbqt4fh6youwv', 'created', '逾期实验数据补交', '2026-04-28 01:30:00', 1, 'cmqw1srez0003bqt45qjilal7', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000dbqt4r8m6dvjn', 'created', '今日课堂反馈整理', '2026-04-28 01:30:00', 4, 'cmqw1srez0004bqt4qy3jviis', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000ebqt4x9esknto', 'created', '迭代二系统设计评审', '2026-04-28 01:30:00', 3, 'cmqw1srez0005bqt41y0wbcrp', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000fbqt4pxda9iz9', 'created', '线性变换证明题', '2026-04-28 01:30:00', 2, 'cmqw1srez0006bqt4j01p7cwx', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000gbqt4lnl6nmjt', 'created', '特征值综合练习', '2026-04-28 01:30:00', 1, 'cmqw1srez0007bqt4p55o2ara', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000hbqt4t2eglceu', 'created', '实验报告与误差分析', '2026-04-28 01:30:00', 4, 'cmqw1srez0008bqt467yuqdec', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000ibqt4vc5ewmkm', 'created', '历史学期复盘作业', '2026-04-28 01:30:00', 3, 'cmqw1srez0009bqt4i5lpmutg', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srf6000jbqt4rx8zra45', 'created', '已删除作业', '2026-04-28 01:30:00', 2, 'cmqw1srez000abqt4el2uqvbq', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkAuditLog" (id, action, "titleSnapshot", "createdAt", "sectionId", "homeworkId", "actorId") VALUES ('cmqw1srfa000kbqt4qvp0n59l', 'deleted', '已删除作业', '2026-04-29 04:05:00', 2, 'cmqw1srez000abqt4el2uqvbq', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;


--
-- Data for Name: HomeworkCompletion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."HomeworkCompletion" ("userId", "homeworkId", "completedAt") VALUES ('cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1srez0002bqt4l5neqtsa', '2026-04-27 13:00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."HomeworkCompletion" ("userId", "homeworkId", "completedAt") VALUES ('cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1srez0006bqt4j01p7cwx', '2026-04-30 12:30:00') ON CONFLICT DO NOTHING;


--
-- Data for Name: Jwks; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Session" ("sessionToken", "userId", expires, "createdAt", "updatedAt", id, "ipAddress", "userAgent") VALUES ('dev-scenario/session-dev-user', 'cmqw1sr9g0001bqt44c3s0kqa', '2026-05-06 15:59:00', '2026-06-27 07:38:10.043', '2026-06-27 07:38:10.043', 'cmqw1srgb0022bqt48r404mua', NULL, NULL) ON CONFLICT DO NOTHING;


--
-- Data for Name: OAuthRefreshToken; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: OAuthAccessToken; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: OAuthConsent; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Room; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Room" (id, "jwId", "nameCn", "nameEn", code, floor, virtual, "seatsForSection", remark, seats, "buildingId", "roomTypeId") VALUES (1, 9910031, '一教101', 'Room 101', '101', 1, false, 60, NULL, 60, 1, 1) ON CONFLICT DO NOTHING;


--
-- Data for Name: ScheduleGroup; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (8, 9903004, 2, 60, 33, 2, false, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (5, 9903008, 2, 70, 45, 2, false, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (3, 9903007, 1, 70, 45, 2, true, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (7, 9903006, 2, 90, 57, 2, false, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (6, 9903005, 1, 90, 57, 2, true, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (2, 9903003, 1, 60, 33, 2, true, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (4, 9903001, 1, 80, 58, 2, true, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."ScheduleGroup" (id, "jwId", no, "limitCount", "stdCount", "actualPeriods", "isDefault", "sectionId") VALUES (1, 9903002, 2, 80, 58, 2, false, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: Schedule; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (1, 2, '2026-05-01', 5, 1530, 1700, NULL, '东校区体育场', NULL, 2, NULL, 9, 10, NULL, 2, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (2, 2, '2026-04-30', 4, 1400, 1545, NULL, NULL, NULL, 2, NULL, 7, 8, 1, 2, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (3, 2, '2026-05-01', 5, 1400, 1545, NULL, NULL, NULL, 2, NULL, 7, 8, 1, 1, 8) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (4, 2, '2026-03-29', 7, 1400, 1545, NULL, NULL, NULL, 2, NULL, 7, 8, 1, 3, 5) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (5, 2, '2026-05-01', 5, 830, 1015, NULL, NULL, NULL, 2, NULL, 1, 2, 1, 4, 6) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (6, 2, '2026-05-02', 6, 1400, 1545, NULL, NULL, NULL, 2, NULL, 7, 8, 1, 4, 7) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (7, 2, '2026-04-29', 3, 830, 1015, NULL, NULL, NULL, 2, NULL, 1, 2, 1, 2, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (8, 2, '2026-03-28', 6, 830, 1015, NULL, NULL, NULL, 2, NULL, 1, 2, 1, 3, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."Schedule" (id, periods, date, weekday, "startTime", "endTime", experiment, "customPlace", "lessonType", "weekIndex", "exerciseClass", "startUnit", "endUnit", "roomId", "sectionId", "scheduleGroupId") VALUES (9, 2, '2026-04-30', 4, 830, 1015, NULL, NULL, NULL, 2, NULL, 1, 2, 1, 1, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: TeacherLessonType; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."TeacherLessonType" (id, "jwId", "nameCn", "nameEn", code, role, enabled) VALUES (1, 9910051, '主讲', 'Lecturer', 'LECT', 'lecturer', true) ON CONFLICT DO NOTHING;


--
-- Data for Name: TeacherAssignment; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."TeacherAssignment" (id, "teacherId", "sectionId", role, period, "weekIndices", "weekIndicesMsg", "teacherLessonTypeId") VALUES (1, 1, 2, 'lecturer', 16, '[1, 2, 3, 4, 5, 6, 7, 8]', '1-8 周', 1) ON CONFLICT DO NOTHING;
INSERT INTO public."TeacherAssignment" (id, "teacherId", "sectionId", role, period, "weekIndices", "weekIndicesMsg", "teacherLessonTypeId") VALUES (2, 2, 2, 'lecturer', 16, '[1, 2, 3, 4, 5, 6, 7, 8]', '1-8 周', 1) ON CONFLICT DO NOTHING;
INSERT INTO public."TeacherAssignment" (id, "teacherId", "sectionId", role, period, "weekIndices", "weekIndicesMsg", "teacherLessonTypeId") VALUES (3, 2, 1, 'lecturer', 16, '[1, 2, 3, 4, 5, 6, 7, 8]', '1-8 周', 1) ON CONFLICT DO NOTHING;
INSERT INTO public."TeacherAssignment" (id, "teacherId", "sectionId", role, period, "weekIndices", "weekIndicesMsg", "teacherLessonTypeId") VALUES (4, 3, 4, 'lecturer', 16, '[1, 2, 3, 4, 5, 6, 7, 8]', '1-8 周', 1) ON CONFLICT DO NOTHING;
INSERT INTO public."TeacherAssignment" (id, "teacherId", "sectionId", role, period, "weekIndices", "weekIndicesMsg", "teacherLessonTypeId") VALUES (5, 1, 3, 'lecturer', 16, '[1, 2, 3, 4, 5, 6, 7, 8]', '1-8 周', 1) ON CONFLICT DO NOTHING;


--
-- Data for Name: Todo; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Todo" (id, title, content, completed, priority, "dueAt", "createdAt", "updatedAt", "userId") VALUES ('cmqw1srg2001lbqt472e7nyo4', '补交培养方案确认', '用于验证逾期待办展示', false, 'high', '2026-04-28 01:00:00', '2026-06-27 07:38:10.034', '2026-06-27 07:38:10.034', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."Todo" (id, title, content, completed, priority, "dueAt", "createdAt", "updatedAt", "userId") VALUES ('cmqw1srg2001mbqt4qm0k8skk', '期末报告提交', '需今日完成', false, 'high', '2026-04-29 15:59:00', '2026-06-27 07:38:10.034', '2026-06-27 07:38:10.034', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."Todo" (id, title, content, completed, priority, "dueAt", "createdAt", "updatedAt", "userId") VALUES ('cmqw1srg2001nbqt4vfmekzrf', '三天内复习安排', NULL, false, 'medium', '2026-05-01 10:00:00', '2026-06-27 07:38:10.034', '2026-06-27 07:38:10.034', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."Todo" (id, title, content, completed, priority, "dueAt", "createdAt", "updatedAt", "userId") VALUES ('cmqw1srg2001obqt4fqox8xbo', '下周小组展示准备', NULL, false, 'low', '2026-05-06 15:59:00', '2026-06-27 07:38:10.034', '2026-06-27 07:38:10.034', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."Todo" (id, title, content, completed, priority, "dueAt", "createdAt", "updatedAt", "userId") VALUES ('cmqw1srg2001pbqt485mjxwbj', '整理课程资料', NULL, false, 'medium', NULL, '2026-06-27 07:38:10.034', '2026-06-27 07:38:10.034', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."Todo" (id, title, content, completed, priority, "dueAt", "createdAt", "updatedAt", "userId") VALUES ('cmqw1srg2001qbqt4oz5dc7ks', '代码评审会议记录', NULL, true, 'high', '2026-04-28 12:00:00', '2026-06-27 07:38:10.034', '2026-06-27 07:38:10.034', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;


--
-- Data for Name: UploadPending; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."UploadPending" (id, key, filename, "contentType", size, "expiresAt", "createdAt", "updatedAt", "userId") VALUES ('cmqw1srg60020bqt4ojzcp279', 'dev-scenario/pending-lab-template.xlsx', 'pending-lab-template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 52000, '2026-04-30 15:59:00', '2026-06-27 07:38:10.038', '2026-06-27 07:38:10.038', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;


--
-- Data for Name: UserSuspension; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."UserSuspension" (id, "userId", "createdById", "createdAt", reason, note, "expiresAt", "liftedAt", "liftedById") VALUES ('cmqw1srge0024bqt46b44xfjz', 'cmqw1sr9g0001bqt44c3s0kqa', 'cmqw1sr9e0000bqt4j4a16ffb', '2026-06-27 07:38:10.046', '[DEV-SCENARIO] 账号异常临时限制', '用于管理端权限与解除限制流程测试。', '2026-05-02 15:59:00', '2026-04-29 01:00:00', 'cmqw1sr9e0000bqt4j4a16ffb') ON CONFLICT DO NOTHING;


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."VerificationToken" (identifier, token, expires, id, "createdAt", "updatedAt") VALUES ('dev-scenario/verify-dev-user', 'scenario-verify-token', '2026-05-01 15:59:00', 'cmqw1srgc0023bqt4s3npk7pr', '2026-06-27 07:38:10.044', '2026-06-27 07:38:10.044') ON CONFLICT DO NOTHING;


--
-- Data for Name: VerifiedEmail; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."VerifiedEmail" (id, email, provider, "createdAt", "updatedAt", "userId") VALUES (1, 'dev-user@ustc.edu.cn', 'dev-scenario', '2026-06-27 07:38:10.04', '2026-06-27 07:38:10.04', 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;


--
-- Data for Name: _ScheduleTeachers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (2, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (3, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (2, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (1, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (4, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (6, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (8, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (9, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (5, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (7, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_ScheduleTeachers" ("A", "B") VALUES (7, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: _SectionAdminClasses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."_SectionAdminClasses" ("A", "B") VALUES (1, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."_SectionAdminClasses" ("A", "B") VALUES (1, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_SectionAdminClasses" ("A", "B") VALUES (1, 4) ON CONFLICT DO NOTHING;
INSERT INTO public."_SectionAdminClasses" ("A", "B") VALUES (1, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: _SectionTeachers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."_SectionTeachers" ("A", "B") VALUES (3, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_SectionTeachers" ("A", "B") VALUES (1, 2) ON CONFLICT DO NOTHING;
INSERT INTO public."_SectionTeachers" ("A", "B") VALUES (4, 3) ON CONFLICT DO NOTHING;
INSERT INTO public."_SectionTeachers" ("A", "B") VALUES (2, 1) ON CONFLICT DO NOTHING;
INSERT INTO public."_SectionTeachers" ("A", "B") VALUES (2, 2) ON CONFLICT DO NOTHING;


--
-- Data for Name: _UserCalendarSections; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."_UserCalendarSections" ("A", "B") VALUES (1, 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."_UserCalendarSections" ("A", "B") VALUES (2, 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."_UserCalendarSections" ("A", "B") VALUES (3, 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;
INSERT INTO public."_UserCalendarSections" ("A", "B") VALUES (4, 'cmqw1sr9g0001bqt44c3s0kqa') ON CONFLICT DO NOTHING;


--
-- Name: AdminClass_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AdminClass_id_seq"', 1, true);


--
-- Name: Building_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Building_id_seq"', 1, true);


--
-- Name: BusRouteStop_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."BusRouteStop_id_seq"', 13, true);


--
-- Name: BusScheduleVersion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."BusScheduleVersion_id_seq"', 1, true);


--
-- Name: BusTrip_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."BusTrip_id_seq"', 22, true);


--
-- Name: Campus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Campus_id_seq"', 1, true);


--
-- Name: ClassType_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ClassType_id_seq"', 1, true);


--
-- Name: CourseCategory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."CourseCategory_id_seq"', 1, true);


--
-- Name: CourseClassify_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."CourseClassify_id_seq"', 1, true);


--
-- Name: CourseGradation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."CourseGradation_id_seq"', 1, true);


--
-- Name: CourseType_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."CourseType_id_seq"', 1, true);


--
-- Name: Course_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Course_id_seq"', 4, true);


--
-- Name: Department_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Department_id_seq"', 1, true);


--
-- Name: EducationLevel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."EducationLevel_id_seq"', 1, true);


--
-- Name: ExamBatch_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ExamBatch_id_seq"', 1, true);


--
-- Name: ExamMode_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ExamMode_id_seq"', 1, true);


--
-- Name: ExamRoom_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ExamRoom_id_seq"', 4, true);


--
-- Name: Exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Exam_id_seq"', 4, true);


--
-- Name: RoomType_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RoomType_id_seq"', 1, true);


--
-- Name: Room_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Room_id_seq"', 1, true);


--
-- Name: ScheduleGroup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ScheduleGroup_id_seq"', 8, true);


--
-- Name: Schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Schedule_id_seq"', 9, true);


--
-- Name: SectionTeacher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."SectionTeacher_id_seq"', 5, true);


--
-- Name: Section_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Section_id_seq"', 4, true);


--
-- Name: Semester_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Semester_id_seq"', 2, true);


--
-- Name: TeachLanguage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."TeachLanguage_id_seq"', 1, true);


--
-- Name: TeacherAssignment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."TeacherAssignment_id_seq"', 5, true);


--
-- Name: TeacherLessonType_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."TeacherLessonType_id_seq"', 1, true);


--
-- Name: TeacherTitle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."TeacherTitle_id_seq"', 1, true);


--
-- Name: Teacher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Teacher_id_seq"', 3, true);


--
-- Name: VerifiedEmail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."VerifiedEmail_id_seq"', 1, true);


--
-- PostgreSQL database dump complete
--



COMMIT;

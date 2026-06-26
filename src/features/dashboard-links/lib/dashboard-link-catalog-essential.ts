import type { DashboardLinkItem } from "@/features/dashboard-links/lib/dashboard-link-catalog";

export const USTC_ESSENTIAL_LINKS: DashboardLinkItem[] = [
  {
    slug: "jw",
    title: "教务系统",
    url: "https://jw.ustc.edu.cn/",
    description: "选课、成绩与教学事务。",
    localizations: {
      "en-us": {
        title: "Academic Affairs System",
        description: "Course selection, grades, and teaching affairs.",
      },
    },
    category: "academic",
    icon: "clipboard-list",
  },
  {
    slug: "icourse",
    title: "评课社区",
    url: "https://icourse.club/",
    description: "课程评价与经验分享。",
    localizations: {
      "en-us": {
        title: "iCourse Review Community",
        description: "Course reviews and study experience sharing.",
      },
    },
    category: "community",
    icon: "users",
  },
  {
    slug: "mail",
    title: "邮箱",
    url: "https://mail.ustc.edu.cn/",
    description: "USTC 邮件系统。",
    localizations: {
      "en-us": {
        title: "USTC Email",
        description: "USTC email service.",
      },
    },
    category: "services",
    icon: "mail",
  },
  {
    slug: "library",
    title: "图书馆",
    url: "http://lib.ustc.edu.cn/",
    description: "图书检索与数据库资源。",
    localizations: {
      "en-us": {
        title: "Library",
        description: "Library catalog search and database resources.",
      },
    },
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "official",
    title: "科大官网",
    url: "https://www.ustc.edu.cn/",
    description: "学校新闻与公告。",
    localizations: {
      "en-us": {
        title: "USTC Official Site",
        description: "University news and announcements.",
      },
    },
    category: "campus",
    icon: "school",
  },
  {
    slug: "course-platform",
    title: "网络教学平台",
    url: "https://course.ustc.edu.cn/portal",
    description: "课程资料与在线学习。",
    localizations: {
      "en-us": {
        title: "Online Teaching Platform",
        description: "Course materials and online learning.",
      },
    },
    category: "academic",
    icon: "monitor-play",
  },
  {
    slug: "education-office",
    title: "教务处",
    url: "https://www.teach.ustc.edu.cn/",
    description: "教学管理与通知。",
    localizations: {
      "en-us": {
        title: "Academic Affairs Office",
        description: "Teaching administration and notices.",
      },
    },
    category: "services",
    icon: "graduation-cap",
  },
  {
    slug: "nan7",
    title: "南七集市",
    url: "https://nan7market.com/",
    description: "校园社区信息平台。",
    localizations: {
      "en-us": {
        title: "Nanqi Market",
        description: "Campus community information platform.",
      },
    },
    category: "community",
    icon: "building",
  },
  {
    slug: "network",
    title: "网络通",
    url: "http://wlt.ustc.edu.cn/",
    description: "网络服务与套餐办理。",
    localizations: {
      "en-us": {
        title: "Network Portal",
        description: "Network services and plan management.",
      },
    },
    category: "services",
    icon: "network",
  },
  {
    slug: "staff-homepage",
    title: "教工 FTP 主页",
    url: "http://staff.ustc.edu.cn/",
    description: "教工主页与相关入口。",
    localizations: {
      "en-us": {
        title: "Faculty FTP Homepages",
        description: "Faculty homepage and related entry points.",
      },
    },
    category: "services",
    icon: "building",
  },
  {
    slug: "legacy-jw",
    title: "旧版教务系统",
    url: "https://mis.teach.ustc.edu.cn/",
    description: "历史教务系统入口。",
    localizations: {
      "en-us": {
        title: "Legacy Academic Affairs System",
        description: "Entry point for the legacy academic affairs system.",
      },
    },
    category: "academic",
    icon: "clipboard-list",
  },
  {
    slug: "physics-lab-1",
    title: "大物实验 1",
    url: "https://jxzy.ustc.edu.cn/",
    description: "大学物理实验平台入口。",
    localizations: {
      "en-us": {
        title: "College Physics Lab 1",
        description: "College physics experiment platform entry.",
      },
    },
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "catalog-query",
    title: "公共查询",
    url: "https://catalog.ustc.edu.cn/query",
    description: "校内公共信息查询。",
    localizations: {
      "en-us": {
        title: "Public Information Query",
        description: "Campus public information lookup.",
      },
    },
    category: "services",
    icon: "clipboard-list",
  },
  {
    slug: "ta-management",
    title: "助教管理系统",
    url: "https://tam.cmet.ustc.edu.cn/",
    description: "助教任务与流程管理。",
    localizations: {
      "en-us": {
        title: "Teaching Assistant Management",
        description: "Teaching assistant tasks and workflow management.",
      },
    },
    category: "academic",
    icon: "graduation-cap",
  },
  {
    slug: "physics-lab-2",
    title: "大物实验 2",
    url: "http://etis.ustc.edu.cn/",
    description: "大学物理实验平台入口。",
    localizations: {
      "en-us": {
        title: "College Physics Lab 2",
        description: "College physics experiment platform entry.",
      },
    },
    category: "academic",
    icon: "book-open",
  },
];

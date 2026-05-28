export type DashboardLinkCategory =
  | "academic"
  | "community"
  | "services"
  | "campus";

export type DashboardLinkIcon =
  | "book-open"
  | "clipboard-list"
  | "building"
  | "graduation-cap"
  | "mail"
  | "monitor-play"
  | "network"
  | "school"
  | "users";

export type DashboardLinkItem = {
  slug: string;
  title: string;
  url: string;
  description: string;
  category: DashboardLinkCategory;
  icon: DashboardLinkIcon;
};

export type DashboardLinkGroup =
  | "mostClicked"
  | "study"
  | "life"
  | "tech"
  | "classroom"
  | "external"
  | "graduate"
  | "leastClicked";

/**
 * Curated from https://github.com/SmartHypercube/ustclife (CC BY-SA 4.0).
 */
export const USTC_DASHBOARD_LINKS: DashboardLinkItem[] = [
  {
    slug: "jw",
    title: "教务系统",
    url: "https://jw.ustc.edu.cn/",
    description: "选课、成绩与教学事务。",
    category: "academic",
    icon: "clipboard-list",
  },
  {
    slug: "icourse",
    title: "评课社区",
    url: "https://icourse.club/",
    description: "课程评价与经验分享。",
    category: "community",
    icon: "users",
  },
  {
    slug: "mail",
    title: "邮箱",
    url: "https://mail.ustc.edu.cn/",
    description: "USTC 邮件系统。",
    category: "services",
    icon: "mail",
  },
  {
    slug: "library",
    title: "图书馆",
    url: "http://lib.ustc.edu.cn/",
    description: "图书检索与数据库资源。",
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "official",
    title: "科大官网",
    url: "https://www.ustc.edu.cn/",
    description: "学校新闻与公告。",
    category: "campus",
    icon: "school",
  },
  {
    slug: "course-platform",
    title: "网络教学平台",
    url: "https://course.ustc.edu.cn/portal",
    description: "课程资料与在线学习。",
    category: "academic",
    icon: "monitor-play",
  },
  {
    slug: "education-office",
    title: "教务处",
    url: "https://www.teach.ustc.edu.cn/",
    description: "教学管理与通知。",
    category: "services",
    icon: "graduation-cap",
  },
  {
    slug: "nan7",
    title: "南七集市",
    url: "https://nan7market.com/",
    description: "校园社区信息平台。",
    category: "community",
    icon: "building",
  },
  {
    slug: "network",
    title: "网络通",
    url: "http://wlt.ustc.edu.cn/",
    description: "网络服务与套餐办理。",
    category: "services",
    icon: "network",
  },
  {
    slug: "staff-homepage",
    title: "教工 FTP 主页",
    url: "http://staff.ustc.edu.cn/",
    description: "教工主页与相关入口。",
    category: "services",
    icon: "building",
  },
  {
    slug: "legacy-jw",
    title: "旧版教务系统",
    url: "https://mis.teach.ustc.edu.cn/",
    description: "历史教务系统入口。",
    category: "academic",
    icon: "clipboard-list",
  },
  {
    slug: "physics-lab-1",
    title: "大物实验 1",
    url: "https://jxzy.ustc.edu.cn/",
    description: "大学物理实验平台入口。",
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "catalog-query",
    title: "公共查询",
    url: "https://catalog.ustc.edu.cn/query",
    description: "校内公共信息查询。",
    category: "services",
    icon: "clipboard-list",
  },
  {
    slug: "ta-management",
    title: "助教管理系统",
    url: "https://tam.cmet.ustc.edu.cn/",
    description: "助教任务与流程管理。",
    category: "academic",
    icon: "graduation-cap",
  },
  {
    slug: "physics-lab-2",
    title: "大物实验 2",
    url: "http://etis.ustc.edu.cn/",
    description: "大学物理实验平台入口。",
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "student-services",
    title: "学工一体化",
    url: "https://xgyth.ustc.edu.cn/",
    description: "学工事务统一办理入口。",
    category: "services",
    icon: "building",
  },
  {
    slug: "ot-club",
    title: "蜗壳学社",
    url: "https://ot.ustc.edu.cn/",
    description: "校园社群与交流。",
    category: "community",
    icon: "users",
  },
  {
    slug: "study-space-booking",
    title: "学习空间预约",
    url: "https://lib.ustc.edu.cn/%e5%9b%be%e4%b9%a6%e9%a6%86%e7%a0%94%e4%bf%ae%e9%97%b4%e9%a2%84%e7%ba%a6%e7%b3%bb%e7%bb%9f/",
    description: "图书馆学习空间预约。",
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "cmet-room-booking",
    title: "中区研修室预约",
    url: "http://roombooking.cmet.ustc.edu.cn/",
    description: "中区研修室预约系统。",
    category: "academic",
    icon: "building",
  },
  {
    slug: "dawu-tools",
    title: "大雾实验工具",
    url: "https://dawu.feixu.site/",
    description: "实验相关辅助工具。",
    category: "academic",
    icon: "monitor-play",
  },
  {
    slug: "physics-lab-3",
    title: "大物实验 3",
    url: "https://pems.ustc.edu.cn/",
    description: "大学物理实验平台入口。",
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "history-culture",
    title: "历史文化",
    url: "http://lswhw.ustc.edu.cn/",
    description: "校园历史与文化资源。",
    category: "campus",
    icon: "school",
  },
  {
    slug: "bbs",
    title: "瀚海星云",
    url: "https://bbs.ustc.edu.cn/",
    description: "校园论坛社区。",
    category: "community",
    icon: "users",
  },
  {
    slug: "confession-wall",
    title: "表白墙",
    url: "http://www.ustcbbq.com/",
    description: "校园匿名交流平台。",
    category: "community",
    icon: "users",
  },
  {
    slug: "campus-portal",
    title: "校园信息门户",
    url: "https://i.ustc.edu.cn/",
    description: "校园信息统一门户。",
    category: "services",
    icon: "building",
  },
  {
    slug: "personal-homepage",
    title: "个人 FTP 主页",
    url: "http://home.ustc.edu.cn/",
    description: "个人主页服务入口。",
    category: "services",
    icon: "building",
  },
  {
    slug: "rec",
    title: "睿客网",
    url: "https://rec.ustc.edu.cn/",
    description: "校园资源与服务入口。",
    category: "campus",
    icon: "school",
  },
  {
    slug: "ecard",
    title: "一卡通管理",
    url: "https://ecard.ustc.edu.cn/",
    description: "校园一卡通服务。",
    category: "services",
    icon: "mail",
  },
  {
    slug: "admission-rain",
    title: "Admission Rain",
    url: "https://adrain.ustclug.org/",
    description: "招生相关信息聚合。",
    category: "campus",
    icon: "graduation-cap",
  },
  {
    slug: "licensed-software",
    title: "正版软件",
    url: "https://zbh.ustc.edu.cn/",
    description: "校内正版软件服务。",
    category: "services",
    icon: "monitor-play",
  },
  {
    slug: "print-service",
    title: "自助打印复印",
    url: "https://weixinprinthost.woquyun.com/wq-web/",
    description: "打印复印自助服务。",
    category: "services",
    icon: "clipboard-list",
  },
  {
    slug: "second-classroom",
    title: "第二课堂",
    url: "https://young.ustc.edu.cn/login",
    description: "第二课堂活动平台。",
    category: "campus",
    icon: "school",
  },
  {
    slug: "n7-teahouse",
    title: "南七茶馆",
    url: "https://ustcforum.com/",
    description: "校园论坛交流社区。",
    category: "community",
    icon: "users",
  },
  {
    slug: "flyer",
    title: "飞跃网站",
    url: "https://ustcflyer.com/",
    description: "学习与留学信息社区。",
    category: "community",
    icon: "users",
  },
  {
    slug: "qq-proof",
    title: "QQ 号证明",
    url: "https://qq.ustc.life/",
    description: "USTC 身份关联证明。",
    category: "services",
    icon: "clipboard-list",
  },
  {
    slug: "cloud-drive",
    title: "科大云盘",
    url: "https://pan.ustc.edu.cn/",
    description: "校内云盘与文件共享。",
    category: "services",
    icon: "network",
  },
  {
    slug: "web-vpn",
    title: "Web VPN",
    url: "https://wvpn.ustc.edu.cn/",
    description: "校外访问校内资源。",
    category: "services",
    icon: "network",
  },
  {
    slug: "mirrors",
    title: "开源软件镜像",
    url: "https://mirrors.ustc.edu.cn/",
    description: "开源软件镜像下载。",
    category: "services",
    icon: "network",
  },
  {
    slug: "scc-gitlab",
    title: "SCC GitLab",
    url: "https://git.ustc.edu.cn/",
    description: "校内代码托管服务。",
    category: "services",
    icon: "monitor-play",
  },
  {
    slug: "lug-gitlab",
    title: "LUG GitLab",
    url: "https://git.lug.ustc.edu.cn/",
    description: "LUG 社区代码托管。",
    category: "community",
    icon: "monitor-play",
  },
  {
    slug: "ustc-latex",
    title: "USTC LaTeX",
    url: "https://latex.ustc.edu.cn/",
    description: "LaTeX 在线编辑与模板。",
    category: "academic",
    icon: "book-open",
  },
  {
    slug: "vlab",
    title: "Vlab",
    url: "https://vlab.ustc.edu.cn/",
    description: "虚拟实验教学平台。",
    category: "academic",
    icon: "monitor-play",
  },
  {
    slug: "classroom-2",
    title: "二教",
    url: "http://bigscreen.cmet.ustc.edu.cn/#/2",
    description: "二教教室信息大屏。",
    category: "campus",
    icon: "building",
  },
  {
    slug: "classroom-3",
    title: "三教",
    url: "http://bigscreen.cmet.ustc.edu.cn/#/3",
    description: "三教教室信息大屏。",
    category: "campus",
    icon: "building",
  },
  {
    slug: "classroom-5",
    title: "五教",
    url: "http://bigscreen.cmet.ustc.edu.cn/#/5",
    description: "五教教室信息大屏。",
    category: "campus",
    icon: "building",
  },
  {
    slug: "zhihu",
    title: "知乎",
    url: "https://www.zhihu.com/",
    description: "问答与知识社区。",
    category: "community",
    icon: "users",
  },
  {
    slug: "bilibili",
    title: "bilibili",
    url: "https://www.bilibili.com/",
    description: "视频与学习内容平台。",
    category: "community",
    icon: "users",
  },
  {
    slug: "weibo",
    title: "微博",
    url: "https://www.weibo.com/",
    description: "社交媒体与资讯平台。",
    category: "community",
    icon: "users",
  },
  {
    slug: "grad-service-platform",
    title: "综合服务平台",
    url: "https://yjs1.ustc.edu.cn/",
    description: "研究生综合事务平台。",
    category: "academic",
    icon: "graduation-cap",
  },
  {
    slug: "epc-platform",
    title: "EPC 平台",
    url: "https://epc.ustc.edu.cn/main.asp",
    description: "研究生培养过程平台。",
    category: "academic",
    icon: "graduation-cap",
  },
  {
    slug: "gradschool",
    title: "研究生院网站",
    url: "https://gradschool.ustc.edu.cn/",
    description: "研究生院官方站点。",
    category: "academic",
    icon: "school",
  },
  {
    slug: "study-guidance",
    title: "学业指导中心",
    url: "http://202.38.65.52/xyzd/",
    description: "学业咨询与支持服务。",
    category: "academic",
    icon: "graduation-cap",
  },
  {
    slug: "campus-wiki",
    title: "校园百科",
    url: "https://baike.ustc.edu.cn/",
    description: "校园知识百科。",
    category: "campus",
    icon: "school",
  },
  {
    slug: "hpc-center",
    title: "超算中心",
    url: "https://scc.ustc.edu.cn/",
    description: "高性能计算资源入口。",
    category: "services",
    icon: "network",
  },
  {
    slug: "payment-system",
    title: "网上缴费系统",
    url: "https://sf.ustc.edu.cn/",
    description: "校内缴费服务平台。",
    category: "services",
    icon: "mail",
  },
  {
    slug: "hospital",
    title: "校医院",
    url: "https://hospital.ustc.edu.cn/",
    description: "校医院与医疗服务。",
    category: "campus",
    icon: "building",
  },
  {
    slug: "transcript-verify",
    title: "成绩单打印",
    url: "https://verify-transcript.cmet.ustc.edu.cn/manager.action",
    description: "成绩单打印与验证。",
    category: "academic",
    icon: "clipboard-list",
  },
  {
    slug: "welcome",
    title: "迎新网",
    url: "https://welcome.ustc.edu.cn/",
    description: "新生报到与迎新信息。",
    category: "campus",
    icon: "school",
  },
  {
    slug: "admissions-office",
    title: "招生办",
    url: "https://zsb.ustc.edu.cn/",
    description: "招生政策与通知。",
    category: "campus",
    icon: "graduation-cap",
  },
  {
    slug: "equipment-repair",
    title: "教学设备报修",
    url: "https://fix.ustc.edu.cn/",
    description: "教学设备故障报修。",
    category: "services",
    icon: "clipboard-list",
  },
];

export const DASHBOARD_LINK_GROUP_ORDER: DashboardLinkGroup[] = [
  "mostClicked",
  "study",
  "life",
  "tech",
  "classroom",
  "external",
  "graduate",
  "leastClicked",
];

export const DASHBOARD_LINK_GROUPS: Record<DashboardLinkGroup, string[]> = {
  mostClicked: [
    "jw",
    "icourse",
    "mail",
    "library",
    "official",
    "course-platform",
    "education-office",
    "nan7",
    "network",
  ],
  study: [
    "staff-homepage",
    "legacy-jw",
    "physics-lab-1",
    "catalog-query",
    "ta-management",
    "physics-lab-2",
    "student-services",
    "ot-club",
    "study-space-booking",
    "cmet-room-booking",
    "dawu-tools",
    "physics-lab-3",
  ],
  life: [
    "history-culture",
    "bbs",
    "confession-wall",
    "campus-portal",
    "personal-homepage",
    "rec",
    "ecard",
    "admission-rain",
    "licensed-software",
    "print-service",
    "second-classroom",
    "n7-teahouse",
    "flyer",
    "qq-proof",
    "cloud-drive",
  ],
  tech: [
    "web-vpn",
    "mirrors",
    "scc-gitlab",
    "lug-gitlab",
    "ustc-latex",
    "vlab",
  ],
  classroom: ["classroom-2", "classroom-3", "classroom-5"],
  external: ["zhihu", "bilibili", "weibo"],
  graduate: ["grad-service-platform", "epc-platform", "gradschool"],
  leastClicked: [
    "study-guidance",
    "campus-wiki",
    "hpc-center",
    "payment-system",
    "hospital",
    "transcript-verify",
    "welcome",
    "admissions-office",
    "equipment-repair",
  ],
};

const DASHBOARD_LINK_GROUP_BY_SLUG: Record<string, DashboardLinkGroup> =
  Object.fromEntries(
    DASHBOARD_LINK_GROUP_ORDER.flatMap((group) =>
      DASHBOARD_LINK_GROUPS[group].map((slug) => [slug, group] as const),
    ),
  );

export function getDashboardLinkGroup(slug: string): DashboardLinkGroup {
  return DASHBOARD_LINK_GROUP_BY_SLUG[slug] ?? "leastClicked";
}

export type LinkClickStats = Record<string, number>;

export function recommendDashboardLinks(
  clickStats: LinkClickStats,
  options: {
    limit?: number;
    excludeSlugs?: string[];
  } = {},
): DashboardLinkItem[] {
  const limit = options.limit ?? 3;
  const excluded = new Set(options.excludeSlugs ?? []);
  const candidateLinks = USTC_DASHBOARD_LINKS.filter(
    (link) => !excluded.has(link.slug),
  );

  return [...candidateLinks]
    .sort((left, right) => {
      const rightCount = clickStats[right.slug] ?? 0;
      const leftCount = clickStats[left.slug] ?? 0;
      if (rightCount === leftCount) {
        return left.title.localeCompare(right.title, "zh-CN");
      }
      return rightCount - leftCount;
    })
    .slice(0, limit);
}

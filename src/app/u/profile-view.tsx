import type { useTranslations } from "next-intl";
import { PageLayout } from "@/components/page-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import type { ProfileData } from "./profile-data";

type ProfileViewProps = {
  data: ProfileData;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  /** Whether to show the user ID (used by /u/id/[uid]) */
  showUserId?: boolean;
};

export function ProfileView({
  data,
  locale,
  t,
  showUserId = false,
}: ProfileViewProps) {
  const { user, sectionCount, weeks, totalContributions } = data;
  const dateFormatter = createShanghaiDateTimeFormatter(locale, {
    dateStyle: "medium",
  });

  const colorForCount = (count: number) => {
    if (count <= 0) return "bg-muted/40";
    if (count === 1) return "bg-emerald-200";
    if (count <= 3) return "bg-emerald-400";
    if (count <= 6) return "bg-emerald-600";
    return "bg-emerald-800";
  };

  return (
    <PageLayout>
      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.image ?? ""} />
                <AvatarFallback>
                  {(user.name ?? user.username ?? "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="truncate">
                  {showUserId
                    ? (user.name ?? user.username ?? t("idLabel"))
                    : (user.name ?? user.username)}
                </CardTitle>
                {showUserId ? (
                  user.username ? (
                    <CardDescription className="truncate">
                      @{user.username}
                    </CardDescription>
                  ) : null
                ) : (
                  <CardDescription className="truncate">
                    @{user.username}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardPanel className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {t("joinedAt", { date: dateFormatter.format(user.createdAt) })}
            </p>
            {showUserId ? (
              <p className="text-muted-foreground">
                {t("idLabel")}: {user.id}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">
                  {t("stats.sections")}
                </p>
                <p className="font-semibold text-xl">{sectionCount}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">
                  {t("stats.comments")}
                </p>
                <p className="font-semibold text-xl">{user._count.comments}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">
                  {t("stats.uploads")}
                </p>
                <p className="font-semibold text-xl">{user._count.uploads}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">
                  {t("stats.homeworks")}
                </p>
                <p className="font-semibold text-xl">
                  {user._count.homeworksCreated}
                </p>
              </div>
            </div>
          </CardPanel>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              {t("contribution.title", { count: totalContributions })}
            </CardTitle>
            <CardDescription>{t("contribution.description")}</CardDescription>
          </CardHeader>
          <CardPanel className="min-w-0">
            <div className="w-full max-w-full pb-2">
              <div className="grid w-full auto-cols-fr grid-flow-col gap-px">
                {weeks.map((week, weekIndex) => (
                  <div
                    key={week[0]?.date ?? `week-${weekIndex}`}
                    className="flex min-w-0 flex-col gap-px"
                  >
                    {week.map((day) => (
                      <div
                        key={day.date}
                        className={`${colorForCount(day.count)} aspect-square w-full rounded-[1px] md:rounded-[2px]`}
                        title={t("contribution.cell", {
                          count: day.count,
                          date: dateFormatter.format(new Date(day.date)),
                        })}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-muted-foreground text-xs">
              <span>{t("contribution.less")}</span>
              <span className="h-2 w-2 rounded-[2px] bg-muted/40 md:h-2.5 md:w-2.5" />
              <span className="h-2 w-2 rounded-[2px] bg-emerald-200 md:h-2.5 md:w-2.5" />
              <span className="h-2 w-2 rounded-[2px] bg-emerald-400 md:h-2.5 md:w-2.5" />
              <span className="h-2 w-2 rounded-[2px] bg-emerald-600 md:h-2.5 md:w-2.5" />
              <span className="h-2 w-2 rounded-[2px] bg-emerald-800 md:h-2.5 md:w-2.5" />
              <span>{t("contribution.more")}</span>
            </div>
            {totalContributions === 0 ? (
              <p className="mt-4 text-muted-foreground text-sm">
                {t("contribution.empty")}
              </p>
            ) : null}
          </CardPanel>
        </Card>
      </div>
    </PageLayout>
  );
}

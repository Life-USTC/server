<script lang="ts">
import type { AppLocale } from "@/i18n/config";
import type { ProfileCopy } from "@/lib/profile-copy";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import ProfileContributionCard from "./ProfileContributionCard.svelte";
import ProfileSummaryCard from "./ProfileSummaryCard.svelte";

type ContributionCell = {
  date: string;
  count: number;
};

type Profile = {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    createdAt: Date | string;
    _count: {
      comments: number;
      uploads: number;
      homeworksCreated: number;
      subscribedSections: number;
    };
  };
  sectionCount: number;
  copy: ProfileCopy;
  locale: AppLocale;
  weeks: ContributionCell[][];
  totalContributions: number;
};

export let profile: Profile;
export let showUserId = false;

$: user = profile.user;
$: copy = profile.copy.publicProfile;
$: dateFormatter = createShanghaiDateTimeFormatter(profile.locale, {
  dateStyle: "medium",
});
$: displayName = user.name ?? user.username ?? copy.idLabel;
$: initials = displayName.slice(0, 1).toUpperCase();
$: joinedDate = dateFormatter.format(new Date(user.createdAt));

$: stats = [
  { label: copy.stats.sections, value: profile.sectionCount },
  { label: copy.stats.comments, value: user._count.comments },
  { label: copy.stats.uploads, value: user._count.uploads },
  { label: copy.stats.homeworks, value: user._count.homeworksCreated },
];
</script>

<section class="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
  <ProfileSummaryCard
    {copy}
    {displayName}
    {initials}
    {joinedDate}
    {showUserId}
    {stats}
    {user}
  />

  <ProfileContributionCard
    {copy}
    {dateFormatter}
    locale={profile.locale}
    {stats}
    totalContributions={profile.totalContributions}
    weeks={profile.weeks}
  />
</section>

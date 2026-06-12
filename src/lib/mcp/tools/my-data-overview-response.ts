import {
  summarizeExamCard,
  summarizeHomeworkCard,
  summarizeTodoCard,
} from "@/lib/mcp/tools/event-summary";
import type {
  loadMyOverviewCounts,
  loadMyOverviewSamples,
} from "./my-data-overview-loaders";

type MyOverviewCounts = Awaited<ReturnType<typeof loadMyOverviewCounts>>;
type MyOverviewSamples = Awaited<ReturnType<typeof loadMyOverviewSamples>>;

export function buildMyOverviewSummaryPayload({
  counts,
  samples,
  user,
}: {
  counts: MyOverviewCounts;
  samples: MyOverviewSamples;
  user: { id: string; image: string | null; name: string | null };
}) {
  return {
    user: {
      id: user.id,
      name: user.name,
      image: user.image,
    },
    overview: counts,
    samples: {
      dueTodos: {
        total: samples.dueTodos.length,
        items: samples.dueTodos.slice(0, 3).map(summarizeTodoCard),
      },
      dueHomeworks: {
        total: samples.dueHomeworks.length,
        items: samples.dueHomeworks.slice(0, 3).map(summarizeHomeworkCard),
      },
      upcomingExams: {
        total: samples.upcomingExams.length,
        items: samples.upcomingExams.slice(0, 3).map(summarizeExamCard),
      },
    },
  };
}

export function buildMyOverviewFullPayload({
  counts,
  samples,
  user,
}: {
  counts: MyOverviewCounts;
  samples: MyOverviewSamples;
  user: {
    id: string;
    image: string | null;
    isAdmin: boolean;
    name: string | null;
  };
}) {
  return {
    user: {
      id: user.id,
      name: user.name,
      image: user.image,
      isAdmin: user.isAdmin,
    },
    overview: counts,
    samples,
  };
}

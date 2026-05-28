"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type HomeworkViewMode = "cards" | "list";

const HOMEWORK_VIEW_MODE_PARAM = "homeworkView";
const HOMEWORK_VIEW_MODE_STORAGE_KEY = "life-ustc-dashboard-homework-view-mode";

function normalizeHomeworkViewMode(value: string | null): HomeworkViewMode {
  return value === "list" ? "list" : "cards";
}

function isHomeworkViewMode(value: string | null): value is HomeworkViewMode {
  return value === "cards" || value === "list";
}

export function useHomeworkViewMode() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<HomeworkViewMode>(() =>
    normalizeHomeworkViewMode(searchParams.get(HOMEWORK_VIEW_MODE_PARAM)),
  );

  useEffect(() => {
    const viewModeParam = searchParams.get(HOMEWORK_VIEW_MODE_PARAM);
    if (isHomeworkViewMode(viewModeParam)) {
      setViewMode(viewModeParam);
      window.localStorage.setItem(
        HOMEWORK_VIEW_MODE_STORAGE_KEY,
        viewModeParam,
      );
      return;
    }

    const cachedViewMode = window.localStorage.getItem(
      HOMEWORK_VIEW_MODE_STORAGE_KEY,
    );
    if (isHomeworkViewMode(cachedViewMode)) {
      setViewMode(cachedViewMode);
      return;
    }

    if (cachedViewMode !== null) {
      window.localStorage.removeItem(HOMEWORK_VIEW_MODE_STORAGE_KEY);
    }
    setViewMode("cards");
  }, [searchParams]);

  const changeViewMode = (mode: HomeworkViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(HOMEWORK_VIEW_MODE_STORAGE_KEY, mode);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (mode === "cards") {
      nextParams.delete(HOMEWORK_VIEW_MODE_PARAM);
    } else {
      nextParams.set(HOMEWORK_VIEW_MODE_PARAM, mode);
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  };

  return { viewMode, changeViewMode };
}

export type { HomeworkViewMode };

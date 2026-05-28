"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { uploadsListResponseSchema } from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import type { UploadSummary } from "../lib/upload-client";

export type UploadOption = {
  id: string;
  filename: string;
  size: number;
  key?: string;
};

export function useUploadsSummary({ enabled }: { enabled: boolean }) {
  const [uploads, setUploads] = useState<UploadOption[]>([]);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  const addUpload = useCallback(
    (upload: UploadOption, nextSummary: UploadSummary) => {
      setUploads((current) => [upload, ...current]);
      setSummary(nextSummary);
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setUploads([]);
      setSummary(null);
      return;
    }

    const loadUploads = async () => {
      try {
        const { data, response } = await apiClient.GET("/api/uploads");
        if (!response.ok || !data) return;
        const parsed = uploadsListResponseSchema.safeParse(data);
        if (!parsed.success) return;
        setUploads(parsed.data.uploads);
        setSummary({
          maxFileSizeBytes: parsed.data.maxFileSizeBytes,
          quotaBytes: parsed.data.quotaBytes,
          usedBytes: parsed.data.usedBytes,
        });
      } catch (error) {
        logClientError("Failed to load uploads summary", error, {
          feature: "uploads",
        });
      }
    };

    void loadUploads();
  }, [enabled]);

  return { uploads, summary, addUpload };
}

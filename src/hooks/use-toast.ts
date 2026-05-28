"use client";

import { useCallback } from "react";
import { toastManager } from "@/components/ui/toast";

type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";
type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

const TOAST_TYPE_BY_VARIANT: Partial<Record<ToastVariant, ToastType>> = {
  destructive: "error",
  info: "info",
  success: "success",
  warning: "warning",
};

export function useToast() {
  const toast = useCallback(
    ({ title, description, variant = "default" }: ToastProps) => {
      toastManager.add({
        type: TOAST_TYPE_BY_VARIANT[variant],
        title,
        description,
      });
    },
    [],
  );

  return { toast };
}

"use client";

import { Search } from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "../ui/input-group";

type SearchShortcutHint = {
  modifier: "Cmd" | "Ctrl";
  key: "K";
};

const searchShortcutInputs = new Set<HTMLInputElement>();
let searchShortcutListenerAttached = false;

function resolveSearchShortcutHint(): SearchShortcutHint | null {
  if (typeof navigator === "undefined") return null;

  const normalizedPlatform = (navigator.platform ?? "").toLowerCase();
  const normalizedUserAgent = (navigator.userAgent ?? "").toLowerCase();

  return /mac|iphone|ipad|ipod/.test(
    `${normalizedPlatform} ${normalizedUserAgent}`,
  )
    ? { modifier: "Cmd", key: "K" }
    : { modifier: "Ctrl", key: "K" };
}

function isVisibleSearchInput(input: HTMLInputElement) {
  return !input.disabled && input.getClientRects().length > 0;
}

function handleSearchShortcut(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
    return;
  }

  const input = Array.from(searchShortcutInputs).find(isVisibleSearchInput);
  if (!input) return;

  event.preventDefault();
  input.focus();
  input.select();
}

function registerSearchShortcutInput(input: HTMLInputElement) {
  searchShortcutInputs.add(input);

  if (!searchShortcutListenerAttached) {
    window.addEventListener("keydown", handleSearchShortcut);
    searchShortcutListenerAttached = true;
  }

  return () => {
    searchShortcutInputs.delete(input);
    if (searchShortcutInputs.size === 0 && searchShortcutListenerAttached) {
      window.removeEventListener("keydown", handleSearchShortcut);
      searchShortcutListenerAttached = false;
    }
  };
}

function SearchShortcutKeys() {
  const [hint, setHint] = useState<SearchShortcutHint | null>(null);

  useEffect(() => {
    setHint(resolveSearchShortcutHint());
  }, []);

  if (!hint) return null;

  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <kbd className="inline-flex h-6 items-center rounded-md border border-border/60 bg-background/90 px-1.5 font-medium font-sans text-[11px] leading-none shadow-[0_1px_1px_rgba(15,23,42,0.04)]">
        {hint.modifier}
      </kbd>
      <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/60 bg-background/90 px-1.5 font-medium font-sans text-[11px] leading-none shadow-[0_1px_1px_rgba(15,23,42,0.04)]">
        {hint.key}
      </kbd>
    </span>
  );
}

export function FiltersBar({
  className,
  children,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FiltersBarSearch({
  className,
  inputClassName,
  endAddon,
  value,
  defaultValue,
  name,
  autoComplete,
  inputMode,
  onChange,
  placeholder,
  ariaLabel,
  inputRef,
  enableShortcut = true,
  showShortcutHint = true,
  type = "search",
}: {
  className?: string;
  inputClassName?: string;
  endAddon?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  name?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange?: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  enableShortcut?: boolean;
  showShortcutHint?: boolean;
  type?: React.HTMLInputTypeAttribute;
}) {
  const ownInputRef = useRef<HTMLInputElement | null>(null);
  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      ownInputRef.current = node;

      if (typeof inputRef === "function") {
        inputRef(node);
      } else if (inputRef) {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current =
          node;
      }
    },
    [inputRef],
  );

  useEffect(() => {
    if (!enableShortcut || !ownInputRef.current) return;
    return registerSearchShortcutInput(ownInputRef.current);
  }, [enableShortcut]);

  const resolvedEndAddon =
    endAddon !== undefined ? (
      endAddon
    ) : enableShortcut && showShortcutHint ? (
      <SearchShortcutKeys />
    ) : null;

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>
            <Search className="h-4 w-4" />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          ref={setInputRef}
          aria-label={ariaLabel}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          inputMode={inputMode}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          type={type}
          className={inputClassName}
        />
        {resolvedEndAddon ? (
          <InputGroupAddon align="inline-end">
            {resolvedEndAddon}
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  );
}

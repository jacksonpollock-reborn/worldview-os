"use client";

import { formatDateTime } from "@/lib/utils";

type LocalDateTimeProps = {
  value: Date | string;
  className?: string;
};

export function LocalDateTime({ value, className }: LocalDateTimeProps) {
  const isoValue = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  const timeZone =
    typeof window === "undefined"
      ? null
      : Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatted = formatDateTime(isoValue, {
    timeZone: timeZone || "UTC",
  });
  const title = timeZone
    ? `Shown in your local timezone: ${timeZone}`
    : "Loading your local timezone. Falling back to UTC until the page hydrates.";

  return (
    <time
      dateTime={isoValue}
      title={title}
      className={className}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
}

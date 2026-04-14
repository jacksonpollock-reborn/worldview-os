import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type FormatDateTimeOptions = {
  locale?: string;
  timeZone?: string;
  timeZoneName?: "short" | "long" | "shortOffset" | "longOffset";
};

export function formatDateTime(
  value: Date | string,
  options: FormatDateTimeOptions = {},
) {
  const date = value instanceof Date ? value : new Date(value);
  const { locale = "en-US", timeZone, timeZoneName = "short" } = options;

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
    ...(timeZoneName ? { timeZoneName } : {}),
  }).format(date);
}

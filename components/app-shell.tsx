import Link from "next/link";
import { cn } from "@/lib/utils";

type AppShellProps = {
  active: "ask" | "history" | "settings" | "analysis";
  eyebrow: string;
  title: string;
  description: string;
  compactHeader?: boolean;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { href: "/", label: "Ask", key: "ask" },
  { href: "/history", label: "History", key: "history" },
  { href: "/settings", label: "Settings", key: "settings" },
] as const;

export function AppShell({
  active,
  eyebrow,
  title,
  description,
  compactHeader = false,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-[rgba(243,241,235,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
              Worldview OS
            </Link>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Structured question analysis
            </p>
          </div>
          <nav className="flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1 shadow-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium transition",
                  active === item.key
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className={cn("mb-8 max-w-3xl", compactHeader && "mb-6 max-w-4xl")}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            {description}
          </p>
        </section>
        {children}
      </main>
    </div>
  );
}

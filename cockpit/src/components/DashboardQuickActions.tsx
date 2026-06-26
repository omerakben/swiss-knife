import Link from "next/link";
import { Reply, ListChecks, FileText, Mail, Smile, CalendarDays, Sparkles, type LucideIcon } from "lucide-react";

import { QUICK_ACTIONS, type QuickAction } from "@/lib/quickActions";

// The marketable hook on the home screen: a few one-click actions a non-technical
// user can use immediately. Each deep-links to the action's form on the Quick
// Actions page. Server component (just links), so it adds no client JS.
const HERO_IDS = ["reply-to-message", "notes-to-list", "summarize", "polite-message", "make-friendlier", "plan-week"];
const ICONS: Record<string, LucideIcon> = { Reply, ListChecks, FileText, Mail, Smile, CalendarDays };

export function DashboardQuickActions() {
  const actions = HERO_IDS.map((id) => QUICK_ACTIONS.find((a) => a.id === id)).filter(
    (a): a is QuickAction => Boolean(a),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</h2>
        <Link href="/tools/quick-actions" className="text-xs text-muted-foreground underline underline-offset-2">
          See all
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {actions.map((a) => {
          const Icon = ICONS[a.icon] ?? Sparkles;
          return (
            <Link
              key={a.id}
              href={`/tools/quick-actions?action=${a.id}`}
              className="group flex items-center gap-2.5 rounded-xl border border-border p-3 transition-[border-color,box-shadow,transform] duration-200 ease-apple hover:border-primary/40 hover:shadow-sm motion-safe:hover:-translate-y-0.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium leading-tight">{a.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

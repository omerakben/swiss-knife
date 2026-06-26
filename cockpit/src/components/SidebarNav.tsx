"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { ExternalLink, Star, ArrowDownAZ, ArrowUpZA, ListFilter, Wrench, ChevronRight } from "lucide-react";

import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "@/lib/nav";
import { usePersisted } from "@/hooks/usePersisted";

const FAV_KEY = "sk:nav:favorites";
const SORT_KEY = "sk:nav:sort";
const PRO_KEY = "sk:nav:professional-open";

export function SidebarNav() {
  const pathname = usePathname();
  const [favJson, setFavJson] = usePersisted(FAV_KEY, "[]");
  const [sort, setSort] = usePersisted(SORT_KEY, "default");
  const [proOpen, setProOpen] = usePersisted(PRO_KEY, "false");

  const favorites = useMemo(() => {
    try {
      const a = JSON.parse(favJson);
      return new Set<string>(Array.isArray(a) ? a : []);
    } catch {
      return new Set<string>();
    }
  }, [favJson]);

  function toggleFav(href: string) {
    const next = new Set(favorites);
    if (next.has(href)) next.delete(href);
    else next.add(href);
    setFavJson(JSON.stringify([...next]));
  }

  function cycleSort() {
    setSort(sort === "default" ? "az" : sort === "az" ? "za" : "default");
  }

  const applySort = (items: NavItem[]) => {
    if (sort === "default") return items;
    const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label));
    return sort === "za" ? sorted.reverse() : sorted;
  };

  const favItems = NAV_ITEMS.filter((i) => favorites.has(i.href));
  const rest = NAV_ITEMS.filter((i) => !favorites.has(i.href));
  // Grouped rendering: Dashboard stays ungrouped on top; A-Z sort applies
  // WITHIN each group (so sorting can't shuffle Dashboard between tools).
  const ungrouped = rest.filter((i) => !i.group);
  // Each group splits into everyday tools (shown inline) and professional QA/dev
  // tools (tucked behind a collapsible "Professional" disclosure, collapsed by
  // default). A favorited pro tool still floats up to Favorites above.
  // `proOpen` is deliberately ONE global switch ("show professional tools"), not
  // per-group — today only the Packs group carries pro items; if another group
  // ever does, the single toggle reveals both, which is the intended semantics.
  const groups = NAV_GROUPS.map((g) => {
    const items = applySort(rest.filter((i) => i.group === g.id));
    return { ...g, regular: items.filter((i) => !i.professional), pro: items.filter((i) => i.professional) };
  }).filter((g) => g.regular.length > 0 || g.pro.length > 0);
  const hasFavs = favItems.length > 0;
  const isProOpen = proOpen === "true";

  function renderItem(t: NavItem) {
    const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
    const Icon = t.icon;
    const fav = favorites.has(t.href);
    return (
      <div
        key={t.href}
        className={"group flex items-center rounded-lg transition-colors " + (active ? "bg-primary/10" : "hover:bg-accent/60")}
      >
        <Link
          href={t.href}
          aria-current={active ? "page" : undefined}
          className={
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset " +
            (active ? "font-medium text-brand" : "text-foreground/70 group-hover:text-foreground")
          }
        >
          <Icon
            className={"h-4 w-4 shrink-0 " + (active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")}
          />
          <span className="truncate">{t.label}</span>
        </Link>
        <button
          onClick={() => toggleFav(t.href)}
          aria-label={fav ? `Unfavorite ${t.label}` : `Favorite ${t.label}`}
          title={fav ? "Unfavorite" : "Favorite"}
          className={
            "mr-1 shrink-0 rounded p-1 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 " +
            (fav
              ? "text-yellow-500"
              : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100")
          }
        >
          <Star className={"h-3.5 w-3.5 " + (fav ? "fill-current" : "")} />
        </button>
      </div>
    );
  }

  const sortTitle = sort === "az" ? "Sorted A–Z" : sort === "za" ? "Sorted Z–A" : "Default order";

  return (
    <div className="flex flex-col gap-0.5">
      {hasFavs && (
        <>
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Favorites
          </div>
          {favItems.map(renderItem)}
          <div className="my-1 border-t border-border/60" />
        </>
      )}

      <div className="flex items-center justify-between px-2.5 pb-0.5 pt-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {hasFavs ? "Tools" : "Menu"}
        </span>
        <button
          onClick={cycleSort}
          title={`${sortTitle} — click to change`}
          aria-label={sortTitle}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {sort === "az" ? (
            <ArrowDownAZ className="h-3.5 w-3.5" />
          ) : sort === "za" ? (
            <ArrowUpZA className="h-3.5 w-3.5" />
          ) : (
            <ListFilter className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {ungrouped.map(renderItem)}
      {groups.map((g) => (
        <div key={g.id} className="mt-1">
          <div className="px-2.5 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {g.label}
          </div>
          {g.regular.map(renderItem)}
          {g.pro.length > 0 && (
            <>
              <button
                onClick={() => setProOpen(isProOpen ? "false" : "true")}
                aria-expanded={isProOpen}
                title={isProOpen ? "Hide professional tools" : "Show professional QA & dev tools"}
                className="group mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
              >
                <Wrench className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <span className="truncate">Professional</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  {g.pro.length}
                  <ChevronRight className={"h-3.5 w-3.5 transition-transform " + (isProOpen ? "rotate-90" : "")} />
                </span>
              </button>
              {isProOpen && g.pro.map(renderItem)}
            </>
          )}
        </div>
      ))}

      <a
        href={process.env.NEXT_PUBLIC_OWUI_URL ?? "http://localhost:4142"}
        target="_blank"
        rel="noreferrer"
        className="group mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span className="truncate">Open WebUI</span>
      </a>
    </div>
  );
}

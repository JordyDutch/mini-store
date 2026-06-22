"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import {
  App,
  categories as appCategories,
  getPrimaryCategory,
  sortByOpenCount,
} from "@/data/appCatalog";
import BookmarkButton from "@/components/BookmarkButton";
import { buildAppBookmark } from "@/lib/bookmarks";

interface TopChartsSliderProps {
  apps: App[];
  onAppClick: (app: App) => void;
  /**
   * Global open counts ({ [appId]: count }). When provided, rows rank
   * most-opened first within the active category. Empty/undefined falls back to
   * the incoming order, so SSR/first render stays stable (see useTrending).
   */
  trendingCounts?: Record<string, number>;
}

type ChartFilter = string;

const PRIORITY_CATEGORIES = [
  "DeFi",
  "Staking",
  "NFTs",
  "Marketplaces",
  "Community",
  "Social",
  "Infrastructure",
  "Exchanges",
];

export default function TopChartsSlider({
  apps,
  onAppClick,
  trendingCounts,
}: TopChartsSliderProps) {
  const [activeFilter, setActiveFilter] = useState<ChartFilter>("DeFi");
  const reduceMotion = useReducedMotion();
  const filterOptions = useMemo(() => {
    const counts = new Map<string, number>();

    apps.forEach((app) => {
      app.categories.forEach((category) => {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      });
    });

    return Object.values(appCategories)
      .map((category) => ({
        id: category.id,
        label: category.displayName,
        count: counts.get(category.id) ?? 0,
      }))
      .filter((category) => category.count > 0)
      .sort((a, b) => {
        const aPriority = PRIORITY_CATEGORIES.indexOf(a.id);
        const bPriority = PRIORITY_CATEGORIES.indexOf(b.id);

        if (aPriority !== -1 || bPriority !== -1) {
          return (
            (aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority) -
            (bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority)
          );
        }

        return a.label.localeCompare(b.label);
      });
  }, [apps]);

  if (!apps || apps.length === 0) {
    return null;
  }

  // The default filter ("DeFi") may not exist in the current catalog; fall back
  // to the first available category so the table never opens on an empty tab.
  const effectiveFilter = filterOptions.some((filter) => filter.id === activeFilter)
    ? activeFilter
    : filterOptions[0]?.id ?? "";

  // Rank most-opened first within the active category; ties keep incoming order.
  const filteredApps = sortByOpenCount(
    apps.filter((app) => app.categories.includes(effectiveFilter)),
    trendingCounts ?? {}
  );
  const activeLabel =
    filterOptions.find((filter) => filter.id === effectiveFilter)?.label ?? effectiveFilter;

  return (
    <div>
      {/* Segmented category filter (the section heading is owned by the parent
          DiscoverSection). A set of toggle buttons, not tabs — there are no
          tabpanels — so we use aria-pressed. */}
      <div
        className="seg-track mb-5 max-w-full overflow-x-auto"
        role="group"
        aria-label="Filter trending apps by category"
      >
        <div className="flex min-w-max gap-1">
          {filterOptions.map((filter) => {
            const isActive = effectiveFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveFilter(filter.id)}
                className={`relative min-h-[44px] min-w-[88px] rounded-full px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isActive ? "text-brand-text" : "text-text-secondary hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="top-charts-pill"
                    className="absolute inset-0 rounded-full bg-card shadow-rest"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 380, damping: 32 }
                    }
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {filter.label}
                  <span className="text-xs tabular-nums text-text-secondary">
                    {filter.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Announce the active category + result count to assistive tech */}
      <p className="sr-only" role="status" aria-live="polite">
        {activeLabel}: {filteredApps.length}{" "}
        {filteredApps.length === 1 ? "app" : "apps"}
      </p>

      {/* Ranked rows — solid content card, no glass (data-dense) */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-rest">
        {filteredApps.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-secondary">
            No apps in this category yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredApps.map((app, index) => {
              const rank = index + 1;
              const isTop = rank === 1;
              return (
                <motion.li
                  key={app.id}
                  className="relative"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.28,
                          delay: Math.min(index, 11) * 0.04,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                >
                  <button
                    type="button"
                    onClick={() => onAppClick(app)}
                    aria-label={`View ${app.app.name}, ranked number ${rank} in ${
                      activeLabel
                    }`}
                    className="group relative flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-5"
                  >
                    {/* Pink accent bar on #1 */}
                    {isTop && (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand-gradient-soft"
                      />
                    )}

                    {/* Rank numeral */}
                    <span
                      aria-hidden
                      className={`w-7 flex-shrink-0 text-center font-display text-lg font-bold tabular-nums sm:w-8 sm:text-xl ${
                        isTop ? "text-brand-text" : "text-text-tertiary"
                      }`}
                    >
                      {rank}
                    </span>

                    {/* Squircle icon */}
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-muted shadow-rest">
                      <Image
                        src={app.icon || ""}
                        alt={`${app.app.name} icon`}
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    </div>

                    {/* Name + category */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate text-[15px] font-medium text-foreground">
                        {app.app.name}
                      </h3>
                      <p className="truncate text-[13px] text-text-secondary">
                        {getPrimaryCategory(app)}
                      </p>
                    </div>

                    {/* Chevron affordance */}
                    <ChevronRight
                      aria-hidden
                      className="h-5 w-5 flex-shrink-0 text-text-tertiary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text-secondary"
                    />
                  </button>
                  <BookmarkButton
                    bookmark={buildAppBookmark(app)}
                    className="absolute right-11 top-1/2 z-10 -translate-y-1/2 sm:right-12"
                  />
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

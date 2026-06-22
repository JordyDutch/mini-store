"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { App, getPrimaryCategory } from "@/data/appCatalog";
import BookmarkButton from "@/components/BookmarkButton";
import { buildAppBookmark } from "@/lib/bookmarks";

interface AppSliderProps {
  title: string;
  apps: App[];
  onAppClick: (app: App) => void;
  /**
   * Accessible name for the rail. On the discover home the surrounding
   * DiscoverSection owns the visible heading, so the rail itself gets no visible
   * title (title="") — pass ariaLabel so the section is still labelled.
   */
  ariaLabel?: string;
  /** Overline shown only when this rail renders its own header (title set). */
  eyebrow?: string;
}

/**
 * AppSlider — a horizontal scroll-snap rail of polished glass app tiles.
 *
 * Presentation-only: tapping a tile fires onAppClick (the app's detail/launch
 * route is owned by the parent). Light by default with a matching dark mode via
 * shared design-system tokens. Tasteful entrance/hover/press motion, gated on
 * prefers-reduced-motion. Returns null when there is nothing to show.
 */
export default function AppSlider({
  title,
  apps,
  onAppClick,
  ariaLabel,
  eyebrow = "Discover",
}: AppSliderProps) {
  const reduceMotion = useReducedMotion();

  if (!apps || apps.length === 0) {
    return null;
  }

  return (
    <section aria-label={ariaLabel || title || undefined}>
      {/* Self-owned header only when this rail provides its own title. On the
          discover home the parent DiscoverSection owns the heading + See all, so
          title="" and this block is skipped entirely (no stray eyebrow). */}
      {title && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow mb-1">{eyebrow}</p>
            <h2 className="section-h2 truncate">{title}</h2>
          </div>

          <Link
            href="/search"
            aria-label="See all apps"
            className="group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-brand-text transition hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See all
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}

      {/* Rail: native scroll-snap + right-edge mask to signal overflow */}
      <div
        className="relative -mx-4 sm:-mx-6"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 40px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 40px), transparent 100%)",
        }}
      >
        <ul
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6"
        >
          {apps.map((app, index) => {
            const name = app.app?.name ?? app.developer ?? "App";
            const category = getPrimaryCategory(app);
            return (
              <motion.li
                key={app.id ?? `${name}-${index}`}
                className="relative snap-start"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.28,
                  ease: [0.22, 1, 0.36, 1],
                  delay: reduceMotion ? 0 : Math.min(index, 11) * 0.04,
                }}
              >
                <motion.button
                  type="button"
                  onClick={() => onAppClick(app)}
                  aria-label={category ? `View ${name}, ${category}` : `View ${name}`}
                  whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="group flex w-[148px] flex-col items-start gap-3 rounded-xl p-3 text-left transition-shadow hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-[164px]"
                >
                  {/* Glass tile holding the squircle app icon */}
                  <div className="glass relative aspect-square w-full overflow-hidden rounded-2xl">
                    <div className="absolute inset-2 overflow-hidden rounded-[14px] bg-card shadow-rest">
                      {app.icon ? (
                        <Image
                          src={app.icon}
                          alt={`${name} icon`}
                          fill
                          sizes="(max-width: 640px) 132px, 148px"
                          className="object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="flex h-full w-full items-center justify-center bg-brand-gradient-soft text-lg font-semibold text-white"
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full px-0.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {name}
                    </p>
                    {category ? (
                      <p className="mt-0.5 truncate text-xs text-text-secondary">
                        {category}
                      </p>
                    ) : null}
                  </div>
                </motion.button>
                <BookmarkButton
                  bookmark={buildAppBookmark(app)}
                  className="absolute right-4 top-4 z-10 h-8 w-8"
                />
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

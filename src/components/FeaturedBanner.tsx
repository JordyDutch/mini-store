"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight, Pause, Play, PlusCircle } from "lucide-react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import {
  FeaturedApp,
  featuredApps,
  getPrimaryCategory,
} from "@/data/appCatalog";
import { useAppLaunch } from "@/hooks/useAppLaunch";
import { useGrid } from "@/app/components/providers/gridProvider";
import { cn } from "@/lib/utils";
import GridSelectionDialog from "./GridSelectionDialog";
import BookmarkButton from "@/components/BookmarkButton";
import { buildAppBookmark } from "@/lib/bookmarks";

const AUTOPLAY_DWELL_MS = 6500;

interface FeaturedBannerProps {
  apps?: FeaturedApp[];
  onAppClick: (app: FeaturedApp) => void;
}

export default function FeaturedBanner({
  apps: slides = featuredApps,
  onAppClick,
}: FeaturedBannerProps) {
  const reduceMotion = useReducedMotion();
  const { sections } = useGrid();
  const {
    canInstallToGrid,
    getPrimaryAction,
    openApp,
    isInstalling,
    pendingApp,
    showGridSelection,
    setShowGridSelection,
    handleGridSelect,
    handleGridSelectionCancel,
  } = useAppLaunch();

  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(slides.length);
  // userPaused = explicit pause toggle; interacting = transient hover/focus.
  const [userPaused, setUserPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const slideSignature = useMemo(
    () => slides.map((app) => app.id ?? app.app.name).join("|"),
    [slides]
  );

  useEffect(() => {
    setSlideCount(slides.length);
    setSelectedIndex(0);
  }, [slides.length, slideSignature]);

  useEffect(() => {
    if (!api) return;

    const syncCarouselState = () => {
      setSlideCount(api.scrollSnapList().length);
      setSelectedIndex(api.selectedScrollSnap());
    };

    api.reInit();
    api.scrollTo(0);
    syncCarouselState();
    api.on("select", syncCarouselState);
    api.on("reInit", syncCarouselState);

    return () => {
      api.off("select", syncCarouselState);
      api.off("reInit", syncCarouselState);
    };
  }, [api, slideSignature]);

  // Auto-advance, gently. Pauses on reduced-motion, single slide, explicit
  // pause, hover/focus, or a hidden tab (WCAG 2.2.2 — see the Pause control).
  const autoplayEnabled =
    !reduceMotion && slideCount > 1 && !userPaused && !interacting;

  useEffect(() => {
    if (!api || !autoplayEnabled) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        api.scrollNext();
      }
    }, AUTOPLAY_DWELL_MS);

    return () => window.clearInterval(intervalId);
  }, [api, autoplayEnabled]);

  const handleDotClick = useCallback(
    (index: number) => api?.scrollTo(index),
    [api]
  );

  const activeTitle = slides[selectedIndex]?.title;

  return (
    <div
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={() => setInteracting(false)}
    >
      <Carousel
        className="w-full touch-pan-y"
        opts={{ align: "start", loop: true }}
        setApi={setApi}
      >
        <CarouselContent className="items-stretch">
          {slides.map((app, index) => {
            const primary = getPrimaryAction(app);
            const category = getPrimaryCategory(app);
            const installingThis = isInstalling && pendingApp?.id === app.id;

            return (
              <CarouselItem
                key={app.id ?? index}
                aria-label={`${app.title} (${index + 1} of ${slides.length})`}
                className="h-[clamp(19rem,46vh,26rem)] basis-[88%] sm:basis-full"
              >
                <div className="group relative isolate h-full overflow-hidden rounded-xl">
                  {/* Catalog art backdrop */}
                  <div className="absolute inset-0 -z-10">
                    <Image
                      src={app.banner}
                      alt=""
                      aria-hidden="true"
                      fill
                      priority={index === 0}
                      sizes="(max-width: 1024px) 100vw, 1200px"
                      className={cn(
                        "object-cover transition-transform duration-700 ease-out",
                        !reduceMotion && "group-hover:scale-[1.04]"
                      )}
                    />
                    {/* Brand wash + legibility scrim layered over art. The dark
                        scrim is image-independent black so white text always
                        clears AA regardless of how bright the artwork is. */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-brand/35 via-transparent to-brand-2/25 mix-blend-multiply" />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/45 to-foreground/10 dark:from-black/85 dark:via-black/55 dark:to-black/10" />
                  </div>

                  {/* Ambient brand glow */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 -z-10 h-2/3 bg-glow-ambient",
                      !reduceMotion && "animate-glow-drift"
                    )}
                  />

                  {/* Clickable hero surface */}
                  <button
                    type="button"
                    onClick={() => onAppClick(app)}
                    aria-label={`View details for ${app.title}`}
                    className="absolute inset-0 z-10 w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset"
                  />

                  <BookmarkButton
                    bookmark={buildAppBookmark(app)}
                    onMedia
                    className="absolute right-4 top-4 z-30"
                  />

                  <div className="pointer-events-none relative z-20 flex h-full w-full flex-col justify-end gap-5 p-6 text-left sm:p-8">
                    {/* Category pill — the band's "Featured" heading is owned by
                        the surrounding section, so this slot surfaces context. */}
                    {category && (
                      <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-white backdrop-blur-sm">
                        {category}
                      </span>
                    )}

                    {/* Identity row: icon + name */}
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/30 bg-white/10 shadow-glass backdrop-blur-md sm:h-20 sm:w-20">
                        <Image
                          src={app.icon ?? ""}
                          alt={`${app.app.name} icon`}
                          fill
                          sizes="80px"
                          className="object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
                          {app.title}
                        </p>
                        <p className="mt-1 truncate text-sm font-medium text-white/85">
                          {app.app.name}
                        </p>
                      </div>
                    </div>

                    {/* Context-aware actions */}
                    <div className="pointer-events-auto flex flex-wrap items-center gap-3">
                      {primary.kind === "install" ? (
                        <>
                          <ActionButton
                            label={installingThis ? "Adding…" : primary.label}
                            icon={<PlusCircle className="h-4 w-4" aria-hidden="true" />}
                            loading={installingThis}
                            onClick={(e) => {
                              e.stopPropagation();
                              primary.run(app);
                            }}
                            ariaLabel={`${primary.label}: ${app.title}`}
                          />
                          {/* Secondary Open while in grid context */}
                          <ActionButton
                            label="Open"
                            icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              openApp(app);
                            }}
                            ariaLabel={`Open ${app.title}`}
                          />
                        </>
                      ) : (
                        <ActionButton
                          label={primary.label}
                          icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            primary.run(app);
                          }}
                          ariaLabel={`${primary.label} ${app.title}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Controls: pause/play + slide dots */}
      {slideCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {!reduceMotion && (
            <Button
              type="button"
              variant="glass"
              size="icon"
              className="h-9 w-9 min-h-[44px] min-w-[44px]"
              aria-label={
                userPaused
                  ? "Resume automatic slideshow"
                  : "Pause automatic slideshow"
              }
              onClick={() => setUserPaused((paused) => !paused)}
            >
              {userPaused ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}

          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Choose featured app"
          >
            {Array.from({ length: slideCount }).map((_, i) => {
              const active = i === selectedIndex;
              return (
                <button
                  key={i}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  aria-label={`Go to featured app ${i + 1}`}
                  onClick={() => handleDotClick(i)}
                  className="flex h-11 min-h-[44px] w-6 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span
                    className={cn(
                      "block rounded-full transition-all duration-300",
                      active
                        ? "h-2 w-6 bg-brand"
                        : "h-2 w-2 bg-text-tertiary hover:bg-text-secondary"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active slide announcement for assistive tech */}
      <p className="sr-only" role="status" aria-live="polite">
        {activeTitle
          ? `Showing ${activeTitle}, ${selectedIndex + 1} of ${slideCount}`
          : ""}
      </p>

      {/* Grid Selection Dialog (grid install path) */}
      {canInstallToGrid && (
        <GridSelectionDialog
          open={showGridSelection}
          onOpenChange={setShowGridSelection}
          sections={sections}
          appName={pendingApp?.app?.name ?? "App"}
          onGridSelect={handleGridSelect}
          onCancel={handleGridSelectionCancel}
        />
      )}
    </div>
  );
}

/* ---- Local hero action button — glass-on-media, always white text ---- */

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
}

function ActionButton({
  label,
  icon,
  ariaLabel,
  onClick,
  loading = false,
}: ActionButtonProps) {
  return (
    <Button
      type="button"
      size="pill"
      variant="glass"
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={loading}
      onClick={onClick}
      // Sits on a dark image scrim in BOTH themes, so it stays white-on-media
      // rather than using the theme-aware glass-light variant (which would be
      // dark text in light mode). The Button variant supplies the press motion.
      className="border border-white/40 bg-white/15 font-semibold text-white backdrop-blur-md hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      <span>{label}</span>
    </Button>
  );
}

"use client";

import { useMemo } from "react";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Loader2, Plus, Search } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { App, getAppsByCategory, getPrimaryCategory, Category } from "../data/appCatalog";
import GridSelectionDialog from "./GridSelectionDialog";
import BookmarkButton from "@/components/BookmarkButton";
import { buildAppBookmark } from "@/lib/bookmarks";
import { useAppLaunch } from "@/hooks/useAppLaunch";
import { useGrid } from "@/app/components/providers/gridProvider";

interface CategoryDetailProps {
  category: Category;
  onBack: () => void;
  onAppClick: (app: App) => void;
}

export default function CategoryDetail({ category, onBack, onAppClick }: CategoryDetailProps) {
  const reduceMotion = useReducedMotion();
  const { sections } = useGrid();

  const apps = useMemo(() => getAppsByCategory(category.id), [category.id]);

  const {
    canInstallToGrid,
    getPrimaryAction,
    isInstalling,
    isUninstalling,
    isInstalled,
    pendingApp,
    showGridSelection,
    setShowGridSelection,
    handleGridSelect,
    handleGridSelectionCancel,
  } = useAppLaunch();

  // Detail navigation is owned by the parent via onAppClick bubbling; this
  // component only surfaces the category list and then hands off.
  const handleAppSelection = (app: App) => {
    if (typeof window !== "undefined") window.scrollTo(0, 0);
    onAppClick(app);
  };

  const title = category.displayName || category.name;
  const count = apps.length;

  // Stagger only the first batch; reduced-motion gets static rows.
  const rowVariants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 8 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: reduceMotion ? 0 : Math.min(i, 11) * 0.04,
        duration: reduceMotion ? 0.12 : 0.28,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    }),
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* Ambient bloom behind the header */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-72 bg-glow-ambient ${
          reduceMotion ? "" : "animate-glow-drift"
        }`}
      />

      {/* Sticky chrome */}
      <header className="glass-nav sticky top-0 z-20 pt-safe">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <button
            onClick={onBack}
            aria-label="Go back"
            className="btn-glass flex-shrink-0"
            type="button"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <p className="eyebrow truncate">Category</p>
            <h1 className="truncate font-display text-base font-semibold leading-tight sm:text-lg">
              {title}
            </h1>
          </div>
        </div>
      </header>

      {/* App list */}
      <main className="relative z-10 mx-auto w-full max-w-[1200px] flex-1 px-4 pt-6 pb-safe-content sm:px-6 sm:pt-8">
        <div className="mb-4 flex items-baseline justify-between gap-3 px-1">
          <h2 className="font-display text-2xl font-bold tracking-[-0.02em] sm:text-3xl">{title}</h2>
          <p className="flex-shrink-0 text-[13px] text-text-secondary">
            {count} {count === 1 ? "app" : "apps"}
          </p>
        </div>

        {count > 0 ? (
          <ul className="flex flex-col gap-3">
            {apps.map((app, i) => {
              const key = app.id ?? `${app.app.name}-${i}`;
              const installed = isInstalled(app);
              const primary = getPrimaryAction(app);
              const isInstallAction = primary.kind === "install";
              const busy = installed ? isUninstalling : isInstalling;
              const isPending = pendingApp?.id === app.id;
              const developer = app.developer || app.publisherProfile;
              const primaryCategory = getPrimaryCategory(app);

              return (
                <motion.li
                  key={key}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAppSelection(app)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleAppSelection(app);
                      }
                    }}
                    aria-label={`View ${app.app.name}`}
                    className="group relative flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-rest transition
                      hover:-translate-y-0.5 hover:shadow-hover focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4"
                  >
                    {/* Squircle icon */}
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                      {app.icon ? (
                        <Image
                          src={app.icon}
                          alt={`${app.app.name} icon`}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand-gradient-soft text-base font-semibold text-white">
                          {app.app.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-medium leading-snug text-foreground">
                        {app.app.name}
                      </h3>
                      <p className="truncate text-[13px] text-text-secondary">{developer}</p>
                      {primaryCategory ? (
                        <span className="chip mt-1.5">{primaryCategory}</span>
                      ) : null}
                    </div>

                    {/* Per-row action: Open primary; Add-to-Grid only when grid install available */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        primary.run(app);
                      }}
                      disabled={busy}
                      aria-label={`${primary.label} ${app.app.name}`}
                      className={`relative flex-shrink-0 inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4
                        text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                        focus-visible:ring-offset-background
                        ${
                          isInstallAction
                            ? "bg-brand text-primary-foreground shadow-brand hover:bg-brand-hover"
                            : "border border-border-strong bg-transparent text-foreground hover:bg-muted"
                        }`}
                    >
                      {busy && isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          <span>Working</span>
                        </>
                      ) : isInstallAction ? (
                        <>
                          <Plus className="h-4 w-4" aria-hidden />
                          <span>{primary.label}</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4" aria-hidden />
                          <span>{primary.label}</span>
                        </>
                      )}
                    </button>
                    <BookmarkButton
                      bookmark={buildAppBookmark(app)}
                      className="h-9 w-9 flex-shrink-0"
                    />
                  </div>
                </motion.li>
              );
            })}
          </ul>
        ) : (
          /* Empty state */
          <div className="content-card mx-auto mt-6 flex max-w-md flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-text-tertiary">
              <Search className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-semibold">No apps in {title} yet</h3>
              <p className="text-[15px] text-text-secondary">
                This category is empty right now. Check back soon or explore other categories.
              </p>
            </div>
            <button onClick={onBack} className="btn-ghost-outline mt-1" type="button">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to store
            </button>
          </div>
        )}
      </main>

      {/* Grid selection dialog — only reachable when grid install is available */}
      {canInstallToGrid && (
        <GridSelectionDialog
          open={showGridSelection}
          onOpenChange={setShowGridSelection}
          sections={sections}
          appName={pendingApp?.app.name ?? "App"}
          onGridSelect={handleGridSelect}
          onCancel={handleGridSelectionCancel}
        />
      )}
    </div>
  );
}

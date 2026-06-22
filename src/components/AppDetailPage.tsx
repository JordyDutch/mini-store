"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  X,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Plus,
  Loader2,
  BadgeCheck,
  Code2,
  LayoutGrid,
  Bookmark,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import { App } from "@/data/appCatalog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Wordmark } from "@/components/Wordmark";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { client as apolloClient } from "@/app/components/apollo/apolloClient";
import { useGrid } from "@/app/components/providers/gridProvider";
import { useAppLaunch } from "@/hooks/useAppLaunch";
import { GET_UNIVERSAL_PROFILE } from "@/app/components/apollo/query";
import GridSelectionDialog from "./GridSelectionDialog";
import BookmarkButton from "@/components/BookmarkButton";
import { buildAppBookmark, buildProfileBookmark } from "@/lib/bookmarks";

// Helper function to convert IPFS URL to HTTP URL
const convertIpfsUrl = (url: string): string => {
  if (!url) return "";

  // Check if it's an IPFS URL
  if (url.startsWith("ipfs://")) {
    // Extract the CID (content identifier)
    const cid = url.replace("ipfs://", "");
    // Return the gateway URL
    return `https://api.universalprofile.cloud/ipfs/${cid}`;
  }

  return url;
};

// Interfaces for universal profile
interface ProfileLink {
  title: string;
  url: string;
}

interface ProfileImage {
  url: string;
}

interface BackgroundImage {
  url: string;
  width: number;
  height: number;
  verified: boolean;
  method: string;
  data: string;
}

interface FollowerProfile {
  id: string;
  name: string;
  description: string;
  tags: string[];
  links: ProfileLink[];
  backgroundImages: BackgroundImage[];
  profileImages: ProfileImage[];
}

interface Following {
  followee: FollowerProfile;
}

interface Followed {
  follower: FollowerProfile;
}

interface LSP5Asset {
  asset: {
    id: string;
  };
}

interface LSP12Asset {
  asset: {
    id: string;
  };
}

interface UniversalProfileDetails {
  id: string;
  name: string;
  description: string;
  createdTimestamp: string;
  tags: string[];
  links: ProfileLink[];
  backgroundImages: BackgroundImage[];
  profileImages: ProfileImage[];
  lsp5ReceivedAssets: LSP5Asset[];
  lsp12IssuedAssets: LSP12Asset[];
  following: Following[];
  followed: Followed[];
}

interface GetUniversalProfileResponse {
  Profile: UniversalProfileDetails[];
}

interface AppDetailPageProps {
  app: App;
  onBack: () => void;
}

// ---- Motion tokens (gated on prefers-reduced-motion via hook) ----
const EASE_ENTRANCE = [0.22, 1, 0.36, 1] as const;

export default function AppDetailPage({ app, onBack }: AppDetailPageProps) {
  const reduceMotion = useReducedMotion();
  const { sections } = useGrid();
  const [openImageViewer, setOpenImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [publisherData, setPublisherData] =
    useState<UniversalProfileDetails | null>(null);
  const [isLoadingPublisher, setIsLoadingPublisher] = useState(false);

  const {
    canInstallToGrid,
    openApp,
    handleInstall,
    addToGrid,
    getAddToGridUrl,
    isInstalled,
    isInstalling,
    showGridSelection,
    setShowGridSelection,
    pendingWidget,
    handleGridSelect,
    handleGridSelectionCancel,
  } = useAppLaunch();

  const previewImages = app.app.previewImages ?? [];
  const hasScreenshots = previewImages.length > 0;

  useEffect(() => {
    // Fetch profile data if universal profile is available
    if (app.publisherProfile && typeof app.publisherProfile === "string") {
      fetchProfileData(app.publisherProfile);
    }
  }, [app]);

  const fetchProfileData = async (profileId: string) => {
    setIsLoadingPublisher(true);
    try {
      const { data } = await apolloClient.query<GetUniversalProfileResponse>({
        query: GET_UNIVERSAL_PROFILE,
        variables: { profileAddress: profileId },
      });

      if (data && data.Profile && data.Profile.length > 0) {
        const profile = data.Profile[0];
        // Convert IPFS URLs in profile data
        const processedProfile = {
          ...profile,
          profileImages: profile.profileImages?.map((img: ProfileImage) => ({
            ...img,
            url: convertIpfsUrl(img.url),
          })),
          backgroundImages: profile.backgroundImages?.map(
            (img: BackgroundImage) => ({
              ...img,
              url: convertIpfsUrl(img.url),
            })
          ),
        };
        setPublisherData(processedProfile);
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
    } finally {
      setIsLoadingPublisher(false);
    }
  };

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setOpenImageViewer(true);
  };

  const closeLightbox = () => {
    setOpenImageViewer(false);
  };

  const goToPreviousImage = () => {
    if (!hasScreenshots) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? previewImages.length - 1 : prev - 1
    );
  };

  const goToNextImage = () => {
    if (!hasScreenshots) return;
    setCurrentImageIndex((prev) =>
      prev === previewImages.length - 1 ? 0 : prev + 1
    );
  };

  // Handle keyboard navigation (preserved)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!openImageViewer) return;

      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        goToPreviousImage();
      } else if (e.key === "ArrowRight") {
        goToNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openImageViewer, app]);

  // ---- Motion helpers ----
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.42, ease: EASE_ENTRANCE },
    },
  };

  const staggerParent: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.06 },
    },
  };

  const publisherName = publisherData?.name || app?.developer || "Publisher";
  const publisherAvatar =
    publisherData?.profileImages && publisherData.profileImages.length > 0
      ? publisherData.profileImages[0].url
      : app?.icon || "";

  const description = publisherData?.description?.trim()
    ? publisherData.description
    : app.developer
    ? `${app.app.name} is built and maintained by ${app.developer}. Launch it to explore everything it offers inside your Universal Profile ecosystem.`
    : "No description available yet for this app.";

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background text-foreground">
      {/* Ambient brand glow behind the hero (decorative) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] bg-glow-ambient ${
          reduceMotion ? "" : "animate-glow-drift"
        }`}
      />

      {/* Sticky glass header — back affordance + store branding (logo/nav) */}
      <header className="glass-nav sticky top-0 z-30 pt-safe">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
          {/* Brand anchored left, matching the store navbar */}
          <Link
            href="/"
            aria-label="LUKSO UP!Store home"
            className="flex min-w-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wordmark />
          </Link>

          {/* Back + utilities on the right */}
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-11 min-h-[44px] items-center gap-1 rounded-full px-2.5 text-sm font-medium text-text-secondary transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] sm:px-3"
              aria-label="Go back to the store"
              type="button"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
              <span className="hidden sm:inline">Back</span>
            </button>
            <Link
              href="/bookmarks"
              aria-label="Bookmarks"
              className="relative inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-full text-text-secondary transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              <Bookmark className="h-5 w-5" aria-hidden />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <motion.main
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto w-full max-w-[1200px] flex-1 px-4 pb-safe-content pt-6 sm:px-6 sm:pt-8"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          {/* ============ LEFT / MAIN COLUMN ============ */}
          <div className="flex min-w-0 flex-col gap-6">
            {/* ---- App header hero (glass-tinted) ---- */}
            <motion.section
              variants={fadeUp}
              className="glass relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
            >
              {/* Decorative corner sheen — soft brand wash, top-left */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-hero-sheen"
              />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                {/* Squircle icon with a soft brand glow for depth */}
                <div className="relative shrink-0">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-brand/15 blur-2xl"
                  />
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/65 bg-white/35 shadow-glass ring-1 ring-inset ring-white/55 backdrop-blur-xl sm:h-24 sm:w-24">
                    <Image
                      src={app.icon || ""}
                      alt={`${app.app.name} app icon`}
                      fill
                      quality={95}
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
                    {app.app.name}
                  </h1>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 text-brand"
                      aria-hidden
                    />
                    <p className="truncate text-sm font-medium text-text-secondary">
                      {app.developer || "Universal Profile"}
                    </p>
                  </div>

                  {/* Category chips */}
                  {app.categories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {app.categories.map((category) => (
                        <span key={category} className="chip">
                          {category}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ---- Context-aware ACTION — Add to Grid works everywhere ---- */}
              <div className="relative mt-6 flex flex-col gap-2.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    variant="glass-light"
                    size="pill"
                    className="h-12 w-full text-sm font-semibold text-brand-text sm:w-auto sm:flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openApp(app);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    <span>Open App</span>
                  </Button>

                  {canInstallToGrid ? (
                    /* In the UP grid: write LSP28TheGrid directly. */
                    <Button
                      variant="ghost-outline"
                      size="pill"
                      className="h-12 w-full text-sm font-semibold text-brand-text sm:w-auto sm:min-w-[180px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstall(app);
                      }}
                      disabled={isInstalling}
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          <span>Adding…</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" aria-hidden />
                          <span>Add to Grid</span>
                        </>
                      )}
                    </Button>
                  ) : (
                    /* Desktop / standalone: hand off to the universaleverything.io
                       add-widget flow. A real anchor — crawlable and agent-readable. */
                    <Button
                      asChild
                      variant="ghost-outline"
                      size="pill"
                      className="h-12 w-full text-sm font-semibold text-brand-text sm:w-auto sm:min-w-[180px]"
                    >
                      <a
                        href={getAddToGridUrl(app)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Add ${app.app.name} to your Universal Profile Grid on universaleverything.io`}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        <span>Add to Grid</span>
                      </a>
                    </Button>
                  )}

                  <BookmarkButton
                    variant="label"
                    bookmark={buildAppBookmark(app)}
                    className="h-12 w-full text-sm font-semibold text-brand-text sm:w-auto"
                  />
                </div>

                {!canInstallToGrid && (
                  <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      Add to Grid opens universaleverything.io to add this app to
                      your Universal Profile — on desktop or mobile.
                    </span>
                  </p>
                )}
              </div>
            </motion.section>

            {/* ---- Widgets — extra surfaces addable to the Grid ---- */}
            {app.widgets && app.widgets.length > 0 && (
              <motion.section variants={fadeUp}>
                <div className="mb-3">
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    Widgets
                  </h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Add any of {app.developer ? `${app.developer}'s` : "these"}{" "}
                    widgets to your Grid.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {app.widgets.map((widget) => {
                    const installed = isInstalled(app, widget);
                    return (
                      <div
                        key={widget.url}
                        className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-rest"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                            <LayoutGrid
                              className="h-4 w-4 shrink-0 text-brand"
                              aria-hidden
                            />
                            <span className="truncate">{widget.name}</span>
                          </h3>
                          <span
                            className="chip shrink-0 tabular-nums"
                            title="Grid footprint (columns × rows)"
                          >
                            {widget.gridSize.width}×{widget.gridSize.height}
                          </span>
                        </div>
                        {widget.description && (
                          <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-text-secondary">
                            {widget.description}
                          </p>
                        )}
                        <Button
                          variant="glass-light"
                          size="pill"
                          className="mt-3 h-10 w-full text-sm font-medium text-brand-text"
                          disabled={isInstalling || installed}
                          aria-label={
                            installed
                              ? `${widget.name} already on your Grid`
                              : `Add ${widget.name} to your Grid`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            addToGrid(app, widget);
                          }}
                        >
                          {installed ? (
                            <>
                              <BadgeCheck className="h-4 w-4" aria-hidden />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" aria-hidden />
                              <span>Add to Grid</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* ---- Screenshots carousel ---- */}
            {hasScreenshots && (
              <motion.section variants={fadeUp}>
                <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
                  Preview
                </h2>
                <Carousel
                  opts={{
                    align: "start",
                    loop: false,
                    skipSnaps: false,
                    containScroll: "trimSnaps",
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-3 flex flex-row py-1">
                    {previewImages.map((image, index) => (
                      <CarouselItem
                        key={index}
                        className="basis-[160px] shrink-0 pl-3 sm:basis-[180px]"
                      >
                        <button
                          type="button"
                          className="group relative block h-[260px] w-full overflow-hidden rounded-lg border border-border bg-card shadow-rest transition hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[300px]"
                          onClick={() => openLightbox(index)}
                          aria-label={`View ${app.app.name} screenshot ${
                            index + 1
                          } full screen`}
                        >
                          <Image
                            src={image}
                            alt={`${app.app.name} screenshot ${index + 1}`}
                            fill
                            quality={90}
                            sizes="180px"
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            priority={index < 3}
                          />
                        </button>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </motion.section>
            )}

            {/* ---- About (solid surface, no glass for legibility) ---- */}
            <motion.section
              variants={fadeUp}
              className="rounded-lg border border-border bg-card p-5 shadow-rest sm:p-6"
            >
              <h2 className="mb-2 font-display text-lg font-semibold text-foreground">
                About this app
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                {description}
              </p>
            </motion.section>

            {/* ---- Details accordion (source code, grid footprint) ---- */}
            <motion.section
              variants={fadeUp}
              className="overflow-hidden rounded-lg border border-border bg-card px-5 shadow-rest sm:px-6"
            >
              <Accordion
                type="single"
                collapsible
                defaultValue="details"
                className="w-full"
              >
                <AccordionItem value="details" className="border-b-0">
                  <AccordionTrigger className="font-display text-base font-semibold hover:no-underline">
                    Details
                  </AccordionTrigger>
                  <AccordionContent>
                    <dl className="flex flex-col divide-y divide-border">
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-sm text-text-secondary">
                          Grid footprint
                        </dt>
                        <dd className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <LayoutGrid
                            className="h-3.5 w-3.5 text-text-tertiary"
                            aria-hidden
                          />
                          {app.app.defaultGridSize.width} ×{" "}
                          {app.app.defaultGridSize.height}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-sm text-text-secondary">
                          Categories
                        </dt>
                        <dd className="text-sm font-medium text-foreground">
                          {app.categories.join(", ") || "—"}
                        </dd>
                      </div>
                      {app.app.sourceCode && (
                        <div className="flex items-center justify-between py-2.5">
                          <dt className="text-sm text-text-secondary">
                            Source code
                          </dt>
                          <dd>
                            <a
                              href={app.app.sourceCode}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-medium text-brand-text transition hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Code2 className="h-3.5 w-3.5" aria-hidden />
                              View on GitHub
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.section>
          </div>

          {/* ============ RIGHT / SIDEBAR COLUMN ============ */}
          <motion.aside variants={fadeUp} className="flex flex-col gap-6">
            {/* ---- Publisher card ---- */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-rest sm:p-6 lg:sticky lg:top-20">
              <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
                Publisher
              </h2>

              {isLoadingPublisher ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="mb-2 h-5 w-40 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mt-1 flex gap-2">
                    <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
                    <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 shrink-0 border border-border">
                      <AvatarImage
                        src={publisherAvatar}
                        alt={publisherName}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-muted text-text-secondary">
                        {(app?.developer || "UP").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {publisherName}
                      </h3>
                      <p className="mt-0.5 text-xs text-text-tertiary">
                        {publisherData?.followed?.length || 0} follower
                        {(publisherData?.followed?.length || 0) === 1
                          ? ""
                          : "s"}
                      </p>
                      {publisherData?.createdTimestamp && (
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          Joined{" "}
                          {new Date(
                            Number(publisherData.createdTimestamp) * 1000
                          ).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                    </div>

                    {app.publisherProfile && (
                      <BookmarkButton
                        variant="icon"
                        bookmark={buildProfileBookmark(app.publisherProfile, {
                          title: publisherName,
                          icon: publisherAvatar || undefined,
                        })}
                        className="ml-auto shrink-0"
                      />
                    )}
                  </div>

                  {publisherData?.description && (
                    <p className="text-sm leading-relaxed text-text-secondary line-clamp-4">
                      {publisherData.description}
                    </p>
                  )}

                  {/* Links */}
                  {publisherData?.links && publisherData.links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {publisherData.links.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong bg-transparent px-3 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                        >
                          {link.title || "Link"}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      </motion.main>

      {/* Footer — same contribute/guide pointer as the list pages, so a wrong
          detail on this app is one PR away from being fixed. */}
      <Footer />

      {/* ===== Full-screen Image Lightbox (keyboard nav preserved) ===== */}
      <AnimatePresence>
        {openImageViewer && hasScreenshots && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`${app.app.name} screenshots`}
            onClick={closeLightbox}
          >
            <motion.div
              initial={{ scale: reduceMotion ? 1 : 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: reduceMotion ? 1 : 0.96, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_ENTRANCE }}
              className="relative max-h-[85vh] w-auto max-w-[85%] overflow-hidden rounded-xl bg-card shadow-glass"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={closeLightbox}
                className="absolute left-3 top-3 z-50 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full glass text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close screenshot viewer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>

              <div className="relative flex h-full w-full items-center justify-center">
                <Image
                  src={previewImages[currentImageIndex]}
                  alt={`${app.app.name} screenshot ${currentImageIndex + 1}`}
                  className="max-h-[85vh] w-auto object-contain"
                  width={275}
                  height={800}
                  quality={100}
                  priority
                />
              </div>

              {/* Image counter */}
              <div className="absolute bottom-3 left-0 right-0 text-center text-sm font-medium text-card-foreground">
                {currentImageIndex + 1} / {previewImages.length}
              </div>
            </motion.div>

            {/* Navigation arrows */}
            {previewImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPreviousImage();
                  }}
                  className="absolute left-4 top-1/2 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full glass text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Previous image"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNextImage();
                  }}
                  className="absolute right-4 top-1/2 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full glass text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Next image"
                >
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Selection Dialog (wiring preserved through useAppLaunch) */}
      <GridSelectionDialog
        open={showGridSelection}
        onOpenChange={setShowGridSelection}
        sections={sections}
        appName={pendingWidget?.name ?? app.app.name}
        onGridSelect={handleGridSelect}
        onCancel={handleGridSelectionCancel}
      />
    </div>
  );
}

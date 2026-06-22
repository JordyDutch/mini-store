"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ChevronRight } from "lucide-react";

import FeaturedBanner from "./FeaturedBanner";
import AppSlider from "./AppSlider";
import TopChartsSlider from "./TopChartsSlider";
import {
  getAppsByCategory,
  apps,
  featuredApps,
  shuffle,
  App,
} from "@/data/appCatalog";
import { useHydrated } from "@/hooks/useHydrated";
import { useTrending } from "@/hooks/useTrending";

interface ExplorePageProps {
  onAppClick: (app: App) => void;
}

/**
 * Section wrapper: provides the discover-home rhythm (eyebrow overline + H2 +
 * one-line intro) and a tasteful, reduced-motion-gated entrance. Composes the
 * existing child sliders without inlining them.
 */
interface DiscoverSectionProps {
  eyebrow: string;
  /** Section title (H2). Every discover-home section now owns its heading here,
   *  so child components render content only and headers never double up. */
  title?: string;
  intro?: string;
  /** When set, a "See all" link sits opposite the title (e.g. category rails). */
  seeAllHref?: string;
  children: React.ReactNode;
}

function DiscoverSection({
  eyebrow,
  title,
  intro,
  seeAllHref,
  children,
}: DiscoverSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.section
      variants={variants}
      initial="hidden"
      animate="visible"
      className="scroll-mt-24"
    >
      {/* Section header — the single source of eyebrow + title + See all */}
      <header className="mb-4 md:mb-5">
        <p className="eyebrow">{eyebrow}</p>
        {(title || seeAllHref) && (
          <div className="mt-1 flex items-end justify-between gap-4">
            {title && <h2 className="section-h2 min-w-0 truncate">{title}</h2>}
            {seeAllHref && (
              <Link
                href={seeAllHref}
                className="group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-brand-text transition hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                See all
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        )}
        {intro && (
          <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-text-secondary">
            {intro}
          </p>
        )}
      </header>
      {children}
    </motion.section>
  );
}

export default function ExplorePage({ onAppClick }: ExplorePageProps) {
  // Stable, deterministic base lists — identical on the server and the first
  // client render so hydration matches.
  const base = useMemo(() => {
    const recommendedPool = [
      ...getAppsByCategory("Social"),
      ...getAppsByCategory("DeFi"),
    ].filter(
      (app, index, self) => index === self.findIndex((a) => a.id === app.id)
    );

    return {
      defi: getAppsByCategory("DeFi"),
      nfts: getAppsByCategory("NFTs"),
      featured: featuredApps,
      recommendedPool,
      all: Object.values(apps),
    };
  }, []);

  // Global open counts — drives the popularity ranking in Trending. Loads
  // post-mount; {} until then so SSR/first render stays stable.
  const trendingCounts = useTrending();

  // After mount we re-randomize the order once. A fresh mount happens on every
  // full page load, so the store reshuffles on every reload (see useHydrated).
  const hydrated = useHydrated();
  const { defiApps, featuredSlides, recommendedApps, nftApps, allApps } = useMemo(
    () => {
      const order = <T,>(list: T[]) => (hydrated ? shuffle(list) : list);

      return {
        defiApps: order(base.defi),
        nftApps: order(base.nfts),
        // Rotate a handful of featured apps each reload without changing SSR output.
        featuredSlides: order(base.featured).slice(0, 6),
        // Shuffle the pool first, then cap at 6 so which six surface also varies.
        recommendedApps: order(base.recommendedPool).slice(0, 6),
        allApps: order(base.all),
      };
    },
    [hydrated, base]
  );

  return (
    <div className="flex flex-col gap-12 pb-4 md:gap-16">
      {/* Lead-in headline — the editorial top of the discover home */}
      <div>
        <p className="eyebrow">LUKSO UP!Store</p>
        <h1 className="mt-1.5 text-balance font-display text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground md:text-[40px]">
          Discover apps for your{" "}
          <span className="bg-brand-gradient bg-clip-text text-transparent">
            Universal Profile
          </span>
        </h1>
        <p className="mt-2 max-w-prose text-balance text-[15px] leading-relaxed text-text-secondary md:text-[16px]">
          Apps built on LUKSO — open any of them instantly, or add them to your
          grid when you are signed in.
        </p>
      </div>

      {/* Featured — the focal band. FeaturedBanner renders the carousel only;
          DiscoverSection owns the heading like every other section. */}
      <DiscoverSection
        eyebrow="Spotlight"
        title="Featured"
        intro="A rotating mix of standout apps, front and center."
      >
        <FeaturedBanner apps={featuredSlides} onAppClick={onAppClick} />
      </DiscoverSection>

      {/* Trending — social proof. TopChartsSlider renders the filter + table
          only; the heading lives here. */}
      <DiscoverSection
        eyebrow="Trending"
        title="Trending now"
        intro="What the LUKSO community is opening most right now."
      >
        <TopChartsSlider
          apps={allApps}
          onAppClick={onAppClick}
          trendingCounts={trendingCounts}
        />
      </DiscoverSection>

      {/* Recommended rail — curated mix, no category "See all". */}
      <DiscoverSection
        eyebrow="For you"
        title="Recommended"
        intro="A mix of social and finance apps worth a look."
      >
        <AppSlider
          title=""
          ariaLabel="Recommended apps"
          apps={recommendedApps}
          onAppClick={onAppClick}
        />
      </DiscoverSection>

      {/* DeFi rail — category-scoped "See all". */}
      <DiscoverSection
        eyebrow="Finance"
        title="DeFi apps"
        intro="Swap, send and stake LYX without leaving your profile."
        seeAllHref="/search?category=DeFi"
      >
        <AppSlider
          title=""
          ariaLabel="DeFi apps"
          apps={defiApps}
          onAppClick={onAppClick}
        />
      </DiscoverSection>

      {/* NFTs rail — category-scoped "See all". */}
      <DiscoverSection
        eyebrow="Collect"
        title="NFTs & collectibles"
        intro="Mint, swipe and showcase digital assets."
        seeAllHref="/search?category=NFTs"
      >
        <AppSlider
          title=""
          ariaLabel="NFTs & collectibles"
          apps={nftApps}
          onAppClick={onAppClick}
        />
      </DiscoverSection>
    </div>
  );
}
